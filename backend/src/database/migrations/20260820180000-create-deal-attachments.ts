import { QueryInterface, DataTypes } from "sequelize";

/**
 * Material do pedido — a arte, o arquivo, a foto do que vai ser produzido.
 *
 * Numa gráfica o pedido não se explica pelo texto: "banner 3x1" pode ser
 * qualquer coisa. Quem está na Produção precisa **ver** o material, e até aqui
 * ele só existia solto no meio da conversa de WhatsApp -- encontrável apenas
 * rolando o histórico.
 *
 * O arquivo é copiado para a pasta pública, e não referenciado onde estava: a
 * mídia da conversa pertence à conversa, e apagar uma mensagem não pode deixar
 * o pedido sem a arte que foi aprovada.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("DealAttachments", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      dealId: {
        type: DataTypes.INTEGER,
        references: { model: "Deals", key: "id" },
        onUpdate: "CASCADE",
        // O material não existe sem o pedido.
        onDelete: "CASCADE",
        allowNull: false
      },
      /** Nome que a pessoa reconhece, preservado do arquivo original. */
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      /** Nome em disco, dentro de /public. Aleatório, como todo upload. */
      fileName: {
        type: DataTypes.STRING,
        allowNull: false
      },
      mimetype: {
        type: DataTypes.STRING(120),
        allowNull: false,
        defaultValue: "application/octet-stream"
      },
      size: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      /**
       * A arte que representa o pedido no card do Kanban.
       *
       * Um pedido tem vários arquivos (a arte, o comprovante, a referência que
       * o cliente mandou); só um responde "o que é este trabalho" de relance.
       */
      isPreview: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      /**
       * Mensagem de onde o arquivo foi trazido, quando veio da conversa.
       *
       * Guardado como texto solto, sem chave estrangeira: é procedência, não
       * dependência. Apagar a mensagem no chat não pode levar junto o material
       * do pedido -- é justamente disso que este cadastro protege --, e uma FK
       * aqui só criaria uma forma a mais de a exclusão falhar.
       */
      sourceMessageId: {
        type: DataTypes.STRING,
        allowNull: true
      },
      uploadedByUserId: {
        type: DataTypes.INTEGER,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true
      },
      companyId: {
        type: DataTypes.INTEGER,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    // A carga do Kanban pede a capa de cada pedido; sem índice isso vira uma
    // varredura da tabela inteira a cada abertura do quadro.
    await queryInterface.addIndex("DealAttachments", ["dealId", "isPreview"], {
      name: "deal_attachments_deal_preview"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("DealAttachments");
  }
};
