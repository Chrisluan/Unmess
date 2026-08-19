import { QueryTypes } from "sequelize";
import sequelize from "../../database";

export type TipoDeSequencia = "quote" | "order";

/**
 * Próximo número da sequência da empresa.
 *
 * Não usa MAX(numero)+1: duas pessoas fechando pedidos no mesmo instante
 * leriam o mesmo máximo e gravariam o mesmo número. Aqui o incremento e a
 * leitura acontecem na mesma instrução, sob bloqueio do banco -- quem chegar
 * depois espera e recebe o número seguinte.
 *
 * O `LAST_INSERT_ID` com argumento é o jeito do MySQL de devolver o valor que
 * acabou de ser gravado dentro do próprio UPDATE, sem um SELECT entre os dois
 * que abriria justamente a fresta que se quer fechar.
 */
const ProximoNumeroService = async (
  companyId: number,
  kind: TipoDeSequencia
): Promise<number> => {
  return sequelize.transaction(async transaction => {
    const agora = new Date();

    // Cria o contador da empresa na primeira vez, sem falhar se outra conexão
    // criou primeiro -- daí o ON DUPLICATE em vez de um SELECT antes.
    await sequelize.query(
      `INSERT INTO Sequences (companyId, kind, lastNumber, createdAt, updatedAt)
       VALUES (:companyId, :kind, 0, :agora, :agora)
       ON DUPLICATE KEY UPDATE id = id`,
      {
        replacements: { companyId, kind, agora },
        type: QueryTypes.INSERT,
        transaction
      }
    );

    await sequelize.query(
      `UPDATE Sequences
          SET lastNumber = LAST_INSERT_ID(lastNumber + 1), updatedAt = :agora
        WHERE companyId = :companyId AND kind = :kind`,
      {
        replacements: { companyId, kind, agora },
        type: QueryTypes.UPDATE,
        transaction
      }
    );

    const [linha] = await sequelize.query<{ numero: number }>(
      "SELECT LAST_INSERT_ID() AS numero",
      { type: QueryTypes.SELECT, transaction }
    );

    return Number(linha.numero);
  });
};

export default ProximoNumeroService;
