import { Transaction } from "sequelize";

import AppError from "../../errors/AppError";
import sequelize from "../../database";
import fonteDoBanco from "./fonteDoBanco";
import { REGRAS } from "./regras";
import { FonteDeDados, Gatilho, Problema, Regra } from "./tipos";

const regrasDe = (gatilho?: Gatilho): Regra[] =>
  gatilho ? REGRAS.filter(r => r.gatilhos.includes(gatilho)) : REGRAS;

/** Roda as regras contra uma fonte e devolve os problemas encontrados. */
export const verificar = async (
  dados: FonteDeDados,
  regras: Regra[] = REGRAS
): Promise<Problema[]> => {
  const resultados = await Promise.all(
    regras.map(async regra => {
      const mensagens = await regra.verificar(dados);
      return mensagens.map<Problema>(mensagem => ({
        regra: regra.id,
        titulo: regra.titulo,
        mensagem,
        severidade: regra.severidade,
        resolver: regra.resolver
      }));
    })
  );
  return resultados.reduce<Problema[]>((todos, lista) => todos.concat(lista), []);
};

/** Tudo o que está inconsistente hoje na empresa. Alimenta o painel de saúde. */
export const saudeDaEmpresa = (companyId: number): Promise<Problema[]> =>
  verificar(fonteDoBanco(companyId));

const mesmoProblema = (a: Problema, b: Problema) =>
  a.regra === b.regra && a.mensagem === b.mensagem;

/**
 * Executa uma alteração de configuração só se ela não quebrar nada.
 *
 * A alteração roda dentro de uma transação; as regras ligadas ao gatilho são
 * conferidas antes e depois, enxergando o estado ainda não gravado. Se surgiu
 * um problema novo que bloqueia, desfaz tudo e responde 409 com a lista do que
 * falta e de onde resolver.
 *
 * Problemas que já existiam não bloqueiam: quem está justamente consertando a
 * configuração, um passo de cada vez, não pode ficar preso por eles.
 *
 * A alteração PRECISA usar a transação recebida em toda escrita. Uma escrita
 * fora dela é gravada na hora e não seria desfeita.
 */
export const comConsistencia = async <T>(
  companyId: number,
  gatilho: Gatilho,
  alteracao: (transaction: Transaction) => Promise<T>
): Promise<T> => {
  const regras = regrasDe(gatilho).filter(r => r.severidade === "bloqueia");

  return sequelize.transaction(async transaction => {
    const antes = await verificar(fonteDoBanco(companyId, transaction), regras);
    const resultado = await alteracao(transaction);
    const depois = await verificar(fonteDoBanco(companyId, transaction), regras);

    const novos = depois.filter(p => !antes.some(a => mesmoProblema(a, p)));

    if (novos.length > 0) {
      throw new AppError("ERR_CONFIGURACAO_INCONSISTENTE", 409, {
        problemas: novos
      });
    }

    return resultado;
  });
};
