import { execFile } from "child_process";
import { promisify } from "util";
import { stat, readFile, copyFile } from "fs/promises";
import path from "path";
import ffmpegPath from "ffmpeg-static";

const executar = promisify(execFile);

/**
 * Converte imagem, GIF ou vídeo curto no WebP que o WhatsApp aceita como
 * figurinha.
 *
 * O WhatsApp não aceita qualquer WebP: exige 512x512, e recusa arquivos acima
 * de um teto que muda conforme a figurinha seja parada ou animada. Mandar um
 * PNG comum como `sticker` faz a mensagem sumir sem erro nenhum -- o aparelho
 * do destinatário simplesmente não a mostra. Por isso a conversão é obrigatória
 * e não um refinamento.
 *
 * O ffmpeg vem do pacote ffmpeg-static, que já era dependência do projeto; não
 * há binário para instalar na máquina.
 */

// Tetos do WhatsApp. Passar deles é o motivo mais comum de figurinha que "não
// chega": o envio é aceito e a mensagem não aparece do outro lado.
const LIMITE_ESTATICA = 100 * 1024;
const LIMITE_ANIMADA = 500 * 1024;
const DURACAO_MAXIMA_S = 8;

const EXTENSOES_ANIMADAS = new Set([".gif", ".mp4", ".webm", ".mov", ".mkv"]);

export interface ResultadoConversao {
  caminho: string;
  animada: boolean;
  tamanho: number;
}

/**
 * A figurinha é sempre um quadrado de 512 com fundo transparente.
 *
 * `decrease` preserva a proporção -- esticar deformaria o desenho -- e o `pad`
 * completa o resto com transparência, centralizando. Sem isso, uma imagem
 * retangular chegaria achatada.
 */
const FILTRO_QUADRADO =
  "scale=512:512:force_original_aspect_ratio=decrease," +
  "pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000";

const ehAnimado = (origem: string, mimetype?: string): boolean => {
  if (mimetype?.startsWith("video/")) return true;
  if (mimetype === "image/gif") return true;
  return EXTENSOES_ANIMADAS.has(path.extname(origem).toLowerCase());
};

interface InfoWebp {
  animado: boolean;
  largura: number | null;
  altura: number | null;
}

/**
 * Lê o cabeçalho de um WebP para saber se é animado e qual o tamanho da tela.
 *
 * Nem o mimetype nem a extensão distinguem WebP parado de animado -- os dois
 * são "image/webp" e ".webp". A diferença está no cabeçalho, e ela importa
 * muito aqui: o decodificador de WebP do ffmpeg não lê animação. Entregar-lhe
 * uma figurinha animada faz ele pular todos os quadros e terminar com "image
 * data not found", que não diz nada a quem só tentou subir uma figurinha.
 *
 * Formato: "RIFF" ---- "WEBP" e então um bloco. O bloco VP8X é o formato
 * estendido e carrega as dimensões da tela e um byte de sinalizadores, onde o
 * bit 0x02 marca animação. VP8 e VP8L são sempre imagens paradas.
 */
const inspecionarWebp = async (arquivo: string): Promise<InfoWebp | null> => {
  let cabecalho: Buffer;
  try {
    const conteudo = await readFile(arquivo);
    cabecalho = conteudo.subarray(0, 30);
  } catch {
    return null;
  }

  if (cabecalho.length < 16) return null;
  if (cabecalho.toString("ascii", 0, 4) !== "RIFF") return null;
  if (cabecalho.toString("ascii", 8, 12) !== "WEBP") return null;

  const bloco = cabecalho.toString("ascii", 12, 16);

  if (bloco === "VP8X" && cabecalho.length >= 30) {
    return {
      animado: (cabecalho[20] & 0x02) !== 0,
      // As dimensões são gravadas menos um, em 24 bits little-endian.
      largura: 1 + cabecalho.readUIntLE(24, 3),
      altura: 1 + cabecalho.readUIntLE(27, 3)
    };
  }

  return { animado: false, largura: null, altura: null };
};

/**
 * Aproveita o arquivo como está quando ele já é uma figurinha válida.
 *
 * O caso mais comum de tudo: alguém salva uma figurinha do próprio WhatsApp e
 * a sobe aqui. Ela já é WebP, já é 512x512 e já cabe no limite -- reconverter
 * só degradaria a imagem, e no caso das animadas nem seria possível, porque o
 * ffmpeg não sabe decodificá-las.
 */
const aproveitarWebp = async (
  origem: string,
  destino: string,
  info: InfoWebp
): Promise<ResultadoConversao | null> => {
  const { size } = await stat(origem);
  const limite = info.animado ? LIMITE_ANIMADA : LIMITE_ESTATICA;

  const cabeNoLimite = size <= limite;
  // Sem VP8X não há dimensão no cabeçalho; nesse caso só as paradas seguem
  // adiante, e elas passam pela conversão normal, que garante os 512.
  const tamanhoCerto =
    info.largura !== null &&
    info.altura !== null &&
    info.largura <= 512 &&
    info.altura <= 512;

  if (!cabeNoLimite || !tamanhoCerto) return null;

  await copyFile(origem, destino);
  return { caminho: destino, animada: info.animado, tamanho: size };
};

const rodarFfmpeg = async (args: string[]): Promise<void> => {
  if (!ffmpegPath) throw new Error("ffmpeg não disponível nesta instalação.");
  // O ffmpeg escreve o progresso no stderr mesmo quando dá certo; o que importa
  // é o código de saída, que o execFile já transforma em exceção.
  await executar(ffmpegPath as string, args, { timeout: 120000, windowsHide: true });
};

/**
 * Tenta converter reduzindo a qualidade até caber no teto.
 *
 * Uma única passada com qualidade fixa não serve: a mesma qualidade que deixa
 * uma logo simples em 20 KB deixa uma foto em 300 KB, e a foto seria recusada.
 * A escala desce em degraus e para no primeiro que couber, para não sacrificar
 * nitidez à toa.
 */
const converterEstatica = async (
  origem: string,
  destino: string
): Promise<ResultadoConversao> => {
  for (const qualidade of [80, 60, 45, 30, 20]) {
    await rodarFfmpeg([
      "-y",
      "-i", origem,
      "-vf", FILTRO_QUADRADO,
      "-c:v", "libwebp",
      "-lossless", "0",
      "-q:v", String(qualidade),
      "-preset", "default",
      "-an",
      "-fps_mode", "passthrough",
      destino
    ]);

    const { size } = await stat(destino);
    if (size <= LIMITE_ESTATICA) return { caminho: destino, animada: false, tamanho: size };
  }

  const { size } = await stat(destino);
  throw new Error(
    `Não consegui deixar a figurinha abaixo de ${Math.round(LIMITE_ESTATICA / 1024)} KB ` +
      `(ficou em ${Math.round(size / 1024)} KB). Tente uma imagem mais simples.`
  );
};

/**
 * Figurinha animada.
 *
 * Além da qualidade, a taxa de quadros também cede: o peso de um WebP animado
 * cresce com o número de quadros, e cortar de 15 para 10 por segundo costuma
 * economizar mais que baixar a qualidade de todos eles.
 */
const converterAnimada = async (
  origem: string,
  destino: string
): Promise<ResultadoConversao> => {
  for (const [qualidade, fps] of [[70, 15], [50, 12], [35, 10], [25, 8]]) {
    await rodarFfmpeg([
      "-y",
      "-t", String(DURACAO_MAXIMA_S),
      "-i", origem,
      "-vf", `${FILTRO_QUADRADO},fps=${fps}`,
      "-c:v", "libwebp_anim",
      "-lossless", "0",
      "-q:v", String(qualidade),
      "-preset", "default",
      "-loop", "0",
      "-an",
      "-fps_mode", "passthrough",
      destino
    ]);

    const { size } = await stat(destino);
    if (size <= LIMITE_ANIMADA) return { caminho: destino, animada: true, tamanho: size };
  }

  const { size } = await stat(destino);
  throw new Error(
    `Não consegui deixar a figurinha animada abaixo de ${Math.round(LIMITE_ANIMADA / 1024)} KB ` +
      `(ficou em ${Math.round(size / 1024)} KB). Tente um vídeo mais curto ou com menos movimento.`
  );
};

export const converterParaFigurinha = async (
  origem: string,
  destino: string,
  mimetype?: string
): Promise<ResultadoConversao> => {
  const webp = await inspecionarWebp(origem);

  if (webp) {
    // Já é figurinha pronta: entra na biblioteca sem passar pelo ffmpeg.
    const aproveitada = await aproveitarWebp(origem, destino, webp);
    if (aproveitada) return aproveitada;

    // Animada e fora das medidas é o único beco sem saída: o ffmpeg não
    // decodifica WebP animado, então não há como redimensionar nem recomprimir.
    // Dizer isso é melhor que devolver o erro cru do ffmpeg, que fala em
    // "chunk ANIM" e não ajuda ninguém a resolver.
    if (webp.animado) {
      const { size } = await stat(origem);
      throw new Error(
        "Esta figurinha animada não pode ser aproveitada: ela precisa ter no " +
          `máximo 512x512 e ${Math.round(LIMITE_ANIMADA / 1024)} KB ` +
          `(esta tem ${webp.largura ?? "?"}x${webp.altura ?? "?"} e ` +
          `${Math.round(size / 1024)} KB). Envie o GIF ou vídeo original, que eu converto.`
      );
    }
  }

  return ehAnimado(origem, mimetype)
    ? converterAnimada(origem, destino)
    : converterEstatica(origem, destino);
};

export default converterParaFigurinha;
