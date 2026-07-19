import { QueryInterface } from "sequelize";

// DESATIVADO: Settings agora é escopada por empresa (companyId), e essa
// configuração não tem mais uso (a rota /signup, que ela controlava, foi
// removida no modelo multi-tenant). Cada empresa pode ter suas próprias
// Settings criadas normalmente pela tela de configurações do admin.

module.exports = {
  up: (_queryInterface: QueryInterface) => {
    return Promise.resolve();
  },

  down: (_queryInterface: QueryInterface) => {
    return Promise.resolve();
  }
};
