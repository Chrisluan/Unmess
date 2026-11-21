import { Request } from "express";

import AppError from "../../errors/AppError";
import { escoposDoUsuario } from "./resolve";
import { EscopoResolvido, EscoposResolvidos, alcanca } from "./escopos";

/**
 * O escopo de quem está pedindo, para uso dentro das rotas.
 *
 * Fica separado de `escopos.ts` porque aquele arquivo é a regra pura — sem
 * Express, sem banco, testável sozinho — e este é a cola entre a regra e a
 * requisição. Foi a mesma divisão feita entre `resolve.ts` e o middleware
 * `hasPermission`, e pelo mesmo motivo: a regra é o que precisa ser fácil de
 * conferir.
 */
export const escoposDaRequisicao = (
  req: Request
): Promise<EscoposResolvidos> => escoposDoUsuario(Number(req.user.id));

export const escopoDaRequisicao = async (
  req: Request,
  dimensao: string
): Promise<EscopoResolvido | undefined> => {
  const escopos = await escoposDaRequisicao(req);
  return escopos[dimensao];
};

/**
 * Barra a operação quando o alvo está fora do escopo de quem pediu.
 *
 * Para o caso de uma coisa só: o quadro em que o card está, a conta escolhida
 * na baixa. Listagens não passam por aqui — elas filtram, que é diferente de
 * recusar: uma listagem filtrada é a resposta certa, uma listagem recusada
 * seria uma tela de erro onde deveria haver uma lista mais curta.
 *
 * A mensagem diz "não está no seu acesso", e não "não existe". Fingir que o
 * quadro não existe seria mais discreto, mas manda a pessoa procurar um bug
 * onde há uma configuração — e quem administra o sistema é quem resolve, num
 * lugar que a mensagem já aponta.
 */
export const garantirNoEscopo = async (
  req: Request,
  dimensao: string,
  id: number | null | undefined,
  oQue: string
): Promise<void> => {
  const escopo = await escopoDaRequisicao(req, dimensao);

  if (!alcanca(escopo, id)) {
    throw new AppError(
      `${oQue} não está no seu acesso. Peça a quem administra o sistema para incluí-lo.`,
      403
    );
  }
};
