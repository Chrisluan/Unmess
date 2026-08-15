/**
 * Autenticação do painel.
 *
 * O painel liga e desliga a produção, e escuta na rede local — então a senha é
 * a única coisa entre um curioso do escritório e o botão de parar o MySQL.
 * Por isso: hash scrypt (não SHA simples), comparação em tempo constante,
 * sessão em memória (some quando o painel fecha) e bloqueio progressivo por IP.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const arquivoConfig = path.join(__dirname, "..", "config.json");

// Parâmetros do scrypt. O padrão do Node (N=16384) leva ~100ms nesta máquina,
// o que é irrelevante para um login por sessão e caro para força bruta.
const CUSTO = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const TAMANHO_HASH = 32;

const DURACAO_SESSAO_MS = 8 * 60 * 60 * 1000; // um turno de trabalho
const MAX_TENTATIVAS = 5;
const BLOQUEIO_MS = 5 * 60 * 1000;

// Estado só de memória: reiniciar o painel derruba todo mundo, que é o
// comportamento desejado para uma ferramenta administrativa.
const sessoes = new Map(); // token -> { expira, ip }
const tentativas = new Map(); // ip -> { contador, bloqueadoAte }

const derivar = (senha, salt) =>
  crypto.scryptSync(senha, Buffer.from(salt, "hex"), TAMANHO_HASH, CUSTO);

const existeConfig = () => fs.existsSync(arquivoConfig);

const lerConfig = () => {
  if (!existeConfig()) return null;
  try {
    return JSON.parse(fs.readFileSync(arquivoConfig, "utf8"));
  } catch (erro) {
    throw new Error(
      `config.json do painel está corrompido (${erro.message}). ` +
        "Apague o arquivo e defina a senha de novo."
    );
  }
};

/**
 * Grava a senha. Chamado pelo lançador na primeira execução, nunca por HTTP:
 * trocar a senha exige acesso ao console da máquina.
 */
const definirSenha = senha => {
  if (typeof senha !== "string" || senha.length < 8) {
    throw new Error("A senha precisa ter pelo menos 8 caracteres.");
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const hash = derivar(senha, salt).toString("hex");

  fs.writeFileSync(
    arquivoConfig,
    JSON.stringify({ salt, hash, definidaEm: new Date().toISOString() }, null, 2),
    { mode: 0o600 }
  );
};

const conferirSenha = senha => {
  const config = lerConfig();
  if (!config) return false;

  const esperado = Buffer.from(config.hash, "hex");
  let recebido;
  try {
    recebido = derivar(String(senha), config.salt);
  } catch {
    return false;
  }

  // timingSafeEqual exige buffers do mesmo tamanho; como ambos saem do scrypt
  // com TAMANHO_HASH, um tamanho diferente já significa config adulterada.
  if (esperado.length !== recebido.length) return false;
  return crypto.timingSafeEqual(esperado, recebido);
};

/** Quantos milissegundos faltam até o IP poder tentar de novo (0 = liberado). */
const bloqueioRestante = ip => {
  const registro = tentativas.get(ip);
  if (!registro || !registro.bloqueadoAte) return 0;
  const restante = registro.bloqueadoAte - Date.now();
  if (restante <= 0) {
    tentativas.delete(ip);
    return 0;
  }
  return restante;
};

const registrarFalha = ip => {
  const registro = tentativas.get(ip) || { contador: 0, bloqueadoAte: 0 };
  registro.contador += 1;
  if (registro.contador >= MAX_TENTATIVAS) {
    registro.bloqueadoAte = Date.now() + BLOQUEIO_MS;
    registro.contador = 0;
  }
  tentativas.set(ip, registro);
};

const limparFalhas = ip => tentativas.delete(ip);

const criarSessao = ip => {
  const token = crypto.randomBytes(32).toString("hex");
  sessoes.set(token, { expira: Date.now() + DURACAO_SESSAO_MS, ip });
  return token;
};

/**
 * A sessão é amarrada ao IP que fez o login. Numa LAN isso é estável, e impede
 * que um token vazado (histórico, print de tela) sirva de outra máquina.
 */
const validarSessao = (token, ip) => {
  if (!token) return false;
  const sessao = sessoes.get(token);
  if (!sessao) return false;
  if (sessao.expira < Date.now() || sessao.ip !== ip) {
    sessoes.delete(token);
    return false;
  }
  return true;
};

const encerrarSessao = token => sessoes.delete(token);

// Faxina periódica para a Map não crescer sem limite num painel deixado aberto
// por semanas. unref() para não segurar o processo vivo sozinho.
setInterval(() => {
  const agora = Date.now();
  for (const [token, sessao] of sessoes) {
    if (sessao.expira < agora) sessoes.delete(token);
  }
  for (const [ip, registro] of tentativas) {
    if (registro.bloqueadoAte && registro.bloqueadoAte < agora) tentativas.delete(ip);
  }
}, 10 * 60 * 1000).unref();

module.exports = {
  arquivoConfig,
  existeConfig,
  definirSenha,
  conferirSenha,
  bloqueioRestante,
  registrarFalha,
  limparFalhas,
  criarSessao,
  validarSessao,
  encerrarSessao,
  DURACAO_SESSAO_MS,
  BLOQUEIO_MS
};
