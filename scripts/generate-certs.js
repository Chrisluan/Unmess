#!/usr/bin/env node
/**
 * Gera uma autoridade certificadora local e um certificado de servidor para
 * esta máquina.
 *
 * Motivo: o navegador só libera microfone, câmera e área de transferência em
 * "contexto seguro" — HTTPS ou localhost. Acessando o sistema pelo IP da rede
 * em HTTP puro, navigator.mediaDevices simplesmente não existe e a gravação de
 * áudio fica indisponível em todos os computadores menos o servidor.
 *
 * O certificado cobre o IP da rede, localhost e 127.0.0.1. Instalar o
 * certificado da CA (certs/ca.crt) nas máquinas dos atendentes faz o navegador
 * aceitar sem aviso.
 *
 * Uso: node scripts/generate-certs.js [ip]
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const certsDir = path.join(__dirname, "..", "certs");

/**
 * Todos os IPv4 pelos quais a máquina pode ser alcançada.
 *
 * Diferente da escolha de IP em select-env.js, aqui não se descarta nada: o
 * Tailscale e demais interfaces são caminhos de acesso legítimos, e um nome
 * fora do certificado derruba o HTTPS com erro de validação.
 */
const getTodosIPv4 = () => {
  const ips = [];
  for (const enderecos of Object.values(os.networkInterfaces())) {
    for (const iface of enderecos || []) {
      if (iface.family === "IPv4" && !ips.includes(iface.address)) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
};

const openssl = args =>
  execFileSync("openssl", args, { cwd: certsDir, stdio: ["ignore", "pipe", "pipe"] });

// Nomes extras podem vir por argumento, para o caso de um apelido de DNS
// interno que não dá para descobrir sozinho.
const extras = process.argv.slice(2);
const ips = [...new Set([...getTodosIPv4(), ...extras.filter(e => /^[\d.]+$/.test(e))])];
const nomes = [
  ...new Set([
    "localhost",
    os.hostname().toLowerCase(),
    ...extras.filter(e => !/^[\d.]+$/.test(e))
  ])
];

// O IP preferido nomeia o certificado; os demais entram como alternativos.
const principal =
  ips.find(i => /^192\.168\./.test(i)) ||
  ips.find(i => !/^127\./.test(i)) ||
  "127.0.0.1";

if (!fs.existsSync(certsDir)) fs.mkdirSync(certsDir, { recursive: true });

console.log(`[certs] IPs   : ${ips.join(", ")}`);
console.log(`[certs] Nomes : ${nomes.join(", ")}`);

// A CA é reaproveitada entre execuções: trocá-la obrigaria a reinstalar o
// certificado em todas as máquinas dos atendentes.
if (!fs.existsSync(path.join(certsDir, "ca.key"))) {
  openssl(["genrsa", "-out", "ca.key", "2048"]);
  openssl([
    "req", "-x509", "-new", "-nodes", "-key", "ca.key",
    "-sha256", "-days", "3650", "-out", "ca.crt",
    "-subj", "/C=BR/O=Unmess/CN=Unmess Local CA"
  ]);
  console.log("[certs] Autoridade local criada (ca.crt)");
} else {
  console.log("[certs] Reaproveitando a autoridade local existente");
}

fs.writeFileSync(
  path.join(certsDir, "server.ext"),
  [
    "authorityKeyIdentifier=keyid,issuer",
    "basicConstraints=CA:FALSE",
    "keyUsage=digitalSignature,keyEncipherment",
    "extendedKeyUsage=serverAuth",
    "subjectAltName=@alt",
    "",
    "[alt]",
    ...ips.map((endereco, i) => `IP.${i + 1}=${endereco}`),
    ...nomes.map((nome, i) => `DNS.${i + 1}=${nome}`)
  ].join("\n")
);

openssl(["genrsa", "-out", "server.key", "2048"]);
openssl([
  "req", "-new", "-key", "server.key", "-out", "server.csr",
  "-subj", `/C=BR/O=Unmess/CN=${principal}`
]);
openssl([
  "x509", "-req", "-in", "server.csr",
  "-CA", "ca.crt", "-CAkey", "ca.key", "-CAcreateserial",
  "-out", "server.crt", "-days", "825", "-sha256",
  "-extfile", "server.ext"
]);

fs.unlinkSync(path.join(certsDir, "server.csr"));

console.log("[certs] Pronto:");
console.log("  certs/server.crt  certificado do servidor");
console.log("  certs/server.key  chave privada");
console.log("  certs/ca.crt      instalar nas máquinas dos atendentes");
