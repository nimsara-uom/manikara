'use client';

import { useActionState } from 'react';
import type { FormState } from '@/app/auth-actions';

export function OtpForm({ action, resend, submitLabel, children }: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  resend: () => Promise<FormState>;
  submitLabel: string;
  children?: React.ReactNode; // extra fields, e.g. new password
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [resendState, resendAction, resending] = useActionState(async () => resend(), undefined);
  return (
    <>
      <form action={formAction}>
        <div className="field">
          <label htmlFor="code">Six-digit code</label>
          <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7}
            placeholder="000 000" required autoFocus style={{ letterSpacing: '.3em' }} />
        </div>
        {children}
        {state?.error && <p className="msg error" role="alert">{state.error}</p>}
        <button className="bid-btn on-dark" disabled={pending} style={{ marginTop: 34 }}>
          <span>{pending ? 'Checking…' : submitLabel}</span><span>→</span>
        </button>
      </form>
      <form action={resendAction} style={{ marginTop: 26 }}>
        <button className="u text-link" disabled={resending}>{resending ? 'Sending…' : 'Send a new code'}</button>
        {resendState?.error && <p className="msg error" role="alert">{resendState.error}</p>}
        {resendState?.notice && <p className="msg notice" role="status">{resendState.notice}</p>}
      </form>
    </>
  );
}
