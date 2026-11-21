import { Op, Transaction, WhereOptions } from "sequelize";

import Finish from "../../models/Finish";
import Product from "../../models/Product";
import ProductSupply from "../../models/ProductSupply";
import Supply from "../../models/Supply";
import { custoDaComposicao, precoPeloCusto, regraDaEmpresa } from "../../helpers/Precificacao";

interface Request {
  companyId: number;
  /** Só estes produtos; omitido = todos os de preço calculado. */
  productIds?: number[];
  /** Recalcular também os acabamentos (omitido = sim). */
  acabamentos?: boolean;
  transaction?: Transaction;
}

/**
 * Regrava custo e preço de tudo que tem preço calculado.
 *
 * Roda quando muda o que entra na conta: a composição de um produto, o custo
 * de um insumo, o markup da empresa. Gravar o resultado, em vez de calcular a
 * cada leitura, deixa o catálogo, o PDV e o orçamento lendo o mesmo número
 * sem repetir a conta -- e cada um deles já lia `price`.
 *
 * Orçamentos e pedidos não são tocados: guardam o preço e o custo do dia.
 */
const RecalcularPrecosService = async ({
  companyId,
  productIds,
  acabamentos = true,
  transaction
}: Request): Promise<void> => {
  const regraEmpresa = await regraDaEmpresa(companyId, transaction);

  const where: WhereOptions & Record<string, unknown> = { companyId, priceMode: "calculado" };
  if (productIds) {
    if (productIds.length === 0 && !acabamentos) return;
    where.id = { [Op.in]: productIds.length ? productIds : [0] };
  }

  const produtos = await Product.findAll({
    where,
    include: [{ model: ProductSupply, as: "composicao", include: [{ model: Supply, as: "supply" }] }],
    transaction
  });

  // eslint-disable-next-line no-restricted-syntax
  for (const produto of produtos) {
    const custo = custoDaComposicao(produto.composicao || []);
    const percentual =
      produto.markupPercent === null || produto.markupPercent === undefined
        ? regraEmpresa.percentual
        : produto.markupPercent;
    const preco = precoPeloCusto(custo, { modo: regraEmpresa.modo, percentual });
    const mudou =
      Math.abs(produto.cost - custo) > 0.004 ||
      (preco !== null && Math.abs(produto.price - preco) > 0.004);
    // eslint-disable-next-line no-continue
    if (!mudou) continue;
    // eslint-disable-next-line no-await-in-loop
    await produto.update(
      // `cost` da tabela tem duas casas; o custo exato fica no item, que tem quatro.
      preco === null ? { cost: custo } : { cost: custo, price: preco },
      { transaction }
    );
  }

  if (!acabamentos) return;

  const lista = await Finish.findAll({ where: { companyId, priceMode: "calculado" }, transaction });
  // eslint-disable-next-line no-restricted-syntax
  for (const acabamento of lista) {
    const preco = precoPeloCusto(acabamento.cost, regraEmpresa, 4);
    const minimo = precoPeloCusto(acabamento.minCost, regraEmpresa);
    // eslint-disable-next-line no-continue
    if (preco === null || minimo === null) continue;
    // eslint-disable-next-line no-continue
    if (Math.abs(acabamento.price - preco) < 0.00005 && Math.abs(acabamento.minPrice - minimo) < 0.005) continue;
    // eslint-disable-next-line no-await-in-loop
    await acabamento.update({ price: preco, minPrice: minimo }, { transaction });
  }
};

export default RecalcularPrecosService;
