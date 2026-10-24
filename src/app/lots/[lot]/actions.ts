'use server';

import { revalidatePath } from 'next/cache';
import { currentUser } from '@/lib/auth';
import { placeBid } from '@/lib/bidding';
import { BidError } from '@/lib/bidding-engine';
import { db } from '@/lib/db';

export type BidResult = { ok: true; leading: boolean; price: number } | { ok: false; error: string };

export async function bidAction(auctionId: string, maxAmount: number): Promise<BidResult> {
  const user = await currentUser();
  if (!user) return { ok: false, error: 'Please sign in to bid.' };
  try {
    const r = await placeBid(auctionId, user.id, Math.floor(Number(maxAmount)));
    revalidatePath('/');
    return { ok: true, leading: r.leaderId === user.id, price: r.currentPrice };
  } catch (e) {
    if (e instanceof BidError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: 'Something went wrong placing your bid.' };
  }
}

export async function toggleWatch(auctionId: string, lotNumber: number) {
  const user = await currentUser();
  if (!user) return;
  const key = { userId_auctionId: { userId: user.id, auctionId } };
  if (await db.watch.findUnique({ where: key })) await db.watch.delete({ where: key });
  else await db.watch.create({ data: { userId: user.id, auctionId } });
  revalidatePath(`/lots/${lotNumber}`);
  revalidatePath('/account');
}
