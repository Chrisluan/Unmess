import AsaasProvider from "./AsaasProvider";
import { BillingProvider } from "./BillingProvider";

/**
 * Qual gateway está em uso.
 *
 * Uma função e não uma constante: a chave vem do .env, e um valor congelado no
 * carregamento do módulo obrigaria a reiniciar o servidor depois de configurar
 * a conta — exatamente o momento em que alguém está testando.
 */
export const provedorDeCobranca = (): BillingProvider => {
  return new AsaasProvider();
};

/**
 * Se dá para emitir de verdade, ou se a cobrança será registrada à mão.
 *
 * Sem credencial o sistema continua servindo: o super registra a fatura, cola
 * a linha digitável que emitiu no banco e o controle de vencimento e bloqueio
 * funciona igual. O que muda é quem gera o documento.
 */
export const emissaoAutomaticaDisponivel = (): boolean =>
  provedorDeCobranca().configurado();

export * from "./BillingProvider";
