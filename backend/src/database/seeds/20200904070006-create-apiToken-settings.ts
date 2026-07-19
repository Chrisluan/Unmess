import { QueryInterface } from "sequelize";

// DESATIVADO: Settings (incluindo o token de API) agora é escopada por
// empresa (companyId). Cada empresa deve gerar seu próprio "userApiToken"
// pela tela de Configurações depois de criada, em vez de um token global
// compartilhado entre todos os tenants.

module.exports = {
  up: (_queryInterface: QueryInterface) => {
    return Promise.resolve();
  },

  down: (_queryInterface: QueryInterface) => {
    return Promise.resolve();
  }
};
