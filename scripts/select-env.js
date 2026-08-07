#!/usr/bin/env node
/**
 * Escolhe o .env correto (backend ou frontend) dependendo do computador
 * onde o projeto está rodando.
 *
 * Detecção: variável de ambiente do sistema operacional UNMESS_LOCAL.
 *   - Definida permanentemente SÓ neste computador -> usa <alvo>/.env.localhost
 *   - Não definida (ex: no outro computador)        -> usa <alvo>/.env.network,
 *     substituindo {{HOST_IP}} pelo IP da rede local desta máquina.
 *
 * Uso: node scripts/select-env.js <backend|frontend>
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

// Faixas de LAN, em ordem de preferência. Redes domésticas e de escritório
// usam 192.168.x.x na esmagadora maioria dos casos.
const FAIXAS_LAN = [
  /^192\.168\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./
];

// VPNs e adaptadores virtuais no Windows costumam reportar MAC zerado.
// 100.64.0.0/10 é a faixa CGNAT usada pelo Tailscale; 169.254.x.x é APIPA,
// endereço de falha de DHCP.
const isVirtual = ({ address, mac }) =>
  !mac ||
  mac === "00:00:00:00:00:00" ||
  /^169\.254\./.test(address) ||
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(address);

const target = process.argv[2];

if (!["backend", "frontend"].includes(target)) {
  console.error("Uso: node scripts/select-env.js <backend|frontend>");
  process.exit(1);
}

const targetDir = path.join(__dirname, "..", target);
const isLocal = !!process.env.UNMESS_LOCAL;
const mode = isLocal ? "localhost" : "network";
const templatePath = path.join(targetDir, `.env.${mode}`);
const outputPath = path.join(targetDir, ".env");

if (!fs.existsSync(templatePath)) {
  console.error(`[select-env] Template não encontrado: ${templatePath}`);
  process.exit(1);
}

let content = fs.readFileSync(templatePath, "utf8");

if (mode === "network") {
  const ip = getLocalIPv4();
  content = content.split("{{HOST_IP}}").join(ip);
  console.log(`[select-env] ${target}: modo REDE -> usando IP ${ip}`);
} else {
  console.log(`[select-env] ${target}: modo LOCALHOST`);
}

fs.writeFileSync(outputPath, content);

function getLocalIPv4() {
  if (process.env.UNMESS_HOST_IP) {
    console.log(
      `[select-env] IP fixado por UNMESS_HOST_IP: ${process.env.UNMESS_HOST_IP}`
    );
    return process.env.UNMESS_HOST_IP;
  }

  const candidatos = [];
  for (const [nome, enderecos] of Object.entries(os.networkInterfaces())) {
    for (const iface of enderecos || []) {
      if (iface.family !== "IPv4" || iface.internal) continue;
      candidatos.push({ nome, address: iface.address, mac: iface.mac });
    }
  }

  if (candidatos.length === 0) {
    console.warn(
      "[select-env] Nenhuma interface de rede encontrada, usando localhost como fallback."
    );
    return "localhost";
  }

  // Descartar as virtuais pode zerar a lista em máquinas onde a placa real
  // também reporta MAC zerado; nesse caso é melhor escolher mal do que não
  // escolher.
  const fisicos = candidatos.filter(c => !isVirtual(c));
  const elegiveis = fisicos.length > 0 ? fisicos : candidatos;

  const escolhido =
    FAIXAS_LAN.reduce(
      (achado, faixa) =>
        achado || elegiveis.find(c => faixa.test(c.address)),
      null
    ) || elegiveis[0];

  // A escolha vai para o log porque foi justamente a falta dela que escondeu
  // o problema: com VPN ligada, a máquina subia num IP inalcançável na LAN.
  const descartados = candidatos
    .filter(c => c !== escolhido)
    .map(c => `${c.nome}=${c.address}`)
    .join(", ");

  console.log(
    `[select-env] Interface escolhida: ${escolhido.nome} (${escolhido.address})` +
      (descartados ? ` | descartadas: ${descartados}` : "")
  );

  return escolhido.address;
}
