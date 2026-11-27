import { DataTypes, QueryInterface, QueryTypes } from "sequelize";

/**
 * Cobrança por boleto e Pix através de um gateway, com baixa automática.
 *
 * - `CompanyIntegrations`: a conta de cada empresa no gateway (hoje o Asaas).
 *   A chave de API fica **cifrada** (helpers/Cifra.ts) e nunca volta para a
 *   tela; o que volta são os quatro últimos caracteres, para a pessoa saber
 *   qual chave está ali. `webhookPath` identifica a empresa na URL do aviso
 *   e `webhookToken` é o segredo que o gateway manda no cabeçalho: dois
 *   valores, para que a URL aparecer num log não baste para forjar baixa.
 *   `accountId` é a conta financeira onde as baixas automáticas entram.
 *
 * - `Receivables` ganham o espelho da cobrança emitida: id no gateway,
 *   situação de lá, valor e vencimento emitidos, boleto, linha digitável e
 *   Pix. O valor emitido é guardado porque a parcela pode receber uma baixa
 *   parcial à mão depois -- e aí o documento antigo cobra a mais.
 *
 * - `FinancialEntries.externalId`: o id do pagamento no gateway. Índice
 *   único por empresa: o mesmo pagamento avisado duas vezes (webhook repetido,
 *   webhook e conciliação ao mesmo tempo) não vira duas baixas. É o banco que
 *   garante, não uma consulta antes de gravar.
 *
 * - `Customers.gatewayIds`: o id do cliente em cada gateway e ambiente
 *   ({"asaas:sandbox": "cus_..."}). Por ambiente porque o cliente criado no
 *   sandbox não existe na produção.
 */

const DERIVADAS: Array<[nova: string, deQuem: string]> = [
  // Quem altera as configurações da empresa conecta a conta do gateway.
  ["settings:integrations", "settings:edit"]
];

const NOVAS = DERIVADAS.map(([nova]) => nova);

const lerLista = (cru: unknown): string[] | null => {
  try {
    const lido = JSON.parse(typeof cru === "string" && cru ? cru : "[]");
    return Array.isArray(lido) ? lido.filter(p => typeof p === "string") : null;
  } catch {
    return null;
  }
};

const reescreverCargos = async (
  queryInterface: QueryInterface,
  mudar: (atuais: string[]) => string[]
) => {
  const { sequelize } = queryInterface;
  const cargos = await sequelize.query<{ id: number; permissions: string | null }>(
    "SELECT id, permissions FROM Roles",
    { type: QueryTypes.SELECT }
  );
  // eslint-disable-next-line no-restricted-syntax
  for (const cargo of cargos) {
    const atuais = lerLista(cargo.permissions);
    // eslint-disable-next-line no-continue
    if (!atuais) continue;
    const finais = mudar(atuais);
    // eslint-disable-next-line no-continue
    if (finais.length === atuais.length && finais.every(p => atuais.includes(p))) continue;
    // eslint-disable-next-line no-await-in-loop
    await sequelize.query("UPDATE Roles SET permissions = :p WHERE id = :id", {
      replacements: { id: cargo.id, p: JSON.stringify(finais) },
      type: QueryTypes.UPDATE
    });
  }
};

const CAMPOS_DA_PARCELA: Array<[string, any]> = [
  ["gatewayProvider", { type: DataTypes.STRING(20), allowNull: true }],
  ["gatewayEnvironment", { type: DataTypes.STRING(12), allowNull: true }],
  ["gatewayChargeId", { type: DataTypes.STRING(64), allowNull: true }],
  ["gatewayStatus", { type: DataTypes.STRING(20), allowNull: true }],
  ["gatewayBillingType", { type: DataTypes.STRING(12), allowNull: true }],
  ["gatewayAmount", { type: DataTypes.DECIMAL(15, 2), allowNull: true }],
  ["gatewayDueDate", { type: DataTypes.DATEONLY, allowNull: true }],
  ["boletoUrl", { type: DataTypes.STRING(500), allowNull: true }],
  ["invoiceUrl", { type: DataTypes.STRING(500), allowNull: true }],
  ["linhaDigitavel", { type: DataTypes.STRING(120), allowNull: true }],
  ["pixCopiaECola", { type: DataTypes.TEXT, allowNull: true }],
  ["pixQrCode", { type: DataTypes.TEXT("medium"), allowNull: true }],
  ["emittedAt", { type: DataTypes.DATE, allowNull: true }],
  ["gatewayCheckedAt", { type: DataTypes.DATE, allowNull: true }]
];

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("CompanyIntegrations", {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      provider: { type: DataTypes.STRING(20), allowNull: false },
      environment: { type: DataTypes.STRING(12), allowNull: false, defaultValue: "sandbox" },
      apiKeyEncrypted: { type: DataTypes.TEXT, allowNull: true },
      apiKeyHint: { type: DataTypes.STRING(8), allowNull: true },
      webhookPath: { type: DataTypes.STRING(40), allowNull: false },
      webhookToken: { type: DataTypes.STRING(80), allowNull: false },
      billingType: { type: DataTypes.STRING(12), allowNull: false, defaultValue: "indefinido" },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      lastCheckedAt: { type: DataTypes.DATE, allowNull: true },
      lastError: { type: DataTypes.STRING(500), allowNull: true },
      lastWebhookAt: { type: DataTypes.DATE, allowNull: true },
      accountId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "FinancialAccounts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });
    await queryInterface.addIndex("CompanyIntegrations", ["companyId", "provider"], { unique: true });
    await queryInterface.addIndex("CompanyIntegrations", ["webhookPath"], { unique: true });

    // eslint-disable-next-line no-restricted-syntax
    for (const [campo, definicao] of CAMPOS_DA_PARCELA) {
      // eslint-disable-next-line no-await-in-loop
      await queryInterface.addColumn("Receivables", campo, definicao);
    }
    await queryInterface.addIndex("Receivables", ["gatewayChargeId"]);

    await queryInterface.addColumn("FinancialEntries", "externalId", {
      type: DataTypes.STRING(80),
      allowNull: true
    });
    await queryInterface.addIndex("FinancialEntries", ["companyId", "externalId"], {
      unique: true,
      name: "financial_entries_company_external_id"
    });

    await queryInterface.addColumn("Customers", "gatewayIds", {
      type: DataTypes.JSON,
      allowNull: true
    });

    await reescreverCargos(queryInterface, atuais => {
      const finais = new Set(atuais);
      DERIVADAS.forEach(([nova, deQuem]) => {
        if (finais.has(deQuem)) finais.add(nova);
      });
      return Array.from(finais);
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await reescreverCargos(queryInterface, atuais => atuais.filter(p => !NOVAS.includes(p)));

    await queryInterface.removeColumn("Customers", "gatewayIds");
    await queryInterface.removeIndex("FinancialEntries", "financial_entries_company_external_id");
    await queryInterface.removeColumn("FinancialEntries", "externalId");
    await queryInterface.removeIndex("Receivables", ["gatewayChargeId"]);
    // eslint-disable-next-line no-restricted-syntax
    for (const [campo] of CAMPOS_DA_PARCELA.slice().reverse()) {
      // eslint-disable-next-line no-await-in-loop
      await queryInterface.removeColumn("Receivables", campo);
    }
    await queryInterface.dropTable("CompanyIntegrations");
  }
};
