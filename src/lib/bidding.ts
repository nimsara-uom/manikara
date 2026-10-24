import { db } from './db';
import { BidError, resolveBid } from './bidding-engine';

const MAX_ATTEMPTS = 5;

/**
 * Places (or raises) a bidder's maximum. Uses the auction's `version` column as
 * an optimistic lock: if another bid lands between our read and write, re-read
 * and resolve again.
 */
export async function placeBid(auctionId: string, userId: string, maxAmount: number) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const done = await db.$transaction(async tx => {
      const auction = await tx.auction.findUnique({ where: { id: auctionId }, include: { autoBids: true } });
      if (!auction) throw new BidError('Auction not found.');

      const now = new Date();
      const result = resolveBid(
        auction,
        auction.autoBids.map(p => ({ userId: p.userId, maxAmount: p.maxAmount, setAt: p.updatedAt })),
        userId,
        maxAmount,
        now,
      );

      const claimed = await tx.auction.updateMany({
        where: { id: auctionId, version: auction.version },
        data: {
          version: { increment: 1 },
          currentPrice: result.currentPrice,
          leaderId: result.leaderId,
          bidCount: { increment: result.bids.length },
          endsAt: result.endsAt,
        },
      });
      if (claimed.count === 0) return null; // lost the race, retry

      await tx.autoBid.upsert({
        where: { auctionId_userId: { auctionId, userId } },
        create: { auctionId, userId, maxAmount, updatedAt: now },
        update: { maxAmount, updatedAt: now },
      });
      for (const [i, bid] of result.bids.entries()) {
        // Offset by a millisecond each so history sorts in the order the engine produced
        await tx.bid.create({ data: { auctionId, ...bid, createdAt: new Date(now.getTime() + i) } });
      }
      return result;
    });
    if (done) return done;
  }
  throw new BidError('The auction is very busy right now. Please try again.');
}
