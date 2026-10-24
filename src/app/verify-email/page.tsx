import { redirect } from 'next/navigation';
import { getPending } from '@/lib/auth';
import { db } from '@/lib/db';
import { AuthShell, maskEmail } from '@/components/AuthShell';
import { OtpForm } from '@/components/OtpForm';
import { resendCode, verifyEmail } from '../auth-actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Verify your email' };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ sendFailed?: string }> }) {
  const pending = await getPending('VERIFY_EMAIL');
  if (!pending) redirect('/login');
  const user = await db.user.findUnique({ where: { id: pending.userId }, select: { email: true } });
  if (!user) redirect('/register');
  const sendFailed = (await searchParams).sendFailed;

  return (
    <AuthShell eyebrow="One last step" line1="Check your" line2="inbox."
      intro={<>We sent a six-digit code to <b>{maskEmail(user.email)}</b>. Enter it to confirm your email and open your account. The code expires in 10 minutes.</>}>
      {sendFailed && <p className="msg error" style={{ marginTop: 0, marginBottom: 20 }}>We could not send the email just now. Use “Send a new code” below.</p>}
      <OtpForm action={verifyEmail} resend={resendCode.bind(null, 'VERIFY_EMAIL')} submitLabel="Verify email" />
    </AuthShell>
  );
}
