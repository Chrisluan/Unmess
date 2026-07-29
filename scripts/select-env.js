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
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  console.warn(
    "[select-env] Nenhuma interface de rede encontrada, usando localhost como fallback."
  );
  return "localhost";
}
