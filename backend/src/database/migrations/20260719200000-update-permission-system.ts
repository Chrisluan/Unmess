/**
 * Esta migração é informacional — as colunas customPermissions e permissionGroupId
 * já foram criadas pela migration 20260719100005.
 *
 * O que mudou nesta versão:
 * - AvailablePermissions agora é derivado de PERMISSION_MODULES (flat list organizada por módulo)
 * - Não há mudança de schema; apenas lógica de aplicação
 *
 * Se você precisar limpar permissões legadas (ex: "chats:viewAll" → "tickets:viewAll"),
 * execute o script SQL abaixo manualmente ou adicione um up/down aqui.
 */

import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Nenhuma alteração de schema necessária nesta migração.
    // As permissões são strings armazenadas em JSON — a validação ocorre
    // no nível de aplicação (AvailablePermissions.ts), não no banco.
    return Promise.resolve();
  },

  down: async (queryInterface: QueryInterface) => {
    return Promise.resolve();
  },
};
