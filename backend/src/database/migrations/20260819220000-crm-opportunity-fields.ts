import { QueryInterface, DataTypes } from "sequelize";

/**
 * Fundação do CRM: o que faltava para a oportunidade ser operável.
 *
 * O card já sabia de cliente, valor, responsável e origem. O que não sabia era
 * o que um vendedor pergunta o dia inteiro: isto está atrasado? quando falo com
 * ele de novo? estou esperando o cliente ou ele está me esperando? qual a
 * chance real disto fechar?
 *
 * Tudo anulável ou com padrão: os negócios que já existem seguem válidos.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // ---- estágio: probabilidade, ganho e desativação -----------------------

    await queryInterface.addColumn("PipelineStages", "probability", {
      // Percentual de fechamento esperado nesta etapa. Alimenta o valor
      // ponderado do funil: 10.000 numa etapa de 70% valem 7.000 na previsão.
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    });

    await queryInterface.addColumn("PipelineStages", "isWon", {
      // Ganho precisa ser explícito. Hoje "chegou ao fim sem próximo quadro"
      // fatura por dedução, o que impede ter uma coluna de ganho no meio do
      // funil -- que é justamente como um funil de vendas costuma terminar.
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.addColumn("PipelineStages", "active", {
      // Desativar em vez de excluir: a coluna some do quadro mas os cards que
      // passaram por ela continuam com histórico coerente.
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });

    // ---- oportunidade: operação do dia a dia -------------------------------

    const colunasDeal: Record<string, any> = {
      // low | normal | high | urgent
      priority: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: "normal"
      },

      /**
       * Status do atendimento, separado do estágio comercial.
       *
       * São perguntas diferentes: "em que pé está a venda" e "de quem é a bola
       * agora". Uma oportunidade pode estar em Negociação e parada esperando o
       * cliente responder -- misturar as duas coisas numa coluna só esconde
       * exatamente o que trava o funil.
       *
       * open | waiting_customer | waiting_team | closed
       */
      serviceStatus: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "open"
      },

      // Última mensagem trocada ou ação registrada. É o que responde "faz
      // quanto tempo que ninguém toca nisto".
      lastInteractionAt: { type: DataTypes.DATE, allowNull: true },

      // Quando falar com o cliente de novo. Atrasado = passou e não houve
      // interação depois.
      nextFollowUpAt: { type: DataTypes.DATE, allowNull: true },

      // Guardado junto com o motivo por extenso: o texto serve para ler, o id
      // serve para agrupar no relatório de perdas.
      lossReasonId: { type: DataTypes.STRING(24), allowNull: true },

      // Quando a oportunidade foi reaberta pela última vez.
      reopenedAt: { type: DataTypes.DATE, allowNull: true }
    };

    await Promise.all(
      Object.entries(colunasDeal).map(([nome, definicao]) =>
        queryInterface.addColumn("Deals", nome, definicao)
      )
    );

    // ---- etiquetas na oportunidade -----------------------------------------
    //
    // A tabela de etiquetas já existia, usada nas conversas. Reaproveitar em
    // vez de criar outra evita duas listas de etiquetas para manter -- e é o
    // mesmo vocabulário: "VIP" na conversa é o mesmo "VIP" na venda.

    await queryInterface.createTable("DealTags", {
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
        onDelete: "CASCADE",
        allowNull: false
      },
      tagId: {
        type: DataTypes.INTEGER,
        references: { model: "Tags", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    // A mesma etiqueta duas vezes no mesmo card não significa nada, e faria a
    // contagem por etiqueta mentir.
    await queryInterface.addIndex("DealTags", ["dealId", "tagId"], {
      name: "deal_tags_unique",
      unique: true
    });

    // ---- índices para o funil aguentar volume ------------------------------
    //
    // As consultas do quadro filtram sempre por empresa e estágio, e ordenam
    // pela posição. Sem índice, cada abertura do Kanban varre a tabela inteira.

    await queryInterface.addIndex("Deals", ["companyId", "stageId", "status"], {
      name: "deals_company_stage_status_idx"
    });

    await queryInterface.addIndex("Deals", ["companyId", "nextFollowUpAt"], {
      name: "deals_company_followup_idx"
    });

    await queryInterface.addIndex("Deals", ["companyId", "responsibleUserId", "status"], {
      name: "deals_company_responsible_idx"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex("Deals", "deals_company_responsible_idx");
    await queryInterface.removeIndex("Deals", "deals_company_followup_idx");
    await queryInterface.removeIndex("Deals", "deals_company_stage_status_idx");
    await queryInterface.dropTable("DealTags");

    for (const nome of [
      "priority",
      "serviceStatus",
      "lastInteractionAt",
      "nextFollowUpAt",
      "lossReasonId",
      "reopenedAt"
    ]) {
      await queryInterface.removeColumn("Deals", nome);
    }

    await queryInterface.removeColumn("PipelineStages", "active");
    await queryInterface.removeColumn("PipelineStages", "isWon");
    await queryInterface.removeColumn("PipelineStages", "probability");
  }
};
