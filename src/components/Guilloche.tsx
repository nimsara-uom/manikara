// Engraved-banknote rosette for certificate backgrounds. Deterministic, so it renders on the server.
const PATHS = Array.from({ length: 48 }, (_, k) => {
  const ph = (k * Math.PI) / 24;
  let d = '';
  for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.03) {
    const r = 170 + 60 * Math.sin(7 * a + ph) * Math.cos(3 * a);
    d += (a ? 'L' : 'M') + (r * Math.cos(a)).toFixed(1) + ',' + (r * Math.sin(a)).toFixed(1);
  }
  return d + 'Z';
});

export function Guilloche() {
  return (
    <svg className="guilloche" viewBox="-260 -260 520 520" aria-hidden="true">
      {PATHS.map((d, i) => <path key={i} d={d} fill="none" stroke="#b8976a" strokeWidth=".5" />)}
    </svg>
  );
}

export function Seal() {
  return (
    <svg className="seal" viewBox="0 0 120 120" aria-hidden="true">
      <defs><path id="seal-circ" d="M60,60 m-46,0 a46,46 0 1,1 92,0 a46,46 0 1,1 -92,0" /></defs>
      <circle cx="60" cy="60" r="56" fill="none" stroke="#b8976a" strokeWidth=".8" />
      <circle cx="60" cy="60" r="36" fill="none" stroke="#b8976a" strokeWidth=".8" />
      <text fontSize="9" letterSpacing="3.2" fill="#b8976a" fontFamily="Satoshi, sans-serif">
        <textPath href="#seal-circ">SIGNED · VERIFIED · MANIKARA · SIGNED ·</textPath>
      </text>
      <text x="60" y="68" textAnchor="middle" fontSize="24" fill="#b8976a" fontFamily="Cormorant Garamond, serif" fontStyle="italic">M</text>
    </svg>
  );
}
