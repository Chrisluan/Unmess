import { QueryTypes } from "sequelize";
import sequelize from "../../database";

interface Request {
  companyId: number;
  boardId?: number | string;
}

export interface IndicadoresFunil {
  total: number;
  valorTotal: number;
  valorPonderado: number;
  ganhas: number;
  valorGanho: number;
  perdidas: number;
  taxaConversao: number;
  ticketMedio: number;
  atrasadas: number;
  followUpsHoje: number;
  semResponsavel: number;
}

const numero = (valor: unknown): number => {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Indicadores do funil.
 *
 * Tudo em uma consulta agregada, e não somando em JavaScript: com milhares de
 * oportunidades, trazer todas para contar seria carregar a base inteira a cada
 * abertura do quadro.
 *
 * O valor ponderado multiplica cada oportunidade pela probabilidade da etapa em
 * que ela está. É a diferença entre "tenho 500 mil no funil" e "espero fechar
 * 180 mil" -- a segunda é a que serve para planejar.
 *
 * O ganho é lido de `wonAt`, não do status: a venda fechada numa coluna de
 * ganho segue para a Produção e o card vira "moved". Contar pelo status deixava
 * o faturamento parado até a jornada chegar ao fim da fila de quadros. Pelo
 * mesmo motivo, o que já foi ganho sai das somas de "em aberto" -- senão a
 * mesma venda apareceria nos dois lados.
 */
const IndicadoresFunilService = async ({
  companyId,
  boardId
}: Request): Promise<IndicadoresFunil> => {
  const filtroQuadro = boardId ? "AND d.boardId = :boardId" : "";

  const [linha] = await sequelize.query<Record<string, unknown>>(
    `
    SELECT
      SUM(CASE WHEN d.status NOT IN ('won','lost') AND d.wonAt IS NULL
               THEN 1 ELSE 0 END)                                              AS total,
      SUM(CASE WHEN d.status NOT IN ('won','lost') AND d.wonAt IS NULL
               THEN d.value ELSE 0 END)                                        AS valorTotal,
      SUM(CASE WHEN d.status NOT IN ('won','lost') AND d.wonAt IS NULL
               THEN d.value * COALESCE(s.probability, 0) / 100 ELSE 0 END)     AS valorPonderado,
      SUM(CASE WHEN d.wonAt IS NOT NULL THEN 1 ELSE 0 END)                     AS ganhas,
      SUM(CASE WHEN d.wonAt IS NOT NULL THEN d.value ELSE 0 END)               AS valorGanho,
      SUM(CASE WHEN d.status = 'lost' THEN 1 ELSE 0 END)                       AS perdidas,
      SUM(CASE WHEN d.status NOT IN ('won','lost') AND d.wonAt IS NULL
               AND d.nextFollowUpAt IS NOT NULL
               AND d.nextFollowUpAt < NOW() THEN 1 ELSE 0 END)                 AS atrasadas,
      SUM(CASE WHEN d.status NOT IN ('won','lost') AND d.wonAt IS NULL
               AND DATE(d.nextFollowUpAt) = CURDATE() THEN 1 ELSE 0 END)       AS followUpsHoje,
      SUM(CASE WHEN d.status NOT IN ('won','lost') AND d.wonAt IS NULL
               AND d.responsibleUserId IS NULL THEN 1 ELSE 0 END)              AS semResponsavel
    FROM Deals d
    LEFT JOIN PipelineStages s ON s.id = d.stageId
    WHERE d.companyId = :companyId ${filtroQuadro}
    `,
    {
      replacements: { companyId, ...(boardId ? { boardId } : {}) },
      type: QueryTypes.SELECT
    }
  );

  const ganhas = numero(linha?.ganhas);
  const perdidas = numero(linha?.perdidas);
  const decididas = ganhas + perdidas;

  return {
    total: numero(linha?.total),
    valorTotal: Number(numero(linha?.valorTotal).toFixed(2)),
    valorPonderado: Number(numero(linha?.valorPonderado).toFixed(2)),
    ganhas,
    valorGanho: Number(numero(linha?.valorGanho).toFixed(2)),
    perdidas,
    // Conversão sobre o que já foi decidido, não sobre o funil inteiro: incluir
    // as que ainda estão em aberto faria a taxa subir sozinha só porque
    // entraram leads novos.
    taxaConversao: decididas ? Number(((ganhas / decididas) * 100).toFixed(1)) : 0,
    ticketMedio: ganhas
      ? Number((numero(linha?.valorGanho) / ganhas).toFixed(2))
      : 0,
    atrasadas: numero(linha?.atrasadas),
    followUpsHoje: numero(linha?.followUpsHoje),
    semResponsavel: numero(linha?.semResponsavel)
  };
};

export default IndicadoresFunilService;
