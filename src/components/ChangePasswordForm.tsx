'use client';

import { useActionState } from 'react';
import { changePassword } from '@/app/account/actions';

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="narrow">
      <div className="field"><label htmlFor="current">Current password</label><input id="current" name="current" type="password" required autoComplete="current-password" /></div>
      <div className="field"><label htmlFor="password">New password · at least 10 characters</label><input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" /></div>
      <div className="field"><label htmlFor="confirm">Confirm new password</label><input id="confirm" name="confirm" type="password" required minLength={10} autoComplete="new-password" /></div>
      {state?.error && <p className="msg error" role="alert">{state.error}</p>}
      {state?.notice && <p className="msg notice" role="status">{state.notice}</p>}
      <button className="bid-btn" disabled={pending} style={{ marginTop: 30 }}><span>{pending ? 'Saving…' : 'Change password'}</span><span>→</span></button>
    </form>
  );
}
