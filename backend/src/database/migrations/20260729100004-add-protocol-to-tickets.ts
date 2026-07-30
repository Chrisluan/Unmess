import { QueryInterface, DataTypes } from "sequelize";

/**
 * Protocolo de atendimento: identificador que o cliente pode citar depois.
 * Formato AAAAMMDD + id sequencial do ticket, gerado na criação.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Tickets", "protocol", {
      type: DataTypes.STRING,
      allowNull: true
    });

    await queryInterface.addIndex("Tickets", ["protocol"], {
      name: "tickets_protocol_idx"
    });

    // Preenche o histórico existente para nenhum chat antigo ficar sem
    // protocolo quando o atendente for consultar.
    await queryInterface.sequelize.query(`
      UPDATE Tickets
      SET protocol = CONCAT(DATE_FORMAT(createdAt, '%Y%m%d'), LPAD(id, 6, '0'))
      WHERE protocol IS NULL
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex("Tickets", "tickets_protocol_idx");
    await queryInterface.removeColumn("Tickets", "protocol");
  }
};
