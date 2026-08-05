import { QueryInterface, DataTypes } from "sequelize";

/**
 * WppKeys.value guarda chaves do protocolo Signal serializadas em JSON pelo
 * BufferJSON (app-state-sync-key, pre-key, etc.). O STRING(191) original só
 * comportava as menores: as demais estouravam o limite e o MySQL em modo
 * estrito rejeitava a gravação. Como StoreWppSessionKeys apenas registra o
 * erro no log, a falha era silenciosa e derrubava a sessão do whaileys.
 *
 * O 191 fazia sentido para as colunas do índice único (limite de bytes de
 * índice em utf8mb4); value não participa do índice, então pode ser TEXT.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.changeColumn("WppKeys", "value", {
      type: DataTypes.TEXT,
      allowNull: false
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.changeColumn("WppKeys", "value", {
      type: DataTypes.STRING(191),
      allowNull: false
    });
  }
};
