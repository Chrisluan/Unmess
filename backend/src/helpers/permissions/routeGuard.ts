import { RequestHandler } from "express";
import { existePermissao } from "./catalog";

/**
 * Auditoria das rotas.
 *
 * O sistema de permissões mais bem desenhado do mundo não protege a rota que
 * alguém esqueceu de proteger. Foi o que aconteceu com `/whatsappsession/*`:
 * iniciar, reiniciar e desconectar o WhatsApp da empresa pediam login e mais
 * nada, e ninguém percebeu porque nada em lugar nenhum reclamava.
 *
 * Aqui cada middleware de guarda carrega uma etiqueta, e no boot o servidor
 * percorre a árvore de rotas do Express conferindo se todas estão etiquetadas.
 * Rota sem etiqueta derruba o processo antes de aceitar a primeira conexão —
 * de propósito: subir com um endpoint aberto é pior do que não subir.
 *
 * Para declarar uma rota que legitimamente dispensa permissão, use
 * `semPermissao("por quê")`. O motivo fica escrito ao lado da rota, que é
 * onde alguém vai procurar depois.
 */

/**
 * A etiqueta é uma propriedade de string comum, e isso não é descuido.
 *
 * O `express-async-errors` (importado no topo de app.ts para que uma promise
 * rejeitada dentro de um handler vire erro tratado) troca cada handler por uma
 * função que o embrulha, e copia para a nova só o que `Object.keys` enxerga:
 * propriedades próprias, de string e enumeráveis. Símbolo não é copiado.
 * Propriedade não-enumerável também não.
 *
 * A primeira versão usava `Symbol.for(...)`. Funcionava ao montar o Router
 * isolado — que era como o teste o montava — e falhava dentro do app de
 * verdade, onde o embrulho já estava ativo: as etiquetas sumiam, a auditoria
 * declarava as 167 rotas desprotegidas e derrubava o boot. Nome de string,
 * feio como é, é o que atravessa o embrulho.
 */
const ETIQUETA = "__unmessGuardaDeRota";

export type TipoDeGuarda =
  | "auth"        // exige sessão de usuário
  | "authApi"     // exige token de integração externa
  | "permissao"   // exige uma permissão do catálogo
  | "super"       // exige o super-admin da plataforma
  | "livre";      // dispensa autorização, com motivo declarado

interface Etiqueta {
  tipo: TipoDeGuarda;
  permissao?: string;
  motivo?: string;
}

export const etiquetar = <T extends RequestHandler>(
  handler: T,
  etiqueta: Etiqueta
): T => {
  (handler as any)[ETIQUETA] = etiqueta;
  return handler;
};

const lerEtiqueta = (handler: unknown): Etiqueta | undefined =>
  handler && typeof handler === "function"
    ? (handler as any)[ETIQUETA]
    : undefined;

/**
 * Declara que a rota não precisa de permissão, e por quê.
 *
 * Serve para o punhado de rotas que qualquer pessoa autenticada usa: sair do
 * sistema, consultar as próprias permissões, escolher a empresa. O motivo é
 * obrigatório porque a alternativa — uma lista de exceções em outro arquivo —
 * envelhece longe da rota e ninguém a revisa.
 */
export const semPermissao = (motivo: string): RequestHandler =>
  etiquetar((_req, _res, next) => next(), { tipo: "livre", motivo });

// ── Auditoria ───────────────────────────────────────────────────────────────

export interface ProblemaDeRota {
  metodo: string;
  caminho: string;
  problema: string;
}

interface RotaEncontrada {
  metodo: string;
  caminho: string;
  etiquetas: Etiqueta[];
}

const juntarCaminho = (prefixo: string, trecho: string): string => {
  const inteiro = `${prefixo}${trecho}`.replace(/\/{2,}/g, "/");
  return inteiro.length > 1 ? inteiro.replace(/\/$/, "") : inteiro;
};

/**
 * O Express não expõe as rotas registradas; a única forma de enumerá-las é
 * percorrer a pilha interna de camadas. A forma do `regexp` de cada camada de
 * router é reconstruída para texto — é aproximado, e serve para a mensagem de
 * erro, não para roteamento.
 */
const caminhoDaCamada = (camada: any): string => {
  if (camada.path) return camada.path;
  const fonte: string | undefined = camada?.regexp?.source;
  if (!fonte || fonte === "^\\/?(?=\\/|$)") return "";
  return fonte
    .replace(/^\^\\\//, "/")
    .replace(/\\\/\?\(\?=\\\/\|\$\)$/, "")
    .replace(/\\\//g, "/")
    .replace(/\(\?:\(\[\^\\\/]\+\?\)\)/g, ":param")
    .replace(/[$^?]/g, "");
};

const percorrer = (pilha: any[], prefixo: string): RotaEncontrada[] => {
  const rotas: RotaEncontrada[] = [];

  pilha.forEach(camada => {
    if (camada.route) {
      const caminho = juntarCaminho(prefixo, camada.route.path);
      const etiquetas = camada.route.stack
        .map((c: any) => lerEtiqueta(c.handle))
        .filter(Boolean) as Etiqueta[];

      Object.keys(camada.route.methods)
        .filter(m => camada.route.methods[m])
        .forEach(metodo =>
          rotas.push({ metodo: metodo.toUpperCase(), caminho, etiquetas })
        );
      return;
    }

    if (camada.handle?.stack) {
      rotas.push(
        ...percorrer(
          camada.handle.stack,
          juntarCaminho(prefixo, caminhoDaCamada(camada))
        )
      );
    }
  });

  return rotas;
};

const avaliar = (rota: RotaEncontrada): string | null => {
  const tipos = rota.etiquetas.map(e => e.tipo);

  if (tipos.includes("livre")) return null;
  if (tipos.includes("authApi")) return null;

  if (!tipos.includes("auth")) {
    return "não exige autenticação e não foi declarada com semPermissao()";
  }

  if (tipos.includes("super") || tipos.includes("permissao")) {
    const invalida = rota.etiquetas.find(
      e => e.tipo === "permissao" && !existePermissao(e.permissao ?? "")
    );
    if (invalida) {
      return `exige a permissão "${invalida.permissao}", que não existe no catálogo`;
    }
    return null;
  }

  return "exige login mas não exige permissão nenhuma; use hasPermission(...), isSuper ou semPermissao(\"motivo\")";
};

/** Aceita tanto um Router (tem `.stack`) quanto o app do Express. */
const pilhaDe = (alvo: any): any[] =>
  alvo?.stack ?? alvo?._router?.stack ?? alvo?.router?.stack ?? [];

export const auditarRotas = (alvo: any): ProblemaDeRota[] =>
  problemasEm(percorrer(pilhaDe(alvo), ""));

const problemasEm = (rotas: RotaEncontrada[]): ProblemaDeRota[] =>
  rotas
    .map(rota => {
      const problema = avaliar(rota);
      return problema
        ? { metodo: rota.metodo, caminho: rota.caminho, problema }
        : null;
    })
    .filter((p): p is ProblemaDeRota => p !== null);

/**
 * O retrato das rotas, tirado assim que o Router termina de ser montado.
 *
 * Não dá para auditar o app depois que ele subiu: o Sentry instrumenta o
 * Express trocando o handler de cada camada por uma função que mede o tempo
 * da chamada, e a etiqueta fica na função original, que some nessa troca.
 * Lido tarde demais, o resultado é que *toda* rota parece desprotegida — o
 * que é pior do que não auditar, porque é um alarme que não distingue nada.
 *
 * Aqui o retrato é tirado antes de o Router encostar no app, quando as
 * funções ainda são as que foram declaradas nos arquivos de rota.
 */
let retrato: RotaEncontrada[] | null = null;

export const capturarRotas = (router: any): void => {
  retrato = percorrer(pilhaDe(router), "");
};

const relatorio = (problemas: ProblemaDeRota[]): string => {
  const lista = problemas
    .map(p => `  ${p.metodo.padEnd(6)} ${p.caminho} — ${p.problema}`)
    .join("\n");

  return (
    `Auditoria de rotas: ${problemas.length} rota(s) sem guarda declarada:\n${lista}\n\n` +
    "Toda rota precisa de isAuth + hasPermission(...), ou isSuper, ou " +
    'semPermissao("motivo") declarando por que dispensa permissão.'
  );
};

/**
 * Confere o retrato no boot.
 *
 * Fora de produção, lança: é durante o desenvolvimento que uma rota sem
 * guarda tem que doer, e é lá que o erro custa barato.
 *
 * Em produção, grita no log e deixa subir — e essa escolha foi paga para ser
 * aprendida. A primeira versão derrubava o processo em qualquer ambiente, com
 * o argumento de que subir com um endpoint aberto é pior do que não subir. Aí
 * um falso positivo (a instrumentação do Sentry apagando as etiquetas)
 * marcou as 167 rotas como desprotegidas e tirou o sistema inteiro do ar, por
 * horas, sem que houvesse rota aberta nenhuma. Uma checagem de segurança que
 * pode errar não deve ter poder de desligar o produto: o que ela precisa é
 * ser impossível de ignorar, e para isso basta um erro no log de quem opera.
 */
export const verificarRotasProtegidas = (
  registrar: (mensagem: string) => void
): ProblemaDeRota[] => {
  if (!retrato) {
    registrar(
      "Auditoria de rotas não rodou: nenhum retrato foi capturado. " +
        "Confira se routes/index.ts ainda chama capturarRotas(routes)."
    );
    return [];
  }

  const problemas = problemasEm(retrato);
  if (problemas.length === 0) return [];

  if (process.env.NODE_ENV !== "production") {
    throw new Error(relatorio(problemas));
  }

  registrar(relatorio(problemas));
  return problemas;
};
