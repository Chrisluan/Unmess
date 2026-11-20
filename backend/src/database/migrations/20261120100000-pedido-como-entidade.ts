import { DataTypes, QueryInterface, QueryTypes } from "sequelize";

/**
 * O pedido deixa de ser um rótulo no card e vira documento próprio.
 *
 * Até aqui orçamento e pedido eram o mesmo card, copiado de quadro em quadro.
 * A cópia não levava os itens, o desconto nem a condição de pagamento, e o
 * registro em Orders apontava para o card novo enquanto o "ganho" ficava no
 * antigo -- a cobrança procurava o pedido no lugar errado e não achava.
 *
 * Agora:
 * - `Orders` guarda o pedido inteiro (cliente, condições, entrega) e
 *   `OrderItems` a cópia congelada dos itens no momento em que foi gerado;
 * - `Deals.orderId` liga ao pedido o orçamento de origem e cada card de
 *   produção, que passam a ler itens e documento do pedido;
 * - `Deals.validUntil` é a validade da proposta;
 * - `Companies` ganha razão social e endereço, para o cabeçalho dos
 *   documentos;
 * - `Customers` passa a ter no máximo um cliente por contato.
 *
 * Em produção Orders estava vazia quando esta migration foi escrita: mudar o
 * sentido de `Orders.dealId` (de "card de produção" para "orçamento de
 * origem") não reescreve nada que exista.
 */

const DERIVADAS: Array<[nova: string, deQuem: string]> = [
  ["crm:generateOrder", "crm:close"],
  ["crm:editOrder", "crm:editItems"],
  ["crm:cancelOrder", "crm:delete"]
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

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const { sequelize } = queryInterface;

    // Um cliente por contato. Sem isso a conversa não sabe de qual cliente é,
    // e o pedido podia nascer ligado ao cadastro errado.
    const duplicados = await sequelize.query<{ companyId: number; contactId: number }>(
      `SELECT companyId, contactId FROM Customers
        WHERE contactId IS NOT NULL
        GROUP BY companyId, contactId HAVING COUNT(*) > 1`,
      { type: QueryTypes.SELECT }
    );
    if (duplicados.length > 0) {
      throw new Error(
        `Há contatos ligados a mais de um cliente (${duplicados
          .map(d => `empresa ${d.companyId} / contato ${d.contactId}`)
          .join(", ")}). Junte os cadastros antes de rodar esta migration.`
      );
    }
    await queryInterface.addIndex("Customers", ["companyId", "contactId"], {
      unique: true,
      name: "customers_company_contact_unique"
    });

    const fk = (tabela: string, onDelete = "SET NULL") => ({
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: tabela, key: "id" },
      onUpdate: "CASCADE",
      onDelete
    });

    // ── Pedido ──────────────────────────────────────────────────────────────
    await queryInterface.addColumn("Orders", "title", { type: DataTypes.STRING, allowNull: true });
    await queryInterface.addColumn("Orders", "customerId", fk("Customers"));
    await queryInterface.addColumn("Orders", "contactId", fk("Contacts"));
    await queryInterface.addColumn("Orders", "responsibleUserId", fk("Users"));
    await queryInterface.addColumn("Orders", "rootDealId", fk("Deals"));
    await queryInterface.addColumn("Orders", "paymentTermId", fk("PaymentTerms"));
    await queryInterface.addColumn("Orders", "discount", {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0
    });
    await queryInterface.addColumn("Orders", "discountType", {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "value"
    });
    await queryInterface.addColumn("Orders", "installments", { type: DataTypes.INTEGER, allowNull: true });
    await queryInterface.addColumn("Orders", "paymentCondition", { type: DataTypes.TEXT, allowNull: true });
    await queryInterface.addColumn("Orders", "deliveryAt", { type: DataTypes.DATE, allowNull: true });
    await queryInterface.addColumn("Orders", "deliveryToArrange", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
    await queryInterface.addColumn("Orders", "deliveryMode", { type: DataTypes.STRING(16), allowNull: true });
    await queryInterface.addColumn("Orders", "carrier", { type: DataTypes.STRING, allowNull: true });
    await queryInterface.addColumn("Orders", "notes", { type: DataTypes.TEXT, allowNull: true });
    await queryInterface.addColumn("Orders", "approvedAt", { type: DataTypes.DATE, allowNull: true });
    await queryInterface.addColumn("Orders", "canceledAt", { type: DataTypes.DATE, allowNull: true });
    await queryInterface.addColumn("Orders", "canceledReason", { type: DataTypes.STRING, allowNull: true });

    await queryInterface.createTable("OrderItems", {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      description: { type: DataTypes.STRING, allowNull: false },
      quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false, defaultValue: 1 },
      unit: { type: DataTypes.STRING(16), allowNull: true },
      unitPrice: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      discount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      width: { type: DataTypes.DECIMAL(10, 3), allowNull: true },
      height: { type: DataTypes.DECIMAL(10, 3), allowNull: true },
      pricingMode: { type: DataTypes.STRING(10), allowNull: false, defaultValue: "unit" },
      minMeasure: { type: DataTypes.DECIMAL(10, 3), allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      orderId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Orders", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      productId: fk("Products"),
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
    await queryInterface.addIndex("OrderItems", ["orderId", "position"]);
    await queryInterface.addIndex("Orders", ["companyId", "dealId"]);

    // ── Cards ───────────────────────────────────────────────────────────────
    await queryInterface.addColumn("Deals", "orderId", fk("Orders"));
    await queryInterface.addColumn("Deals", "validUntil", { type: DataTypes.DATE, allowNull: true });

    // ── Empresa (cabeçalho dos documentos) ─────────────────────────────────
    await queryInterface.addColumn("Companies", "legalName", { type: DataTypes.STRING, allowNull: true });
    await queryInterface.addColumn("Companies", "address", { type: DataTypes.STRING, allowNull: true });

    // ── Permissões novas, para quem já fazia o equivalente ─────────────────
    const cargos = await sequelize.query<{ id: number; permissions: string | null }>(
      "SELECT id, permissions FROM Roles",
      { type: QueryTypes.SELECT }
    );
    // eslint-disable-next-line no-restricted-syntax
    for (const cargo of cargos) {
      const atuais = lerLista(cargo.permissions);
      // eslint-disable-next-line no-continue
      if (!atuais) continue;
      const finais = new Set(atuais);
      DERIVADAS.forEach(([nova, deQuem]) => {
        if (finais.has(deQuem)) finais.add(nova);
      });
      // eslint-disable-next-line no-continue
      if (finais.size === atuais.length) continue;
      // eslint-disable-next-line no-await-in-loop
      await sequelize.query("UPDATE Roles SET permissions = :p WHERE id = :id", {
        replacements: { id: cargo.id, p: JSON.stringify(Array.from(finais)) },
        type: QueryTypes.UPDATE
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
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
      const finais = atuais.filter(p => !NOVAS.includes(p));
      // eslint-disable-next-line no-continue
      if (finais.length === atuais.length) continue;
      // eslint-disable-next-line no-await-in-loop
      await sequelize.query("UPDATE Roles SET permissions = :p WHERE id = :id", {
        replacements: { id: cargo.id, p: JSON.stringify(finais) },
        type: QueryTypes.UPDATE
      });
    }

    await queryInterface.removeColumn("Companies", "address");
    await queryInterface.removeColumn("Companies", "legalName");
    await queryInterface.removeColumn("Deals", "validUntil");
    await queryInterface.removeColumn("Deals", "orderId");
    await queryInterface.removeIndex("Orders", ["companyId", "dealId"]);
    await queryInterface.dropTable("OrderItems");
    await [
      "canceledReason",
      "canceledAt",
      "approvedAt",
      "notes",
      "carrier",
      "deliveryMode",
      "deliveryToArrange",
      "deliveryAt",
      "paymentCondition",
      "installments",
      "discountType",
      "discount",
      "paymentTermId",
      "rootDealId",
      "responsibleUserId",
      "contactId",
      "customerId",
      "title"
    ].reduce(
      (anterior, coluna) => anterior.then(() => queryInterface.removeColumn("Orders", coluna)),
      Promise.resolve()
    );
    await queryInterface.removeIndex("Customers", "customers_company_contact_unique");
  }
};
