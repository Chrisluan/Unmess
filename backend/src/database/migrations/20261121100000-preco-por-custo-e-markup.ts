import { DataTypes, QueryInterface, QueryTypes } from "sequelize";

/**
 * Preço por custo + markup.
 *
 * Até aqui o produto tinha um preço digitado e um custo informativo, e o item
 * do orçamento não guardava custo nenhum: não havia como saber a margem de uma
 * venda. Agora:
 *
 * - `Supplies` (insumos): o que se compra -- lona, tinta, vinil, hora de mão
 *   de obra --, com custo por unidade e perda;
 * - `Finishes` (acabamentos): ilhós, bainha, laminação..., cobrados por área,
 *   perímetro, metro linear, peça ou valor fixo, com custo e mínimo;
 * - `ProductSupplies`: a composição do produto (quanto de cada insumo vai em
 *   uma unidade de medida dele) e `ProductFinishes` os acabamentos que ele
 *   oferece, alguns já marcados por padrão;
 * - `Products.priceMode`: "manual" (como era) ou "calculado" (custo da
 *   composição × markup), e `markupPercent` para um percentual próprio;
 * - `DealItems`/`OrderItems` guardam uma cópia do custo e dos acabamentos
 *   escolhidos. Mudar o catálogo não reescreve orçamento já feito -- mesmo
 *   princípio do preço, que sempre foi copiado.
 *
 * Os acabamentos do item vão como JSON, e não numa tabela: são uma fotografia
 * do momento da venda (nome, base, preço e custo de então), lida sempre junto
 * com o item e nunca consultada por fora dele.
 */

const DERIVADAS: Array<[nova: string, deQuem: string]> = [
  // Vender abaixo do preço calculado é decisão de quem forma o preço.
  ["crm:overridePrice", "products:manage"]
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

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const empresa = {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Companies", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE"
    };
    const datas = {
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    };

    // ── Insumos ─────────────────────────────────────────────────────────────
    await queryInterface.createTable("Supplies", {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      name: { type: DataTypes.STRING, allowNull: false },
      // m2 | m | un | kg | l | h
      unit: { type: DataTypes.STRING(8), allowNull: false, defaultValue: "un" },
      // Quatro casas: tinta por mililitro, ilhós por unidade -- centavos de
      // centavo que somados fazem diferença.
      cost: { type: DataTypes.DECIMAL(15, 4), allowNull: false, defaultValue: 0 },
      wastePercent: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      companyId: empresa,
      ...datas
    });
    await queryInterface.addIndex("Supplies", ["companyId", "active"]);

    // ── Acabamentos ─────────────────────────────────────────────────────────
    await queryInterface.createTable("Finishes", {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      name: { type: DataTypes.STRING, allowNull: false },
      // area | perimetro | linear | unidade | fixo
      base: { type: DataTypes.STRING(12), allowNull: false, defaultValue: "unidade" },
      cost: { type: DataTypes.DECIMAL(15, 4), allowNull: false, defaultValue: 0 },
      minCost: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      // manual: preço digitado; calculado: custo × markup da empresa.
      priceMode: { type: DataTypes.STRING(10), allowNull: false, defaultValue: "calculado" },
      price: { type: DataTypes.DECIMAL(15, 4), allowNull: false, defaultValue: 0 },
      minPrice: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      companyId: empresa,
      ...datas
    });
    await queryInterface.addIndex("Finishes", ["companyId", "active"]);

    // ── Composição do produto ───────────────────────────────────────────────
    await queryInterface.createTable("ProductSupplies", {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      productId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Products", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      supplyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Supplies", key: "id" },
        onUpdate: "CASCADE",
        // Insumo em uso não é apagado, é desativado; RESTRICT garante isso.
        onDelete: "RESTRICT"
      },
      // Quanto do insumo vai em uma unidade de medida do produto.
      quantity: { type: DataTypes.DECIMAL(12, 4), allowNull: false, defaultValue: 1 },
      companyId: empresa,
      ...datas
    });
    await queryInterface.addIndex("ProductSupplies", ["productId"]);

    await queryInterface.createTable("ProductFinishes", {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      productId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Products", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      finishId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Finishes", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT"
      },
      // Já vem marcado ao escolher o produto (a bainha do banner).
      isDefault: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      companyId: empresa,
      ...datas
    });
    await queryInterface.addIndex("ProductFinishes", ["productId", "finishId"], { unique: true });

    // ── Produto ─────────────────────────────────────────────────────────────
    await queryInterface.addColumn("Products", "priceMode", {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "manual"
    });
    await queryInterface.addColumn("Products", "markupPercent", {
      type: DataTypes.DECIMAL(7, 2),
      allowNull: true
    });

    // ── Itens: fotografia do custo e dos acabamentos ────────────────────────
    // eslint-disable-next-line no-restricted-syntax
    for (const tabela of ["DealItems", "OrderItems"]) {
      // eslint-disable-next-line no-await-in-loop
      await queryInterface.addColumn(tabela, "unitCost", {
        type: DataTypes.DECIMAL(15, 4),
        // Nulo = custo desconhecido (item digitado à mão, ou anterior a esta
        // migration). Diferente de zero, que é um custo.
        allowNull: true
      });
      // eslint-disable-next-line no-await-in-loop
      await queryInterface.addColumn(tabela, "finishes", { type: DataTypes.JSON, allowNull: true });
    }

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

    // eslint-disable-next-line no-restricted-syntax
    for (const tabela of ["DealItems", "OrderItems"]) {
      // eslint-disable-next-line no-await-in-loop
      await queryInterface.removeColumn(tabela, "finishes");
      // eslint-disable-next-line no-await-in-loop
      await queryInterface.removeColumn(tabela, "unitCost");
    }
    await queryInterface.removeColumn("Products", "markupPercent");
    await queryInterface.removeColumn("Products", "priceMode");
    await queryInterface.dropTable("ProductFinishes");
    await queryInterface.dropTable("ProductSupplies");
    await queryInterface.dropTable("Finishes");
    await queryInterface.dropTable("Supplies");
  }
};
