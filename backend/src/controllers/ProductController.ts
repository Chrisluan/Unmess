import { Request, Response } from "express";
import { Op, WhereOptions } from "sequelize";
import * as Yup from "yup";

import Product from "../models/Product";
import ProductSupply from "../models/ProductSupply";
import ProductFinish from "../models/ProductFinish";
import Supply from "../models/Supply";
import Finish from "../models/Finish";
import AppError from "../errors/AppError";
import getCompanyId from "../helpers/GetCompanyId";
import { comConsistencia } from "../helpers/consistencia/motor";
import { ocultarCustos, podeVerCustos } from "../helpers/permissions/valores";
import RecalcularPrecosService from "../services/PrecoServices/RecalcularPrecosService";

const schema = Yup.object().shape({
  name: Yup.string().required().min(1).max(255),
  unit: Yup.string().max(12),
  price: Yup.number().min(0),
  cost: Yup.number().min(0)
});

/**
 * Tira custo e margem da resposta de quem não pode vê-los.
 *
 * O custo é o que revela a formação do preço, e vendedor não precisa dele
 * para vender. Escondê-lo só na tela não esconderia nada: a lista de produtos
 * alimenta o autocompletar do orçamento, e o número viajaria inteiro para o
 * navegador de quem soubesse abrir a aba de rede. Vale também para a
 * composição (custo dos insumos) e os acabamentos.
 *
 * Vira `null`, e não zero: zero é um custo possível, e faria a margem
 * aparecer como 100% para quem não deveria ver margem nenhuma.
 */
const semCustoParaQuemNaoPode = async <T>(req: Request, payload: T): Promise<T> =>
  (await podeVerCustos(req)) ? payload : ocultarCustos(payload);

/** O que vem junto com o produto: composição e acabamentos oferecidos. */
const INCLUIR = [
  {
    model: ProductSupply,
    as: "composicao",
    attributes: ["id", "supplyId", "quantity"],
    include: [{ model: Supply, as: "supply", attributes: ["id", "name", "unit", "cost", "wastePercent", "active"] }]
  },
  {
    model: ProductFinish,
    as: "acabamentos",
    attributes: ["id", "finishId", "isDefault"],
    include: [
      {
        model: Finish,
        as: "finish",
        attributes: ["id", "name", "base", "price", "minPrice", "cost", "minCost", "active"]
      }
    ]
  }
];

/** Campos do produto que a tela pode gravar. O resto (empresa, id) não. */
const CAMPOS = [
  "name",
  "code",
  "description",
  "unit",
  "price",
  "cost",
  "pricingMode",
  "minMeasure",
  "category",
  "active",
  "priceMode",
  "markupPercent"
];

const camposDe = (corpo: Record<string, unknown>) => {
  const dados: Record<string, unknown> = {};
  CAMPOS.forEach(campo => {
    if (corpo[campo] !== undefined) dados[campo] = corpo[campo];
  });
  if (dados.priceMode !== undefined) {
    dados.priceMode = dados.priceMode === "calculado" ? "calculado" : "manual";
  }
  if (dados.markupPercent !== undefined) {
    const n = Number(dados.markupPercent);
    // Vazio = usar o percentual da empresa.
    dados.markupPercent =
      dados.markupPercent === null || dados.markupPercent === "" || !Number.isFinite(n) ? null : Math.max(0, n);
  }
  return dados;
};

interface LinhaDaComposicao {
  supplyId: number | string;
  quantity: number | string;
}

interface AcabamentoOferecido {
  finishId: number | string;
  isDefault?: boolean;
}

/**
 * Regrava composição e acabamentos, quando vieram no corpo. Ausentes ficam
 * como estão: a tela de preço rápido não precisa reenviar a composição.
 */
const gravarComposicao = async (
  produto: Product,
  corpo: { composicao?: LinhaDaComposicao[]; acabamentos?: AcabamentoOferecido[] },
  companyId: number,
  transaction: import("sequelize").Transaction
) => {
  if (Array.isArray(corpo.composicao)) {
    const linhas = corpo.composicao
      .map(l => ({ supplyId: Number(l.supplyId), quantity: Number(l.quantity) }))
      .filter(l => l.supplyId > 0 && Number.isFinite(l.quantity) && l.quantity > 0);
    const ids = Array.from(new Set(linhas.map(l => l.supplyId)));
    // Insumo de outra empresa não entra, nem por id adivinhado.
    const validos = await Supply.count({ where: { companyId, id: { [Op.in]: ids.length ? ids : [0] } }, transaction });
    if (validos !== ids.length) throw new AppError("ERR_INSUMO_INVALIDO", 400);
    await ProductSupply.destroy({ where: { productId: produto.id, companyId }, transaction });
    await ProductSupply.bulkCreate(
      linhas.map(l => ({ ...l, productId: produto.id, companyId })) as never[],
      { transaction }
    );
  }

  if (Array.isArray(corpo.acabamentos)) {
    const porId = new Map<number, boolean>();
    corpo.acabamentos.forEach(a => {
      const id = Number(a.finishId);
      if (id > 0) porId.set(id, Boolean(a.isDefault));
    });
    const ids = Array.from(porId.keys());
    const validos = await Finish.count({ where: { companyId, id: { [Op.in]: ids.length ? ids : [0] } }, transaction });
    if (validos !== ids.length) throw new AppError("ERR_ACABAMENTO_INVALIDO", 400);
    await ProductFinish.destroy({ where: { productId: produto.id, companyId }, transaction });
    await ProductFinish.bulkCreate(
      ids.map(finishId => ({ finishId, isDefault: porId.get(finishId), productId: produto.id, companyId })) as never[],
      { transaction }
    );
  }
};

/**
 * Grava o produto inteiro (dados, composição, acabamentos) e refaz o preço
 * calculado, numa transação conferida pelas regras de consistência -- um
 * produto de preço calculado sem insumo nenhum é recusado ali.
 */
const salvar = (companyId: number, corpo: Record<string, unknown>, existente?: Product) =>
  comConsistencia(companyId, "produto", async transaction => {
    const dados = camposDe(corpo);
    const produto = existente
      ? await existente.update(dados, { transaction })
      : await Product.create({ ...dados, companyId } as never, { transaction });
    await gravarComposicao(produto, corpo as never, companyId, transaction);
    await RecalcularPrecosService({ companyId, productIds: [produto.id], acabamentos: false, transaction });
    return produto;
  });

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, category, includeInactive } = req.query as Record<string, string>;
  const companyId = getCompanyId(req);

  const where: WhereOptions & Record<string, any> = { companyId };

  // Inativos ficam de fora por padrão: quem monta um orçamento quer o que está
  // à venda hoje, não o catálogo histórico inteiro.
  if (includeInactive !== "true") where.active = true;
  if (category) where.category = category;

  const termo = searchParam?.trim();
  if (termo) {
    // Nome e código juntos: quem procura sabe um ou o outro, não os dois.
    where[Op.or as any] = [
      { name: { [Op.like]: `%${termo}%` } },
      { code: { [Op.like]: `%${termo}%` } }
    ];
  }

  const products = await Product.findAll({
    where,
    include: INCLUIR,
    order: [["name", "ASC"]],
    // Teto no autocompletar: um catálogo grande travaria a digitação se
    // devolvesse tudo a cada tecla.
    limit: termo ? 30 : 300
  });

  return res.json({ products: await semCustoParaQuemNaoPode(req, products) });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const dados = req.body;

  try {
    await schema.validate(dados);
  } catch (err) {
    throw new AppError(err.message);
  }

  const companyId = getCompanyId(req);
  const criado = await salvar(companyId, dados);
  const product = await Product.findByPk(criado.id, { include: INCLUIR });

  return res.status(200).json(await semCustoParaQuemNaoPode(req, product));
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  const { productId } = req.params;
  const companyId = getCompanyId(req);

  // O companyId entra na busca, e não numa conferência depois: assim uma
  // empresa não consegue editar nem descobrir o produto de outra.
  const product = await Product.findOne({ where: { id: productId, companyId } });
  if (!product) throw new AppError("ERR_NO_PRODUCT_FOUND", 404);

  try {
    await schema.validate({ ...product.toJSON(), ...req.body });
  } catch (err) {
    throw new AppError(err.message);
  }

  await salvar(companyId, req.body, product);
  await product.reload({ include: INCLUIR });

  return res.json(await semCustoParaQuemNaoPode(req, product));
};

/**
 * Desativa em vez de excluir.
 *
 * Os itens dos orçamentos antigos apontam para o produto; apagá-lo de verdade
 * deixaria o histórico com referências mortas. Quem quiser sumir com ele da
 * lista de venda só precisa que ele pare de aparecer.
 */
export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { productId } = req.params;

  const product = await Product.findOne({
    where: { id: productId, companyId: getCompanyId(req) }
  });
  if (!product) throw new AppError("ERR_NO_PRODUCT_FOUND", 404);

  await comConsistencia(product.companyId, "produto", async transaction => {
    await product.update({ active: false }, { transaction });
  });

  return res.json({ message: "Product deactivated" });
};

/** Categorias em uso, para montar o filtro sem uma tabela só para isso. */
export const categories = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const lista = await Product.findAll({
    where: { companyId: getCompanyId(req), active: true },
    attributes: ["category"],
    group: ["category"],
    order: [["category", "ASC"]]
  });

  return res.json({
    categories: lista.map(p => p.category).filter(Boolean)
  });
};
