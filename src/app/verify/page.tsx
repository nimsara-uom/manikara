import { redirect } from 'next/navigation';
import { normalizeCode } from '@/lib/gemkey';

export const metadata = { title: 'Verify a Gem Key' };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const raw = (await searchParams).code;
  const code = raw ? normalizeCode(raw) : null;
  if (code) redirect(`/verify/${code}`);

  return (
    <section className="page dark">
      <div className="cert-wrap">
        <div className="form-side">
          <span className="eyebrow gold">( Verify )</span>
          <h1 className="display reveal" style={{ fontSize: 'clamp(56px,6.5vw,112px)', margin: '22px 0 28px' }}>
            <span className="rl"><span style={{ '--i': 0 } as React.CSSProperties}>Check any</span></span>
            <span className="rl"><span style={{ '--i': 1 } as React.CSSProperties}><em>Gem Key.</em></span></span>
          </h1>
          <p className="fade">
            Every Manikara stone carries a key like <span className="mono">MK-7F3A-91C2-…</span>, printed on its certificate and shown on its
            lot page. Enter it to confirm the description was issued by us and still matches the stone on record.
          </p>
        </div>
        <div className="fade">
          <form method="get">
            <div className="field">
              <label htmlFor="code">Gem Key</label>
              <input id="code" name="code" defaultValue={raw} placeholder="MK-XXXX-XXXX-XXXX-XXXX" autoComplete="off" spellCheck={false} required autoFocus />
            </div>
            {raw && <p className="msg error" role="alert">That doesn&apos;t look like a Gem Key. Keys have 16 letters and digits after “MK”.</p>}
            <button className="bid-btn on-dark"><span>Verify key</span><span>→</span></button>
          </form>
          <p className="small muted" style={{ marginTop: 40, lineHeight: 1.8 }}>
            Prefer to check it yourself? Keys are Ed25519 signatures. Fetch the signed record from{' '}
            <span className="mono">/api/keys/&lt;code&gt;</span> and our public key from <a href="/api/public-key" className="text-link">/api/public-key</a>.
          </p>
        </div>
      </div>
    </section>
  );
}
