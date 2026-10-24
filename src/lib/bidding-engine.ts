// Proxy bidding rules, free of any database code so they can be unit-tested.
//
// Every bid a user places is a secret maximum. The engine bids on each
// bidder's behalf, only as much as needed, to keep the highest maximum
// in the lead:
//   price = min(top max, second max + increment), never below the current price
// Ties go to whoever reached that maximum first. If the leader's maximum meets
// the reserve, the price jumps to the reserve so the lot can actually sell.

export const SNIPE_WINDOW_MS = 2 * 60 * 1000; // bids in the last 2 minutes extend the close

export type AuctionState = {
  startingPrice: number;
  reservePrice: number | null;
  increment: number;
  currentPrice: number;
  bidCount: number;
  leaderId: string | null;
  startsAt: Date;
  endsAt: Date;
};

export type Proxy = { userId: string; maxAmount: number; setAt: Date };

export type NewBid = { userId: string; amount: number; isAuto: boolean };

export type Resolution = {
  currentPrice: number;
  leaderId: string;
  bids: NewBid[]; // to append to history, in order
  endsAt: Date;
};

export class BidError extends Error {}

export function minimumBid(a: Pick<AuctionState, 'bidCount' | 'startingPrice' | 'currentPrice' | 'increment'>): number {
  return a.bidCount === 0 ? a.startingPrice : a.currentPrice + a.increment;
}

export function auctionPhase(a: Pick<AuctionState, 'startsAt' | 'endsAt'>, now = new Date()) {
  if (now < a.startsAt) return 'upcoming' as const;
  if (now >= a.endsAt) return 'ended' as const;
  return 'live' as const;
}

export function reserveMet(a: Pick<AuctionState, 'reservePrice' | 'currentPrice' | 'bidCount'>): boolean {
  return a.bidCount > 0 && (a.reservePrice == null || a.currentPrice >= a.reservePrice);
}

/**
 * Applies a bidder's new maximum and works out the resulting price, leader and
 * history rows. `proxies` are the auction's existing maximums (any order).
 */
export function resolveBid(
  auction: AuctionState,
  proxies: Proxy[],
  bidderId: string,
  maxAmount: number,
  now = new Date(),
): Resolution {
  if (!Number.isSafeInteger(maxAmount) || maxAmount <= 0) throw new BidError('Bids are whole dollars.');
  const phase = auctionPhase(auction, now);
  if (phase === 'upcoming') throw new BidError('Bidding has not opened yet.');
  if (phase === 'ended') throw new BidError('This auction has closed.');

  const own = proxies.find(p => p.userId === bidderId);
  const isLeader = auction.leaderId === bidderId;

  if (isLeader && own) {
    if (maxAmount <= own.maxAmount) {
      throw new BidError(`You are already leading with a maximum of $${own.maxAmount.toLocaleString('en-US')}. Raise it to change it.`);
    }
  } else {
    const min = minimumBid(auction);
    if (maxAmount < min) throw new BidError(`The minimum bid is $${min.toLocaleString('en-US')}.`);
  }

  const updated: Proxy[] = [
    ...proxies.filter(p => p.userId !== bidderId),
    // Raising a maximum counts as reaching it now, so it loses ties to older maximums
    { userId: bidderId, maxAmount, setAt: now },
  ].sort((a, b) => b.maxAmount - a.maxAmount || a.setAt.getTime() - b.setAt.getTime());

  const [top, second] = updated;
  const floor = auction.bidCount === 0 ? auction.startingPrice : auction.currentPrice;
  let price = second ? Math.max(floor, Math.min(top.maxAmount, second.maxAmount + auction.increment)) : floor;
  if (auction.reservePrice != null && top.maxAmount >= auction.reservePrice && price < auction.reservePrice) {
    price = auction.reservePrice;
  }

  const bids: NewBid[] = [];
  if (top.userId !== bidderId) {
    // An existing maximum beats the new bid straight away
    bids.push({ userId: bidderId, amount: maxAmount, isAuto: false });
    bids.push({ userId: top.userId, amount: price, isAuto: true });
  } else if (auction.leaderId !== bidderId) {
    // New leader. Show the outbid proxy's last stand if it went above the old price.
    const prev = updated.find(p => p.userId === auction.leaderId);
    if (prev && prev.maxAmount > auction.currentPrice) {
      bids.push({ userId: prev.userId, amount: prev.maxAmount, isAuto: true });
    }
    bids.push({ userId: bidderId, amount: price, isAuto: false });
  } else if (price > auction.currentPrice) {
    // Leader raised their own maximum past the reserve
    bids.push({ userId: bidderId, amount: price, isAuto: true });
  }

  const endsAt = bids.length && auction.endsAt.getTime() - now.getTime() < SNIPE_WINDOW_MS
    ? new Date(now.getTime() + SNIPE_WINDOW_MS)
    : auction.endsAt;

  return { currentPrice: price, leaderId: top.userId, bids, endsAt };
}
