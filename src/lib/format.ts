import { createHash } from 'node:crypto';

export function usd(amount: number): string {
  return '$' + amount.toLocaleString('en-US');
}

/** Stable pseudonym for a bidder within one auction — bidders never see each other's names. */
export function bidderAlias(userId: string, auctionId: string): string {
  return 'Bidder ' + createHash('sha256').update(`${auctionId}:${userId}`).digest('hex').slice(0, 4).toUpperCase();
}

export function lotLabel(n: number): string {
  return 'Lot ' + String(n).padStart(3, '0');
}
