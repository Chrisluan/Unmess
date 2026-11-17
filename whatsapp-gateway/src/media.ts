import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "audio/ogg": "ogg",
  "audio/ogg; codecs=opus": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "application/pdf": "pdf"
};

export class MediaStore {
  private readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  async save(sessionId: string, messageId: string, mimetype: string, data: Buffer, filename?: string): Promise<string> {
    const extension = EXTENSIONS[mimetype] ?? path.extname(filename ?? "").replace(".", "") ?? "bin";
    const safeSession = sanitize(sessionId);
    const ref = `${safeSession}/${sanitize(messageId)}.${extension || "bin"}`;
    await mkdir(path.join(this.root, safeSession), { recursive: true });
    await writeFile(this.resolve(ref), data);
    return ref;
  }

  async read(ref: string): Promise<Buffer> {
    return readFile(this.resolve(ref));
  }

  resolve(ref: string): string {
    const full = path.resolve(this.root, ref);
    if (!full.startsWith(this.root + path.sep)) {
      throw new Error("media reference escapes the media directory");
    }
    return full;
  }
}

function sanitize(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "_");
}
