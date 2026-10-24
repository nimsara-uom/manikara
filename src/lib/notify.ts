import { db } from './db';
import { minimumBid, reserveMet } from './bidding-engine';
import { sendEmail, sendInBackground } from './email';
import { adminResultEmail, bidPlacedEmail, lotClosedEmail, outbidEmail, wonEmail } from './email-templates';

/** Emails the bidder a receipt and, if someone lost the lead, tells them they were outbid. */
export async function notifyBid(auctionId: string, bidderId: string, maxAmount: number, previousLeaderId: string | null) {
  const a = await db.auction.findUnique({ where: { id: auctionId }, include: { gem: { select: { name: true } } } });
  if (!a) return;
  const ids = [bidderId, previousLeaderId].filter((x): x is string => !!x);
  const users = new Map((await db.user.findMany({ where: { id: { in: ids } } })).map(u => [u.id, u]));

  const bidder = users.get(bidderId);
  if (bidder?.notifyBids) {
    sendInBackground(bidPlacedEmail(bidder.email, bidder.name, {
      lotNumber: a.lotNumber, gemName: a.gem.name, price: a.currentPrice, max: maxAmount, leading: a.leaderId === bidderId,
    }));
  }
  const prev = previousLeaderId ? users.get(previousLeaderId) : null;
  if (prev && prev.id !== bidderId && a.leaderId !== prev.id && prev.notifyBids) {
    sendInBackground(outbidEmail(prev.email, prev.name, {
      lotNumber: a.lotNumber, gemName: a.gem.name, price: a.currentPrice, minimumBid: minimumBid(a), endsAt: a.endsAt,
    }));
  }
}

/**
 * Processes every auction whose close has passed: marks it settled exactly once
 * (even with several servers racing) and sends the result emails.
 */
export async function settleEndedAuctions(): Promise<number> {
  const due = await db.auction.findMany({
    where: { endsAt: { lte: new Date() }, settledAt: null },
    include: { gem: { select: { name: true } }, autoBids: { include: { user: true } }, leader: true },
  });
  let settled = 0;
  for (const a of due) {
    const claimed = await db.auction.updateMany({ where: { id: a.id, settledAt: null, endsAt: { lte: new Date() } }, data: { settledAt: new Date() } });
    if (claimed.count === 0) continue; // another instance got it, or the close was extended
    settled++;

    const sold = reserveMet(a);
    const info = { lotNumber: a.lotNumber, gemName: a.gem.name, price: a.currentPrice };
    const mails = [];
    for (const { user } of a.autoBids) {
      if (sold && user.id === a.leaderId) mails.push(wonEmail(user.email, user.name, info)); // always sent, whatever the preference
      else if (user.notifyBids) mails.push(lotClosedEmail(user.email, user.name, { ...info, sold }));
    }
    const admins = await db.user.findMany({ where: { role: 'ADMIN', emailVerifiedAt: { not: null } } });
    for (const admin of admins) {
      mails.push(adminResultEmail(admin.email, admin.name, { ...info, sold, bidCount: a.bidCount, winnerEmail: sold ? a.leader?.email ?? null : null }));
    }
    await Promise.all(mails.map(sendEmail));
  }
  return settled;
}

// Opportunistic settlement on page views, at most every 30 seconds per server.
// For exact timing in production, also run `npm run settle` from a scheduler every minute.
let lastRun = 0;
export function settleSoon() {
  if (Date.now() - lastRun < 30_000) return;
  lastRun = Date.now();
  void settleEndedAuctions().catch(e => console.error('settlement failed', e));
}
