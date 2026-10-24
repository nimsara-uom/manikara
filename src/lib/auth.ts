import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignJWT, jwtVerify } from 'jose';
import { db } from './db';
import type { OtpPurpose } from './otp';

const COOKIE = 'mk_session';
const PENDING = 'mk_pending';
const MAX_AGE = 60 * 60 * 24 * 7; // one week
const PENDING_MAX_AGE = 60 * 20; // time to fetch the code from email

export type SessionUser = {
  id: string; email: string; name: string; role: string;
  twoFactorEnabled: boolean; notifyBids: boolean;
};

function secret() {
  const raw = process.env.SESSION_SECRET;
  if (!raw) throw new Error('SESSION_SECRET is not set. Run `npm run setup`.');
  return new TextEncoder().encode(raw);
}

const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge,
});

export async function startSession(userId: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { sessionVersion: true } });
  const token = await new SignJWT({ sv: user.sessionVersion, typ: 'session' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  const jar = await cookies();
  jar.set(COOKIE, token, cookieOptions(MAX_AGE));
  jar.delete(PENDING);
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

/** Invalidates every existing session for a user (after a password change, or on request). */
export async function revokeAllSessions(userId: string) {
  await db.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });
}

/**
 * The signed-in user, re-read from the database so role changes apply
 * immediately and revoked sessions stop working at once.
 */
export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] });
    if (!payload.sub || payload.typ !== 'session') return null;
    const user = await db.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, twoFactorEnabled: true, notifyBids: true, sessionVersion: true, emailVerifiedAt: true },
    });
    if (!user || user.sessionVersion !== payload.sv || !user.emailVerifiedAt) return null;
    const { sessionVersion: _sv, emailVerifiedAt: _ev, ...rest } = user;
    return rest;
  } catch {
    return null;
  }
}

export async function requireUser(next = '/'): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser('/admin');
  if (user.role !== 'ADMIN') redirect('/');
  return user;
}

// ---------- pending step (between password and emailed code) ----------

export type Pending = { userId: string; purpose: OtpPurpose; next: string };

export async function setPending(p: Pending) {
  const token = await new SignJWT({ purpose: p.purpose, next: p.next, typ: 'pending' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(p.userId)
    .setIssuedAt()
    .setExpirationTime(`${PENDING_MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(PENDING, token, cookieOptions(PENDING_MAX_AGE));
}

export async function getPending(purpose?: OtpPurpose): Promise<Pending | null> {
  const token = (await cookies()).get(PENDING)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] });
    if (payload.typ !== 'pending' || !payload.sub) return null;
    const p = { userId: payload.sub, purpose: payload.purpose as OtpPurpose, next: String(payload.next ?? '/') };
    return purpose && p.purpose !== purpose ? null : p;
  } catch {
    return null;
  }
}

export async function clearPending() {
  (await cookies()).delete(PENDING);
}
