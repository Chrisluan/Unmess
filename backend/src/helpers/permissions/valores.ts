import { Request } from "express";

import { usuarioPode } from "./resolve";

/**
 * Esconder dinheiro de quem não tem `crm:viewValues`.
 *
 * Esconder só na tela não é esconder: o número continua na resposta da API, a
 * um F12 de distância. A máscara vale no servidor, na saída, e a tela só
 * acompanha.
 *
 * É feita por nome de campo, em toda a árvore da resposta, e não campo a campo
 * em cada controller. Cada controller que devolve um card ou um item teria de
 * lembrar de mascarar, e o próximo que alguém escrevesse não lembraria — o
 * mesmo formato de esquecimento que a auditoria de rotas existe para pegar. O
 * custo é que um campo novo com dinheiro dentro precisa entrar na lista abaixo;
 * o teste de `valores.spec.ts` fixa os nomes de hoje.
 *
 * Valor oculto vira `null`, e não zero: zero é um preço (brinde, cortesia) e a
 * tela precisa distinguir "sem permissão" de "grátis".
 */
const CAMPOS_DE_VALOR = new Set([
  // card e orçamento
  "value",
  "discount",
  "total",
  "subtotal",
  "unitPrice",
  "installmentValue",
  // trilha comercial (pedido e cobranças)
  "faturado",
  "recebido",
  "restante",
  "amount",
  "paidAmount",
  "totalValue",
  "paidValue",
  // totais do funil
  "pipelineValue",
  "inProgressValue",
  "billedValue",
  "valorTotal",
  "valorPonderado",
  "valorGanho",
  "ticketMedio"
]);

/**
 * Custo e margem: um degrau acima dos valores. Quem vende vê o preço, mas não
 * quanto a empresa paga -- é o número que revela a formação do preço. Mesmo
 * mecanismo, outra permissão (`products:viewCost`) e outra lista.
 */
const CAMPOS_DE_CUSTO = new Set(["cost", "minCost", "unitCost", "custo", "margem", "margin", "wastePercent"]);

/** Pessoa pode ver os números de dinheiro do funil? */
export const podeVerValores = (req: Request): Promise<boolean> =>
  usuarioPode(Number(req.user.id), "crm:viewValues");

export const podeVerCustos = (req: Request): Promise<boolean> =>
  usuarioPode(Number(req.user.id), "products:viewCost");

const mascaradorDe = (campos: Set<string>) => {
  const mascarar = (valor: unknown): unknown => {
    if (Array.isArray(valor)) return valor.map(mascarar);

    if (valor && typeof valor === "object") {
      const saida: Record<string, unknown> = {};
      Object.entries(valor as Record<string, unknown>).forEach(([chave, v]) => {
        saida[chave] = campos.has(chave) ? null : mascarar(v);
      });
      return saida;
    }

    return valor;
  };
  return mascarar;
};

const mascarar = mascaradorDe(CAMPOS_DE_VALOR);
const mascararCustos = mascaradorDe(CAMPOS_DE_CUSTO);

/**
 * Devolve uma cópia sem os campos de dinheiro.
 *
 * Passa por JSON antes de percorrer: um modelo do Sequelize guarda os campos
 * em getters e `dataValues`, e é o `toJSON` que os materializa — inclusive os
 * getters que convertem DECIMAL em número.
 */
export const ocultarValores = <T>(payload: T): T =>
  mascarar(JSON.parse(JSON.stringify(payload))) as T;

/** Cópia sem custo e margem (ver CAMPOS_DE_CUSTO). */
export const ocultarCustos = <T>(payload: T): T =>
  mascararCustos(JSON.parse(JSON.stringify(payload))) as T;

/**
 * Atalho para o fim de um handler: mascara só se a pessoa não puder ver.
 */
export const respostaComValores = async <T>(req: Request, payload: T): Promise<T> => {
  const [valores, custos] = await Promise.all([podeVerValores(req), podeVerCustos(req)]);
  let saida = payload;
  if (!custos) saida = ocultarCustos(saida);
  if (!valores) saida = ocultarValores(saida);
  return saida;
};
