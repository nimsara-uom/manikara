import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { checkKey, factsFromGem, normalizeCode } from '@/lib/gemkey';
import { lotLabel } from '@/lib/format';
import { Certificate } from '@/components/Certificate';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Gem Key verification' };

function Check({ pass, children }: { pass: boolean; children: React.ReactNode }) {
  return <li className={pass ? 'pass' : 'fail'}><span className="mark">{pass ? '✓' : '✕'}</span><span>{children}</span></li>;
}

export default async function VerifyCodePage({ params }: { params: Promise<{ code: string }> }) {
  const raw = decodeURIComponent((await params).code);
  const code = normalizeCode(raw);
  if (!code) redirect(`/verify?code=${encodeURIComponent(raw)}`);
  if (code !== raw) redirect(`/verify/${code}`);

  const key = await db.gemKey.findUnique({
    where: { code },
    include: {
      gem: {
        include: {
          images: { orderBy: { position: 'asc' } },
          auction: { select: { lotNumber: true } },
          keys: { where: { revokedAt: null }, select: { code: true }, take: 1 },
        },
      },
    },
  });

  if (!key) {
    return (
      <section className="page dark">
        <div className="narrow">
          <span className="eyebrow gold">( Verification )</span>
          <h1 className="display verdict">Unknown <em>key.</em></h1>
          <div className="keyline">{code}</div>
          <ul className="checks" style={{ marginTop: 40 }}>
            <Check pass={false}>Manikara has never issued this key. Check for typing mistakes. If the code came printed on a certificate, please contact us.</Check>
          </ul>
          <Link href="/verify" className="bid-btn on-dark" style={{ marginTop: 40 }}><span>Try another key</span><span>→</span></Link>
        </div>
      </section>
    );
  }

  const result = checkKey(key, factsFromGem(key.gem));
  const authentic = result.signatureValid && result.codeValid;
  const current = authentic && !result.revoked && result.matchesGem;
  const replacement = key.gem.keys[0]?.code;
  const f = result.facts;

  const [verdictA, verdictB] = !authentic ? ['Not', 'authentic.']
    : current ? ['Authentic', '& current.']
    : result.revoked ? ['Authentic,', 'superseded.']
    : ['Authentic,', 'record changed.'];

  return (
    <section className="page dark">
      <div className="cert-wrap" style={{ alignItems: 'start' }}>
        <div>
          <span className="eyebrow gold">( Verification )</span>
          <h1 className="display verdict">{verdictA} <em>{verdictB}</em></h1>
          <div className="keyline">{key.code}</div>
          <ul className="checks" style={{ marginTop: 40 }}>
            <Check pass={result.signatureValid}>
              {result.signatureValid ? 'Signature is valid. This description was issued by Manikara.' : 'Signature does not match our public key. Do not rely on this record.'}
            </Check>
            <Check pass={result.codeValid}>
              {result.codeValid ? 'The code is the fingerprint of the signed description.' : 'The code does not match the signed description.'}
            </Check>
            <Check pass={!result.revoked}>
              {result.revoked
                ? <>Replaced on {key.revokedAt!.toLocaleDateString('en-GB', { dateStyle: 'long' })} after the stone&apos;s record was updated.
                    {replacement && <> The current key is <Link href={`/verify/${replacement}`} className="mono">{replacement}</Link>.</>}</>
                : 'This is the stone’s current key.'}
            </Check>
            <Check pass={result.matchesGem}>
              {result.matchesGem ? 'Matches the stone on record today, including its photographs.' : 'The stone’s record today differs from what this key describes.'}
            </Check>
          </ul>
          <p className="small muted" style={{ marginTop: 20 }}>Issued {key.issuedAt.toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' })}.</p>
          {key.gem.auction && current && (
            <Link href={`/lots/${key.gem.auction.lotNumber}`} className="bid-btn on-dark" style={{ marginTop: 30 }}>
              <span>View {lotLabel(key.gem.auction.lotNumber)}</span><span>→</span>
            </Link>
          )}
          <details className="raw-details" style={{ marginTop: 30 }}>
            <summary>Signed record ↓</summary>
            <p className="small muted" style={{ marginBottom: 16, lineHeight: 1.7 }}>
              The signature is Ed25519 over the exact UTF-8 bytes of the payload, using <a href="/api/public-key" className="text-link">our public key</a>.
            </p>
            <div className="eyebrow">Payload</div>
            <pre className="raw">{key.payload}</pre>
            <div className="eyebrow">Signature (base64)</div>
            <pre className="raw">{key.signature}</pre>
          </details>
        </div>

        {f && (
          <div className="fade">
            {/* Shows what the key itself certifies, not today's record */}
            <Certificate
              c={{
                name: f.name, species: f.species, carat: Number(f.carat), colorName: f.colorName, colorHex: f.colorHex,
                clarity: f.clarity, cut: f.cut, origin: f.origin, lab: f.lab, reportNo: f.reportNo,
                photo: result.matchesGem ? key.gem.images[0]?.file ?? null : null,
                code: key.code, payload: key.payload,
              }}
            />
            {f.images.length > 0 && (
              <p className="small muted" style={{ marginTop: 30 }}>{f.images.length} photograph{f.images.length === 1 ? '' : 's'} fingerprinted into this key.</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
