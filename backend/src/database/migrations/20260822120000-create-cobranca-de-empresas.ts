import { QueryInterface, DataTypes } from "sequelize";

/**
 * Cobrança das empresas assinantes.
 *
 * O sistema já tinha um financeiro completo, mas ele é do inquilino: as contas
 * que a gráfica cobra dos clientes dela. Faturar as próprias empresas
 * assinantes — a receita do SaaS — não existia em lugar nenhum. `Company` tinha
 * `plan`, `status` e `dueDate` soltos, sem histórico: dava para dizer "vence
 * dia 10", nunca "esta fatura de setembro foi paga e a de outubro está em
 * aberto".
 *
 * `CompanyInvoices` é o histórico que faltava. Uma linha por cobrança emitida,
 * com o que o gateway devolveu (linha digitável, PDF, id da cobrança lá) ao
 * lado do que o sistema controla (valor, vencimento, baixa). Guardar os dois
 * permite continuar operando quando o gateway está fora do ar ou quando a
 * cobrança foi feita por fora, no banco.
 *
 * As colunas novas em `Companies` são o que o gateway e o bloqueio precisam:
 * o id do cliente lá, o valor e o dia da mensalidade, e se o vencimento
 * derruba o acesso sozinho.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const datas = {
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    };

    await queryInterface.addColumn("Companies", "billingCustomerId", {
      type: DataTypes.STRING(64),
      allowNull: true,
      comment: "Id do cliente no gateway de pagamento"
    });

    await queryInterface.addColumn("Companies", "monthlyFee", {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
      comment: "Valor sugerido ao emitir uma cobranca"
    });

    await queryInterface.addColumn("Companies", "billingDay", {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 10,
      comment: "Dia do mes usado como vencimento padrao"
    });

    await queryInterface.addColumn("Companies", "blockWhenOverdue", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Suspende o acesso sozinho quando ha fatura vencida"
    });

    await queryInterface.addColumn("Companies", "overdueGraceDays", {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5,
      comment: "Dias de tolerancia antes do bloqueio automatico"
    });

    /**
     * Por que o acesso foi cortado.
     *
     * Sem isto a tela de login só poderia dizer "acesso bloqueado", e quem
     * atende o telefone da empresa não saberia se é inadimplência, pedido do
     * próprio cliente ou engano.
     */
    await queryInterface.addColumn("Companies", "statusReason", {
      type: DataTypes.STRING(255),
      allowNull: true
    });

    await queryInterface.addColumn("Companies", "statusChangedAt", {
      type: DataTypes.DATE,
      allowNull: true
    });

    await queryInterface.createTable("CompanyInvoices", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      description: { type: DataTypes.STRING, allowNull: false },
      amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
      dueDate: { type: DataTypes.DATEONLY, allowNull: false },

      /** pending | paid | overdue | canceled | failed */
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "pending"
      },

      paidAt: { type: DataTypes.DATE, allowNull: true },
      paidAmount: { type: DataTypes.DECIMAL(15, 2), allowNull: true },

      /** boleto | pix | credit_card — o que foi pedido ao gateway. */
      billingType: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "boleto"
      },

      /** asaas | manual — de onde veio o documento. */
      provider: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "manual"
      },
      providerChargeId: { type: DataTypes.STRING(64), allowNull: true },

      /**
       * O que o cliente usa para pagar. Guardado no banco e não buscado no
       * gateway a cada abertura da tela: são dados que não mudam depois de
       * emitidos, e a fatura precisa continuar acessível se a API cair.
       */
      bankSlipUrl: { type: DataTypes.STRING(512), allowNull: true },
      digitableLine: { type: DataTypes.STRING(80), allowNull: true },
      pixPayload: { type: DataTypes.TEXT, allowNull: true },
      invoiceUrl: { type: DataTypes.STRING(512), allowNull: true },

      /** Última resposta de erro do gateway, para não depender do log. */
      lastError: { type: DataTypes.STRING(512), allowNull: true },

      notes: { type: DataTypes.TEXT, allowNull: true },
      ...datas
    });

    await queryInterface.addIndex("CompanyInvoices", ["companyId", "dueDate"], {
      name: "company_invoices_company_due"
    });

    await queryInterface.addIndex("CompanyInvoices", ["status", "dueDate"], {
      name: "company_invoices_status_due"
    });

    // O webhook chega com o id da cobrança no gateway e nada mais: sem este
    // índice, cada aviso de pagamento varreria a tabela inteira.
    await queryInterface.addIndex("CompanyInvoices", ["providerChargeId"], {
      name: "company_invoices_provider_charge"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("CompanyInvoices");
    await queryInterface.removeColumn("Companies", "billingCustomerId");
    await queryInterface.removeColumn("Companies", "monthlyFee");
    await queryInterface.removeColumn("Companies", "billingDay");
    await queryInterface.removeColumn("Companies", "blockWhenOverdue");
    await queryInterface.removeColumn("Companies", "overdueGraceDays");
    await queryInterface.removeColumn("Companies", "statusReason");
    await queryInterface.removeColumn("Companies", "statusChangedAt");
  }
};
