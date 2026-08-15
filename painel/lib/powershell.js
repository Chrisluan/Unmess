/**
 * Ponte com o PowerShell.
 *
 * Tudo que o painel sabe sobre serviços e disco vem daqui. Duas regras que o
 * resto do código depende:
 *
 *   1. Nada de `shell: true` e nada de string de comando montada com entrada do
 *      usuário — os argumentos vão como array para o execFile, e os nomes de
 *      serviço saem de uma lista fixa em servicos.js.
 *   2. Todo comando tem timeout. Um Stop-Service travado não pode deixar o
 *      painel pendurado esperando para sempre.
 */
const { execFile } = require("child_process");

const POWERSHELL = "powershell.exe";

/**
 * Preâmbulo obrigatório em todo comando.
 *
 * O PowerShell escreve na codepage do console (CP850 numa instalação em
 * português), enquanto o Node lê o stdout como UTF-8. Sem forçar UTF-8 dos dois
 * lados, todo acento volta corrompido — o que aparece justamente nas mensagens
 * de erro do Windows, que são a hora em que se mais precisa ler direito.
 */
const UTF8 = "[Console]::OutputEncoding = [Text.Encoding]::UTF8; $OutputEncoding = [Text.Encoding]::UTF8; ";

/**
 * -NoProfile evita carregar o perfil do usuário (mais rápido e previsível);
 * -NonInteractive garante que um cmdlet que resolva perguntar algo falhe em vez
 * de travar esperando uma resposta que nunca vem.
 */
const executar = (comando, { timeout = 20000 } = {}) =>
  new Promise((resolve, reject) => {
    execFile(
      POWERSHELL,
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", UTF8 + comando],
      { timeout, windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
      (erro, stdout, stderr) => {
        if (erro) {
          const motivo = (stderr || "").trim() || erro.message;
          reject(new Error(erro.killed ? `Tempo esgotado: ${comando.slice(0, 60)}…` : motivo));
          return;
        }
        resolve(stdout);
      }
    );
  });

/**
 * Executa e interpreta a saída como JSON.
 *
 * ConvertTo-Json colapsa listas de um item só em objeto; por isso todo chamador
 * usa `@(...)` do lado do PowerShell e este helper ainda normaliza para array
 * quando `comoLista` é pedido.
 */
const executarJson = async (comando, { timeout = 20000, comoLista = false } = {}) => {
  const saida = (await executar(comando, { timeout })).trim();
  if (!saida) return comoLista ? [] : null;

  let dados;
  try {
    dados = JSON.parse(saida);
  } catch (erro) {
    throw new Error(`Resposta inesperada do PowerShell: ${saida.slice(0, 200)}`);
  }

  if (comoLista) return Array.isArray(dados) ? dados : [dados];
  return dados;
};

module.exports = { executar, executarJson };
