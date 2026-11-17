import { Op } from "sequelize";

import CompanyInvoice from "../../models/CompanyInvoice";

interface Request {
  companyId: number;
}

export interface ResumoDeCobranca {
  /** Faturas em aberto cujo vencimento já passou. */
  vencidas: number;
  valorVencido: number;
  emAberto: number;
  valorEmAberto: number;
  /** Vencimento da próxima fatura em aberto, ou null. */
  proximoVencimento: string | null;
  pagoNoAno: number;
}

interface Response {
  invoices: CompanyInvoice[];
  resumo: ResumoDeCobranca;
}

/**
 * Faturas de uma empresa, com o resumo que o painel mostra no topo.
 *
 * O resumo sai da mesma consulta e não de contagens separadas: com quatro
 * chamadas diferentes, a tela conseguiria mostrar "nada vencido" ao lado de
 * uma linha vermelha na lista, porque cada número teria vindo de um instante
 * diferente.
 */
const ListarFaturasService = async ({
  companyId
}: Request): Promise<Response> => {
  const invoices = await CompanyInvoice.findAll({
    where: { companyId },
    order: [
      ["dueDate", "DESC"],
      ["id", "DESC"]
    ],
    limit: 60
  });

  const hoje = new Date().toISOString().slice(0, 10);
  const inicioDoAno = `${new Date().getFullYear()}-01-01`;

  const abertas = invoices.filter(i =>
    ["pending", "overdue"].includes(i.status)
  );
  const vencidas = abertas.filter(i => String(i.dueDate) < hoje);

  const somar = (lista: CompanyInvoice[]) =>
    lista.reduce((total, i) => total + Number(i.amount || 0), 0);

  const aVencer = abertas
    .filter(i => String(i.dueDate) >= hoje)
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));

  const pagas = invoices.filter(
    i => i.status === "paid" && String(i.dueDate) >= inicioDoAno
  );

  return {
    invoices,
    resumo: {
      vencidas: vencidas.length,
      valorVencido: somar(vencidas),
      emAberto: abertas.length,
      valorEmAberto: somar(abertas),
      proximoVencimento: aVencer.length ? String(aVencer[0].dueDate) : null,
      pagoNoAno: pagas.reduce(
        (total, i) => total + Number(i.paidAmount ?? i.amount ?? 0),
        0
      )
    }
  };
};

/**
 * Contagem de vencidas por empresa, para a listagem do painel.
 *
 * Uma consulta agregada em vez de uma por linha: com trinta empresas na tela,
 * buscar as faturas de cada uma seriam trinta idas ao banco para desenhar um
 * selo vermelho.
 */
export const vencidasPorEmpresa = async (
  companyIds: number[]
): Promise<Record<number, number>> => {
  if (companyIds.length === 0) return {};

  const hoje = new Date().toISOString().slice(0, 10);

  const linhas = await CompanyInvoice.findAll({
    where: {
      companyId: { [Op.in]: companyIds },
      status: { [Op.in]: ["pending", "overdue"] },
      dueDate: { [Op.lt]: hoje }
    },
    attributes: ["companyId"]
  });

  return linhas.reduce<Record<number, number>>((mapa, linha) => {
    mapa[linha.companyId] = (mapa[linha.companyId] || 0) + 1;
    return mapa;
  }, {});
};

export default ListarFaturasService;
