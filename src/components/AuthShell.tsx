/** Two-column dark layout shared by the sign-in, sign-up and code pages. */
export function AuthShell({ eyebrow, line1, line2, intro, children }: {
  eyebrow: string; line1: string; line2: string; intro: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="page dark">
      <div className="cert-wrap">
        <div className="form-side">
          <span className="eyebrow gold">( {eyebrow} )</span>
          <h1 className="display reveal" style={{ fontSize: 'clamp(56px,6.5vw,112px)', margin: '22px 0 28px' }}>
            <span className="rl"><span style={{ '--i': 0 } as React.CSSProperties}>{line1}</span></span>
            <span className="rl"><span style={{ '--i': 1 } as React.CSSProperties}><em>{line2}</em></span></span>
          </h1>
          <p className="fade">{intro}</p>
        </div>
        <div className="fade narrow">{children}</div>
      </div>
    </section>
  );
}

/** "nimsara@gmail.com" → "ni•••••@gmail.com", so code pages confirm the address without exposing it. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local.slice(0, 2)}${'•'.repeat(Math.max(3, local.length - 2))}@${domain}`;
}
