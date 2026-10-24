'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { audit } from '@/lib/audit';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { canonicalJson, factsFromGem, issueKey } from '@/lib/gemkey';
import { storeUpload } from '@/lib/media';

export type AdminFormState = { error?: string; notice?: string } | undefined;

const text = (max = 200) => z.string().trim().min(1, 'Required').max(max);

const GemInput = z.object({
  name: text(120),
  species: text(80),
  carat: z.coerce.number().positive('Carat weight must be positive').max(10000),
  colorName: text(80),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Pick a colour'),
  clarity: text(80),
  cut: text(120),
  origin: text(120),
  treatment: text(120),
  lab: text(80),
  reportNo: text(80),
  dimensions: z.string().trim().max(120).transform(s => s || null),
  description: z.string().trim().min(1, 'Required').max(5000),
});

function firstIssue(e: z.ZodError) {
  const i = e.issues[0];
  return `${i.path.join('.') || 'Form'}: ${i.message}`;
}

export async function saveGem(_prev: AdminFormState, form: FormData): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const id = String(form.get('id') ?? '') || null;
  const parsed = GemInput.safeParse(Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === 'string')));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const uploads = form.getAll('images').filter((f): f is File => f instanceof File && f.size > 0);
  if (!id && uploads.length === 0) return { error: 'Add at least one photograph.' };
  if (uploads.length > 12) return { error: 'At most 12 photographs per stone.' };

  let stored: { file: string; sha256: string }[] = [];
  try {
    stored = await Promise.all(uploads.map(storeUpload));
  } catch (e) {
    return { error: (e as Error).message };
  }
  const images = stored.map((s, position) => ({ ...s, position }));

  if (!id) {
    const gem = await db.$transaction(async tx => {
      const g = await tx.gem.create({ data: { ...parsed.data, images: { create: images } }, include: { images: true } });
      await tx.gemKey.create({ data: { gemId: g.id, ...issueKey(factsFromGem(g)) } });
      return g;
    });
    await audit('ADMIN_GEM_SAVED', admin.id, `created ${gem.id} "${gem.name}"`);
    revalidatePath('/admin');
    redirect(`/admin/gems/${gem.id}?created=1`);
  }

  const reissued = await db.$transaction(async tx => {
    const before = await tx.gem.findUnique({ where: { id }, include: { images: true } });
    if (!before) throw new Error('Gem not found');
    if (images.length) await tx.gemImage.deleteMany({ where: { gemId: id } });
    const after = await tx.gem.update({
      where: { id },
      data: { ...parsed.data, ...(images.length ? { images: { create: images } } : {}) },
      include: { images: true },
    });
    // The key certifies the facts; if any changed, the old key no longer describes the stone
    if (canonicalJson(factsFromGem(before)) === canonicalJson(factsFromGem(after))) return false;
    await tx.gemKey.updateMany({ where: { gemId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.gemKey.create({ data: { gemId: id, ...issueKey(factsFromGem(after)) } });
    return true;
  });

  await audit('ADMIN_GEM_SAVED', admin.id, `edited ${id}${reissued ? ', key re-issued' : ''}`);
  revalidatePath('/', 'layout');
  return { notice: reissued ? 'Saved. The facts changed, so the old Gem Key was revoked and a new one issued.' : 'Saved. Gem Key unchanged.' };
}

const AuctionInput = z.object({
  gemId: z.string().min(1),
  lotNumber: z.coerce.number().int().positive(),
  startingPrice: z.coerce.number().int().positive(),
  reservePrice: z.string().trim().transform((s, ctx) => {
    if (!s) return null;
    const n = Number(s);
    if (!Number.isInteger(n) || n <= 0) { ctx.addIssue({ code: 'custom', message: 'Reserve must be a whole number' }); return z.NEVER; }
    return n;
  }),
  increment: z.coerce.number().int().positive(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
});

export async function saveAuction(_prev: AdminFormState, form: FormData): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const parsed = AuctionInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const a = parsed.data;
  if (Number.isNaN(a.startsAt.getTime()) || Number.isNaN(a.endsAt.getTime())) return { error: 'Enter both dates.' };
  if (a.endsAt <= a.startsAt) return { error: 'The auction must end after it starts.' };
  if (a.reservePrice != null && a.reservePrice < a.startingPrice) return { error: 'Reserve cannot be below the starting price.' };

  const existing = await db.auction.findUnique({ where: { gemId: a.gemId } });
  const clash = await db.auction.findUnique({ where: { lotNumber: a.lotNumber } });
  if (clash && clash.gemId !== a.gemId) return { error: `Lot ${a.lotNumber} is already taken.` };

  // Moving the close into the future re-opens a lot that was already settled
  const reopen = a.endsAt > new Date() ? { settledAt: null } : {};

  if (existing && existing.bidCount > 0) {
    // Once people have bid, only the closing time may move — and only later
    const changed = existing.lotNumber !== a.lotNumber || existing.startingPrice !== a.startingPrice
      || existing.reservePrice !== a.reservePrice || existing.increment !== a.increment
      || existing.startsAt.getTime() !== a.startsAt.getTime();
    if (changed) return { error: 'This lot has bids. Only the closing time can be changed.' };
    if (a.endsAt < existing.endsAt) return { error: 'This lot has bids. The closing time can only be extended.' };
    await db.auction.update({ where: { id: existing.id }, data: { endsAt: a.endsAt, version: { increment: 1 }, ...reopen } });
  } else if (existing) {
    await db.auction.update({ where: { id: existing.id }, data: { ...a, version: { increment: 1 }, ...reopen } });
  } else {
    await db.auction.create({ data: a });
  }
  await audit('ADMIN_AUCTION_SAVED', admin.id, `gem ${a.gemId} lot ${a.lotNumber}`);
  revalidatePath('/', 'layout');
  return { notice: 'Auction saved.' };
}

export async function deleteGem(id: string) {
  const admin = await requireAdmin();
  const gem = await db.gem.findUnique({ where: { id }, include: { auction: true } });
  if (!gem) redirect('/admin');
  if (gem.auction && gem.auction.bidCount > 0) throw new Error('Cannot delete a stone whose lot has bids.');
  await db.gem.delete({ where: { id } });
  await audit('ADMIN_GEM_DELETED', admin.id, `${id} "${gem.name}"`);
  revalidatePath('/', 'layout');
  redirect('/admin');
}
