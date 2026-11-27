import { QueryInterface, DataTypes, QueryTypes } from "sequelize";

/**
 * Chat de equipe: canais, quem leu até onde, e as mensagens.
 *
 * Um canal serve a duas coisas ao mesmo tempo — texto e rádio —, como um
 * canal de Mumble: entrar no rádio de "Produção" é entrar na mesma sala onde
 * o texto de "Produção" está escrito. Por isso não há tabela de "sala de voz":
 * a voz não guarda nada em disco, vive na memória do servidor enquanto alguém
 * estiver na escuta.
 *
 * `kind` separa os canais abertos da empresa (`channel`) das conversas a dois
 * (`direct`). A conversa a dois é identificada por `directKey` — os dois ids
 * em ordem crescente —, e o índice único em (companyId, directKey) é o que
 * impede duas abas abrindo a mesma conversa ao mesmo tempo de criarem duas.
 *
 * Mesma cautela da frente de caixa: DDL no MySQL não é transacional, então
 * cada passo confere se já foi feito antes de agir.
 */

const temTabela = async (
  queryInterface: QueryInterface,
  tabela: string
): Promise<boolean> => {
  const linhas = await queryInterface.sequelize.query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = LOWER(:tabela)`,
    { replacements: { tabela }, type: QueryTypes.SELECT }
  );
  return Number(linhas[0]?.n ?? 0) > 0;
};

const temIndice = async (
  queryInterface: QueryInterface,
  tabela: string,
  indice: string
): Promise<boolean> => {
  const linhas = await queryInterface.sequelize.query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND LOWER(TABLE_NAME) = LOWER(:tabela)
        AND INDEX_NAME = :indice`,
    { replacements: { tabela, indice }, type: QueryTypes.SELECT }
  );
  return Number(linhas[0]?.n ?? 0) > 0;
};

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    if (!(await temTabela(queryInterface, "TeamChannels"))) {
      await queryInterface.createTable("TeamChannels", {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false
        },
        companyId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: "Companies", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE"
        },
        kind: {
          type: DataTypes.STRING(10),
          allowNull: false,
          defaultValue: "channel"
        },
        // Conversa a dois não tem nome: cada lado vê o nome do outro.
        name: { type: DataTypes.STRING(60), allowNull: true },
        topic: { type: DataTypes.STRING(200), allowNull: true },
        directKey: { type: DataTypes.STRING(40), allowNull: true },
        position: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        // Arquivar, e não apagar: o histórico de um canal é registro da
        // empresa, e um clique errado não pode levá-lo junto.
        archived: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        createdById: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: "Users", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL"
        },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false }
      });
    }

    if (
      !(await temIndice(queryInterface, "TeamChannels", "team_channels_direct_key"))
    ) {
      await queryInterface.addIndex("TeamChannels", ["companyId", "directKey"], {
        name: "team_channels_direct_key",
        unique: true
      });
    }

    if (!(await temTabela(queryInterface, "TeamChannelMembers"))) {
      await queryInterface.createTable("TeamChannelMembers", {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false
        },
        channelId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: "TeamChannels", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE"
        },
        userId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: "Users", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE"
        },
        // Até qual mensagem a pessoa leu. Contar não lidas é contar o que
        // veio depois disto — sem uma linha por mensagem por pessoa.
        lastReadMessageId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false }
      });
    }

    if (
      !(await temIndice(queryInterface, "TeamChannelMembers", "team_channel_members_unico"))
    ) {
      await queryInterface.addIndex("TeamChannelMembers", ["channelId", "userId"], {
        name: "team_channel_members_unico",
        unique: true
      });
    }

    if (!(await temTabela(queryInterface, "TeamMessages"))) {
      await queryInterface.createTable("TeamMessages", {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false
        },
        companyId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: "Companies", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE"
        },
        channelId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: "TeamChannels", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE"
        },
        // A mensagem fica quando a pessoa sai da empresa; perde só o autor.
        userId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: "Users", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL"
        },
        body: { type: DataTypes.TEXT, allowNull: false },
        editedAt: { type: DataTypes.DATE, allowNull: true },
        // Apagada fica no lugar, sem o texto: sumir de vez deixaria buraco
        // nas respostas que vieram depois.
        deletedAt: { type: DataTypes.DATE, allowNull: true },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false }
      });
    }

    if (
      !(await temIndice(queryInterface, "TeamMessages", "team_messages_canal"))
    ) {
      await queryInterface.addIndex("TeamMessages", ["channelId", "id"], {
        name: "team_messages_canal"
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("TeamMessages");
    await queryInterface.dropTable("TeamChannelMembers");
    await queryInterface.dropTable("TeamChannels");
  }
};
