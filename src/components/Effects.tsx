'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

function countUp(el: HTMLElement) {
  const end = Number(el.dataset.count), t0 = performance.now();
  const step = (now: number) => {
    const k = Math.min((now - t0) / 1800, 1), e = 1 - Math.pow(1 - k, 4);
    el.textContent = Math.round(end * e).toLocaleString('en-US');
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Site-wide motion: custom cursor, scroll reveals and count-up numbers. */
export function Effects() {
  const pathname = usePathname();
  const cur = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);

  // Reveal .fade / .reveal elements as they scroll into view (re-run on each navigation)
  useEffect(() => {
    document.documentElement.classList.add('js');
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      io.unobserve(e.target);
      e.target.querySelectorAll<HTMLElement>('[data-count]').forEach(countUp);
    }), { threshold: 0.12 });
    const t = setTimeout(() => document.querySelectorAll('.reveal:not(.in), .fade:not(.in)').forEach(el => io.observe(el)), 50);
    return () => { clearTimeout(t); io.disconnect(); };
  }, [pathname]);

  useEffect(() => {
    if (matchMedia('(hover: none)').matches) return;
    let rx = 0, ry = 0, cx = 0, cy = 0, frame = 0;
    const move = (e: PointerEvent) => {
      if (!cx && !cy) { rx = e.clientX; ry = e.clientY; cur.current?.classList.add('on'); ring.current?.classList.add('on'); }
      cx = e.clientX; cy = e.clientY;
      if (cur.current) cur.current.style.transform = `translate(${cx}px,${cy}px) translate(-50%,-50%)`;
    };
    const over = (e: PointerEvent) => {
      ring.current?.classList.toggle('big', !!(e.target as Element).closest?.('a, button, .lot-img, summary, .row, input, select, textarea'));
    };
    const follow = () => {
      rx += (cx - rx) * 0.15; ry += (cy - ry) * 0.15;
      if (ring.current) ring.current.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`;
      frame = requestAnimationFrame(follow);
    };
    addEventListener('pointermove', move);
    document.addEventListener('pointerover', over);
    follow();
    return () => { cancelAnimationFrame(frame); removeEventListener('pointermove', move); document.removeEventListener('pointerover', over); };
  }, []);

  return (
    <>
      <div className="cursor" ref={cur} aria-hidden="true" />
      <div className="cursor-ring" ref={ring} aria-hidden="true" />
    </>
  );
}
