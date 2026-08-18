#!/usr/bin/env node
/**
 * Troca os segredos do backend: as duas chaves de JWT e a senha do banco.
 *
 * Quando usar: sempre que um segredo tiver sido exposto -- aparecido num
 * terminal, num print, num log, num commit -- e também de tempos em tempos por
 * higiene. Um segredo que vazou continua valendo até ser trocado; quem o tiver
 * assina tokens como se fosse o servidor.
 *
 * O que acontece ao rodar:
 *
 *   - Todos os atendentes são deslogados. Os tokens em circulação foram
 *     assinados com a chave antiga e deixam de ser aceitos -- é justamente o
 *     efeito desejado quando a chave vazou.
 *   - A senha do banco é trocada no MySQL e nos arquivos .env, nessa ordem, com
 *     a conexão testada antes de qualquer coisa ser gravada.
 *
 * Uso (PowerShell como Administrador):
 *   node scripts/rotacionar-segredos.js
 *
 * Nada é impresso na tela além de "ok": o motivo de rotacionar é justamente
 * que segredo em terminal vira segredo vazado.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const RAIZ = path.join(__dirname, "..");
const ENV = path.join(RAIZ, "backend", ".env");
const ENV_TEMPLATE = path.join(RAIZ, "backend", ".env.network");

const log = (texto, marca = "  ") => console.log(`${marca} ${texto}`);

/** 48 bytes em base64url: entropia muito além do que um ataque alcança. */
const gerarSegredo = () => crypto.randomBytes(48).toString("base64url");

const lerEnv = arquivo => {
  const texto = fs.readFileSync(arquivo, "utf8");
  const valor = chave => {
    const achado = texto.match(new RegExp(`^\\s*${chave}\\s*=\\s*(.*)$`, "m"));
    return achado ? achado[1].trim() : null;
  };
  return { texto, valor };
};

/**
 * Troca o valor de uma chave preservando o resto do arquivo.
 *
 * Reescrever o .env inteiro a partir de um modelo perderia comentários e
 * qualquer ajuste feito à mão na máquina -- e este arquivo é a única cópia da
 * configuração desta instalação.
 */
const substituir = (texto, chave, valor) => {
  const linha = `${chave}=${valor}`;
  const padrao = new RegExp(`^\\s*${chave}\\s*=.*$`, "m");
  return padrao.test(texto) ? texto.replace(padrao, linha) : `${texto}\n${linha}`;
};

/** Executa SQL pelo cliente do MySQL, com a senha pelo ambiente e nunca na linha de comando. */
const mysql = (executavel, usuario, senha, sql) =>
  new Promise((resolve, reject) => {
    execFile(
      executavel,
      ["-h", "127.0.0.1", "-u", usuario, "--protocol=TCP", "-N", "-B", "-e", sql],
      { env: { ...process.env, MYSQL_PWD: senha }, windowsHide: true, timeout: 30000 },
      (erro, stdout, stderr) => {
        if (erro) return reject(new Error((stderr || erro.message).trim()));
        resolve(String(stdout).trim());
      }
    );
  });

/**
 * Onde está o cliente do MySQL.
 *
 * O primeiro da lista é o desta instalação, que não fica no caminho padrão do
 * instalador -- o serviço MySQL80 aponta para C:\mysql. Os demais cobrem uma
 * reinstalação futura pelo instalador oficial.
 */
const acharMysql = () => {
  const candidatos = [
    "C:\\mysql\\bin\\mysql.exe",
    "C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe",
    "C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe",
    "C:\\Program Files\\MySQL\\MySQL Server 9.0\\bin\\mysql.exe"
  ];
  return candidatos.find(c => fs.existsSync(c)) || null;
};

(async () => {
  console.log("");
  console.log("  Rotação de segredos do backend");
  console.log("  ------------------------------");
  console.log("");

  if (!fs.existsSync(ENV)) {
    log("backend/.env não encontrado.", "✗");
    process.exit(1);
  }

  // Cópia de segurança antes de tocar em qualquer coisa: se algo falhar no
  // meio, é por aqui que a instalação volta a funcionar.
  const reserva = `${ENV}.antes-da-rotacao`;
  fs.copyFileSync(ENV, reserva);
  log(`cópia do .env guardada em ${path.basename(reserva)}`, "✓");

  const { valor } = lerEnv(ENV);
  const usuarioBanco = valor("DB_USER");
  const senhaAtual = valor("DB_PASS");

  // ---- JWT -----------------------------------------------------------------

  let texto = fs.readFileSync(ENV, "utf8");
  texto = substituir(texto, "JWT_SECRET", gerarSegredo());
  texto = substituir(texto, "JWT_REFRESH_SECRET", gerarSegredo());
  fs.writeFileSync(ENV, texto);
  log("chaves de JWT trocadas", "✓");

  // ---- senha do banco ------------------------------------------------------

  const executavel = acharMysql();

  if (!executavel) {
    log("cliente do MySQL não encontrado; a senha do banco NÃO foi trocada.", "!");
    log("troque-a pelo MySQL Workbench e atualize DB_PASS em backend/.env:", " ");
    log(`ALTER USER '${usuarioBanco}'@'localhost' IDENTIFIED BY '<nova senha>';`, " ");
  } else if (!usuarioBanco || !senhaAtual) {
    log("DB_USER ou DB_PASS ausentes no .env; senha do banco não trocada.", "!");
  } else {
    const novaSenha = crypto.randomBytes(24).toString("base64url");

    try {
      // Confere o acesso antes de mudar qualquer coisa: trocar a senha sem
      // conseguir entrar depois deixaria a aplicação sem banco.
      await mysql(executavel, usuarioBanco, senhaAtual, "SELECT 1");

      // ALTER USER USER() muda a senha da conta que está conectada agora.
      // Nomear a conta ('unmess'@'localhost') exigiria privilégio de CREATE
      // USER, que uma conta de aplicação não tem -- e nem deveria ter.
      await mysql(
        executavel,
        usuarioBanco,
        senhaAtual,
        `ALTER USER USER() IDENTIFIED BY '${novaSenha}';`
      );

      // Só grava no .env depois de provar que a senha nova entra de verdade.
      await mysql(executavel, usuarioBanco, novaSenha, "SELECT 1");

      texto = substituir(fs.readFileSync(ENV, "utf8"), "DB_PASS", novaSenha);
      fs.writeFileSync(ENV, texto);
      log("senha do banco trocada e conferida", "✓");
    } catch (erro) {
      log(`não consegui trocar a senha do banco: ${erro.message.split("\n")[0]}`, "!");
      log("as chaves de JWT foram trocadas mesmo assim; o banco segue com a senha antiga.", " ");
    }
  }

  // ---- template ------------------------------------------------------------

  // O .env.network é o molde de onde o .env é regerado. Deixar segredo real
  // aqui é como colá-lo num arquivo de exemplo: some do lugar certo e aparece
  // onde não devia.
  if (fs.existsSync(ENV_TEMPLATE)) {
    let modelo = fs.readFileSync(ENV_TEMPLATE, "utf8");
    modelo = substituir(modelo, "JWT_SECRET", "");
    modelo = substituir(modelo, "JWT_REFRESH_SECRET", "");
    modelo = substituir(modelo, "DB_PASS", "");
    fs.writeFileSync(ENV_TEMPLATE, modelo);
    log("segredos removidos do .env.network (o molde não guarda segredo)", "✓");
  }

  console.log("");
  log("falta reiniciar o backend para as chaves novas valerem:", "→");
  log("Restart-Service unmess-backend", " ");
  log("todos os atendentes precisarão entrar de novo.", "!");
  console.log("");
})().catch(erro => {
  log(erro.message, "✗");
  process.exit(1);
});
