import { Fragment } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { lotLabel } from '@/lib/format';
import { lotState } from '@/lib/lots';
import { verifyQrSvg } from '@/lib/qr';
import { BidPanel } from '@/components/BidPanel';
import { Certificate } from '@/components/Certificate';
import { Gallery } from '@/components/Gallery';
import { toggleWatch } from './actions';

export const dynamic = 'force-dynamic';

async function load(lotParam: string) {
  const lotNumber = Number(lotParam);
  if (!Number.isInteger(lotNumber)) return null;
  return db.auction.findUnique({
    where: { lotNumber },
    include: {
      gem: {
        include: {
          images: { orderBy: { position: 'asc' } },
          keys: { where: { revokedAt: null }, orderBy: { issuedAt: 'desc' }, take: 1 },
        },
      },
    },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ lot: string }> }) {
  const a = await load((await params).lot);
  return { title: a ? `${lotLabel(a.lotNumber)}: ${a.gem.name}` : 'Lot not found' };
}

export default async function LotPage({ params }: { params: Promise<{ lot: string }> }) {
  const auction = await load((await params).lot);
  if (!auction) notFound();
  const user = await currentUser();
  const state = (await lotState(auction.lotNumber, user?.id ?? null))!;
  const { gem } = auction;
  const key = gem.keys[0];
  const qr = key ? await verifyQrSvg(key.code) : undefined;
  const watching = user
    ? !!(await db.watch.findUnique({ where: { userId_auctionId: { userId: user.id, auctionId: auction.id } } }))
    : false;

  const facts: [string, string | null][] = [
    ['Species', gem.species],
    ['Weight', `${gem.carat.toFixed(2)} ct`],
    ['Colour', gem.colorName],
    ['Clarity', gem.clarity],
    ['Cut', gem.cut],
    ['Dimensions', gem.dimensions],
    ['Origin', gem.origin],
    ['Treatment', gem.treatment],
    ['Laboratory', `${gem.lab} · ${gem.reportNo}`],
  ];

  return (
    <section className="page light">
      <Link href="/#lots" className="back">← All lots</Link>
      <div className="lot-page">
        <div>
          <Gallery images={gem.images} colorHex={gem.colorHex} name={gem.name} lotNumber={auction.lotNumber} verified={!!key} />
          {key && (
            <div style={{ marginTop: 100 }}>
              <div className="sec-head" style={{ marginBottom: 50, gridTemplateColumns: '1fr' }}>
                <span className="eyebrow">( Certificate of Identity )</span>
                <h2 className="display" style={{ fontSize: 'clamp(40px,4vw,68px)' }}>Signed, <em>sealed</em>, checkable.</h2>
              </div>
              <Certificate flat c={{ ...gem, photo: gem.images[0]?.file ?? null, code: key.code, payload: key.payload }} />
              <div className="cert-foot">
                {qr && <div className="qr" role="img" aria-label="QR code that opens this key's verification page" dangerouslySetInnerHTML={{ __html: qr }} />}
                <p className="small muted">
                  Issued {key.issuedAt.toLocaleDateString('en-GB', { dateStyle: 'long' })}. Scan with your phone or{' '}
                  <Link href={`/verify/${key.code}`} className="text-link">verify this key →</Link>
                </p>
              </div>
            </div>
          )}
        </div>

        <aside className="lot-side">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20 }}>
            <span className="eyebrow">( {lotLabel(auction.lotNumber)} )</span>
            {user && (
              <form action={toggleWatch.bind(null, auction.id, auction.lotNumber)}>
                <button className="u watch">{watching ? '★ Watching' : '☆ Watch lot'}</button>
              </form>
            )}
          </div>
          <h1 className="display lot-title">{gem.name}</h1>
          <div className="lot-spec">{gem.carat.toFixed(2)} ct {gem.species} · {gem.origin}</div>

          <BidPanel initial={state} signedIn={!!user} />

          <dl className="facts">
            {facts.filter(([, v]) => v).map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}
          </dl>
          <p className="prose">{gem.description}</p>
        </aside>
      </div>
    </section>
  );
}
