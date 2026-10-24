import { db } from './db';
import { auctionPhase, minimumBid, reserveMet } from './bidding-engine';
import { bidderAlias } from './format';
import { settleSoon } from './notify';

/** Public live state of a lot, as seen by `viewerId` (who may be anonymous). Safe to send to the browser. */
export async function lotState(lotNumber: number, viewerId: string | null) {
  settleSoon();
  const a = await db.auction.findUnique({
    where: { lotNumber },
    include: {
      bids: { orderBy: { createdAt: 'desc' }, take: 25 },
      autoBids: viewerId ? { where: { userId: viewerId } } : false,
    },
  });
  if (!a) return null;
  const phase = auctionPhase(a);
  return {
    auctionId: a.id,
    lotNumber: a.lotNumber,
    phase,
    startsAt: a.startsAt.toISOString(),
    endsAt: a.endsAt.toISOString(),
    currentPrice: a.currentPrice,
    startingPrice: a.startingPrice,
    increment: a.increment,
    bidCount: a.bidCount,
    minimumBid: minimumBid(a),
    hasReserve: a.reservePrice != null,
    reserveMet: reserveMet(a),
    youLead: !!viewerId && a.leaderId === viewerId,
    yourMax: a.autoBids?.[0]?.maxAmount ?? null,
    youWon: phase === 'ended' && !!viewerId && a.leaderId === viewerId && reserveMet(a),
    history: a.bids.map(b => ({
      id: b.id,
      bidder: b.userId === viewerId ? 'You' : bidderAlias(b.userId, a.id),
      amount: b.amount,
      isAuto: b.isAuto,
      at: b.createdAt.toISOString(),
    })),
  };
}

export type LotState = NonNullable<Awaited<ReturnType<typeof lotState>>>;
