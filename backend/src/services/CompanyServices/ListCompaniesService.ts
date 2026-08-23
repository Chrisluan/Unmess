import { Sequelize, Op } from "sequelize";
import Company from "../../models/Company";
import User from "../../models/User";
import { vencidasPorEmpresa } from "../BillingServices/ListarFaturasService";

interface Request {
  searchParam?: string;
  pageNumber?: string;
  /** active | suspended | canceled | overdue — filtro do painel do super. */
  status?: string;
}

/**
 * A empresa somada ao que só faz sentido na visão do super: quantas pessoas
 * usam e se há fatura vencida. São os dois números que decidem se a linha
 * precisa de atenção, e buscá-los por linha na tela seriam dezenas de idas ao
 * banco para desenhar uma lista.
 */
export interface CompanyResumo {
  usuarios: number;
  faturasVencidas: number;
}

interface Response {
  companies: (Company & { resumo?: CompanyResumo })[];
  count: number;
  hasMore: boolean;
}

const ListCompaniesService = async ({
  searchParam = "",
  pageNumber = "1",
  status
}: Request): Promise<Response> => {
  const busca = {
    [Op.or]: [
      {
        name: Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col("name")),
          "LIKE",
          `%${searchParam.toLowerCase().trim()}%`
        )
      },
      { email: { [Op.like]: `%${searchParam.toLowerCase().trim()}%` } },
      { document: { [Op.like]: `%${searchParam.toLowerCase().trim()}%` } }
    ]
  };

  // "overdue" não é situação da empresa e sim das faturas dela; o filtro por
  // ele acontece depois, sobre o resumo.
  const porSituacao =
    status && status !== "overdue" ? { status } : undefined;

  const whereCondition = porSituacao ? { ...busca, ...porSituacao } : busca;

  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const { count, rows: companies } = await Company.findAndCountAll({
    where: whereCondition,
    limit,
    offset,
    order: [["name", "ASC"]]
  });

  const ids = companies.map(c => c.id);

  const contagens = await User.findAll({
    where: { companyId: ids },
    attributes: [
      "companyId",
      [Sequelize.fn("COUNT", Sequelize.col("id")), "total"]
    ],
    group: ["companyId"],
    raw: true
  });

  const usuariosPorEmpresa = (contagens as any[]).reduce<Record<number, number>>(
    (mapa, linha) => {
      mapa[linha.companyId] = Number(linha.total);
      return mapa;
    },
    {}
  );

  const vencidas = await vencidasPorEmpresa(ids);

  let lista = companies.map(company => {
    const resumo: CompanyResumo = {
      usuarios: usuariosPorEmpresa[company.id] || 0,
      faturasVencidas: vencidas[company.id] || 0
    };
    // O toJSON puro perde o resumo; espalhar mantém o formato que a tela
    // já esperava e acrescenta o bloco novo.
    return { ...company.toJSON(), resumo } as any;
  });

  if (status === "overdue") {
    lista = lista.filter((c: any) => c.resumo.faturasVencidas > 0);
  }

  const hasMore = count > offset + companies.length;

  return {
    companies: lista,
    count,
    hasMore
  };
};

export default ListCompaniesService;
