import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { auctionPhase } from '@/lib/bidding-engine';
import { lotLabel, usd } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin' };

export default async function AdminPage() {
  await requireAdmin();
  const gems = await db.gem.findMany({
    orderBy: { createdAt: 'desc' },
    include: { auction: true, keys: { where: { revokedAt: null }, take: 1 } },
  });
  return (
    <section className="page light">
      <div className="page-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 30, flexWrap: 'wrap' }}>
        <div>
          <span className="eyebrow">( Curator )</span>
          <h1 className="display">The <em>stones.</em></h1>
        </div>
        <Link href="/admin/gems/new" className="btn-round" style={{ width: 130, height: 130, marginTop: 0 }}>Add stone</Link>
      </div>
      {gems.length === 0 ? <p className="empty">No stones yet.</p> : (
        <table className="table">
          <thead><tr><th>Stone</th><th>Lot</th><th>Status</th><th>Price</th><th>Gem Key</th></tr></thead>
          <tbody>
            {gems.map(g => {
              const phase = g.auction ? auctionPhase(g.auction) : null;
              return (
                <tr key={g.id}>
                  <td className="serif-cell">
                    <Link href={`/admin/gems/${g.id}`}>{g.name}</Link>
                    <div className="small muted" style={{ fontFamily: 'var(--sans)' }}>{g.carat.toFixed(2)} ct {g.species}</div>
                  </td>
                  <td>{g.auction ? <Link href={`/lots/${g.auction.lotNumber}`}>{lotLabel(g.auction.lotNumber)}</Link> : <span className="muted">—</span>}</td>
                  <td>{phase ? <span className={`chip ${phase}`}>{phase === 'live' ? 'Bidding open' : phase === 'upcoming' ? 'Preview' : 'Closed'}</span> : <span className="muted small">No auction</span>}</td>
                  <td>{g.auction?.bidCount ? `${usd(g.auction.currentPrice)} · ${g.auction.bidCount} bids` : <span className="muted">—</span>}</td>
                  <td className="mono small">{g.keys[0]?.code ?? <span className="danger">none</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
