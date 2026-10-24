'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, useTransition } from 'react';
import type { LotState } from '@/lib/lots';
import { bidAction } from '@/app/lots/[lot]/actions';
import { Countdown } from './Countdown';

const POLL_MS = 4000;
const usd = (n: number) => '$' + n.toLocaleString('en-US');

export function BidPanel({ initial, signedIn }: { initial: LotState; signedIn: boolean }) {
  const [s, setS] = useState(initial);
  const [amount, setAmount] = useState(String(initial.minimumBid));
  const [message, setMessage] = useState<{ kind: 'error' | 'notice'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/lots/${initial.lotNumber}`, { cache: 'no-store' });
    if (res.ok) setS(await res.json());
  }, [initial.lotNumber]);

  useEffect(() => {
    if (s.phase === 'ended') return;
    const t = setInterval(() => { if (!document.hidden) refresh(); }, POLL_MS);
    return () => clearInterval(t);
  }, [refresh, s.phase]);

  // Keep the suggested amount valid as the price moves, unless the user typed something higher
  useEffect(() => {
    setAmount(a => (Number(a) < s.minimumBid && !s.youLead ? String(s.minimumBid) : a));
  }, [s.minimumBid, s.youLead]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const value = Number(amount);
    startTransition(async () => {
      const r = await bidAction(s.auctionId, value);
      if (!r.ok) setMessage({ kind: 'error', text: r.error });
      else if (r.leading) setMessage({ kind: 'notice', text: `You lead at ${usd(r.price)}. We'll bid for you up to ${usd(value)}.` });
      else setMessage({ kind: 'error', text: `Another collector's maximum is higher. The price is now ${usd(r.price)}.` });
      await refresh();
    });
  }

  const label = s.bidCount > 0 ? `${s.bidCount} bid${s.bidCount === 1 ? '' : 's'} · ${s.phase === 'ended' ? 'final' : 'current'}` : 'Opening bid';

  return (
    <div>
      <div className="price-block">
        <div>
          <small>{label}</small>
          <div className="price-big">{usd(s.bidCount > 0 ? s.currentPrice : s.startingPrice)}</div>
        </div>
        <div className="clock">
          {s.phase === 'live' && <><small className="eyebrow">Closes in</small><b><Countdown to={s.endsAt} format="clock" onDone={refresh} hotClass="hot" /></b></>}
          {s.phase === 'upcoming' && <><small className="eyebrow">Opens in</small><b><Countdown to={s.startsAt} format="clock" onDone={refresh} /></b></>}
          {s.phase === 'ended' && <><small className="eyebrow">Bidding</small><b>Closed</b></>}
        </div>
      </div>

      <div className="row-status" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 18, flexWrap: 'wrap' }}>
        <span className={`chip ${s.phase}`}>{s.phase === 'live' ? 'Bidding open' : s.phase === 'upcoming' ? 'Preview' : 'Closed'}</span>
        {s.hasReserve && <span className={`chip ${s.reserveMet ? 'ok' : 'warn'}`}>{s.reserveMet ? 'Reserve met' : 'Reserve not yet met'}</span>}
      </div>

      {s.youWon && <p className="msg notice">You won this lot. Our concierge will contact you about payment and delivery.</p>}
      {s.phase === 'ended' && !s.youWon && s.bidCount > 0 && !s.reserveMet && <p className="msg">The lot closed below its reserve and was not sold.</p>}
      {s.phase !== 'ended' && s.yourMax != null && (
        <p className={`msg ${s.youLead ? 'notice' : 'error'}`}>
          {s.youLead ? `You are leading · your maximum is ${usd(s.yourMax)}` : `You have been outbid · your maximum was ${usd(s.yourMax)}`}
        </p>
      )}

      {s.phase === 'live' && (signedIn ? (
        <form onSubmit={submit} style={{ marginTop: 26 }}>
          <div className="field">
            <label htmlFor="max">Your maximum bid (USD)</label>
            <input id="max" type="number" inputMode="numeric" min={s.youLead ? (s.yourMax ?? 0) + 1 : s.minimumBid} step={1}
              value={amount} onChange={e => setAmount(e.target.value)} required />
          </div>
          <p className="small muted" style={{ marginTop: 12, lineHeight: 1.7 }}>
            {s.youLead ? 'Raise your maximum at any time. ' : `Minimum ${usd(s.minimumBid)}. `}
            We bid for you in steps of {usd(s.increment)}, never above your maximum. A bid in the final two minutes extends the close.
          </p>
          <button className="bid-btn" disabled={pending}>
            <span>{pending ? 'Placing bid…' : s.youLead ? 'Raise maximum' : `Place bid · ${usd(Number(amount) || s.minimumBid)}`}</span><span>→</span>
          </button>
        </form>
      ) : (
        <Link className="bid-btn" href={`/login?next=/lots/${s.lotNumber}`} style={{ marginTop: 30 }}><span>Sign in to bid</span><span>→</span></Link>
      ))}

      {message && <p className={`msg ${message.kind}`} role="status">{message.text}</p>}

      {s.history.length > 0 && (
        <div className="history">
          <h3>Bid history</h3>
          <ul>
            {s.history.map(b => (
              <li key={b.id}>
                <span>{b.bidder}{b.isAuto && <span className="muted"> · proxy</span>}</span>
                <b>{usd(b.amount)}</b>
                <time dateTime={b.at} suppressHydrationWarning>
                  {new Date(b.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </time>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
