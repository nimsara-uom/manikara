'use client';

import { useEffect, useState } from 'react';

/** Studio-rendered still of a gem in its recorded colour, used when a stone has no photographs. */
export function GemShot({ color, bg = '#e9e3d8', rot = 0.4, w = 720, h = 900, alt }: {
  color: string; bg?: string; rot?: number; w?: number; h?: number; alt: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    import('@/lib/gem3d').then(({ shoot }) => { if (!cancelled) setSrc(shoot(color, bg, rot, w, h)); });
    return () => { cancelled = true; };
  }, [color, bg, rot, w, h]);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt={alt} /> : <div style={{ width: '100%', height: '100%', background: bg }} aria-label={alt} />;
}
