import path from "path";
import crypto from "crypto";
import multer from "multer";

const publicFolder = path.resolve(__dirname, "..", "..", "public");

/**
 * Tipos aceitos em upload.
 *
 * A lista existe por dois motivos, e o segundo é o que importa mais: os
 * arquivos são servidos por /public a partir do mesmo host da API. Aceitar
 * .html ou .svg significaria hospedar página com script na origem da própria
 * aplicação -- quem abrisse o link executaria esse script como se fosse nosso,
 * com acesso ao que a origem alcança.
 */
const TIPOS_PERMITIDOS = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/mp4",
  "video/mp4",
  "video/webm",
  "video/3gpp",
  "video/quicktime",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv"
]);

/**
 * Nome de arquivo imprevisível.
 *
 * Antes era só `Date.now()`: dois arquivos enviados no mesmo milissegundo se
 * sobrescreviam, e -- pior -- qualquer um podia varrer a faixa de horários e
 * baixar os anexos um a um, já que /public responde sem pedir login. Com 16
 * bytes de aleatoriedade criptográfica, adivinhar deixa de ser viável.
 */
const nomeAleatorio = (original: string): string => {
  const extensao = path.extname(original).toLowerCase().slice(0, 10);

  // A extensão vem do cliente e vira nome de arquivo em disco: sem esta
  // limpeza, um "..\\..\\algo.js" escaparia da pasta de uploads.
  const extensaoSegura = /^\.[a-z0-9]{1,9}$/.test(extensao) ? extensao : "";

  return `${Date.now()}-${crypto.randomBytes(16).toString("hex")}${extensaoSegura}`;
};

export default {
  directory: publicFolder,

  // 25 MB: acima do que o WhatsApp aceita em mídia comum, e baixo o bastante
  // para um upload sozinho não encher o disco desta máquina.
  limits: { fileSize: 25 * 1024 * 1024, files: 10 },

  fileFilter(
    _req: Express.Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
  ) {
    if (TIPOS_PERMITIDOS.has(file.mimetype)) return cb(null, true);
    return cb(new Error(`Tipo de arquivo não permitido: ${file.mimetype}`));
  },

  storage: multer.diskStorage({
    destination: publicFolder,
    filename(_req, file, cb) {
      return cb(null, nomeAleatorio(file.originalname));
    }
  })
};
