'use client';

import { useEffect, useState } from 'react';

function words(ms: number): string {
  if (ms <= 0) return '0s';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${String(s % 60).padStart(2, '0')}s`;
}

function clock(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400);
  const hms = [Math.floor((s % 86400) / 3600), Math.floor((s % 3600) / 60), s % 60].map(n => String(n).padStart(2, '0')).join(':');
  return d > 0 ? `${d}d ${hms}` : hms;
}

export function Countdown({ to, onDone, format = 'words', className, hotClass }: {
  to: string; onDone?: () => void; format?: 'words' | 'clock'; className?: string; hotClass?: string;
}) {
  const target = new Date(to).getTime();
  const [now, setNow] = useState<number | null>(null); // null until mounted, avoids hydration mismatch

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (now !== null && now >= target) onDone?.();
  }, [now, target, onDone]);

  const left = now === null ? null : target - now;
  const hot = hotClass && left !== null && left > 0 && left < 120_000;
  return (
    <span className={[className, hot ? hotClass : ''].filter(Boolean).join(' ') || undefined}>
      {left === null ? '--:--:--' : format === 'clock' ? clock(left) : words(left)}
    </span>
  );
}
