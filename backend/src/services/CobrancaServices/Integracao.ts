import crypto from "crypto";
import { Transaction } from "sequelize";
import AppError from "../../errors/AppError";
import { chaveMestraDisponivel, cifrar, decifrar } from "../../helpers/Cifra";
import { comConsistencia } from "../../helpers/consistencia/motor";
import CompanyIntegration, {
  AMBIENTES_DE_COBRANCA,
  TIPOS_DE_COBRANCA
} from "../../models/CompanyIntegration";
import FinancialAccount from "../../models/FinancialAccount";
import AsaasProvider from "../BillingServices/AsaasProvider";

/**
 * A integração de cobrança de uma empresa: ler, salvar e montar o provedor.
 *
 * Hoje há um provedor só (Asaas), e a tabela já comporta outros. Quando
 * entrar o segundo, `provedorDa` escolhe pelo `provider` e o resto do sistema
 * não muda -- o contrato é o BillingProvider.
 */

export const PROVEDOR_PADRAO = "asaas";

export const integracaoDaEmpresa = async (
  companyId: number,
  transaction?: Transaction
): Promise<CompanyIntegration | null> =>
  CompanyIntegration.findOne({
    where: { companyId, provider: PROVEDOR_PADRAO },
    transaction
  });

/** Para emitir: precisa estar ligada e ter chave. */
export const integracaoAtiva = async (companyId: number): Promise<CompanyIntegration> => {
  const integracao = await integracaoDaEmpresa(companyId);
  if (!integracao || !integracao.active || !integracao.apiKeyEncrypted) {
    throw new AppError("ERR_INTEGRACAO_INATIVA", 409);
  }
  return integracao;
};

export const provedorDa = (integracao: CompanyIntegration): AsaasProvider =>
  new AsaasProvider({
    chave: decifrar(integracao.apiKeyEncrypted),
    ambiente: integracao.environment === "production" ? "production" : "sandbox"
  });

/** Chave do cliente em Customer.gatewayIds: o id lá muda por ambiente. */
export const chaveDoCliente = (integracao: CompanyIntegration): string =>
  `${integracao.provider}:${integracao.environment}`;

/**
 * O que a tela de configuração recebe. A chave de API nunca: só os quatro
 * últimos caracteres, para saber qual está gravada.
 */
export const paraTela = (integracao: CompanyIntegration | null) => ({
  provider: PROVEDOR_PADRAO,
  environment: integracao?.environment || "sandbox",
  configurada: Boolean(integracao?.apiKeyEncrypted),
  apiKeyHint: integracao?.apiKeyHint || null,
  billingType: integracao?.billingType || "indefinido",
  active: Boolean(integracao?.active),
  accountId: integracao?.accountId || null,
  webhookPath: integracao?.webhookPath || null,
  webhookToken: integracao?.webhookToken || null,
  lastCheckedAt: integracao?.lastCheckedAt || null,
  lastError: integracao?.lastError || null,
  lastWebhookAt: integracao?.lastWebhookAt || null,
  chaveMestraDisponivel: chaveMestraDisponivel()
});

interface Dados {
  environment?: string;
  apiKey?: string;
  billingType?: string;
  accountId?: number | string | null;
  active?: boolean;
}

/**
 * Salva a integração, testando a chave no gateway antes de gravar.
 *
 * Chave nova é sempre testada: gravar uma chave que o Asaas recusa só
 * adiaria o erro para o primeiro boleto, na frente do cliente. Trocar de
 * ambiente exige chave nova, porque a do sandbox não vale na produção (e
 * vice-versa) -- manter a antiga deixaria a integração "ligada" e quebrada.
 *
 * Roda dentro do motor de consistência: ligar sem conta de baixa é recusado
 * ali, com o atalho para resolver.
 */
export const salvarIntegracao = async (
  companyId: number,
  dados: Dados
): Promise<CompanyIntegration> => {
  const atual = await integracaoDaEmpresa(companyId);

  const ambiente = dados.environment ?? atual?.environment ?? "sandbox";
  if (!(AMBIENTES_DE_COBRANCA as readonly string[]).includes(ambiente)) {
    throw new AppError("ERR_INTEGRACAO_AMBIENTE_INVALIDO", 400);
  }

  const tipo = dados.billingType ?? atual?.billingType ?? "indefinido";
  if (!(TIPOS_DE_COBRANCA as readonly string[]).includes(tipo)) {
    throw new AppError("ERR_INTEGRACAO_TIPO_INVALIDO", 400);
  }

  let accountId = atual?.accountId ?? null;
  if (dados.accountId !== undefined) {
    accountId = dados.accountId ? Number(dados.accountId) : null;
    if (accountId) {
      const conta = await FinancialAccount.findOne({
        where: { id: accountId, companyId },
        attributes: ["id", "active"]
      });
      if (!conta) throw new AppError("ERR_NO_ACCOUNT_FOUND", 404);
    }
  }

  const chaveNova = typeof dados.apiKey === "string" ? dados.apiKey.trim() : "";
  const trocouAmbiente = Boolean(atual?.apiKeyEncrypted) && atual?.environment !== ambiente;
  if (trocouAmbiente && !chaveNova) {
    throw new AppError("ERR_INTEGRACAO_TROCA_DE_AMBIENTE_SEM_CHAVE", 400);
  }

  const ativa = dados.active ?? atual?.active ?? false;
  const temChave = Boolean(chaveNova || atual?.apiKeyEncrypted);
  if (ativa && !temChave) throw new AppError("ERR_INTEGRACAO_SEM_CHAVE", 400);

  const campos: Partial<CompanyIntegration> = {
    environment: ambiente,
    billingType: tipo,
    accountId,
    active: ativa
  } as Partial<CompanyIntegration>;

  // Testa antes de abrir a transação: é uma chamada de rede, e segurar
  // conexão do banco esperando o gateway não ajuda ninguém.
  if (chaveNova) {
    if (!chaveMestraDisponivel()) throw new AppError("ERR_INTEGRACAO_SEM_CHAVE_MESTRA", 503);
    await new AsaasProvider({
      chave: chaveNova,
      ambiente: ambiente === "production" ? "production" : "sandbox"
    }).testar();
    Object.assign(campos, {
      apiKeyEncrypted: cifrar(chaveNova),
      apiKeyHint: chaveNova.slice(-4),
      lastCheckedAt: new Date(),
      lastError: null
    });
  } else if (ativa && atual && !atual.active && atual.apiKeyEncrypted) {
    // Religando com a chave que já estava: confere se ela ainda vale.
    await provedorDa(atual).testar();
    Object.assign(campos, { lastCheckedAt: new Date(), lastError: null });
  }

  return comConsistencia(companyId, "integracao", async transaction => {
    if (atual) return atual.update(campos, { transaction });
    return CompanyIntegration.create(
      {
        ...campos,
        provider: PROVEDOR_PADRAO,
        webhookPath: crypto.randomUUID(),
        webhookToken: crypto.randomBytes(32).toString("base64url"),
        companyId
      } as never,
      { transaction }
    );
  });
};

/** Testa a chave gravada e registra o resultado, sem mudar mais nada. */
export const testarIntegracao = async (companyId: number) => {
  const integracao = await integracaoDaEmpresa(companyId);
  if (!integracao?.apiKeyEncrypted) throw new AppError("ERR_INTEGRACAO_SEM_CHAVE", 400);
  try {
    const resultado = await provedorDa(integracao).testar();
    await integracao.update({ lastCheckedAt: new Date(), lastError: null });
    return resultado;
  } catch (erro) {
    await integracao.update({
      lastCheckedAt: new Date(),
      lastError: String((erro as Error).message || erro).slice(0, 500)
    });
    throw erro;
  }
};

/**
 * Troca o segredo do webhook. Para quando ele vazou: o valor antigo para de
 * valer na hora, e o novo precisa ser colado no painel do gateway.
 */
export const novoTokenDoWebhook = async (companyId: number): Promise<CompanyIntegration> => {
  const integracao = await integracaoDaEmpresa(companyId);
  if (!integracao) throw new AppError("ERR_INTEGRACAO_INATIVA", 409);
  return integracao.update({ webhookToken: crypto.randomBytes(32).toString("base64url") });
};
