'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';

const GemViewer = dynamic(() => import('./GemViewer').then(m => m.GemViewer), { ssr: false });

export function Gallery({ images, colorHex, name, lotNumber, verified }: {
  images: { file: string }[]; colorHex: string; name: string; lotNumber: number; verified: boolean;
}) {
  // -1 is the 3D view, the default when there are no photographs
  const [active, setActive] = useState(images.length ? 0 : -1);
  return (
    <div className="gallery">
      <div className="main">
        {active === -1
          ? <GemViewer colorHex={colorHex} label={name} />
          // eslint-disable-next-line @next/next/no-img-element
          : <img src={`/media/${images[active].file}`} alt={`${name}, photograph ${active + 1}`} />}
        <span className="lot-no" style={{ pointerEvents: 'none' }}>Lot {String(lotNumber).padStart(3, '0')}</span>
        {verified && <span className="lot-verified" style={{ pointerEvents: 'none' }}>Key Verified</span>}
      </div>
      {images.length > 0 && <div className="thumbs">
        {images.map((img, i) => (
          <button key={img.file} type="button" aria-pressed={active === i} onClick={() => setActive(i)} aria-label={`Photograph ${i + 1}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/media/${img.file}`} alt="" />
          </button>
        ))}
        <button type="button" aria-pressed={active === -1} onClick={() => setActive(-1)}>360°</button>
      </div>}
      {active === -1 && (
        <p className="caption">{images.length ? 'Illustrative model in the recorded colour · drag to turn' : 'Studio model in the recorded colour · drag to turn'}</p>
      )}
    </div>
  );
}
