import { QueryInterface, DataTypes } from "sequelize";

/**
 * Campos comerciais da proposta.
 *
 * O card guardava o essencial do funil (título, valor, prazo) mas nada do que
 * se combina para fechar: como paga, em quantas vezes, se retira ou recebe,
 * quanto de desconto. Sem isso a ordem de serviço saía incompleta e o combinado
 * vivia no WhatsApp, onde ninguém acha depois.
 *
 * Tudo entra anulável: os negócios que já existem continuam válidos sem
 * nenhum desses campos preenchidos.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const colunas: Record<string, any> = {
      // Data e hora combinadas para o cliente ter o material em mãos. É
      // diferente de expectedCloseAt, que é a previsão de fechar a venda.
      deliveryAt: { type: DataTypes.DATE, allowNull: true },
      // "A combinar" precisa ser um estado próprio: sem ele, data vazia tanto
      // significa "ainda não sei" quanto "combinamos que não tem prazo".
      deliveryToArrange: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      // pickup (retirada) | delivery (entrega)
      deliveryMode: {
        type: DataTypes.STRING(12),
        allowNull: false,
        defaultValue: "pickup"
      },
      carrier: { type: DataTypes.STRING, allowNull: true },
      paymentCondition: { type: DataTypes.STRING, allowNull: true },
      installments: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      discount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
      },
      // value | percent — o desconto é digitado de um jeito ou de outro, e
      // guardar só o resultado impediria reabrir a proposta como foi montada.
      discountType: {
        type: DataTypes.STRING(8),
        allowNull: false,
        defaultValue: "value"
      },
      origin: { type: DataTypes.STRING, allowNull: true }
    };

    await Promise.all(
      Object.entries(colunas).map(([nome, definicao]) =>
        queryInterface.addColumn("Deals", nome, definicao)
      )
    );
  },

  down: async (queryInterface: QueryInterface) => {
    const nomes = [
      "deliveryAt",
      "deliveryToArrange",
      "deliveryMode",
      "carrier",
      "paymentCondition",
      "installments",
      "discount",
      "discountType",
      "origin"
    ];

    await Promise.all(
      nomes.map(nome => queryInterface.removeColumn("Deals", nome))
    );
  }
};
