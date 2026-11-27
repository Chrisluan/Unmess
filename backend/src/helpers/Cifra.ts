import crypto from "crypto";
import AppError from "../errors/AppError";

/**
 * Cifra o que o sistema precisa guardar e não pode guardar em claro.
 *
 * O caso de hoje é a chave de API do gateway de cobrança de cada empresa: com
 * ela, quem tiver uma cópia do banco emite e cancela cobranças em nome da
 * empresa e enxerga o saldo dela. Um backup esquecido num pendrive não pode
 * valer isso.
 *
 * AES-256-GCM, com vetor novo a cada gravação e a etiqueta de autenticação
 * junto: um valor adulterado no banco falha ao abrir em vez de virar uma chave
 * errada que só quebra lá no gateway.
 *
 * A chave mestra fica em `INTEGRATIONS_KEY` no backend/.env — fora do banco, de
 * propósito. **Trocá-la torna ilegível tudo o que foi cifrado com ela**: as
 * empresas teriam de redigitar as chaves de API. Por isso ela não entra na
 * rotação de segredos; é gerada uma vez por scripts/gerar-chave-de-integracoes.js.
 */

const VERSAO = "v1";
const TAMANHO_MINIMO = 32;

const chaveMestra = (): Buffer | null => {
  const bruta = (process.env.INTEGRATIONS_KEY || "").trim();
  if (bruta.length < TAMANHO_MINIMO) return null;
  // sha256 normaliza qualquer texto longo o bastante para os 32 bytes que o
  // AES-256 exige, sem obrigar o .env a guardar hexadecimal exato.
  return crypto.createHash("sha256").update(bruta).digest();
};

export const chaveMestraDisponivel = (): boolean => chaveMestra() !== null;

const exigirChave = (): Buffer => {
  const chave = chaveMestra();
  if (!chave) throw new AppError("ERR_INTEGRACAO_SEM_CHAVE_MESTRA", 503);
  return chave;
};

export const cifrar = (texto: string): string => {
  const chave = exigirChave();
  const iv = crypto.randomBytes(12);
  const cifra = crypto.createCipheriv("aes-256-gcm", chave, iv);
  const corpo = Buffer.concat([cifra.update(texto, "utf8"), cifra.final()]);
  const etiqueta = cifra.getAuthTag();
  return [VERSAO, iv.toString("base64"), etiqueta.toString("base64"), corpo.toString("base64")].join(":");
};

export const decifrar = (guardado: string): string => {
  const chave = exigirChave();
  const [versao, iv, etiqueta, corpo] = String(guardado || "").split(":");
  if (versao !== VERSAO || !iv || !etiqueta || !corpo) {
    throw new AppError("ERR_INTEGRACAO_CHAVE_ILEGIVEL", 409);
  }
  try {
    const decifra = crypto.createDecipheriv("aes-256-gcm", chave, Buffer.from(iv, "base64"));
    decifra.setAuthTag(Buffer.from(etiqueta, "base64"));
    return Buffer.concat([decifra.update(Buffer.from(corpo, "base64")), decifra.final()]).toString("utf8");
  } catch {
    // Chave mestra trocada ou valor adulterado: nos dois casos a saída é a
    // empresa redigitar a chave de API, e a mensagem diz isso.
    throw new AppError("ERR_INTEGRACAO_CHAVE_ILEGIVEL", 409);
  }
};

/** Comparação em tempo constante, para tokens de webhook. */
export const mesmoSegredo = (a: unknown, b: unknown): boolean => {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  const x = crypto.createHash("sha256").update(a).digest();
  const y = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(x, y);
};
