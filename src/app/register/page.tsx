import Link from 'next/link';
import { AuthForm } from '@/components/AuthForm';
import { register } from '../auth-actions';

export const metadata = { title: 'Register' };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = (await searchParams).next ?? '/';
  return (
    <section className="page dark">
      <div className="cert-wrap">
        <div className="form-side">
          <span className="eyebrow gold">( Join )</span>
          <h1 className="display reveal" style={{ fontSize: 'clamp(56px,6.5vw,112px)', margin: '22px 0 28px' }}>
            <span className="rl"><span style={{ '--i': 0 } as React.CSSProperties}>Begin your</span></span>
            <span className="rl"><span style={{ '--i': 1 } as React.CSSProperties}><em>collection.</em></span></span>
          </h1>
          <p className="fade">An account lets you bid on any open lot. Your maximum bids are private, and bidders appear to each other only by an anonymous name.</p>
        </div>
        <div className="fade narrow">
          <AuthForm action={register} next={next} withName submitLabel="Create account" />
          <p className="small muted" style={{ marginTop: 30 }}>
            Already a member? <Link className="text-link" href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link>
          </p>
        </div>
      </div>
    </section>
  );
}
