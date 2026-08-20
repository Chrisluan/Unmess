import { Request, Response } from "express";
import { Op, WhereOptions } from "sequelize";
import * as Yup from "yup";

import Product from "../models/Product";
import AppError from "../errors/AppError";
import getCompanyId from "../helpers/GetCompanyId";

const schema = Yup.object().shape({
  name: Yup.string().required().min(1).max(255),
  unit: Yup.string().max(12),
  price: Yup.number().min(0),
  cost: Yup.number().min(0)
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
    order: [["name", "ASC"]],
    // Teto no autocompletar: um catálogo grande travaria a digitação se
    // devolvesse tudo a cada tecla.
    limit: termo ? 30 : 300
  });

  return res.json({ products });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const dados = req.body;

  try {
    await schema.validate(dados);
  } catch (err) {
    throw new AppError(err.message);
  }

  const product = await Product.create({
    ...dados,
    companyId: getCompanyId(req)
  });

  return res.status(200).json(product);
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

  await product.update(req.body);

  return res.json(product);
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

  await product.update({ active: false });

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
