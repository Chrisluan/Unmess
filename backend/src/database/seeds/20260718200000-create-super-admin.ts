import { QueryInterface } from "sequelize";

// Cria o usuário super-admin inicial do SaaS (profile "super", sem companyId).
// Ele é o único que enxerga e gerencia a tela de Empresas (/companies),
// responsável por cadastrar cada empresa cliente e seu respectivo admin.
//
// Login padrão gerado por este seed:
//   e-mail:  super@whaticket.com
//   senha:   super123
//
// IMPORTANTE: troque a senha logo após o primeiro login em produção.

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.bulkInsert(
      "Users",
      [
        {
          name: "Super Admin",
          email: "super@whaticket.com",
          passwordHash:
            "$2a$08$/GlBZWea/pY3FJ99I1.XjewxBXKLVs/YcKxT3XHX7ri3EoSCNRucq",
          profile: "super",
          companyId: null,
          tokenVersion: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ],
      {}
    );
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.bulkDelete("Users", { email: "super@whaticket.com" });
  }
};
