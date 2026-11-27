import { Request, Response } from "express";
import * as Yup from "yup";

import AppError from "../errors/AppError";
import getCompanyId from "../helpers/GetCompanyId";
import { comConsistencia } from "../helpers/consistencia/motor";
import { ocultarCustos, podeVerCustos } from "../helpers/permissions/valores";
import { precoPeloCusto, regraDaEmpresa } from "../helpers/Precificacao";
import { GetSettingNumber } from "../helpers/GetSetting";
import Finish, { BASES_DE_ACABAMENTO } from "../models/Finish";
import Supply, { UNIDADES_DE_INSUMO } from "../models/Supply";
import RecalcularPrecosService from "../services/PrecoServices/RecalcularPrecosService";

/**
 * Insumos e acabamentos: o que entra na conta do preço calculado.
 *
 * Insumo é só custo, e por isso a lista pede `products:viewCost`. Acabamento
 * tem preço, e quem monta orçamento precisa da lista para escolher -- o custo
 * dele é mascarado para quem não pode vê-lo, como no produto.
 */

const esquemaDeInsumo = Yup.object().shape({
  name: Yup.string().trim().required().max(255),
  unit: Yup.string().oneOf([...UNIDADES_DE_INSUMO]),
  cost: Yup.number().min(0),
  wastePercent: Yup.number().min(0).max(99)
});

const esquemaDeAcabamento = Yup.object().shape({
  name: Yup.string().trim().required().max(255),
  base: Yup.string().oneOf([...BASES_DE_ACABAMENTO]),
  cost: Yup.number().min(0),
  minCost: Yup.number().min(0),
  priceMode: Yup.string().oneOf(["manual", "calculado"]),
  price: Yup.number().min(0),
  minPrice: Yup.number().min(0)
});

const validar = async (esquema: { validate(dados: unknown): Promise<unknown> }, dados: unknown) => {
  try {
    await esquema.validate(dados);
  } catch (err) {
    throw new AppError(err.message);
  }
};

const escolher = (corpo: Record<string, unknown>, campos: string[]) => {
  const saida: Record<string, unknown> = {};
  campos.forEach(c => {
    if (corpo[c] !== undefined) saida[c] = corpo[c];
  });
  return saida;
};

// ── Insumos ───────────────────────────────────────────────────────────────

export const listarInsumos = async (req: Request, res: Response): Promise<Response> => {
  const where: { companyId: number; active?: boolean } = { companyId: getCompanyId(req) };
  if (req.query.includeInactive !== "true") where.active = true;
  const insumos = await Supply.findAll({ where, order: [["name", "ASC"]] });
  // A regra vai junto para a tela mostrar o preço calculado enquanto se
  // monta a composição, com a mesma conta do servidor.
  const regra = await regraDaEmpresa(getCompanyId(req));
  return res.json({ insumos, regra });
};

/**
 * Criar, editar e desativar passam pelas regras de consistência e refazem o
 * preço de todo produto calculado: um insumo mais caro encarece, na hora, tudo
 * que o usa (orçamentos já feitos não mudam).
 */
export const salvarInsumo = async (req: Request, res: Response): Promise<Response> => {
  const companyId = getCompanyId(req);
  const { insumoId } = req.params;
  const dados = escolher(req.body, ["name", "unit", "cost", "wastePercent", "active"]);

  const existente = insumoId ? await Supply.findOne({ where: { id: insumoId, companyId } }) : null;
  if (insumoId && !existente) throw new AppError("ERR_INSUMO_NAO_ENCONTRADO", 404);
  await validar(esquemaDeInsumo, { ...(existente ? existente.toJSON() : {}), ...dados });

  const insumo = await comConsistencia(companyId, "insumo", async transaction => {
    const gravado = existente
      ? await existente.update(dados, { transaction })
      : await Supply.create({ ...dados, companyId } as never, { transaction });
    await RecalcularPrecosService({ companyId, acabamentos: false, transaction });
    return gravado;
  });

  return res.status(insumoId ? 200 : 201).json(insumo);
};

export const desativarInsumo = async (req: Request, res: Response): Promise<Response> => {
  req.body = { active: false };
  return salvarInsumo(req, res);
};

// ── Acabamentos ───────────────────────────────────────────────────────────

export const listarAcabamentos = async (req: Request, res: Response): Promise<Response> => {
  const where: { companyId: number; active?: boolean } = { companyId: getCompanyId(req) };
  if (req.query.includeInactive !== "true") where.active = true;
  const acabamentos = await Finish.findAll({ where, order: [["name", "ASC"]] });
  // A margem mínima vai junto: é a régua do alerta na aba de itens, e quem
  // monta orçamento nem sempre pode abrir os Ajustes para lê-la.
  const margemMinima = await GetSettingNumber("margemMinima", getCompanyId(req), 0);
  const payload = { acabamentos, margemMinima };
  return res.json((await podeVerCustos(req)) ? payload : ocultarCustos(payload));
};

export const salvarAcabamento = async (req: Request, res: Response): Promise<Response> => {
  const companyId = getCompanyId(req);
  const { acabamentoId } = req.params;
  const dados = escolher(req.body, [
    "name",
    "base",
    "cost",
    "minCost",
    "priceMode",
    "price",
    "minPrice",
    "active"
  ]);

  const existente = acabamentoId
    ? await Finish.findOne({ where: { id: acabamentoId, companyId } })
    : null;
  if (acabamentoId && !existente) throw new AppError("ERR_ACABAMENTO_NAO_ENCONTRADO", 404);
  const final = { ...(existente ? existente.toJSON() : { priceMode: "calculado" }), ...dados } as Record<
    string,
    unknown
  >;
  await validar(esquemaDeAcabamento, final);

  // Preço calculado sai do custo pela regra da empresa; o que veio da tela
  // nesses dois campos é ignorado.
  if (final.priceMode === "calculado") {
    const regra = await regraDaEmpresa(companyId);
    const preco = precoPeloCusto(Number(final.cost) || 0, regra, 4);
    const minimo = precoPeloCusto(Number(final.minCost) || 0, regra);
    if (preco !== null) dados.price = preco;
    if (minimo !== null) dados.minPrice = minimo;
  }

  const acabamento = existente
    ? await existente.update(dados)
    : await Finish.create({ ...dados, companyId } as never);

  return res.status(acabamentoId ? 200 : 201).json(acabamento);
};

export const desativarAcabamento = async (req: Request, res: Response): Promise<Response> => {
  req.body = { active: false };
  return salvarAcabamento(req, res);
};
