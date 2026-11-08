import { QueryInterface, DataTypes, QueryTypes } from "sequelize";

/**
 * Escopo de acesso: sobre quais coisas cada permissão vale.
 *
 * Duas colunas de JSON, espelhando exatamente onde as permissões já moram:
 * o padrão no cargo (`Roles.scopes`, ao lado de `Roles.permissions`) e as
 * exceções na pessoa (`Users.scopeExceptions`, ao lado de
 * `Users.accessExceptions`). Nada aqui é consultado pelo banco — entra e sai
 * inteiro, na mesma leitura que já busca o cargo —, então uma tabela de
 * junção por dimensão custaria três joins por requisição para guardar uma
 * lista de inteiros.
 *
 * ── Sobre o preenchimento abaixo ────────────────────────────────────────────
 *
 * A regra escolhida é "escopo vazio não alcança nada". Numa base nova isso é
 * apenas seguro; numa base em produção, aplicado sem mais nada, é um apagão:
 * na primeira requisição depois do restart, todo mundo abriria o CRM sem
 * quadro nenhum e o financeiro sem conta nenhuma, porque ninguém nunca teve a
 * chance de configurar um escopo que não existia.
 *
 * Por isso todo cargo já existente nasce irrestrito. Não é uma exceção à
 * regra — é a tradução fiel do que esses cargos já podiam fazer hoje, que era
 * ver tudo. A regra vale de agora em diante: cargo criado depois desta
 * migração começa sem alcance, e quem o criar decide o que ele alcança.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Roles", "scopes", {
      type: DataTypes.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn("Users", "scopeExceptions", {
      type: DataTypes.TEXT,
      allowNull: true
    });

    /**
     * Irrestrito, e não a lista dos ids de hoje.
     *
     * Congelar os quadros existentes numa lista pareceria mais explícito, mas
     * mudaria o comportamento no dia seguinte: o primeiro quadro novo nasceria
     * invisível para a empresa inteira, e ninguém ligaria uma coisa à outra.
     * "Acompanha tudo" é o que esses cargos faziam ontem e continuam fazendo.
     */
    const irrestrito = JSON.stringify({
      board: { todos: true },
      account: { todos: true },
      connection: { todos: true }
    });

    await queryInterface.sequelize.query(
      "UPDATE Roles SET scopes = :irrestrito WHERE scopes IS NULL",
      { replacements: { irrestrito }, type: QueryTypes.UPDATE }
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Users", "scopeExceptions");
    await queryInterface.removeColumn("Roles", "scopes");
  }
};
