/**
 * Leitura dos logs que o NSSM escreve em C:\unmess\logs.
 *
 * Regra de segurança que vale para o arquivo inteiro: o navegador manda um
 * nome de arquivo, e esse nome é conferido contra a listagem real do diretório
 * antes de qualquer leitura. Nunca se concatena o que veio da rede em um
 * caminho — é assim que se pede um `..\..\backend\.env` por acidente.
 */
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

const DIRETORIO = path.join(__dirname, "..", "..", "logs");
const MAX_LINHAS = 500;

/**
 * Lista os logs mais recentes, do mais novo para o mais velho.
 *
 * O NSSM rotaciona criando `unmess-backend-<timestamp>.log` e deixando o
 * `unmess-backend.log` como o corrente; os antigos vazios são ruído puro na
 * interface, então ficam de fora.
 */
const listar = async (limite = 12) => {
  if (!fs.existsSync(DIRETORIO)) return [];

  const nomes = await fsp.readdir(DIRETORIO);
  const arquivos = [];

  for (const nome of nomes) {
    if (!nome.endsWith(".log")) continue;
    try {
      const info = await fsp.stat(path.join(DIRETORIO, nome));
      if (!info.isFile() || info.size === 0) continue;
      arquivos.push({
        nome,
        tamanho: info.size,
        modificadoEm: info.mtime.toISOString(),
        erro: nome.includes("-erro")
      });
    } catch {
      // Arquivo removido entre o readdir e o stat: seguir adiante.
    }
  }

  return arquivos
    .sort((a, b) => new Date(b.modificadoEm) - new Date(a.modificadoEm))
    .slice(0, limite);
};

/**
 * Últimas linhas de um log, lendo só o fim do arquivo.
 *
 * Um log de serviço rodando há semanas pode ter dezenas de MB; carregar tudo
 * na memória para mostrar 200 linhas seria desperdício num servidor com 8 GB
 * dividido com a produção.
 */
const ler = async (nomePedido, linhas = 200) => {
  const disponiveis = await listar(200);
  const escolhido = disponiveis.find(a => a.nome === nomePedido);
  if (!escolhido) throw new Error("Log não encontrado.");

  const quantidade = Math.min(Math.max(Number(linhas) || 200, 1), MAX_LINHAS);
  const caminho = path.join(DIRETORIO, escolhido.nome);
  const arquivo = await fsp.open(caminho, "r");

  try {
    const { size } = await arquivo.stat();
    // 512 bytes por linha é folgado para log de aplicação e limita o teto de
    // leitura em ~256 KB no pior caso.
    const janela = Math.min(size, quantidade * 512);
    const buffer = Buffer.alloc(janela);
    await arquivo.read(buffer, 0, janela, size - janela);

    const texto = buffer.toString("utf8");
    const todas = texto.split(/\r?\n/);

    // A primeira linha da janela quase sempre está cortada no meio; descartar
    // só faz sentido se de fato houve corte (arquivo maior que a janela).
    if (janela < size) todas.shift();

    return {
      nome: escolhido.nome,
      tamanho: size,
      modificadoEm: escolhido.modificadoEm,
      truncado: janela < size,
      linhas: todas.filter(l => l.trim() !== "").slice(-quantidade)
    };
  } finally {
    await arquivo.close();
  }
};

module.exports = { listar, ler, DIRETORIO };
