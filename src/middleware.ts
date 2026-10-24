import { NextResponse, type NextRequest } from 'next/server';

/**
 * Per-request Content Security Policy with a nonce. Next.js reads the nonce
 * from the request's CSP header and stamps it on its own scripts; anything
 * else (an injected <script>, an inline event handler) is refused by the browser.
 */
export function middleware(req: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const dev = process.env.NODE_ENV !== 'production';

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? ` 'unsafe-eval'` : ''}`,
    // React style={{}} props need inline styles; fonts come from Google Fonts and Fontshare
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.fontshare.com`,
    `font-src 'self' https://fonts.gstatic.com https://cdn.fontshare.com`,
    `img-src 'self' data: blob:`,
    `connect-src 'self'${dev ? ' ws: wss:' : ''}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    ...(dev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');

  const headers = new Headers(req.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);

  const res = NextResponse.next({ request: { headers } });
  res.headers.set('Content-Security-Policy', csp);
  return res;
}

export const config = {
  matcher: [
    {
      source: '/((?!api|media|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
