import { createHash } from 'node:crypto';
import { GemShot } from './GemShot';
import { Guilloche, Seal } from './Guilloche';

export type CertificateData = {
  name: string;
  species: string;
  carat: number;
  colorName: string;
  colorHex: string;
  clarity: string;
  cut: string;
  origin: string;
  lab: string;
  reportNo: string;
  photo: string | null;
  code: string;
  payload: string;
};

/** The printed-certificate look from the design, filled with a real signed Gem Key. */
export function Certificate({ c, flat }: { c: CertificateData; flat?: boolean }) {
  // Split "The Kandy Cornflower" into "The" + italic rest, as on the printed certificates
  const [first, ...rest] = c.name.split(' ');
  const lead = first.toLowerCase() === 'the' && rest.length ? 'The' : null;
  const italic = lead ? rest.join(' ') : c.name;
  const fingerprint = createHash('sha256').update(c.payload, 'utf8').digest('hex');

  return (
    <div className={`cert${flat ? ' flat' : ''}`}>
      <Guilloche />
      <div className="cert-grid">
        <div>
          <div className="cert-head">Manikara · Certificate of Identity</div>
          <h4>{lead && <>{lead} </>}<em>{italic}</em></h4>
          <div className="shot">
            {c.photo
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={`/media/${c.photo}`} alt={c.name} />
              : <GemShot color={c.colorHex} bg="#f7f3eb" rot={0.5} w={700} h={700} alt={`${c.name}, studio render`} />}
          </div>
        </div>
        <div>
          <dl>
            <dt>Species</dt><dd>{c.species}</dd>
            <dt>Weight</dt><dd>{c.carat.toFixed(2)} ct</dd>
            <dt>Colour</dt><dd>{c.colorName}</dd>
            <dt>Clarity</dt><dd>{c.clarity}</dd>
            <dt>Cut</dt><dd>{c.cut}</dd>
            <dt>Origin</dt><dd>{c.origin}</dd>
            <dt>Report</dt><dd>{c.reportNo.startsWith(c.lab) ? c.reportNo : `${c.lab} ${c.reportNo}`}</dd>
          </dl>
          <div className="key">
            <div className="cert-head">Gem Key</div>
            <b>{c.code}</b>
            <div className="fp">SHA-256 {fingerprint}</div>
          </div>
        </div>
      </div>
      <Seal />
    </div>
  );
}
