#!/usr/bin/env node
/**
 * Publica a instalação na internet pelo Tailscale Funnel.
 *
 * Diferente dos túneis descartáveis da Cloudflare, o endereço aqui é fixo e
 * derivado do nome da máquina no tailnet -- não muda entre execuções nem
 * depois de reiniciar o servidor. E o Funnel é mantido pelo próprio serviço do
 * Tailscale: não há processo para deixar aberto numa janela.
 *
 * O Funnel só aceita as portas 443, 8443 e 10000, daí o desenho:
 *
 *   https://<maquina>.<tailnet>.ts.net        -> interface (3333)
 *   https://<maquina>.<tailnet>.ts.net:8443   -> API (8080)
 *
 * Como os dois saem do mesmo hostname, o navegador os trata como o mesmo site
 * e o cookie de sessão atravessa sem depender de SameSite=None.
 *
 * Uso (PowerShell como Administrador -- reiniciar o backend exige isso):
 *   node scripts/publicar-tailscale.js
 *
 * Para despublicar:
 *   node scripts/publicar-tailscale.js --remover
 */
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const ARQUIVO_ENDERECO = path.join(RAIZ, "frontend", "endereco-publico.json");
const ENVS_BACKEND = [path.join(RAIZ, "backend", ".env"), path.join(RAIZ, "backend", ".env.network")];

// O executável não entra no PATH de sessões que já estavam abertas quando o
// Tailscale foi instalado; o caminho fixo evita um "comando não encontrado"
// que não tem nada a ver com o problema real.
const TAILSCALE = "C:\\Program Files\\Tailscale\\tailscale.exe";

const PORTA_INTERFACE = 3333;
const PORTA_API = 8080;
const PUBLICA_API = 8443;

const log = (texto, marca = "  ") => console.log(`${marca} ${texto}`);

const executar = (comando, args, { timeout = 60000 } = {}) =>
  new Promise((resolve, reject) => {
    execFile(comando, args, { timeout, windowsHide: true }, (erro, stdout, stderr) => {
      const saida = `${stdout || ""}${stderr || ""}`.trim();
      if (erro) return reject(new Error(saida || erro.message));
      resolve(saida);
    });
  });

const tailscale = (args, opcoes) => executar(TAILSCALE, args, opcoes);

// ------------------------------------------------------------------ diagnóstico

/**
 * Nome público da máquina no tailnet, sem o ponto final que o Tailscale usa
 * para marcar o nome como absoluto.
 */
const descobrirHostname = async () => {
  let bruto;
  try {
    bruto = await tailscale(["status", "--json"]);
  } catch (erro) {
    throw new Error(
      `não consegui falar com o Tailscale: ${erro.message.split("\n")[0]}`
    );
  }

  const estado = JSON.parse(bruto);

  if (estado.BackendState !== "Running") {
    throw new Error(
      `o Tailscale está em "${estado.BackendState}". Rode "tailscale login" e entre com sua conta antes.`
    );
  }

  const nome = estado.Self?.DNSName;
  if (!nome) throw new Error("o Tailscale não informou o nome desta máquina no tailnet.");

  return nome.replace(/\.$/, "");
};

// ------------------------------------------------------------------ funnel

/**
 * Aponta uma porta pública do Funnel para um serviço local.
 *
 * --bg deixa a regra registrada no serviço do Tailscale: ela sobrevive ao
 * fechamento deste script e ao reboot da máquina, que é justamente o que os
 * quick tunnels não davam.
 */
const publicarPorta = async (portaPublica, portaLocal, rotulo) => {
  log(`publicando ${rotulo} (porta ${portaLocal}) em :${portaPublica}…`);

  try {
    await tailscale(
      ["funnel", "--bg", `--https=${portaPublica}`, `http://127.0.0.1:${portaLocal}`],
      { timeout: 90000 }
    );
  } catch (erro) {
    const mensagem = erro.message;

    // O Funnel vem desligado por padrão no tailnet. O próprio Tailscale
    // devolve um link de aprovação, e repassá-lo inteiro poupa a caçada pelo
    // painel de ACL.
    if (/funnel|attribute|not permitted|denied|HTTPS/i.test(mensagem)) {
      throw new Error(
        `o tailnet ainda não libera o Funnel. Mensagem do Tailscale:\n\n${mensagem}\n\n` +
          "Aprove pelo link acima (ou em https://login.tailscale.com/admin/dns para ativar HTTPS) e rode este script de novo."
      );
    }

    throw new Error(`falha ao publicar ${rotulo}: ${mensagem}`);
  }
};

const removerPublicacao = async () => {
  log("removendo as regras de Funnel…");

  for (const porta of [443, PUBLICA_API]) {
    try {
      await tailscale(["funnel", "--https=" + porta, "off"], { timeout: 60000 });
    } catch (erro) {
      // Remover algo que não existe não é problema; qualquer outra coisa é.
      if (!/no serve config|not found|nothing/i.test(erro.message)) {
        log(`aviso ao remover :${porta} — ${erro.message.split("\n")[0]}`, "!");
      }
    }
  }

  try {
    fs.unlinkSync(ARQUIVO_ENDERECO);
  } catch {
    // já não existia
  }

  log("instalação de volta ao acesso apenas pela rede local.", "✓");
};

// ------------------------------------------------------------------ configuração

const escreverEnderecoFrontend = hostname => {
  fs.writeFileSync(
    ARQUIVO_ENDERECO,
    JSON.stringify(
      {
        VITE_PUBLIC_APP_HOST: hostname,
        VITE_PUBLIC_API_URL: `https://${hostname}:${PUBLICA_API}`,
        // Precisa constar mesmo vazia: quando window.ENV existe, o frontend lê
        // todas as chaves dele e não volta para as variáveis do build.
        VITE_HOURS_CLOSE_TICKETS_AUTO: null,
        atualizadoEm: new Date().toISOString()
      },
      null,
      2
    )
  );
};

/**
 * Acrescenta a origem pública à lista de CORS do backend, preservando o que já
 * estiver lá e limpando restos dos túneis da Cloudflare.
 */
const atualizarOrigensBackend = hostname => {
  const origem = `https://${hostname}`;
  let mudou = false;

  for (const arquivo of ENVS_BACKEND) {
    if (!fs.existsSync(arquivo)) continue;

    const linhas = fs.readFileSync(arquivo, "utf8").split(/\r?\n/);
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
    const linhaNova = `PUBLIC_ORIGINS=${[...new Set([...preservadas, origem])].join(",")}`;

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
        resolve();
      }
    );
  });

// ------------------------------------------------------------------ principal

(async () => {
  console.log("");
  console.log("  Publicação pelo Tailscale Funnel");
  console.log("  --------------------------------");
  console.log("");

  if (!fs.existsSync(TAILSCALE)) {
    log("Tailscale não encontrado.", "✗");
    log("instale com: winget install --id tailscale.tailscale", " ");
    process.exit(1);
  }

  if (process.argv.includes("--remover")) {
    await removerPublicacao();
    return;
  }

  const hostname = await descobrirHostname();
  log(`máquina no tailnet: ${hostname}`, "✓");

  await publicarPorta(443, PORTA_INTERFACE, "interface");
  await publicarPorta(PUBLICA_API, PORTA_API, "API");

  escreverEnderecoFrontend(hostname);
  log("endereço publicado gravado para o frontend", "✓");

  if (atualizarOrigensBackend(hostname)) {
    try {
      await reiniciarBackend();
      log("backend no ar com a origem nova", "✓");
    } catch (erro) {
      log(`não consegui reiniciar o backend: ${erro.message}`, "!");
      log("sem isso o navegador será bloqueado por CORS. Rode como Administrador.", "!");
    }
  }

  console.log("");
  console.log("  ┌─ No ar ────────────────────────────────────────────");
  console.log(`  │  Interface : https://${hostname}`);
  console.log(`  │  API       : https://${hostname}:${PUBLICA_API}`);
  console.log("  └────────────────────────────────────────────────────");
  console.log("");
  log("o endereço é fixo: sobrevive a reboot e não precisa de janela aberta.");
  log("para despublicar: node scripts/publicar-tailscale.js --remover");
  console.log("");
})().catch(erro => {
  console.log("");
  log(erro.message, "✗");
  console.log("");
  process.exit(1);
});
