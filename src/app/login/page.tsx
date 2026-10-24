import Link from 'next/link';
import { AuthForm } from '@/components/AuthForm';
import { AuthShell } from '@/components/AuthShell';
import { signIn } from '../auth-actions';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const { next = '/', reset } = await searchParams;
  return (
    <AuthShell eyebrow="Members" line1="Welcome" line2="back." intro="Sign in to bid, follow lots and see the stones you have won.">
      {reset && <p className="msg notice" style={{ marginTop: 0, marginBottom: 20 }}>Password changed. Please sign in with your new password.</p>}
      <AuthForm action={signIn} next={next} submitLabel="Sign in" />
      <p className="small muted" style={{ marginTop: 30, display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <span>New to Manikara? <Link className="text-link" href={`/register?next=${encodeURIComponent(next)}`}>Create an account</Link></span>
        <Link className="text-link" href="/forgot">Forgot password?</Link>
      </p>
    </AuthShell>
  );
}
