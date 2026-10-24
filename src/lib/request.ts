import { headers } from 'next/headers';

/**
 * Caller's IP and user agent. Behind a proxy (Vercel, Nginx, Cloudflare) the
 * first X-Forwarded-For entry is the client. Only trust this when the app is
 * actually deployed behind such a proxy, since clients can set the header themselves.
 */
export async function requestInfo() {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for')?.split(',')[0]?.trim();
  return {
    ip: forwarded || h.get('x-real-ip') || 'unknown',
    userAgent: (h.get('user-agent') ?? '').slice(0, 300) || null,
  };
}
