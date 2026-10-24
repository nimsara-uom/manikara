'use client';

import { useEffect, useState } from 'react';

/** Brief curtain on first visit to the home page, then the hero title rises in. */
export function Preloader() {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const seen = sessionStorage.getItem('mk-intro');
    const delay = seen || matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 900;
    sessionStorage.setItem('mk-intro', '1');
    const t = setTimeout(() => {
      setDone(true);
      setTimeout(() => document.querySelectorAll('.hero .rl-group, .hero .hfade').forEach(el => el.classList.add('in')), delay ? 700 : 0);
    }, delay);
    return () => clearTimeout(t);
  }, []);
  return <div className={`loader${done ? ' done' : ''}`} aria-hidden="true"><span>MANIKARA</span></div>;
}
