import { Fragment } from 'react';
import Link from 'next/link';
import { currentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { auctionPhase, minimumBid, reserveMet } from '@/lib/bidding-engine';
import { Certificate } from '@/components/Certificate';
import { Countdown } from '@/components/Countdown';
import { HeroGem } from '@/components/HeroGem';
import { LotCard, type LotCardData } from '@/components/LotCard';
import { Preloader } from '@/components/Preloader';

export const dynamic = 'force-dynamic';

const MARQUEE = ['Sapphire', 'Padparadscha', '*Ruby', 'Alexandrite', 'Spinel', "*Cat's Eye"];

const photoOf = (images: { file: string }[]) => images[0]?.file ?? null;

export default async function Home() {
  const [user, auctions, stoneCount, bidCount] = await Promise.all([
    currentUser(),
    db.auction.findMany({
      orderBy: { lotNumber: 'asc' },
      include: { gem: { include: { images: { orderBy: { position: 'asc' }, take: 1 }, keys: { where: { revokedAt: null }, take: 1 } } } },
    }),
    db.gemKey.groupBy({ by: ['gemId'], where: { revokedAt: null } }).then(g => g.length),
    db.bid.count(),
  ]);

  const order = { live: 0, upcoming: 1, ended: 2 } as const;
  const sorted = auctions
    .map(a => ({ ...a, phase: auctionPhase(a) }))
    .sort((a, b) => order[a.phase] - order[b.phase] || a.endsAt.getTime() - b.endsAt.getTime());
  const featured = sorted[0];
  const featuredKey = featured?.gem.keys[0];

  const lots: LotCardData[] = sorted.map((a, i) => ({
    lotNumber: a.lotNumber,
    name: a.gem.name,
    spec: [`${a.gem.carat.toFixed(2)} ct`, a.gem.cut.split(',')[0], a.gem.treatment.startsWith('None') ? 'Unheated' : a.gem.treatment, a.gem.lab].join(' · '),
    colorHex: a.gem.colorHex,
    photo: photoOf(a.gem.images),
    verified: a.gem.keys.length > 0,
    phase: a.phase,
    startsAt: a.startsAt.toISOString(),
    endsAt: a.endsAt.toISOString(),
    bidCount: a.bidCount,
    currentPrice: a.currentPrice,
    startingPrice: a.startingPrice,
    minimumBid: minimumBid(a),
    sold: reserveMet(a),
    rot: [0.3, 1.1, 0.7, 1.6][i % 4],
  }));

  return (
    <>
      <Preloader />

      <header className="hero" id="top">
        <HeroGem color={featured?.gem.colorHex ?? '#1d3fbf'} />
        <p className="hero-side hfade" style={{ '--i': 6 } as React.CSSProperties}>
          Rare coloured gemstones from Ratnapura and beyond. Independently certified, signed with a unique key, and sold at open auction.
        </p>
        <div className="hero-copy">
          <h1 className="display rl-group">
            <span className="rl"><span style={{ '--i': 1 } as React.CSSProperties}>Rare stones,</span></span>
            <span className="rl r"><span style={{ '--i': 2 } as React.CSSProperties}><em>honestly</em> sold.</span></span>
          </h1>
        </div>
        {featured && (
          <div className="hero-bar hfade" style={{ '--i': 8 } as React.CSSProperties}>
            <span>Lot {String(featured.lotNumber).padStart(3, '0')} · <b>{featured.gem.species} {featured.gem.carat.toFixed(2)} ct</b></span>
            <span>
              {featured.phase === 'live' && <>Closing in <b><Countdown to={featured.endsAt.toISOString()} format="clock" /></b></>}
              {featured.phase === 'upcoming' && <>Opening in <b><Countdown to={featured.startsAt.toISOString()} format="clock" /></b></>}
              {featured.phase === 'ended' && <>Sale <b>closed</b></>}
            </span>
            <span><Link className="u" href="#lots">Scroll to view ↓</Link></span>
          </div>
        )}
      </header>

      <div className="marquee" aria-hidden="true">
        <div className="track">
          {[0, 1].map(k => (
            <span key={k}>
              {MARQUEE.map(w => <Fragment key={w}>{w.startsWith('*') ? <em>{w.slice(1)}</em> : w}<i>◆</i></Fragment>)}
            </span>
          ))}
        </div>
      </div>

      <section className="light" id="house">
        <div className="sec-head reveal">
          <span className="eyebrow">( The House )</span>
          <h2 className="display">
            <span className="rl"><span style={{ '--i': 0 } as React.CSSProperties}>Three promises</span></span>
            <span className="rl"><span style={{ '--i': 1 } as React.CSSProperties}>behind <em>every</em> lot.</span></span>
          </h2>
        </div>
        <div className="pillars">
          <div className="pillar fade" style={{ '--i': 0 } as React.CSSProperties}>
            <span className="n">01</span><h3>Certified</h3>
            <p>Every stone is graded by an independent laboratory such as GIA, GRS or Gübelin before we accept it. We never list a stone without its report.</p>
          </div>
          <div className="pillar fade" style={{ '--i': 1 } as React.CSSProperties}>
            <span className="n">02</span><h3>Signed</h3>
            <p>We sign each gem&apos;s weight, colour, clarity, report and photographs into a unique cryptographic key. Anyone can check it. No one can forge it.</p>
          </div>
          <div className="pillar fade" style={{ '--i': 2 } as React.CSSProperties}>
            <span className="n">03</span><h3>Witnessed</h3>
            <p>Bidding is open and in real time. Set your maximum and we bid for you, and a late bid always adds two minutes so no one wins by sniping.</p>
          </div>
        </div>
      </section>

      <section className="light" id="lots" style={{ paddingTop: 40 }}>
        <div className="sec-head reveal">
          <span className="eyebrow">( Current Auction · {new Date().getFullYear()} )</span>
          <h2 className="display">
            <span className="rl"><span style={{ '--i': 0 } as React.CSSProperties}>The <em>Ceylon</em></span></span>
            <span className="rl"><span style={{ '--i': 1 } as React.CSSProperties}>Collection.</span></span>
          </h2>
        </div>
        {lots.length === 0
          ? <p className="empty">The next sale is being prepared. Please check back soon.</p>
          : <div className="lots">{lots.map((l, i) => <LotCard key={l.lotNumber} lot={l} signedIn={!!user} index={i} />)}</div>}
      </section>

      <section id="certificate">
        <div className="cert-wrap">
          <div className="form-side">
            <span className="eyebrow gold">( The Gem Key )</span>
            <h2 className="display reveal">
              <span className="rl"><span style={{ '--i': 0 } as React.CSSProperties}>A key as</span></span>
              <span className="rl"><span style={{ '--i': 1 } as React.CSSProperties}><em>unique</em> as</span></span>
              <span className="rl"><span style={{ '--i': 2 } as React.CSSProperties}>the stone.</span></span>
            </h2>
            <p className="fade">
              Every certificate carries a key signed over the stone&apos;s facts and photographs. Change a single detail and the key no
              longer matches. Enter any key below to check it.
            </p>
            <form action="/verify" method="get" className="fade">
              <div className="field">
                <label htmlFor="home-code">Gem Key</label>
                <input id="home-code" name="code" placeholder="MK-XXXX-XXXX-XXXX-XXXX" defaultValue={featuredKey?.code} autoComplete="off" spellCheck={false} required />
              </div>
              <button className="bid-btn on-dark"><span>Verify key</span><span>→</span></button>
            </form>
          </div>
          {featured && featuredKey && (
            <div className="fade">
              <Certificate c={{ ...featured.gem, photo: photoOf(featured.gem.images), code: featuredKey.code, payload: featuredKey.payload }} />
            </div>
          )}
        </div>
      </section>

      <section className="light">
        <div className="sec-head reveal">
          <span className="eyebrow">( In Numbers )</span>
          <h2 className="display"><span className="rl"><span style={{ '--i': 0 } as React.CSSProperties}>Trust, <em>measured.</em></span></span></h2>
        </div>
        <div className="stats fade">
          <div className="stat"><div className="big"><span data-count={stoneCount}>{stoneCount}</span></div><h5>Stones Signed</h5><p>Each one has its own key, report and history.</p></div>
          <div className="stat"><div className="big"><span data-count={100}>100</span><sup>%</sup></div><h5>Lab Certified</h5><p>Independent grading. No exceptions.</p></div>
          <div className="stat"><div className="big"><span data-count={2}>2</span><sup>min</sup></div><h5>Fair Close</h5><p>A late bid adds two minutes, so no one wins by sniping.</p></div>
          <div className="stat"><div className="big"><span data-count={bidCount}>{bidCount}</span></div><h5>Bids Placed</h5><p>Every one recorded openly in the lot&apos;s history.</p></div>
        </div>
      </section>

      <section>
        <div className="sec-head reveal">
          <span className="eyebrow">( The Experience )</span>
          <h2 className="display">
            <span className="rl"><span style={{ '--i': 0 } as React.CSSProperties}>Made for</span></span>
            <span className="rl"><span style={{ '--i': 1 } as React.CSSProperties}><em>collectors.</em></span></span>
          </h2>
        </div>
        <div className="rows">
          <Link href="#lots" className="row fade"><span className="n">01</span><h3>Live Bidding</h3><p>Real-time bids with proxy bidding. Set your maximum and we bid for you, one step at a time.</p><span className="arr">→</span></Link>
          <Link href={featured ? `/lots/${featured.lotNumber}` : '#lots'} className="row fade"><span className="n">02</span><h3>360° Viewing</h3><p>Turn every stone in 3D in its recorded colour, alongside the laboratory photographs.</p><span className="arr">→</span></Link>
          <Link href="/verify" className="row fade"><span className="n">03</span><h3>Verify Anywhere</h3><p>Scan the QR code on a certificate or type its key. Our public key lets anyone check the signature themselves.</p><span className="arr">→</span></Link>
          <Link href="/verify" className="row fade"><span className="n">04</span><h3>Key History</h3><p>If a stone&apos;s record is ever corrected, the old key is marked superseded and points to the new one.</p><span className="arr">→</span></Link>
        </div>
      </section>

      <section className="light" id="faq">
        <div className="faq">
          <div className="reveal">
            <span className="eyebrow">( Enquiries )</span>
            <h2 className="display" style={{ fontSize: 'clamp(48px,5vw,84px)', marginTop: 22 }}>
              <span className="rl"><span style={{ '--i': 0 } as React.CSSProperties}>Questions,</span></span>
              <span className="rl"><span style={{ '--i': 1 } as React.CSSProperties}><em>answered.</em></span></span>
            </h2>
          </div>
          <div className="qa">
            <details><summary>How do I verify a stone?</summary><p>Scan the QR code on the certificate or enter the Gem Key on our verify page. We check our signature and show exactly which facts and photographs the key certifies, and whether they still match the stone on record.</p></details>
            <details><summary>How does proxy bidding work?</summary><p>Enter the most you are willing to pay. We bid on your behalf only as much as needed to keep you in the lead, one increment at a time, and never above your maximum. Nobody else sees your maximum.</p></details>
            <details><summary>What happens if someone bids in the final seconds?</summary><p>Fair close applies: any bid in the last two minutes moves the close to two minutes after that bid, so every bidder has time to respond.</p></details>
            <details><summary>What is a reserve?</summary><p>Some lots have a confidential minimum price. The lot page shows whether it has been met. If bidding closes below the reserve, the stone is not sold.</p></details>
          </div>
        </div>
      </section>

      <section className="cta">
        <span className="eyebrow gold">( Begin )</span>
        <h2 className="display reveal" style={{ marginTop: 30 }}>
          <span className="rl"><span style={{ '--i': 0 } as React.CSSProperties}>Begin your</span></span>
          <span className="rl"><span style={{ '--i': 1 } as React.CSSProperties}><em>collection.</em></span></span>
        </h2>
        <Link href={user ? '#lots' : '/register'} className="btn-round">{user ? 'View Lots' : 'Register'}</Link>
      </section>
    </>
  );
}
