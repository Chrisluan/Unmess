import { QueryTypes } from "sequelize";

import sequelize from "../../database";
import AppError from "../../errors/AppError";
import CashSale from "../../models/CashSale";
import CashSaleItem from "../../models/CashSaleItem";
import CashSession from "../../models/CashSession";
import FinancialEntry from "../../models/FinancialEntry";
import Product from "../../models/Product";
import Receivable from "../../models/Receivable";
import User from "../../models/User";

/**
 * A venda de balcão, do carrinho ao lançamento.
 *
 * Três gravações que só fazem sentido juntas: o cupom (o que foi vendido), a
 * cobrança (o que o cliente devia) e o lançamento (o dinheiro que entrou).
 * Uma transação envolve as três porque qualquer subconjunto delas é pior que
 * nenhuma — cupom sem lançamento é venda que não aparece no caixa, lançamento
 * sem cupom é dinheiro sem origem, e a conferência de fechamento acusaria a
 * diferença sem nenhuma pista de onde ela nasceu.
 *
 * A cobrança nasce e é quitada no mesmo instante. Parece rodeio — por que não
 * lançar direto na conta? — mas é o que faz a venda de balcão chegar ao mesmo
 * lugar que as outras: contas a receber, métricas por cliente, concentração de
 * faturamento. Um lançamento solto ficaria fora de todas elas.
 */

export interface ItemDaVenda {
  productId?: number | null;
  name?: string;
  quantity?: number;
  unitPrice?: number;
}

const arredondar = (v: number): number => Math.round(v * 100) / 100;

const numeroPositivo = (v: unknown, padrao = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : padrao;
};

/**
 * O próximo número de cupom da empresa.
 *
 * `MAX + 1` dentro da transação, e não uma contagem: cupom cancelado no futuro
 * não pode fazer o número voltar atrás e colidir com um já emitido. O índice
 * único no banco é quem tem a palavra final — se duas vendas simultâneas
 * pegarem o mesmo número, a segunda falha e é refeita, em vez de as duas
 * gravarem o mesmo cupom.
 */
const proximoNumero = async (
  companyId: number,
  transaction: any
): Promise<number> => {
  const [linha] = await sequelize.query<{ maximo: number | null }>(
    "SELECT MAX(number) AS maximo FROM CashSales WHERE companyId = :companyId",
    {
      replacements: { companyId },
      type: QueryTypes.SELECT,
      transaction
    }
  );

  return Number(linha?.maximo ?? 0) + 1;
};

export const registrarVenda = async ({
  companyId,
  sessionId,
  userId,
  items,
  method,
  discount = 0,
  customerId
}: {
  companyId: number;
  sessionId: number;
  userId: number;
  items: ItemDaVenda[];
  method: string;
  discount?: number;
  customerId?: number | null;
}): Promise<CashSale> => {
  const session = await CashSession.findOne({
    where: { id: sessionId, companyId }
  });

  if (!session) {
    throw new AppError("Turno de caixa não encontrado.", 404);
  }

  if (session.status !== "open") {
    throw new AppError(
      "Este turno já foi fechado. Abra o caixa para registrar vendas.",
      400
    );
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError("A venda precisa de ao menos um item.", 400);
  }

  /**
   * O preço vem do catálogo, não do navegador.
   *
   * Aceitar o `unitPrice` que a tela mandou deixaria o preço de qualquer venda
   * a um passo do console do navegador. O preço digitado só é aceito para item
   * avulso — o que não tem produto atrás —, e aí ele é o que a pessoa
   * combinou no balcão, não um desconto disfarçado.
   */
  const produtos = await Product.findAll({
    where: {
      companyId,
      id: items
        .map(item => Number(item.productId))
        .filter(id => Number.isInteger(id) && id > 0)
    }
  });

  const porId = new Map(produtos.map(p => [p.id, p]));

  const linhas = items.map(item => {
    const quantidade = numeroPositivo(item.quantity, 0);

    if (!(quantidade > 0)) {
      throw new AppError("Toda linha da venda precisa de quantidade.", 400);
    }

    const produto = item.productId ? porId.get(Number(item.productId)) : null;

    if (item.productId && !produto) {
      throw new AppError("Produto não encontrado no catálogo.", 404);
    }

    const nome = (produto?.name || item.name || "").trim();

    if (!nome) {
      throw new AppError("Toda linha da venda precisa de uma descrição.", 400);
    }

    const preco = produto ? produto.price : numeroPositivo(item.unitPrice, 0);

    return {
      productId: produto?.id ?? null,
      name: nome,
      quantity: quantidade,
      unitPrice: preco,
      total: arredondar(quantidade * preco)
    };
  });

  const bruto = arredondar(linhas.reduce((soma, l) => soma + l.total, 0));
  const abatimento = numeroPositivo(discount, 0);

  if (abatimento > bruto) {
    throw new AppError("O desconto não pode ser maior que a venda.", 400);
  }

  const total = arredondar(bruto - abatimento);

  if (!(total > 0)) {
    throw new AppError("O total da venda precisa ser maior que zero.", 400);
  }

  const hoje = new Date().toISOString().slice(0, 10);

  return sequelize.transaction(async transaction => {
    const number = await proximoNumero(companyId, transaction);

    const receivable = await Receivable.create(
      {
        companyId,
        customerId: customerId || null,
        description: `Venda no balcão #${number}`,
        dueDate: hoje,
        amount: total,
        installment: 1,
        installments: 1
      } as any,
      { transaction }
    );

    const entry = await FinancialEntry.create(
      {
        companyId,
        accountId: session.accountId,
        receivableId: receivable.id,
        direction: "in",
        amount: total,
        occurredAt: hoje,
        method,
        // Venda é receita de verdade: entra nas métricas, ao contrário de
        // sangria e suprimento.
        isTransfer: false,
        description: `Venda no balcão #${number}`,
        userId
      } as any,
      { transaction }
    );

    const sale = await CashSale.create(
      {
        companyId,
        sessionId: session.id,
        userId,
        number,
        total,
        discount: abatimento,
        method,
        customerId: customerId || null,
        receivableId: receivable.id,
        entryId: entry.id
      } as any,
      { transaction }
    );

    await CashSaleItem.bulkCreate(
      linhas.map(linha => ({ ...linha, companyId, saleId: sale.id })) as any,
      { transaction }
    );

    return sale;
  });
};

/** As vendas de um turno, para a tela mostrar o que já passou pelo caixa. */
export const listarVendasDaSessao = async (
  companyId: number,
  sessionId: number
): Promise<CashSale[]> =>
  CashSale.findAll({
    where: { companyId, sessionId },
    include: [
      { model: CashSaleItem, required: false },
      { model: User, attributes: ["id", "name"], required: false }
    ],
    order: [["number", "DESC"]]
  });
