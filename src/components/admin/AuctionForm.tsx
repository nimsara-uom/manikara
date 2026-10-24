'use client';

import { useActionState, useEffect, useState } from 'react';
import { saveAuction } from '@/app/admin/actions';

type AuctionValues = {
  lotNumber: number; startingPrice: number; reservePrice: number | null; increment: number;
  startsAt: string; endsAt: string; bidCount: number;
};

// <input type="datetime-local"> works in the browser's time zone; the server gets UTC ISO strings
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const toIso = (local: string) => (local ? new Date(local).toISOString() : '');

export function AuctionForm({ gemId, auction, nextLot }: { gemId: string; auction?: AuctionValues; nextLot: number }) {
  const [state, action, pending] = useActionState(saveAuction, undefined);
  const [starts, setStarts] = useState('');
  const [ends, setEnds] = useState('');
  const locked = !!auction && auction.bidCount > 0;

  useEffect(() => {
    const now = Date.now();
    setStarts(toLocalInput(auction?.startsAt ?? new Date(now).toISOString()));
    setEnds(toLocalInput(auction?.endsAt ?? new Date(now + 7 * 86400000).toISOString()));
  }, [auction?.startsAt, auction?.endsAt]);

  return (
    <form action={action}>
      <input type="hidden" name="gemId" value={gemId} />
      <input type="hidden" name="startsAt" value={toIso(starts)} />
      <input type="hidden" name="endsAt" value={toIso(ends)} />
      {locked && <p className="small muted" style={{ marginBottom: 20 }}>This lot has {auction!.bidCount} bids, so only the closing time can be extended.</p>}
      <div className="fields">
        <div className="field">
          <label htmlFor="lotNumber">Lot number</label>
          <input id="lotNumber" name="lotNumber" type="number" min={1} defaultValue={auction?.lotNumber ?? nextLot} required readOnly={locked} />
        </div>
        <div className="field">
          <label htmlFor="startingPrice">Starting price (USD)</label>
          <input id="startingPrice" name="startingPrice" type="number" min={1} defaultValue={auction?.startingPrice} required readOnly={locked} />
        </div>
        <div className="field">
          <label htmlFor="reservePrice">Reserve (USD, optional)</label>
          <input id="reservePrice" name="reservePrice" type="number" min={1} defaultValue={auction?.reservePrice ?? ''} readOnly={locked} />
        </div>
        <div className="field">
          <label htmlFor="increment">Bid increment (USD)</label>
          <input id="increment" name="increment" type="number" min={1} defaultValue={auction?.increment ?? 100} required readOnly={locked} />
        </div>
        <div className="field">
          <label htmlFor="starts">Opens (your local time)</label>
          <input id="starts" type="datetime-local" value={starts} onChange={e => setStarts(e.target.value)} required readOnly={locked} />
        </div>
        <div className="field">
          <label htmlFor="ends">Closes (your local time)</label>
          <input id="ends" type="datetime-local" value={ends} onChange={e => setEnds(e.target.value)} required />
        </div>
      </div>
      {state?.error && <p className="msg error" role="alert">{state.error}</p>}
      {state?.notice && <p className="msg notice" role="status">{state.notice}</p>}
      <button className="bid-btn" disabled={pending} style={{ marginTop: 34 }}>
        <span>{pending ? 'Saving…' : auction ? 'Save auction' : 'Create auction'}</span><span>→</span>
      </button>
    </form>
  );
}
