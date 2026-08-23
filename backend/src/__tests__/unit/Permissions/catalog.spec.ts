import express from "express";

import hasPermission from "../../../middleware/hasPermission";
import isAuth from "../../../middleware/isAuth";
import { auditarRotas } from "../../../helpers/permissions/routeGuard";
import { aplicarExcecoes, lerExcecoes } from "../../../helpers/permissions/resolve";
import {
  ALL_PERMISSIONS,
  comDependencias,
  permissoesDoNivel,
  sanitizar,
  semDependentes,
  MODULES
} from "../../../helpers/permissions/catalog";
import {
  garantirQueNaoEhSiMesmo,
  garantirQuePodeConceder,
  garantirQuePodeMexerEm,
  garantirQueSobraAdministrador
} from "../../../helpers/permissions/guards";
import { MODELOS_DE_CARGO } from "../../../helpers/permissions/roleTemplates";

/**
 * Estes testes não tocam o banco de propósito: as regras que eles cobrem são
 * as que decidem quem pode o quê, e uma regra dessas precisa ser conferível
 * sem infraestrutura, em qualquer máquina, em menos de um segundo.
 */

const acesso = (permissions: string[], isSuper = false) => ({
  permissions,
  role: null,
  exceptions: { allow: [], deny: [] },
  isSuper
});

describe("Catálogo de permissões", () => {
  it("não tem dependência apontando para permissão inexistente", () => {
    const validas = new Set(ALL_PERMISSIONS);

    Object.entries(MODULES).forEach(([moduloKey, modulo]) => {
      Object.entries(modulo.acoes).forEach(([acaoKey, acao]) => {
        (acao.requer ?? []).forEach(dep => {
          expect({ de: `${moduloKey}:${acaoKey}`, requer: dep, existe: validas.has(dep) })
            .toEqual({ de: `${moduloKey}:${acaoKey}`, requer: dep, existe: true });
        });
      });
    });
  });

  it("traduz nomes antigos e descarta o que não existe", () => {
    expect(sanitizar(["crm:access", "permissionGroups:edit"])).toEqual([
      "crm:view",
      "roles:manage"
    ]);
    expect(sanitizar(["coisa:inventada", 42, null, undefined])).toEqual([]);
    expect(sanitizar("não é lista")).toEqual([]);
  });

  it("conceder uma ação concede o que ela precisa para funcionar", () => {
    expect(comDependencias(["tickets:delete"])).toEqual([
      "tickets:view",
      "tickets:delete"
    ]);
    // Dependência entre módulos também: etiquetar é ação de atendimento.
    expect(comDependencias(["tags:assign"])).toContain("tickets:view");
  });

  it("tirar uma permissão leva junto quem dependia dela", () => {
    const cargo = permissoesDoNivel("tickets", "gerenciar");
    expect(cargo.length).toBeGreaterThan(1);
    expect(semDependentes(cargo, "tickets:view")).toEqual([]);
  });

  it("os níveis crescem: ver ⊂ operar ⊂ gerenciar", () => {
    Object.keys(MODULES).forEach(moduloKey => {
      const ver = permissoesDoNivel(moduloKey, "ver");
      const operar = permissoesDoNivel(moduloKey, "operar");
      const gerenciar = permissoesDoNivel(moduloKey, "gerenciar");

      ver.forEach(p => expect(operar).toContain(p));
      operar.forEach(p => expect(gerenciar).toContain(p));
    });
  });

  it("os modelos de cargo são conjuntos válidos e fechados", () => {
    MODELOS_DE_CARGO.forEach(modelo => {
      expect(modelo.permissions).toEqual(comDependencias(modelo.permissions));
      expect(modelo.permissions).toEqual(sanitizar(modelo.permissions));
      expect(modelo.permissions.length).toBeGreaterThan(0);
    });
  });

  it("nenhum modelo de cargo dá poder sobre cargos", () => {
    // Só o Administrador mexe em quem pode o quê. Um modelo pronto que
    // concedesse roles:manage entregaria o sistema inteiro em um clique.
    MODELOS_DE_CARGO.forEach(modelo => {
      expect(modelo.permissions).not.toContain("roles:manage");
      expect(modelo.permissions).not.toContain("roles:assign");
    });
  });
});

describe("Resolução do acesso", () => {
  it("cargo mais liberação individual, menos bloqueio individual", () => {
    const resultado = aplicarExcecoes(["tickets:view", "tickets:edit"], {
      allow: ["finance:view"],
      deny: ["tickets:edit"]
    });

    expect(resultado).toContain("tickets:view");
    expect(resultado).toContain("finance:view");
    expect(resultado).not.toContain("tickets:edit");
  });

  it("liberar uma ação solta traz a dependência dela", () => {
    expect(aplicarExcecoes([], { allow: ["finance:settle"], deny: [] })).toEqual([
      "finance:view",
      "finance:settle"
    ]);
  });

  it("bloquear a base derruba o módulo inteiro para a pessoa", () => {
    const cargo = permissoesDoNivel("finance", "gerenciar");
    expect(aplicarExcecoes(cargo, { allow: [], deny: ["finance:view"] })).toEqual(
      []
    );
  });

  it("sem cargo e sem exceção, não pode nada", () => {
    expect(aplicarExcecoes([], { allow: [], deny: [] })).toEqual([]);
  });

  it("JSON estragado nas exceções não concede nada", () => {
    expect(lerExcecoes("{isto não é json")).toEqual({ allow: [], deny: [] });
    expect(lerExcecoes(null)).toEqual({ allow: [], deny: [] });
  });

  it("lê o formato antigo de overrides sem conceder lixo", () => {
    expect(
      lerExcecoes('{"add":["crm:access","x:y"],"remove":["tickets:delete"]}')
    ).toEqual({ allow: ["crm:view"], deny: ["tickets:delete"] });
  });
});

describe("Regras anti-escalação", () => {
  it("ninguém concede o que não tem", () => {
    const ator = acesso(["tickets:view"]);
    expect(() => garantirQuePodeConceder(ator, ["tickets:view"])).not.toThrow();
    expect(() => garantirQuePodeConceder(ator, ["finance:settle"])).toThrow();
  });

  it("o super-admin da plataforma passa por cima", () => {
    expect(() =>
      garantirQuePodeConceder(acesso([], true), [...ALL_PERMISSIONS])
    ).not.toThrow();
  });

  it("ninguém altera o próprio acesso", () => {
    expect(() => garantirQueNaoEhSiMesmo(7, 7)).toThrow();
    expect(() => garantirQueNaoEhSiMesmo(7, 8)).not.toThrow();
  });

  it("ninguém mexe em quem pode mais do que ele", () => {
    const gerente = acesso(["users:view", "roles:view", "roles:assign", "tickets:view"]);
    const atendente = acesso(["tickets:view"]);
    const administrador = acesso([...ALL_PERMISSIONS]);

    expect(() => garantirQuePodeMexerEm(gerente, atendente)).not.toThrow();
    expect(() => garantirQuePodeMexerEm(gerente, administrador)).toThrow();
  });

  it("a empresa não fica sem administrador", () => {
    expect(() => garantirQueSobraAdministrador(1)).not.toThrow();
    expect(() => garantirQueSobraAdministrador(0)).toThrow();
  });
});

describe("Auditoria de rotas", () => {
  /**
   * As rotas de verdade são auditadas no boot do servidor, por
   * exigirRotasProtegidas() em server.ts — importá-las aqui arrastaria o app
   * inteiro (inclusive o WhatsApp e o puppeteer) para dentro do teste. O que
   * este arquivo garante é que o auditor enxerga o que precisa enxergar.
   */
  /**
   * O teste que faltava quando isto foi para produção.
   *
   * O `express-async-errors` troca cada handler por uma função que o embrulha
   * e copia para a nova só o que `Object.keys` enxerga. Com a etiqueta num
   * `Symbol`, ela não sobrevivia à cópia: montado isolado — como o teste
   * montava — o Router parecia certo, e dentro do app real todas as rotas
   * apareciam desprotegidas. Aqui o embrulho é reproduzido de propósito.
   */
  it("a etiqueta sobrevive a um handler embrulhado por outra biblioteca", () => {
    const original = hasPermission("tickets:view");

    const embrulhado: any = (...args: any[]) => (original as any)(...args);
    Object.keys(original).forEach(chave => {
      embrulhado[chave] = (original as any)[chave];
    });

    const app = express();
    const router = express.Router();
    router.get("/x", isAuth, embrulhado, (_req, res) => res.json({}));
    app.use(router);

    expect(auditarRotas(app)).toEqual([]);
  });

  it("acusa rota aberta, rota só com login e permissão inventada", () => {
    const app = express();
    const router = express.Router();

    router.get("/sem-nada", (_req, res) => res.json({}));
    router.post("/so-login", isAuth, (_req, res) => res.json({}));
    app.use(router);

    const problemas = auditarRotas(app);
    expect(problemas).toHaveLength(2);
    expect(problemas[0].caminho).toBe("/sem-nada");
    expect(problemas[1].caminho).toBe("/so-login");

    // Uma permissão que não existe no catálogo nem chega a virar rota: o
    // arquivo de rotas quebra ao ser carregado.
    expect(() => hasPermission("financeiro:sacar-tudo")).toThrow();
  });
});
