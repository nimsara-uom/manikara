import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { MEDIA_NAME, MEDIA_TYPES, UPLOAD_DIR } from '@/lib/media';

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  // Strict name check doubles as path-traversal protection
  if (!MEDIA_NAME.test(file)) return new Response('Not found', { status: 404 });
  try {
    const body = await readFile(path.join(UPLOAD_DIR, file));
    return new Response(new Uint8Array(body), {
      headers: {
        'Content-Type': MEDIA_TYPES[file.split('.').pop()!],
        // Content-addressed, so it can never change
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
