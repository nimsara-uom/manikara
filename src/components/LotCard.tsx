'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { GemShot } from './GemShot';

export type LotCardData = {
  lotNumber: number;
  name: string;
  spec: string;
  colorHex: string;
  photo: string | null;
  verified: boolean;
  phase: 'upcoming' | 'live' | 'ended';
  startsAt: string;
  endsAt: string;
  bidCount: number;
  currentPrice: number;
  startingPrice: number;
  minimumBid: number;
  sold: boolean;
  rot: number;
};

const usd = (n: number) => '$' + n.toLocaleString('en-US');
const clock = (ms: number) => {
  if (ms <= 0) return '00:00:00';
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400);
  const hms = [Math.floor((s % 86400) / 3600), Math.floor((s % 3600) / 60), s % 60].map(n => String(n).padStart(2, '0')).join(':');
  return d > 0 ? `${d}d ${hms}` : hms;
};

export function LotCard({ lot, signedIn, index }: { lot: LotCardData; signedIn: boolean; index: number }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Phase can change while the page is open
  const phase = now === null ? lot.phase
    : now < Date.parse(lot.startsAt) ? 'upcoming' : now >= Date.parse(lot.endsAt) ? 'ended' : 'live';
  const left = now === null ? null : Date.parse(phase === 'upcoming' ? lot.startsAt : lot.endsAt) - now;
  const hot = phase === 'live' && left !== null && left < 120_000;

  const timer = phase === 'ended' ? (lot.sold ? 'Sold' : 'Closed')
    : left === null ? ' ' : `${phase === 'upcoming' ? 'Opens in' : 'Closes in'} ${clock(left)}`;
  const action = phase === 'ended' ? 'View result'
    : phase === 'upcoming' ? 'Preview lot'
    : signedIn ? `Place bid · ${usd(lot.minimumBid)}` : 'Sign in to bid';
  const href = phase === 'live' && !signedIn ? `/login?next=/lots/${lot.lotNumber}` : `/lots/${lot.lotNumber}`;

  return (
    <article className="lot fade" style={{ '--i': index % 2 } as React.CSSProperties}>
      <Link href={`/lots/${lot.lotNumber}`} className="lot-img">
        {lot.photo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={`/media/${lot.photo}`} alt={lot.name} />
          : <GemShot color={lot.colorHex} rot={lot.rot} alt={`${lot.name}, studio render`} />}
        <span className="lot-no">Lot {String(lot.lotNumber).padStart(3, '0')}</span>
        {lot.verified && <span className="lot-verified">Key Verified</span>}
        <span className={`lot-timer${hot ? ' hot' : ''}`}>{timer}</span>
      </Link>
      <div className="lot-info">
        <div>
          <h3><Link href={`/lots/${lot.lotNumber}`}>{lot.name}</Link></h3>
          <div className="spec">{lot.spec}</div>
        </div>
        <div className="bid">
          {lot.bidCount > 0 ? (
            <><small>{lot.bidCount} bid{lot.bidCount === 1 ? '' : 's'} · {phase === 'ended' ? 'final' : 'current'}</small><span className="amt">{usd(lot.currentPrice)}</span></>
          ) : (
            <><small>Opening bid</small><span className="amt">{usd(lot.startingPrice)}</span></>
          )}
        </div>
      </div>
      <Link href={href} className="bid-btn"><span>{action}</span><span>→</span></Link>
    </article>
  );
}
