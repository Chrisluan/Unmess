#!/usr/bin/env node
/**
 * Atualiza a instalação a partir da branch `production` do GitHub.
 *
 * O fluxo pretendido é: você faz push para `production`, e o servidor se
 * atualiza sozinho -- sem RDP, sem estar no escritório, sem ninguém aqui.
 *
 * O que ele faz, e por que cada passo existe:
 *
 *   1. Recusa rodar se houver alteração não commitada aqui. Um `git reset`
 *      apagaria o trabalho de quem estivesse editando na máquina.
 *   2. Só age quando há commit novo. Sem isso, cada verificação recompilaria
 *      1,7 MB de bundle numa máquina de 2 núcleos que atende clientes.
 *   3. Guarda o que está no ar antes de trocar. É o que permite voltar.
 *   4. Compila ANTES de tocar nos serviços. Código que não compila nunca chega
 *      a derrubar o atendimento.
 *   5. Confere a saúde depois de subir, e volta atrás sozinho se o backend não
 *      responder. Um deploy quebrado às 3 da manhã se desfaz sem ninguém.
 *
 * Uso:
 *   node scripts/atualizar-producao.js            verifica e atualiza se houver novidade
 *   node scripts/atualizar-producao.js --forcar   recompila mesmo sem commit novo
 *   node scripts/atualizar-producao.js --dry-run  mostra o que faria, sem fazer
 */
const { execFileSync, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const http = require("http");

const RAIZ = path.join(__dirname, "..");
const BRANCH = process.env.UNMESS_BRANCH || "production";
const LOG = path.join(RAIZ, "logs", "atualizacao.log");
const RESERVA = path.join(RAIZ, ".reserva-deploy");

const FORCAR = process.argv.includes("--forcar");
const SIMULAR = process.argv.includes("--dry-run");

const PORTA_BACKEND = 8080;
const PORTA_FRONTEND = 3333;

// ------------------------------------------------------------------ registro

const registrar = (texto, marca = "  ") => {
  const linha = `${new Date().toISOString()} ${marca} ${texto}`;
  console.log(`${marca} ${texto}`);
  try {
    fs.mkdirSync(path.dirname(LOG), { recursive: true });
    fs.appendFileSync(LOG, `${linha}\n`);
  } catch {
    // Não conseguir gravar o log não é motivo para abortar uma atualização.
  }
};

const git = (args, opcoes = {}) =>
  execFileSync("git", args, { cwd: RAIZ, encoding: "utf8", ...opcoes }).trim();

const rodar = (comando, cwd, timeout = 900000) =>
  execSync(comando, { cwd, encoding: "utf8", timeout, stdio: "pipe" });

// ------------------------------------------------------------------ verificações

/**
 * Trabalho não salvo na máquina impede a atualização.
 *
 * O deploy usa `reset --hard` para garantir que a instalação fique idêntica ao
 * que está no GitHub. Se alguém estiver editando aqui, esse reset apaga tudo
 * sem aviso -- então a atualização para e avisa, em vez de destruir.
 */
const arvoreLimpa = () => git(["status", "--porcelain"]).length === 0;

const commitAtual = () => git(["rev-parse", "HEAD"]);
const commitRemoto = () => git(["rev-parse", `origin/${BRANCH}`]);

const resumoDoCommit = ref =>
  git(["log", "-1", "--pretty=%h %s (%an, %ar)", ref]);

/** Só recompila o que mudou: o build do frontend leva minutos, o do backend segundos. */
const mudouEm = (de, para, prefixo) => {
  const saida = git(["diff", "--name-only", `${de}..${para}`]);
  return saida.split("\n").some(l => l.startsWith(prefixo));
};

const dependenciasMudaram = (de, para, pasta) => {
  const saida = git(["diff", "--name-only", `${de}..${para}`]);
  return saida
    .split("\n")
    .some(l => l === `${pasta}/package.json` || l === `${pasta}/package-lock.json`);
};

// ------------------------------------------------------------------ serviços

const powershell = comando =>
  execFileSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", comando],
    { encoding: "utf8", timeout: 180000, windowsHide: true }
  ).trim();

const reiniciarServico = nome => {
  const saida = powershell(
    `$ErrorActionPreference='Stop';` +
      `try { Restart-Service -Name '${nome}';` +
      `(Get-Service '${nome}').WaitForStatus('Running',(New-TimeSpan -Seconds 90));` +
      `'ok' } catch { 'falha: ' + $_.Exception.Message }`
  );
  if (!saida.startsWith("ok")) throw new Error(`${nome}: ${saida}`);
};

/**
 * O serviço estar "Running" não significa que a aplicação subiu -- o Node pode
 * ter morrido por erro logo depois. Só a porta respondendo prova que está de pé.
 */
const esperarPorta = (porta, tentativas = 20) =>
  new Promise(resolve => {
    let restantes = tentativas;

    const tentar = () => {
      const req = http.get(
        { host: "127.0.0.1", port: porta, path: "/", timeout: 3000 },
        res => {
          res.destroy();
          resolve(true);
        }
      );
      req.on("error", () => {
        restantes -= 1;
        if (restantes <= 0) return resolve(false);
        setTimeout(tentar, 3000);
      });
      req.on("timeout", () => {
        req.destroy();
      });
    };

    tentar();
  });

// ------------------------------------------------------------------ reserva

/**
 * Guarda o que está no ar hoje, para poder voltar.
 *
 * Só o resultado da compilação: o código-fonte volta com um `git reset` para o
 * commit anterior, que é mais confiável do que copiar a árvore inteira.
 */
const guardarReserva = () => {
  fs.rmSync(RESERVA, { recursive: true, force: true });
  fs.mkdirSync(RESERVA, { recursive: true });

  const dist = path.join(RAIZ, "backend", "dist");
  const build = path.join(RAIZ, "frontend", "build");

  if (fs.existsSync(dist)) fs.cpSync(dist, path.join(RESERVA, "dist"), { recursive: true });
  if (fs.existsSync(build)) fs.cpSync(build, path.join(RESERVA, "build"), { recursive: true });

  fs.writeFileSync(path.join(RESERVA, "commit.txt"), commitAtual());
};

const restaurarReserva = () => {
  const commitAnterior = fs.readFileSync(path.join(RESERVA, "commit.txt"), "utf8").trim();

  registrar(`voltando para ${commitAnterior.slice(0, 8)}`, "↩");
  git(["reset", "--hard", commitAnterior]);

  const dist = path.join(RESERVA, "dist");
  const build = path.join(RESERVA, "build");

  if (fs.existsSync(dist)) {
    fs.rmSync(path.join(RAIZ, "backend", "dist"), { recursive: true, force: true });
    fs.cpSync(dist, path.join(RAIZ, "backend", "dist"), { recursive: true });
  }
  if (fs.existsSync(build)) {
    fs.rmSync(path.join(RAIZ, "frontend", "build"), { recursive: true, force: true });
    fs.cpSync(build, path.join(RAIZ, "frontend", "build"), { recursive: true });
  }
};

// ------------------------------------------------------------------ principal

(async () => {
  registrar("=".repeat(58));
  registrar(`verificando a branch ${BRANCH}`, "→");

  if (!arvoreLimpa()) {
    registrar("há alterações não commitadas nesta máquina.", "✗");
    registrar("a atualização apagaria esse trabalho, então parei aqui.", " ");
    registrar("commite ou descarte, e rode de novo.", " ");
    process.exit(1);
  }

  git(["fetch", "origin", BRANCH, "--quiet"]);

  const antes = commitAtual();
  const depois = commitRemoto();

  if (antes === depois && !FORCAR) {
    registrar("já está na versão mais recente; nada a fazer.", "✓");
    process.exit(0);
  }

  if (antes !== depois) {
    registrar(`novidade: ${resumoDoCommit(`origin/${BRANCH}`)}`, "•");
  }

  const precisaBackend = FORCAR || mudouEm(antes, depois, "backend/");
  const precisaFrontend = FORCAR || mudouEm(antes, depois, "frontend/");
  const npmBackend = dependenciasMudaram(antes, depois, "backend");
  const npmFrontend = dependenciasMudaram(antes, depois, "frontend");

  registrar(
    `backend: ${precisaBackend ? "recompilar" : "sem mudanças"} · ` +
      `frontend: ${precisaFrontend ? "recompilar" : "sem mudanças"}`,
    "•"
  );

  if (SIMULAR) {
    registrar("--dry-run: nada foi alterado.", "✓");
    process.exit(0);
  }

  guardarReserva();
  registrar("versão atual guardada para poder voltar", "✓");

  try {
    // O reset garante que a instalação fique exatamente igual ao GitHub, sem
    // resquício de merge ou de arquivo editado à mão no servidor.
    git(["checkout", BRANCH, "--quiet"]);
    git(["reset", "--hard", `origin/${BRANCH}`, "--quiet"]);
    registrar(`código atualizado para ${depois.slice(0, 8)}`, "✓");

    if (npmBackend) {
      registrar("dependências do backend mudaram; instalando…");
      rodar("npm ci --omit=dev --no-audit --no-fund", path.join(RAIZ, "backend"));
    }
    if (npmFrontend) {
      registrar("dependências do frontend mudaram; instalando…");
      rodar("npm ci --no-audit --no-fund", path.join(RAIZ, "frontend"));
    }

    // Compilar antes de mexer nos serviços: se o código novo não compila, o
    // atendimento nunca chega a ser interrompido.
    if (precisaBackend) {
      registrar("compilando o backend…");
      rodar("npm run build", path.join(RAIZ, "backend"));
      registrar("backend compilado", "✓");
    }
    if (precisaFrontend) {
      registrar("compilando o frontend… (alguns minutos)");
      rodar("npx vite build", path.join(RAIZ, "frontend"));
      registrar("frontend compilado", "✓");
    }

    if (precisaBackend) {
      registrar("aplicando migrations…");
      rodar("npx sequelize db:migrate", path.join(RAIZ, "backend"));
      registrar("banco atualizado", "✓");
    }

    if (precisaBackend) {
      registrar("reiniciando a API…");
      reiniciarServico("unmess-backend");
    }
    if (precisaFrontend) {
      registrar("reiniciando a interface…");
      reiniciarServico("unmess-frontend");
    }

    const apiOk = await esperarPorta(PORTA_BACKEND);
    const telaOk = await esperarPorta(PORTA_FRONTEND);

    if (!apiOk || !telaOk) {
      throw new Error(
        `serviço não respondeu depois de subir (api=${apiOk ? "ok" : "mudo"}, ` +
          `tela=${telaOk ? "ok" : "muda"})`
      );
    }

    registrar(`atualizado e no ar: ${resumoDoCommit("HEAD")}`, "✓");
    fs.rmSync(RESERVA, { recursive: true, force: true });
  } catch (erro) {
    registrar(`falhou: ${String(erro.message).split("\n")[0]}`, "✗");

    try {
      restaurarReserva();
      reiniciarServico("unmess-backend");
      reiniciarServico("unmess-frontend");

      const voltouApi = await esperarPorta(PORTA_BACKEND);
      registrar(
        voltouApi
          ? "versão anterior restaurada e no ar."
          : "versão anterior restaurada, mas a API não respondeu — precisa de olho humano.",
        voltouApi ? "✓" : "!"
      );
    } catch (erroVolta) {
      registrar(`a volta atrás também falhou: ${erroVolta.message}`, "✗");
      registrar(`reserva preservada em ${RESERVA}`, "!");
    }

    process.exit(1);
  }
})();
