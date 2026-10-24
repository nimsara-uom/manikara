import { db } from './db';

export type Limit = { max: number; windowSec: number };

export const LIMITS = {
  loginPerIp: { max: 20, windowSec: 15 * 60 },
  loginPerEmail: { max: 8, windowSec: 15 * 60 },
  registerPerIp: { max: 5, windowSec: 60 * 60 },
  otpSendPerUser: { max: 5, windowSec: 60 * 60 },
  resetPerIp: { max: 5, windowSec: 60 * 60 },
  resetPerEmail: { max: 3, windowSec: 60 * 60 },
  bidPerUser: { max: 20, windowSec: 60 },
} satisfies Record<string, Limit>;

/**
 * Counts one hit against `key` and reports whether it is within the limit.
 * A single atomic upsert, so concurrent requests on any server instance agree.
 */
export async function hit(key: string, limit: Limit): Promise<{ ok: boolean; retryAfterSec: number }> {
  const rows = await db.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, NOW() + make_interval(secs => ${limit.windowSec}))
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN "RateLimit"."resetAt" < NOW() THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" < NOW() THEN EXCLUDED."resetAt" ELSE "RateLimit"."resetAt" END
    RETURNING "count", "resetAt"`;
  const { count, resetAt } = rows[0];
  return { ok: count <= limit.max, retryAfterSec: Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000)) };
}

/** Clears a counter, e.g. the per-email login counter after a successful sign-in. */
export async function clear(key: string) {
  await db.rateLimit.deleteMany({ where: { key } });
}

export function waitMessage(retryAfterSec: number): string {
  const mins = Math.ceil(retryAfterSec / 60);
  return `Too many attempts. Please try again in ${mins} minute${mins === 1 ? '' : 's'}.`;
}
