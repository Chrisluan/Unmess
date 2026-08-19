import { QueryInterface, DataTypes } from "sequelize";

/**
 * Marca qual quadro é o funil de vendas.
 *
 * A pergunta "gerar pedido?" só faz sentido saindo da venda: é ali que se
 * decide se um orçamento aprovado vira trabalho. Nos demais quadros
 * (Produção → Expedição, por exemplo) a passagem é a continuação natural do
 * processo, e perguntar a cada etapa vira só mais um clique no caminho.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Boards", "isSalesFunnel", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    // O primeiro quadro da ordem é o funil de vendas em toda instalação que
    // existe hoje; deixar tudo falso obrigaria a reconfigurar à mão para o
    // comportamento voltar a ser o de antes.
    await queryInterface.sequelize.query(
      "UPDATE Boards SET isSalesFunnel = true WHERE id IN " +
        "(SELECT id FROM (SELECT MIN(id) AS id FROM Boards GROUP BY companyId) AS primeiros)"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Boards", "isSalesFunnel");
  }
};
