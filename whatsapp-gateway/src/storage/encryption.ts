import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export function encrypt(key: Buffer, plaintext: string, associatedData: string): Buffer {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(associatedData, "utf8"));
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

export function decrypt(key: Buffer, payload: Uint8Array, associatedData: string): string {
  const buffer = Buffer.from(payload);
  const iv = buffer.subarray(0, IV_LENGTH);
  const tag = buffer.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const body = buffer.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(Buffer.from(associatedData, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
}
