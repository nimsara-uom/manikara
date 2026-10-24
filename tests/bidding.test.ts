import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BidError, SNIPE_WINDOW_MS, minimumBid, resolveBid, type AuctionState, type Proxy } from '../src/lib/bidding-engine';

const NOW = new Date('2026-06-01T12:00:00Z');
const t = (offsetMs: number) => new Date(NOW.getTime() + offsetMs);

function auction(over: Partial<AuctionState> = {}): AuctionState {
  return {
    startingPrice: 1000, reservePrice: null, increment: 100, currentPrice: 0, bidCount: 0, leaderId: null,
    startsAt: t(-3600_000), endsAt: t(86400_000), ...over,
  };
}

/** Runs a sequence of bids through the engine, carrying state forward like the database would. */
function play(start: AuctionState, bids: [string, number][]) {
  let a = start;
  let proxies: Proxy[] = [];
  const history: { userId: string; amount: number; isAuto: boolean }[] = [];
  bids.forEach(([user, max], i) => {
    const now = t(i * 1000);
    const r = resolveBid(a, proxies, user, max, now);
    proxies = [...proxies.filter(p => p.userId !== user), { userId: user, maxAmount: max, setAt: now }];
    a = { ...a, currentPrice: r.currentPrice, leaderId: r.leaderId, bidCount: a.bidCount + r.bids.length, endsAt: r.endsAt };
    history.push(...r.bids);
  });
  return { a, history };
}

test('first bid opens at the starting price, whatever the maximum', () => {
  const { a, history } = play(auction(), [['ana', 5000]]);
  assert.equal(a.currentPrice, 1000);
  assert.equal(a.leaderId, 'ana');
  assert.deepEqual(history, [{ userId: 'ana', amount: 1000, isAuto: false }]);
});

test('a higher maximum takes the lead at one increment above the old maximum', () => {
  const { a, history } = play(auction(), [['ana', 1500], ['ben', 3000]]);
  assert.equal(a.leaderId, 'ben');
  assert.equal(a.currentPrice, 1600);
  assert.deepEqual(history.slice(1), [
    { userId: 'ana', amount: 1500, isAuto: true },
    { userId: 'ben', amount: 1600, isAuto: false },
  ]);
});

test('a lower bid is answered immediately by the leader’s proxy', () => {
  const { a, history } = play(auction(), [['ana', 5000], ['ben', 2000]]);
  assert.equal(a.leaderId, 'ana');
  assert.equal(a.currentPrice, 2100);
  assert.deepEqual(history.slice(1), [
    { userId: 'ben', amount: 2000, isAuto: false },
    { userId: 'ana', amount: 2100, isAuto: true },
  ]);
});

test('proxy never bids past its own maximum', () => {
  const { a } = play(auction(), [['ana', 2050], ['ben', 2000]]);
  assert.equal(a.leaderId, 'ana');
  assert.equal(a.currentPrice, 2050);
});

test('equal maximums: the earlier bidder keeps the lead', () => {
  const { a } = play(auction(), [['ana', 2000], ['ben', 2000]]);
  assert.equal(a.leaderId, 'ana');
  assert.equal(a.currentPrice, 2000);
});

test('bids below the minimum are rejected', () => {
  const a = auction({ bidCount: 1, currentPrice: 1500, leaderId: 'ana' });
  assert.equal(minimumBid(a), 1600);
  assert.throws(() => resolveBid(a, [{ userId: 'ana', maxAmount: 1500, setAt: t(-1) }], 'ben', 1599, NOW), BidError);
});

test('the leader can raise their maximum without moving the price', () => {
  const { a, history } = play(auction(), [['ana', 2000], ['ben', 1500], ['ana', 9000]]);
  assert.equal(a.leaderId, 'ana');
  assert.equal(a.currentPrice, 1600);
  assert.equal(history.length, 3);
});

test('the leader cannot lower or repeat their maximum', () => {
  assert.throws(() => play(auction(), [['ana', 2000], ['ana', 2000]]), /already leading/);
});

test('price jumps to the reserve once a maximum covers it', () => {
  const { a } = play(auction({ reservePrice: 4000 }), [['ana', 2000]]);
  assert.equal(a.currentPrice, 1000);
  const { a: b, history } = play(auction({ reservePrice: 4000 }), [['ana', 2000], ['ana', 4500]]);
  assert.equal(b.currentPrice, 4000);
  assert.deepEqual(history.at(-1), { userId: 'ana', amount: 4000, isAuto: true });
});

test('a bid in the final two minutes extends the close', () => {
  const endsAt = t(30_000);
  const r = resolveBid(auction({ endsAt }), [], 'ana', 1000, NOW);
  assert.equal(r.endsAt.getTime(), NOW.getTime() + SNIPE_WINDOW_MS);
  const early = resolveBid(auction(), [], 'ana', 1000, NOW);
  assert.equal(early.endsAt.getTime(), auction().endsAt.getTime());
});

test('no bidding before opening or after closing', () => {
  assert.throws(() => resolveBid(auction({ startsAt: t(1000) }), [], 'ana', 1000, NOW), /not opened/);
  assert.throws(() => resolveBid(auction({ endsAt: t(-1) }), [], 'ana', 1000, NOW), /closed/);
});

test('rejects fractional and non-positive amounts', () => {
  assert.throws(() => resolveBid(auction(), [], 'ana', 1000.5, NOW), BidError);
  assert.throws(() => resolveBid(auction(), [], 'ana', -5, NOW), BidError);
});
