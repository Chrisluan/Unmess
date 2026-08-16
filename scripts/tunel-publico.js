#!/usr/bin/env node
/**
 * Publica a instalação na internet por túneis provisórios da Cloudflare.
 *
 * Serve para o intervalo entre "precisa estar no ar" e "o domínio saiu". Sobe
 * dois quick tunnels -- um para a interface, outro para a API -- e ajusta as
 * duas pontas para conversarem pelos endereços novos.
 *
 * O que ele resolve, e que fazer na mão custaria caro:
 *
 *   1. Quick tunnel sorteia um endereço a cada execução. Como as variáveis
 *      VITE_* entram no bundle durante o build, cada troca exigiria recompilar
 *      o frontend; aqui o endereço vai para endereco-publico.json, servido em
 *      /env.js e lido pelo navegador em tempo de execução.
 *   2. O backend recusa por CORS qualquer origem que não conheça, e o endereço
 *      do frontend muda junto. A origem nova entra em PUBLIC_ORIGINS.
 *   3. Se um túnel cai, os dois endereços viram pó. O script percebe, levanta
 *      de novo e refaz a configuração sozinho.
 *
 * Uso (PowerShell como Administrador -- reiniciar o backend exige isso):
 *   node scripts/tunel-publico.js
 *
 * Ctrl+C derruba os túneis e devolve a instalação ao acesso local.
 *
 * AVISO: trycloudflare.com é infraestrutura descartável -- sem garantia de
 * disponibilidade e com endereço novo a cada subida. Serve para atravessar a
 * espera do domínio, não para ficar.
 */
const { execFile, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const ARQUIVO_ENDERECO = path.join(RAIZ, "frontend", "endereco-publico.json");
const ENVS_BACKEND = [path.join(RAIZ, "backend", ".env"), path.join(RAIZ, "backend", ".env.network")];

const ALVOS = {
  frontend: { porta: 3333, rotulo: "Interface" },
  backend: { porta: 8080, rotulo: "API" }
};

const PADRAO_URL = /https:\/\/[a-z0-9][a-z0-9-]*\.trycloudflare\.com/i;
const ESPERA_URL_MS = 90000;

const enderecos = {}; // frontend | backend -> URL pública
const processos = {}; // frontend | backend -> ChildProcess
let encerrando = false;
let reconfigurando = null; // Promise em curso, para não reconfigurar em paralelo

const log = (texto, marca = "  ") => console.log(`${marca} ${texto}`);

// ------------------------------------------------------------------ cloudflared

const versaoCloudflared = () =>
  new Promise(resolve => {
    execFile("cloudflared", ["--version"], { windowsHide: true }, (erro, saida) => {
      resolve(erro ? null : String(saida).trim());
    });
  });

/**
 * Sobe um quick tunnel e resolve quando a URL aparecer.
 *
 * O cloudflared escreve tudo no stderr, inclusive a URL, dentro de uma moldura
 * ASCII. Não há modo "só me diga a URL", então resta procurá-la na saída.
 */
const abrirTunel = alvo =>
  new Promise((resolve, reject) => {
    const { porta, rotulo } = ALVOS[alvo];
    log(`abrindo túnel para ${rotulo} (porta ${porta})…`);

    const processo = spawn(
      "cloudflared",
      ["tunnel", "--no-autoupdate", "--url", `http://localhost:${porta}`],
      { windowsHide: true }
    );

    processos[alvo] = processo;

    let resolvido = false;
    const relogio = setTimeout(() => {
      if (resolvido) return;
      resolvido = true;
      encerrarProcesso(alvo);
      reject(new Error(`${rotulo}: o cloudflared não devolveu endereço em 90s.`));
    }, ESPERA_URL_MS);

    const procurarUrl = pedaco => {
      const texto = String(pedaco);
      const achado = texto.match(PADRAO_URL);
      if (!achado || resolvido) return;

      resolvido = true;
      clearTimeout(relogio);
      enderecos[alvo] = achado[0];
      log(`${rotulo}: ${achado[0]}`, "✓");
      resolve(achado[0]);
    };

    processo.stdout.on("data", procurarUrl);
    processo.stderr.on("data", procurarUrl);

    processo.on("error", erro => {
      if (resolvido) return;
      resolvido = true;
      clearTimeout(relogio);
      reject(new Error(`Falha ao executar cloudflared: ${erro.message}`));
    });

    // Queda depois de estabelecido é o caso que importa tratar: o endereço
    // morre com o processo, e o atendimento cai junto.
    processo.on("exit", codigo => {
      delete processos[alvo];
      if (encerrando || !resolvido) return;

      delete enderecos[alvo];
      log(`${rotulo}: o túnel caiu (código ${codigo}). Levantando de novo…`, "!");
      restabelecer();
    });
  });

const encerrarProcesso = alvo => {
  const processo = processos[alvo];
  if (!processo) return;
  delete processos[alvo];

  // No Windows, matar o pai deixa a árvore de filhos viva; o taskkill /T é o
  // que garante que o cloudflared não fique segurando a porta.
  execFile("taskkill", ["/pid", String(processo.pid), "/T", "/F"], { windowsHide: true }, () => {});
};

// ------------------------------------------------------------------ configuração

/** Grava o endereço público que o /env.js do frontend vai servir. */
const escreverEnderecoFrontend = () => {
  const hostname = new URL(enderecos.frontend).hostname;

  fs.writeFileSync(
    ARQUIVO_ENDERECO,
    JSON.stringify(
      {
        VITE_PUBLIC_APP_HOST: hostname,
        VITE_PUBLIC_API_URL: enderecos.backend,
        // Precisa constar mesmo vazia: quando window.ENV existe, o frontend
        // lê todas as chaves dele e não volta para as variáveis do build.
        VITE_HOURS_CLOSE_TICKETS_AUTO: null,
        atualizadoEm: new Date().toISOString()
      },
      null,
      2
    )
  );

  log(`interface publicada em ${enderecos.frontend}`, "✓");
};

/**
 * Coloca a origem do frontend em PUBLIC_ORIGINS, de onde o backend monta a
 * lista de CORS.
 *
 * As origens de túnel anteriores são descartadas em vez de acumuladas: cada
 * uma delas é um endereço morto que só serviria para aumentar a lista de quem
 * pode falar com a API.
 */
const atualizarOrigensBackend = () => {
  let mudou = false;

  for (const arquivo of ENVS_BACKEND) {
    if (!fs.existsSync(arquivo)) continue;

    const original = fs.readFileSync(arquivo, "utf8");
    const linhas = original.split(/\r?\n/);
    const indice = linhas.findIndex(l => /^\s*PUBLIC_ORIGINS\s*=/.test(l));

    const atuais =
      indice >= 0
        ? linhas[indice]
            .replace(/^\s*PUBLIC_ORIGINS\s*=/, "")
            .split(",")
            .map(o => o.trim())
            .filter(Boolean)
        : [];

    const preservadas = atuais.filter(o => !/trycloudflare\.com/i.test(o));
    const novas = [...new Set([...preservadas, enderecos.frontend])];
    const linhaNova = `PUBLIC_ORIGINS=${novas.join(",")}`;

    if (indice >= 0) {
      if (linhas[indice] === linhaNova) continue;
      linhas[indice] = linhaNova;
    } else {
      linhas.push(linhaNova);
    }

    fs.writeFileSync(arquivo, linhas.join("\r\n"));
    mudou = true;
  }

  return mudou;
};

/**
 * O backend lê PUBLIC_ORIGINS de process.env, que só é preenchido na subida --
 * sem reiniciar, a origem nova continua barrada no CORS.
 */
const reiniciarBackend = () =>
  new Promise((resolve, reject) => {
    log("reiniciando o backend para aplicar a origem nova…");

    execFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "$ErrorActionPreference='Stop';" +
          "try { Restart-Service -Name 'unmess-backend';" +
          "(Get-Service 'unmess-backend').WaitForStatus('Running',(New-TimeSpan -Seconds 60));" +
          "'ok' } catch { 'falha: ' + $_.Exception.Message }"
      ],
      { windowsHide: true, timeout: 90000 },
      (erro, saida) => {
        const texto = String(saida || "").trim();
        if (erro) return reject(new Error(erro.message));
        if (!texto.startsWith("ok")) return reject(new Error(texto));
        log("backend no ar com a origem nova", "✓");
        resolve();
      }
    );
  });

const aplicarConfiguracao = async () => {
  escreverEnderecoFrontend();

  if (atualizarOrigensBackend()) {
    try {
      await reiniciarBackend();
    } catch (erro) {
      log(`não consegui reiniciar o backend: ${erro.message}`, "!");
      log("sem isso o navegador será bloqueado por CORS ao abrir a interface.", "!");
      log("rode este script num PowerShell como Administrador.", "!");
    }
  }
};

/** Recria o que estiver faltando e reconfigura. Uma execução por vez. */
const restabelecer = () => {
  if (encerrando) return Promise.resolve();
  if (reconfigurando) return reconfigurando;

  reconfigurando = (async () => {
    for (const alvo of Object.keys(ALVOS)) {
      if (enderecos[alvo]) continue;
      try {
        await abrirTunel(alvo);
      } catch (erro) {
        log(erro.message, "✗");
        // Esperar antes de tentar de novo: insistir em rajada contra um serviço
        // gratuito é o caminho mais curto para ser bloqueado por abuso.
        await new Promise(r => setTimeout(r, 10000));
        if (!encerrando) restabelecer();
        return;
      }
    }

    await aplicarConfiguracao();
    resumo();
  })().finally(() => {
    reconfigurando = null;
  });

  return reconfigurando;
};

const resumo = () => {
  console.log("");
  console.log("  ┌─ No ar ────────────────────────────────────────────");
  console.log(`  │  Interface : ${enderecos.frontend}`);
  console.log(`  │  API       : ${enderecos.backend}`);
  console.log("  └────────────────────────────────────────────────────");
  console.log("");
  log("estes endereços mudam se o túnel cair; deixe esta janela aberta.");
  log("Ctrl+C derruba os túneis e volta ao acesso só pela rede local.");
  console.log("");
};

// ------------------------------------------------------------------ ciclo de vida

const encerrar = () => {
  if (encerrando) return;
  encerrando = true;

  console.log("");
  log("derrubando os túneis…");

  Object.keys(processos).forEach(encerrarProcesso);

  // O arquivo some junto: mantê-lo apontaria o navegador para um endereço que
  // já não responde, em vez de deixar o frontend voltar a deduzir a API.
  try {
    fs.unlinkSync(ARQUIVO_ENDERECO);
  } catch {
    // já não existia
  }

  log("instalação de volta ao acesso pela rede local.", "✓");
  setTimeout(() => process.exit(0), 500);
};

process.on("SIGINT", encerrar);
process.on("SIGTERM", encerrar);

(async () => {
  console.log("");
  console.log("  Publicação provisória por túnel da Cloudflare");
  console.log("  ---------------------------------------------");
  console.log("");

  const versao = await versaoCloudflared();
  if (!versao) {
    log("cloudflared não encontrado no PATH.", "✗");
    log("instale com: winget install --id Cloudflare.cloudflared", " ");
    process.exit(1);
  }

  log(`cloudflared ${versao.split(" ")[0]}`, "✓");

  await restabelecer();
})().catch(erro => {
  log(erro.stack || erro.message, "✗");
  process.exit(1);
});
