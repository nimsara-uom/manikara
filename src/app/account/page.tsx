import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { auctionPhase, reserveMet } from '@/lib/bidding-engine';
import { lotLabel, usd } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My account' };

export default async function AccountPage() {
  const user = await requireUser('/account');
  const [proxies, watches] = await Promise.all([
    db.autoBid.findMany({
      where: { userId: user.id },
      include: { auction: { include: { gem: { select: { name: true } } } } },
      orderBy: { auction: { endsAt: 'asc' } },
    }),
    db.watch.findMany({
      where: { userId: user.id },
      include: { auction: { include: { gem: { select: { name: true } } } } },
      orderBy: { auction: { endsAt: 'asc' } },
    }),
  ]);

  const active = proxies.filter(p => auctionPhase(p.auction) !== 'ended');
  const won = proxies.filter(p => auctionPhase(p.auction) === 'ended' && p.auction.leaderId === user.id && reserveMet(p.auction));
  const [first, ...rest] = user.name.split(' ');

  return (
    <section className="page light">
      <div className="page-head">
        <span className="eyebrow">( Your account · {user.email} )</span>
        <h1 className="display">{first}{rest.length > 0 && <> <em>{rest.join(' ')}</em></>}</h1>
      </div>

      <div className="block">
        <h2>Active <em>bids</em></h2>
        {active.length === 0 ? <p className="empty">No bids on open lots. <Link href="/#lots" className="text-link">Browse lots →</Link></p> : (
          <table className="table">
            <thead><tr><th>Lot</th><th>Current</th><th>Your maximum</th><th>Status</th></tr></thead>
            <tbody>
              {active.map(p => (
                <tr key={p.id}>
                  <td className="serif-cell"><Link href={`/lots/${p.auction.lotNumber}`}>{p.auction.gem.name}</Link> <span className="small muted">{lotLabel(p.auction.lotNumber)}</span></td>
                  <td>{usd(p.auction.currentPrice)}</td>
                  <td>{usd(p.maxAmount)}</td>
                  <td>{p.auction.leaderId === user.id ? <span className="chip ok">Leading</span> : <span className="chip bad">Outbid</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="block">
        <h2>Won</h2>
        {won.length === 0 ? <p className="empty">Nothing yet.</p> : (
          <table className="table">
            <thead><tr><th>Lot</th><th>Hammer price</th><th>Closed</th></tr></thead>
            <tbody>
              {won.map(p => (
                <tr key={p.id}>
                  <td className="serif-cell"><Link href={`/lots/${p.auction.lotNumber}`}>{p.auction.gem.name}</Link> <span className="small muted">{lotLabel(p.auction.lotNumber)}</span></td>
                  <td>{usd(p.auction.currentPrice)}</td>
                  <td>{p.auction.endsAt.toLocaleDateString('en-GB', { dateStyle: 'medium' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="block">
        <h2>Watching</h2>
        {watches.length === 0 ? <p className="empty">Use “Watch lot” on any lot page to follow it here.</p> : (
          <table className="table">
            <thead><tr><th>Lot</th><th>Current</th><th>Status</th></tr></thead>
            <tbody>
              {watches.map(w => {
                const phase = auctionPhase(w.auction);
                return (
                  <tr key={w.auctionId}>
                    <td className="serif-cell"><Link href={`/lots/${w.auction.lotNumber}`}>{w.auction.gem.name}</Link> <span className="small muted">{lotLabel(w.auction.lotNumber)}</span></td>
                    <td>{w.auction.bidCount ? usd(w.auction.currentPrice) : '—'}</td>
                    <td><span className={`chip ${phase}`}>{phase === 'live' ? 'Bidding open' : phase === 'upcoming' ? 'Preview' : 'Closed'}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
