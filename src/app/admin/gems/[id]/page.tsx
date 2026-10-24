import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { lotLabel } from '@/lib/format';
import { AuctionForm } from '@/components/admin/AuctionForm';
import { GemForm } from '@/components/admin/GemForm';
import { deleteGem } from '../../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Edit stone' };

export default async function EditGemPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const created = (await searchParams).created;
  const gem = await db.gem.findUnique({
    where: { id },
    include: { images: { orderBy: { position: 'asc' } }, auction: true, keys: { orderBy: { issuedAt: 'desc' } } },
  });
  if (!gem) notFound();
  const maxLot = await db.auction.aggregate({ _max: { lotNumber: true } });
  const { auction } = gem;

  return (
    <section className="page light">
      <Link href="/admin" className="back">← All stones</Link>
      <div className="page-head">
        <span className="eyebrow">( Curator{auction && <> · <Link href={`/lots/${auction.lotNumber}`} className="u">{lotLabel(auction.lotNumber)}</Link></>} )</span>
        <h1 className="display">{gem.name}</h1>
        {created && <p className="msg notice">Stone created and its Gem Key issued. Set up its auction below.</p>}
      </div>

      <div className="block">
        <h2>The <em>stone</em></h2>
        {gem.images.length > 0 && (
          <div className="thumb-row">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {gem.images.map(img => <img key={img.id} src={`/media/${img.file}`} alt="" />)}
          </div>
        )}
        <GemForm gem={gem} />
      </div>

      <div className="block">
        <h2>The <em>auction</em></h2>
        <AuctionForm
          gemId={gem.id}
          nextLot={(maxLot._max.lotNumber ?? 0) + 1}
          auction={auction ? { ...auction, startsAt: auction.startsAt.toISOString(), endsAt: auction.endsAt.toISOString() } : undefined}
        />
      </div>

      <div className="block">
        <h2>Gem <em>keys</em></h2>
        <table className="table">
          <thead><tr><th>Code</th><th>Issued</th><th>Status</th></tr></thead>
          <tbody>
            {gem.keys.map(k => (
              <tr key={k.id}>
                <td><Link href={`/verify/${k.code}`} className="mono">{k.code}</Link></td>
                <td>{k.issuedAt.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                <td>{k.revokedAt ? <span className="chip bad">Revoked</span> : <span className="chip ok">Current</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!(auction && auction.bidCount > 0) && (
        <form action={deleteGem.bind(null, gem.id)} className="block">
          <button className="u danger" style={{ fontSize: 12, letterSpacing: '.2em', textTransform: 'uppercase' }}>Delete this stone</button>
        </form>
      )}
    </section>
  );
}
