import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { normalizeCode } from '@/lib/gemkey';

// Raw signed record, for anyone who wants to verify a key with their own tools
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = normalizeCode(decodeURIComponent((await params).code));
  const key = code && (await db.gemKey.findUnique({ where: { code } }));
  if (!key) return NextResponse.json({ error: 'Unknown gem key' }, { status: 404 });
  return NextResponse.json({
    code: key.code,
    payload: key.payload,
    signature: key.signature,
    algorithm: 'Ed25519',
    publicKey: '/api/public-key',
    revokedAt: key.revokedAt,
  });
}
