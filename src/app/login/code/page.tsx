import { redirect } from 'next/navigation';
import { getPending } from '@/lib/auth';
import { db } from '@/lib/db';
import { AuthShell, maskEmail } from '@/components/AuthShell';
import { OtpForm } from '@/components/OtpForm';
import { resendCode, verifySignIn } from '../../auth-actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign-in code' };

export default async function SignInCodePage() {
  const pending = await getPending('SIGN_IN');
  if (!pending) redirect('/login');
  const user = await db.user.findUnique({ where: { id: pending.userId }, select: { email: true } });
  if (!user) redirect('/login');

  return (
    <AuthShell eyebrow="Two-step sign-in" line1="Confirm it's" line2="you."
      intro={<>Your password was correct. For extra protection we sent a six-digit code to <b>{maskEmail(user.email)}</b>.</>}>
      <OtpForm action={verifySignIn} resend={resendCode.bind(null, 'SIGN_IN')} submitLabel="Sign in" />
    </AuthShell>
  );
}
