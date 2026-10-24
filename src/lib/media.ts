import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MEDIA_NAME = /^[a-f0-9]{64}\.(jpg|png|webp)$/;

export const MEDIA_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/** Detects the real format from magic bytes, so a renamed file can't slip through. */
function sniff(buf: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

/** Stores a file under its content hash. Identical photographs are stored once. */
export async function storeBytes(buf: Buffer, ext: string) {
  const sha256 = createHash('sha256').update(buf).digest('hex');
  const file = `${sha256}.${ext}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, file), buf);
  return { file, sha256 };
}

export async function storeUpload(upload: File) {
  if (upload.size > MAX_IMAGE_BYTES) throw new Error(`${upload.name} is larger than 8 MB.`);
  const buf = Buffer.from(await upload.arrayBuffer());
  const ext = sniff(buf);
  if (!ext) throw new Error(`${upload.name} is not a JPEG, PNG or WebP image.`);
  return storeBytes(buf, ext);
}
