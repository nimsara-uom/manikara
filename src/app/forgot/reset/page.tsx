import { redirect } from 'next/navigation';
import { getPending } from '@/lib/auth';
import { MIN_PASSWORD } from '@/lib/password';
import { AuthShell } from '@/components/AuthShell';
import { OtpForm } from '@/components/OtpForm';
import { resendCode, resetPassword } from '../../auth-actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Choose a new password' };

export default async function ResetPage() {
  if (!(await getPending('RESET_PASSWORD'))) redirect('/forgot');
  return (
    <AuthShell eyebrow="Password reset" line1="Choose a new" line2="password."
      intro="If that email belongs to an account, a six-digit code is on its way. Enter it with your new password. Every other device will be signed out.">
      <OtpForm action={resetPassword} resend={resendCode.bind(null, 'RESET_PASSWORD')} submitLabel="Save new password">
        <div className="field">
          <label htmlFor="password">New password · at least {MIN_PASSWORD} characters</label>
          <input id="password" name="password" type="password" required minLength={MIN_PASSWORD} autoComplete="new-password" />
        </div>
        <div className="field">
          <label htmlFor="confirm">Confirm new password</label>
          <input id="confirm" name="confirm" type="password" required minLength={MIN_PASSWORD} autoComplete="new-password" />
        </div>
      </OtpForm>
    </AuthShell>
  );
}
