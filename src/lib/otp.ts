import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { db } from './db';

export type OtpPurpose = 'VERIFY_EMAIL' | 'SIGN_IN' | 'RESET_PASSWORD';

export const OTP_TTL_MIN = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SEC = 60;

/** Six digits from a cryptographic RNG. */
export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** HMAC binds the code to its user and purpose, so a stolen hash can't be replayed elsewhere. */
export function hashCode(code: string, userId: string, purpose: OtpPurpose, secret = process.env.SESSION_SECRET ?? ''): string {
  if (!secret) throw new Error('SESSION_SECRET is not set.');
  return createHmac('sha256', secret).update(`${purpose}:${userId}:${code}`).digest('hex');
}

export function codesMatch(code: string, hash: string, userId: string, purpose: OtpPurpose, secret?: string): boolean {
  const a = Buffer.from(hashCode(code, userId, purpose, secret), 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Seconds until another code may be sent, or 0 if one can be sent now. */
export async function resendWait(userId: string, purpose: OtpPurpose): Promise<number> {
  const last = await db.otpCode.findFirst({ where: { userId, purpose }, orderBy: { createdAt: 'desc' } });
  if (!last) return 0;
  const elapsed = (Date.now() - last.createdAt.getTime()) / 1000;
  return Math.max(0, Math.ceil(OTP_RESEND_COOLDOWN_SEC - elapsed));
}

/** Issues a fresh code, invalidating any earlier unused code for the same purpose. Returns the plain code to email. */
export async function issueCode(userId: string, purpose: OtpPurpose): Promise<string> {
  const code = generateCode();
  await db.$transaction([
    db.otpCode.updateMany({ where: { userId, purpose, consumedAt: null }, data: { consumedAt: new Date() } }),
    db.otpCode.create({
      data: { userId, purpose, codeHash: hashCode(code, userId, purpose), expiresAt: new Date(Date.now() + OTP_TTL_MIN * 60_000) },
    }),
  ]);
  return code;
}

export type OtpResult = 'ok' | 'invalid' | 'expired' | 'locked';

/** Checks a submitted code. Each wrong guess counts; after five the code is burned. */
export async function consumeCode(userId: string, purpose: OtpPurpose, submitted: string): Promise<OtpResult> {
  const code = submitted.replace(/\D/g, '');
  const otp = await db.otpCode.findFirst({
    where: { userId, purpose, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!otp) return 'expired';
  if (otp.expiresAt < new Date()) return 'expired';
  if (otp.attempts >= OTP_MAX_ATTEMPTS) return 'locked';

  if (code.length === 6 && codesMatch(code, otp.codeHash, userId, purpose)) {
    // Conditional update so two simultaneous submissions can't both succeed
    const claimed = await db.otpCode.updateMany({ where: { id: otp.id, consumedAt: null }, data: { consumedAt: new Date() } });
    return claimed.count === 1 ? 'ok' : 'expired';
  }
  const updated = await db.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
  return updated.attempts >= OTP_MAX_ATTEMPTS ? 'locked' : 'invalid';
}

export function otpMessage(r: Exclude<OtpResult, 'ok'>): string {
  if (r === 'invalid') return 'That code is not right. Please check the email and try again.';
  if (r === 'locked') return 'Too many wrong codes. Please request a new one.';
  return 'That code has expired. Please request a new one.';
}
