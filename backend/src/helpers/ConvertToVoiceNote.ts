import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";

import ffmpegPath from "ffmpeg-static";
import { logger } from "../utils/logger";

const execFileAsync = promisify(execFile);

/**
 * Converte um áudio para Ogg/Opus, o formato das mensagens de voz do WhatsApp.
 *
 * O navegador grava em WebM/Opus (o Chrome não grava Ogg), e o WhatsApp recusa
 * esse contêiner como mensagem de voz — o envio falhava com
 * ERR_SENDING_WAPP_MSG. O codec já é o certo; só o empacotamento muda, então a
 * conversão é rápida e sem perda adicional.
 *
 * Devolve o caminho do arquivo convertido, ou o original se a conversão não
 * for possível — melhor tentar enviar o que se tem do que falhar aqui.
 */
export const convertToVoiceNote = async (
  origem: string
): Promise<{ path: string; mimetype: string; convertido: boolean }> => {
  const original = { path: origem, mimetype: "audio/ogg; codecs=opus", convertido: false };

  if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
    logger.warn("ffmpeg indisponível; enviando o áudio sem converter.");
    return original;
  }

  const destino = path.join(
    path.dirname(origem),
    `${path.basename(origem, path.extname(origem))}.ogg`
  );

  try {
    await execFileAsync(ffmpegPath, [
      "-y",
      "-i", origem,
      "-vn",              // descarta qualquer trilha de vídeo do contêiner
      "-c:a", "libopus",
      "-b:a", "64k",
      "-ar", "48000",
      "-ac", "1",         // mono, como as mensagens de voz do WhatsApp
      destino
    ]);

    if (!fs.existsSync(destino) || fs.statSync(destino).size === 0) {
      throw new Error("ffmpeg gerou arquivo vazio");
    }

    // O arquivo de origem não serve mais e ficaria órfão na pasta public.
    try {
      fs.unlinkSync(origem);
    } catch (err) {
      logger.warn({ info: "Could not remove source audio", origem, err });
    }

    return { path: destino, mimetype: "audio/ogg; codecs=opus", convertido: true };
  } catch (err) {
    logger.error({ info: "Falha ao converter áudio para Ogg/Opus", origem, err });
    return original;
  }
};

export default convertToVoiceNote;
