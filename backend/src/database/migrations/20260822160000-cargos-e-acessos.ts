import { QueryInterface, DataTypes, QueryTypes } from "sequelize";
import {
  ALL_PERMISSIONS,
  normalizarPermissao,
  comDependencias,
  sanitizar
} from "../../helpers/permissions/catalog";
import { SLUG_ADMINISTRADOR } from "../../helpers/permissions/roleTemplates";

/**
 * Unifica "profile" e "Grupo de Permissão" num conceito só: o Cargo.
 *
 * Antes, duas coisas respondiam à mesma pergunta e só uma valia. O campo
 * `profile` do usuário aceitava admin/user/vendedor/producao/instalacao/
 * financeiro, mas nenhum desses valores era consultado em lugar nenhum do
 * código — exceto "admin", que era um atalho para liberar tudo, e "super".
 * Marcar alguém como "vendedor" não restringia nada; quem restringia era o
 * grupo de permissão, invisível ao lado do seletor de cargo. E o padrão do
 * campo era "admin", então todo usuário criado sem escolha explícita nascia
 * com acesso total.
 *
 * O que esta migração faz:
 *
 *  1. Cria a tabela Roles e as colunas Users.roleId / Users.accessExceptions.
 *  2. Dá a cada empresa um cargo "Administrador" de sistema.
 *  3. Copia cada Grupo de Permissão para um Cargo da mesma empresa.
 *  4. Liga cada usuário ao cargo que reproduz o que ele já podia fazer hoje:
 *     quem era `profile = 'admin'` vira Administrador; o resto herda o cargo
 *     que veio do seu grupo.
 *  5. Traduz os nomes de permissão que mudaram (`modulo:access` virou
 *     `modulo:view`, e o módulo `permissionGroups` virou `roles`).
 *  6. Converte os overrides individuais para o formato novo.
 *  7. Reduz `profile` a "super" ou "member".
 *
 * Ninguém ganha permissão que não tinha. A tabela PermissionGroups e a coluna
 * Users.customPermissions ficam onde estão, intocadas: se algo der errado, o
 * `down` volta a ligar tudo nelas sem ter perdido nada pelo caminho.
 */

/** Formato salvo em Users.customPermissions no sistema antigo. */
interface OverridesAntigos {
  add?: unknown;
  remove?: unknown;
  allow?: unknown;
  deny?: unknown;
}

const lerJson = <T>(cru: string | null, padrao: T): T => {
  if (!cru) return padrao;
  try {
    return JSON.parse(cru) as T;
  } catch (err) {
    return padrao;
  }
};

/**
 * Traduz uma lista salva no banco para os nomes atuais.
 *
 * Quem podia ver o funil passa a poder consultar o catálogo de produtos:
 * `products:view` não existia — a listagem de produtos era protegida por
 * `crm:view` direto na rota. Agora que Produtos é um módulo com permissão
 * própria, quem já montava orçamento precisa dela para o seletor de produtos
 * continuar abrindo.
 */
const traduzir = (lista: unknown): string[] => {
  if (!Array.isArray(lista)) return [];
  const traduzidas = lista
    .filter((p): p is string => typeof p === "string")
    .map(normalizarPermissao);
  if (traduzidas.includes("crm:view")) traduzidas.push("products:view");
  return sanitizar(comDependencias(traduzidas));
};

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const agora = new Date();

    // ── 1. Estrutura ────────────────────────────────────────────────────────
    await queryInterface.createTable("Roles", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      name: { type: DataTypes.STRING(60), allowNull: false },
      /** Identificador estável do cargo de sistema. Nulo nos cargos da empresa. */
      slug: { type: DataTypes.STRING(60), allowNull: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      /**
       * JSON em TEXT, e não o tipo JSON nativo: o dialeto varia entre as
       * instalações e a leitura já passa por um sanitizador de qualquer forma.
       */
      permissions: { type: DataTypes.TEXT, allowNull: false },
      isSystem: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    await queryInterface.addIndex("Roles", ["companyId"]);

    await queryInterface.addColumn("Users", "roleId", {
      type: DataTypes.INTEGER,
      references: { model: "Roles", key: "id" },
      onUpdate: "CASCADE",
      // O cargo apagado não pode levar a pessoa junto: ela fica sem acesso
      // até alguém lhe dar um cargo novo, que é o lado seguro do erro.
      onDelete: "SET NULL",
      allowNull: true
    });

    await queryInterface.addColumn("Users", "accessExceptions", {
      type: DataTypes.TEXT,
      allowNull: true
    });

    // ── 2. Um Administrador por empresa ─────────────────────────────────────
    const empresas: { id: number }[] = await queryInterface.sequelize.query(
      "SELECT id FROM Companies",
      { type: QueryTypes.SELECT }
    );

    const administradorDaEmpresa = new Map<number, number>();

    for (const empresa of empresas) {
      await queryInterface.bulkInsert("Roles", [
        {
          name: "Administrador",
          slug: SLUG_ADMINISTRADOR,
          description:
            "Acesso total ao sistema. Mantido pelo sistema: não pode ser editado nem excluído, e toda permissão criada daqui para a frente já nasce incluída.",
          // O Administrador recebe o catálogo em tempo de execução; a coluna
          // é só o retrato do dia da migração, para quem inspecionar o banco.
          permissions: JSON.stringify([...ALL_PERMISSIONS]),
          isSystem: true,
          companyId: empresa.id,
          createdAt: agora,
          updatedAt: agora
        }
      ]);

      // O MySQL não devolve o id inserido pelo bulkInsert; buscamos pelo slug,
      // que é único por empresa justamente para isto.
      const [criado]: { id: number }[] = await queryInterface.sequelize.query(
        "SELECT id FROM Roles WHERE companyId = :companyId AND slug = :slug LIMIT 1",
        {
          type: QueryTypes.SELECT,
          replacements: { companyId: empresa.id, slug: SLUG_ADMINISTRADOR }
        }
      );

      if (criado) administradorDaEmpresa.set(empresa.id, criado.id);
    }

    // ── 3. Grupos de Permissão viram Cargos ─────────────────────────────────
    const grupos: {
      id: number;
      name: string;
      permissions: string | null;
      companyId: number;
    }[] = await queryInterface.sequelize.query(
      "SELECT id, name, permissions, companyId FROM PermissionGroups",
      { type: QueryTypes.SELECT }
    );

    /** id do grupo antigo → id do cargo novo */
    const cargoDoGrupo = new Map<number, number>();

    for (const grupo of grupos) {
      if (!grupo.companyId) continue;

      const permissoes = traduzir(lerJson<unknown[]>(grupo.permissions, []));

      await queryInterface.bulkInsert("Roles", [
        {
          name: grupo.name,
          slug: null,
          description: "Cargo migrado do grupo de permissão de mesmo nome.",
          permissions: JSON.stringify(permissoes),
          isSystem: false,
          companyId: grupo.companyId,
          createdAt: agora,
          updatedAt: agora
        }
      ]);

      const [novo]: { id: number }[] = await queryInterface.sequelize.query(
        `SELECT id FROM Roles
          WHERE companyId = :companyId AND name = :name AND isSystem = false
          ORDER BY id DESC LIMIT 1`,
        {
          type: QueryTypes.SELECT,
          replacements: { companyId: grupo.companyId, name: grupo.name }
        }
      );

      if (novo) cargoDoGrupo.set(grupo.id, novo.id);
    }

    // ── 4. Cada pessoa recebe o cargo que reproduz o que já podia fazer ─────
    const usuarios: {
      id: number;
      profile: string | null;
      companyId: number | null;
      permissionGroupId: number | null;
      customPermissions: string | null;
    }[] = await queryInterface.sequelize.query(
      `SELECT id, profile, companyId, permissionGroupId, customPermissions
         FROM Users`,
      { type: QueryTypes.SELECT }
    );

    for (const usuario of usuarios) {
      const ehSuper = usuario.profile === "super";

      let roleId: number | null = null;
      if (!ehSuper && usuario.companyId) {
        if (usuario.profile === "admin") {
          roleId = administradorDaEmpresa.get(usuario.companyId) ?? null;
        } else if (usuario.permissionGroupId) {
          roleId = cargoDoGrupo.get(usuario.permissionGroupId) ?? null;
        }
      }

      /**
       * Só `add` e `remove` são migrados.
       *
       * A tela de permissões individuais gravava `{allow, deny}`, mas quem
       * resolvia as permissões só lia `{add, remove}` — o que foi salvo por
       * ali nunca chegou a valer para ninguém. Trazer essas chaves agora
       * concederia, de uma vez, acessos que nunca estiveram em vigor. O que
       * estava de fato valendo é migrado; o que era letra morta fica para
       * trás, e a tela nova mostra as exceções de cada pessoa por escrito,
       * caso alguém precise recriá-las.
       */
      const antigos = lerJson<OverridesAntigos>(usuario.customPermissions, {});
      const excecoes = {
        allow: traduzir(antigos.add),
        deny: traduzir(antigos.remove)
      };
      const temExcecoes = excecoes.allow.length > 0 || excecoes.deny.length > 0;

      await queryInterface.sequelize.query(
        `UPDATE Users
            SET roleId = :roleId,
                accessExceptions = :excecoes,
                profile = :profile
          WHERE id = :id`,
        {
          replacements: {
            id: usuario.id,
            roleId,
            excecoes: temExcecoes ? JSON.stringify(excecoes) : null,
            profile: ehSuper ? "super" : "member"
          }
        }
      );
    }

    // ── 5. O padrão deixa de conceder ───────────────────────────────────────
    await queryInterface.changeColumn("Users", "profile", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "member"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    /**
     * A volta reconstrói o `profile` a partir do cargo: quem está no cargo de
     * Administrador era `admin`, o resto era `user`. Os grupos de permissão e
     * `customPermissions` nunca foram tocados, então voltam a valer sozinhos.
     * Perde-se apenas a distinção entre os profiles decorativos (vendedor,
     * producao, instalacao, financeiro), que não tinham efeito algum.
     */
    await queryInterface.sequelize.query(
      `UPDATE Users u
         LEFT JOIN Roles r ON r.id = u.roleId
          SET u.profile = CASE
                WHEN u.profile = 'super' THEN 'super'
                WHEN r.isSystem = true THEN 'admin'
                ELSE 'user'
              END`
    );

    await queryInterface.changeColumn("Users", "profile", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "admin"
    });

    await queryInterface.removeColumn("Users", "accessExceptions");
    await queryInterface.removeColumn("Users", "roleId");
    await queryInterface.dropTable("Roles");
  }
};
