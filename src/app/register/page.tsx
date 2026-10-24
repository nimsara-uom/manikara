import Link from 'next/link';
import { AuthForm } from '@/components/AuthForm';
import { AuthShell } from '@/components/AuthShell';
import { register } from '../auth-actions';

export const metadata = { title: 'Register' };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = (await searchParams).next ?? '/';
  return (
    <AuthShell eyebrow="Join" line1="Begin your" line2="collection."
      intro="We will email you a code to confirm your address. Your maximum bids are private, and bidders appear to each other only by an anonymous name.">
      <AuthForm action={register} next={next} withName submitLabel="Create account" />
      <p className="small muted" style={{ marginTop: 30 }}>
        Already a member? <Link className="text-link" href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link>
      </p>
    </AuthShell>
  );
}
