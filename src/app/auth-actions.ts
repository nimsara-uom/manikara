'use server';

import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db';
import { audit } from '@/lib/audit';
import { clearPending, endSession, getPending, requireUser, revokeAllSessions, setPending, startSession } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { otpEmail, passwordChangedEmail } from '@/lib/email-templates';
import { OTP_TTL_MIN, consumeCode, issueCode, otpMessage, resendWait, type OtpPurpose } from '@/lib/otp';
import { checkNewPassword } from '@/lib/password';
import { LIMITS, clear, hit, waitMessage } from '@/lib/ratelimit';
import { requestInfo } from '@/lib/request';

export type FormState = { error?: string; notice?: string } | undefined;

const BCRYPT_ROUNDS = 12;

/** Only allow redirects back into this site. */
function safeNext(raw: FormDataEntryValue | string | null | undefined): string {
  const s = typeof raw === 'string' ? raw : '';
  return s.startsWith('/') && !s.startsWith('//') && !s.startsWith('/\\') ? s : '/';
}

// Compared against when the email is unknown, so response time doesn't reveal which emails exist
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

async function sendCode(user: { id: string; email: string; name: string }, purpose: OtpPurpose): Promise<boolean> {
  const code = await issueCode(user.id, purpose);
  return sendEmail(otpEmail(user.email, user.name, code, purpose, OTP_TTL_MIN));
}

// ---------- sign in ----------

export async function signIn(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase().slice(0, 254);
  const password = String(form.get('password') ?? '').slice(0, 200);
  const next = safeNext(form.get('next'));
  const { ip } = await requestInfo();

  const [byIp, byEmail] = await Promise.all([
    hit(`login:ip:${ip}`, LIMITS.loginPerIp),
    hit(`login:email:${email}`, LIMITS.loginPerEmail),
  ]);
  if (!byIp.ok || !byEmail.ok) {
    await audit('SIGN_IN_RATE_LIMITED', null, email);
    return { error: waitMessage(Math.max(byIp.ok ? 0 : byIp.retryAfterSec, byEmail.ok ? 0 : byEmail.retryAfterSec)) };
  }

  const user = await db.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    await audit('SIGN_IN_FAILED', user?.id ?? null, email);
    return { error: 'Email or password is incorrect.' };
  }
  await clear(`login:email:${email}`);

  if (!user.emailVerifiedAt) {
    await sendCode(user, 'VERIFY_EMAIL');
    await setPending({ userId: user.id, purpose: 'VERIFY_EMAIL', next });
    redirect('/verify-email');
  }
  if (user.role === 'ADMIN' || user.twoFactorEnabled) {
    await sendCode(user, 'SIGN_IN');
    await audit('SIGN_IN_CODE_SENT', user.id);
    await setPending({ userId: user.id, purpose: 'SIGN_IN', next });
    redirect('/login/code');
  }
  await startSession(user.id);
  await audit('SIGN_IN', user.id);
  redirect(next);
}

// ---------- register ----------

const Registration = z.object({
  name: z.string().trim().min(2, 'Please enter your name.').max(80),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email('Please enter a valid email.')),
  password: z.string().max(200),
});

export async function register(_prev: FormState, form: FormData): Promise<FormState> {
  const { ip } = await requestInfo();
  const limit = await hit(`register:ip:${ip}`, LIMITS.registerPerIp);
  if (!limit.ok) return { error: waitMessage(limit.retryAfterSec) };

  const parsed = Registration.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, password } = parsed.data;

  if (await db.user.findUnique({ where: { email } })) {
    return { error: 'An account with that email already exists. Sign in, or reset your password if you have forgotten it.' };
  }
  const weak = await checkNewPassword(password, email, name);
  if (weak) return { error: weak };

  const user = await db.user.create({ data: { name, email, passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS) } });
  await audit('REGISTER', user.id);
  const sent = await sendCode(user, 'VERIFY_EMAIL');
  await setPending({ userId: user.id, purpose: 'VERIFY_EMAIL', next: safeNext(form.get('next')) });
  redirect(sent ? '/verify-email' : '/verify-email?sendFailed=1');
}

// ---------- emailed codes ----------

async function pendingUser(purpose: OtpPurpose) {
  const p = await getPending(purpose);
  if (!p) return null;
  const user = await db.user.findUnique({ where: { id: p.userId } });
  return user ? { p, user } : null;
}

export async function verifyEmail(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await pendingUser('VERIFY_EMAIL');
  if (!ctx) return { error: 'Your session has expired. Please sign in again.' };
  const r = await consumeCode(ctx.user.id, 'VERIFY_EMAIL', String(form.get('code') ?? ''));
  if (r !== 'ok') {
    await audit(r === 'locked' ? 'OTP_LOCKED' : 'OTP_FAILED', ctx.user.id, 'VERIFY_EMAIL');
    return { error: otpMessage(r) };
  }
  await db.user.update({ where: { id: ctx.user.id }, data: { emailVerifiedAt: new Date() } });
  await audit('EMAIL_VERIFIED', ctx.user.id);
  await startSession(ctx.user.id);
  await audit('SIGN_IN', ctx.user.id);
  redirect(ctx.p.next);
}

export async function verifySignIn(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await pendingUser('SIGN_IN');
  if (!ctx) return { error: 'Your session has expired. Please sign in again.' };
  const r = await consumeCode(ctx.user.id, 'SIGN_IN', String(form.get('code') ?? ''));
  if (r !== 'ok') {
    await audit(r === 'locked' ? 'OTP_LOCKED' : 'OTP_FAILED', ctx.user.id, 'SIGN_IN');
    return { error: otpMessage(r) };
  }
  await startSession(ctx.user.id);
  await audit('SIGN_IN', ctx.user.id, 'with emailed code');
  redirect(ctx.p.next);
}

export async function resendCode(purpose: OtpPurpose): Promise<FormState> {
  const ctx = await pendingUser(purpose);
  if (!ctx) {
    // A reset for an unknown email must look the same as a real one
    if (purpose === 'RESET_PASSWORD' && (await getPending(purpose))) return { notice: 'A new code is on its way.' };
    return { error: 'Your session has expired. Please start again.' };
  }
  const wait = await resendWait(ctx.user.id, purpose);
  if (wait > 0) return { error: `Please wait ${wait} seconds before asking for another code.` };
  const limit = await hit(`otp:${ctx.user.id}`, LIMITS.otpSendPerUser);
  if (!limit.ok) return { error: waitMessage(limit.retryAfterSec) };
  const sent = await sendCode(ctx.user, purpose);
  return sent ? { notice: 'A new code is on its way.' } : { error: 'We could not send the email. Please try again shortly.' };
}

// ---------- password reset ----------

export async function requestReset(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase().slice(0, 254);
  if (!z.email().safeParse(email).success) return { error: 'Please enter a valid email.' };
  const { ip } = await requestInfo();
  const [byIp, byEmail] = await Promise.all([hit(`reset:ip:${ip}`, LIMITS.resetPerIp), hit(`reset:email:${email}`, LIMITS.resetPerEmail)]);
  if (!byIp.ok || !byEmail.ok) return { error: waitMessage(Math.max(byIp.retryAfterSec, byEmail.retryAfterSec)) };

  const user = await db.user.findUnique({ where: { email } });
  if (user && (await resendWait(user.id, 'RESET_PASSWORD')) === 0) {
    await sendCode(user, 'RESET_PASSWORD');
    await audit('PASSWORD_RESET_REQUESTED', user.id);
  }
  // Same response whether or not the account exists, so this can't be used to discover members
  await setPending({ userId: user?.id ?? 'unknown', purpose: 'RESET_PASSWORD', next: '/' });
  redirect('/forgot/reset');
}

export async function resetPassword(_prev: FormState, form: FormData): Promise<FormState> {
  const p = await getPending('RESET_PASSWORD');
  if (!p) return { error: 'Your reset session has expired. Please start again.' };
  const user = await db.user.findUnique({ where: { id: p.userId } });
  const password = String(form.get('password') ?? '');
  if (password !== String(form.get('confirm') ?? '')) return { error: 'The two passwords do not match.' };
  if (!user) {
    // Unknown account: answer exactly as a real one would
    const weak = await checkNewPassword(password, 'unknown@unknown.invalid');
    return { error: weak ?? 'That code is not right or has expired.' };
  }

  // Check the password before spending the code, so a weak choice doesn't burn it
  const weak = await checkNewPassword(password, user.email, user.name);
  if (weak) return { error: weak };
  const r = await consumeCode(user.id, 'RESET_PASSWORD', String(form.get('code') ?? ''));
  if (r !== 'ok') {
    await audit(r === 'locked' ? 'OTP_LOCKED' : 'OTP_FAILED', user.id, 'RESET_PASSWORD');
    return { error: r === 'locked' ? otpMessage(r) : 'That code is not right or has expired.' };
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS), emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
  });
  await revokeAllSessions(user.id);
  await audit('PASSWORD_CHANGED', user.id, 'via reset code');
  await sendEmail(passwordChangedEmail(user.email, user.name));
  await clearPending();
  redirect('/login?reset=1');
}

// ---------- sign out ----------

export async function signOut() {
  await endSession();
  redirect('/');
}

export async function signOutEverywhere() {
  const user = await requireUser('/account');
  await revokeAllSessions(user.id);
  await audit('SIGN_OUT_ALL', user.id);
  await endSession();
  redirect('/login');
}
