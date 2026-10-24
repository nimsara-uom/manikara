import { createHash } from 'node:crypto';

export const MIN_PASSWORD = 10;

/** Local checks that need no network. Returns an error message, or null if acceptable. */
export function passwordProblem(password: string, email: string, name = ''): string | null {
  if (password.length < MIN_PASSWORD) return `Passwords need at least ${MIN_PASSWORD} characters.`;
  if (password.length > 200) return 'That password is too long.';
  const lower = password.toLowerCase();
  const local = email.split('@')[0]?.toLowerCase() ?? '';
  if (local.length >= 4 && lower.includes(local)) return 'Your password should not contain your email address.';
  const first = name.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  if (first.length >= 4 && lower.includes(first)) return 'Your password should not contain your name.';
  if (/^(.)\1+$/.test(password)) return 'Please choose a less predictable password.';
  return null;
}

/**
 * Checks Have I Been Pwned's breach corpus using k-anonymity: only the first 5
 * hex characters of the SHA-1 leave this server. Fails open if the service is
 * unreachable, so an outage never blocks sign-ups.
 */
export async function isBreached(password: string): Promise<boolean> {
  const sha1 = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5), suffix = sha1.slice(5);
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return false;
    const body = await res.text();
    return body.split('\n').some(line => {
      const [hash, count] = line.trim().split(':');
      return hash === suffix && Number(count) > 0;
    });
  } catch {
    return false;
  }
}

export async function checkNewPassword(password: string, email: string, name?: string): Promise<string | null> {
  const local = passwordProblem(password, email, name);
  if (local) return local;
  if (await isBreached(password)) {
    return 'This password has appeared in a known data breach. Please choose a different one.';
  }
  return null;
}
