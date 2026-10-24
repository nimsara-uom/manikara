'use server';

import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { audit } from '@/lib/audit';
import { requireUser, revokeAllSessions, startSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { passwordChangedEmail } from '@/lib/email-templates';
import { checkNewPassword } from '@/lib/password';
import { LIMITS, hit, waitMessage } from '@/lib/ratelimit';
import type { FormState } from '../auth-actions';

export async function setNotifications(on: boolean) {
  const user = await requireUser('/account');
  await db.user.update({ where: { id: user.id }, data: { notifyBids: on } });
  revalidatePath('/account');
}

export async function setTwoFactor(on: boolean) {
  const user = await requireUser('/account');
  if (user.role === 'ADMIN') return; // always on for admins
  await db.user.update({ where: { id: user.id }, data: { twoFactorEnabled: on } });
  await audit(on ? 'TWO_FACTOR_ENABLED' : 'TWO_FACTOR_DISABLED', user.id);
  revalidatePath('/account');
}

export async function changePassword(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser('/account');
  // Shares the sign-in budget so this form can't be used to guess the current password
  const limit = await hit(`login:email:${user.email}`, LIMITS.loginPerEmail);
  if (!limit.ok) return { error: waitMessage(limit.retryAfterSec) };

  const current = String(form.get('current') ?? '');
  const next = String(form.get('password') ?? '');
  if (next !== String(form.get('confirm') ?? '')) return { error: 'The two new passwords do not match.' };
  const record = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await bcrypt.compare(current, record.passwordHash))) {
    await audit('SIGN_IN_FAILED', user.id, 'wrong current password on change-password form');
    return { error: 'Your current password is incorrect.' };
  }
  const weak = await checkNewPassword(next, user.email, user.name);
  if (weak) return { error: weak };

  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(next, 12) } });
  await revokeAllSessions(user.id);
  await startSession(user.id); // keep this device signed in with the new session version
  await audit('PASSWORD_CHANGED', user.id, 'from account page');
  await sendEmail(passwordChangedEmail(user.email, user.name));
  return { notice: 'Password changed. Every other device has been signed out.' };
}
