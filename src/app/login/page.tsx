import Link from 'next/link';
import { AuthForm } from '@/components/AuthForm';
import { signIn } from '../auth-actions';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = (await searchParams).next ?? '/';
  return (
    <section className="page dark">
      <div className="cert-wrap">
        <div className="form-side">
          <span className="eyebrow gold">( Members )</span>
          <h1 className="display reveal" style={{ fontSize: 'clamp(56px,6.5vw,112px)', margin: '22px 0 28px' }}>
            <span className="rl"><span style={{ '--i': 0 } as React.CSSProperties}>Welcome</span></span>
            <span className="rl"><span style={{ '--i': 1 } as React.CSSProperties}><em>back.</em></span></span>
          </h1>
          <p className="fade">Sign in to bid, follow lots and see the stones you have won.</p>
        </div>
        <div className="fade narrow">
          <AuthForm action={signIn} next={next} submitLabel="Sign in" />
          <p className="small muted" style={{ marginTop: 30 }}>
            New to Manikara? <Link className="text-link" href={`/register?next=${encodeURIComponent(next)}`}>Create an account</Link>
          </p>
        </div>
      </div>
    </section>
  );
}
