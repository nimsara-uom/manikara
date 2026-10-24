import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignJWT, jwtVerify } from 'jose';
import { db } from './db';

const COOKIE = 'mk_session';
const MAX_AGE = 60 * 60 * 24 * 7; // one week

export type SessionUser = { id: string; email: string; name: string; role: string };

function secret() {
  const raw = process.env.SESSION_SECRET;
  if (!raw) throw new Error('SESSION_SECRET is not set. Run `npm run setup`.');
  return new TextEncoder().encode(raw);
}

export async function startSession(userId: string) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

/** The signed-in user, re-read from the database so role changes apply immediately. */
export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] });
    if (!payload.sub) return null;
    return await db.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true },
    });
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
