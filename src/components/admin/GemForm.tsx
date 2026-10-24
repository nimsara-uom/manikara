'use client';

import { useActionState } from 'react';
import { saveGem } from '@/app/admin/actions';

type GemValues = {
  id: string; name: string; species: string; carat: number; colorName: string; colorHex: string; clarity: string;
  cut: string; origin: string; treatment: string; lab: string; reportNo: string; dimensions: string | null; description: string;
};

const FIELDS: [keyof GemValues, string, string?][] = [
  ['name', 'Name', 'The Kandy Cornflower'],
  ['species', 'Species', 'Sapphire'],
  ['colorName', 'Colour', 'Cornflower blue'],
  ['clarity', 'Clarity', 'Eye clean'],
  ['cut', 'Cut', 'Cushion, modified brilliant'],
  ['dimensions', 'Dimensions (optional)', '12.41 × 10.88 × 7.02 mm'],
  ['origin', 'Origin', 'Sri Lanka'],
  ['treatment', 'Treatment', 'None'],
  ['lab', 'Laboratory', 'GIA'],
  ['reportNo', 'Report number', ''],
];

export function GemForm({ gem }: { gem?: GemValues }) {
  const [state, action, pending] = useActionState(saveGem, undefined);
  return (
    <form action={action}>
      {gem && <input type="hidden" name="id" value={gem.id} />}
      <div className="fields">
        {FIELDS.map(([name, label, placeholder]) => (
          <div key={name} className="field">
            <label htmlFor={name}>{label}</label>
            <input id={name} name={name} defaultValue={(gem?.[name] as string | null) ?? ''} placeholder={placeholder}
              required={name !== 'dimensions'} />
          </div>
        ))}
        <div className="field">
          <label htmlFor="carat">Weight (ct)</label>
          <input id="carat" name="carat" type="number" step="0.01" min="0.01" defaultValue={gem?.carat} required />
        </div>
        <div className="field">
          <label htmlFor="colorHex">Colour swatch</label>
          <input id="colorHex" name="colorHex" type="color" defaultValue={gem?.colorHex ?? '#3b5bdb'} />
        </div>
        <div className="field wide">
          <label htmlFor="description">Description</label>
          <textarea id="description" name="description" defaultValue={gem?.description} required />
        </div>
        <div className="field wide">
          <label htmlFor="images">{gem ? 'Replace photographs (optional)' : 'Photographs'}</label>
          <input id="images" name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple required={!gem} />
          <p className="hint">
            JPEG, PNG or WebP, up to 8 MB each, in display order. Photographs are fingerprinted into the Gem Key, so
            replacing them — or changing any fact above — revokes the current key and issues a new one.
          </p>
        </div>
      </div>
      {state?.error && <p className="msg error" role="alert">{state.error}</p>}
      {state?.notice && <p className="msg notice" role="status">{state.notice}</p>}
      <button className="bid-btn" disabled={pending} style={{ marginTop: 34 }}>
        <span>{pending ? 'Saving…' : gem ? 'Save stone' : 'Create stone & issue key'}</span><span>→</span>
      </button>
    </form>
  );
}
