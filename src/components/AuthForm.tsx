'use client';

import { useActionState } from 'react';
import type { FormState } from '@/app/auth-actions';

export function AuthForm({
  action, next, withName, submitLabel,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  next: string;
  withName?: boolean;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction}>
      <input type="hidden" name="next" value={next} />
      {withName && (
        <div className="field"><label htmlFor="name">Full name</label><input id="name" name="name" required autoComplete="name" /></div>
      )}
      <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="email" /></div>
      <div className="field">
        <label htmlFor="password">Password{withName && ' · at least 8 characters'}</label>
        <input id="password" name="password" type="password" required minLength={withName ? 8 : undefined}
          autoComplete={withName ? 'new-password' : 'current-password'} />
      </div>
      {state?.error && <p className="msg error" role="alert">{state.error}</p>}
      <button className="bid-btn on-dark" disabled={pending} style={{ marginTop: 34 }}>
        <span>{pending ? 'One moment…' : submitLabel}</span><span>→</span>
      </button>
    </form>
  );
}
