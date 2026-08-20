import { QueryInterface, DataTypes } from "sequelize";

/**
 * Medidas no item e forma de cobrança no produto.
 *
 * Comunicação visual não se vende por unidade na maior parte dos casos: um
 * banner é 3,00 × 1,50 a tanto o metro quadrado, uma faixa é 8 metros lineares,
 * uma letra caixa é por peça. Hoje o sistema só sabia multiplicar quantidade
 * por preço, o que obrigava a calcular a área na calculadora antes de digitar
 * -- e a conta errada só aparecia quando o cliente conferia.
 *
 * Os três modos convivem no mesmo orçamento porque é assim que o trabalho
 * chega: o mesmo pedido tem banner por m², faixa por metro e letra por peça.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    /**
     * unit   — por peça, como era antes
     * area   — largura x altura x peças, ao preço do m²
     * linear — comprimento x peças, ao preço do metro
     */
    await queryInterface.addColumn("Products", "pricingMode", {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "unit"
    });

    /**
     * Mínimo cobrado por peça, na unidade do modo.
     *
     * Quase todo serviço tem um piso: sem ele, um adesivo de 10 x 10 cm sairia
     * por centavos, quando o custo de preparar a máquina e refilar é o mesmo de
     * uma peça grande. Zero significa sem mínimo.
     */
    await queryInterface.addColumn("Products", "minMeasure", {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: false,
      defaultValue: 0
    });

    const medidas: Record<string, any> = {
      // Guardadas em metros, com 3 casas: 1,5 cm de sangria importa numa
      // fachada, e centímetro redondo perderia isso.
      width: { type: DataTypes.DECIMAL(10, 3), allowNull: true },
      height: { type: DataTypes.DECIMAL(10, 3), allowNull: true },
      // Copiado do produto no momento do orçamento, e não lido dele: mudar a
      // forma de cobrança do catálogo não pode reescrever pedido já fechado.
      pricingMode: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: "unit"
      },
      minMeasure: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
        defaultValue: 0
      }
    };

    await Promise.all(
      Object.entries(medidas).map(([nome, definicao]) =>
        queryInterface.addColumn("DealItems", nome, definicao)
      )
    );
  },

  down: async (queryInterface: QueryInterface) => {
    for (const nome of ["width", "height", "pricingMode", "minMeasure"]) {
      await queryInterface.removeColumn("DealItems", nome);
    }
    await queryInterface.removeColumn("Products", "minMeasure");
    await queryInterface.removeColumn("Products", "pricingMode");
  }
};
