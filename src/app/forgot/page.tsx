'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { AuthShell } from '@/components/AuthShell';
import { requestReset } from '../auth-actions';

export default function ForgotPage() {
  const [state, action, pending] = useActionState(requestReset, undefined);
  return (
    <AuthShell eyebrow="Password reset" line1="Forgotten" line2="password?"
      intro="Enter the email you registered with. If it belongs to an account, we will send a code to reset your password.">
      <form action={action}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" autoFocus />
        </div>
        {state?.error && <p className="msg error" role="alert">{state.error}</p>}
        <button className="bid-btn on-dark" disabled={pending} style={{ marginTop: 34 }}>
          <span>{pending ? 'One moment…' : 'Send reset code'}</span><span>→</span>
        </button>
      </form>
      <p className="small muted" style={{ marginTop: 30 }}>Remembered it? <Link className="text-link" href="/login">Sign in</Link></p>
    </AuthShell>
  );
}
