import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { lotState } from '@/lib/lots';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ lot: string }> }) {
  const lot = Number((await params).lot);
  if (!Number.isInteger(lot)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const user = await currentUser();
  const state = await lotState(lot, user?.id ?? null);
  if (!state) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } });
}
