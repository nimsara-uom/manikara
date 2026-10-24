'use server';

import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db';
import { endSession, startSession } from '@/lib/auth';

export type FormState = { error?: string } | undefined;

/** Only allow redirects back into this site. */
function safeNext(raw: FormDataEntryValue | null): string {
  const s = typeof raw === 'string' ? raw : '';
  return s.startsWith('/') && !s.startsWith('//') && !s.startsWith('/\\') ? s : '/';
}

// Compared against when the email is unknown, so response time doesn't reveal which emails exist
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

export async function signIn(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  const user = await db.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) return { error: 'Email or password is incorrect.' };
  await startSession(user.id);
  redirect(safeNext(form.get('next')));
}

const Registration = z.object({
  name: z.string().trim().min(2, 'Please enter your name.').max(80),
  email: z.string().trim().toLowerCase().pipe(z.email('Please enter a valid email.')),
  password: z.string().min(8, 'Passwords need at least 8 characters.').max(200),
});

export async function register(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = Registration.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, password } = parsed.data;
  if (await db.user.findUnique({ where: { email } })) {
    return { error: 'An account with that email already exists.' };
  }
  const user = await db.user.create({ data: { name, email, passwordHash: await bcrypt.hash(password, 10) } });
  await startSession(user.id);
  redirect(safeNext(form.get('next')));
}

export async function signOut() {
  await endSession();
  redirect('/');
}
