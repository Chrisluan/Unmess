import { QueryInterface } from "sequelize";

// DESATIVADO: no modelo multi-tenant, usuários precisam pertencer a uma
// empresa (companyId). Criar um admin "solto" aqui geraria um usuário sem
// acesso útil ao sistema. Use o seed "create-super-admin" para o acesso
// inicial, e a tela /companies (ou POST /companies) para criar cada empresa
// junto com seu próprio usuário admin.

module.exports = {
  up: (_queryInterface: QueryInterface) => {
    return Promise.resolve();
  },

  down: (_queryInterface: QueryInterface) => {
    return Promise.resolve();
  }
};
