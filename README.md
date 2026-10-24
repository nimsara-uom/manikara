# Manikara

Fine gemstone auctions with signed Gem Keys.

## Getting started

Requires Node 22+ and PostgreSQL.

1. `npm install`
2. `npm run setup` writes `.env` (session secret, Ed25519 key pair, placeholders), migrates, and seeds demo data.
3. In `.env`, set `DATABASE_URL` to your PostgreSQL server, for example
   `postgresql://postgres:PASSWORD@localhost:5432/manikara?schema=public`. The database is created if it doesn't exist.
4. Optional: set `BREVO_API_KEY` and `MAIL_FROM_EMAIL` (a sender verified in Brevo) to send real email.
   Without them, emails, including sign-in codes, are printed in the terminal.
5. `npm run dev`, then open http://localhost:3000

Demo accounts (password `Manikara#2026`): `admin@manikara.test` (admin), `ana@manikara.test`, `ben@manikara.test`.
Emails to `.test` addresses are never sent; they appear in the terminal, so you can sign in as the demo admin and read the code there.

| Command | What it does |
| --- | --- |
| `npm run seed` | **Wipes** the database and reloads demo data |
| `npm run make-admin -- you@example.com` | Promotes a registered account to admin |
| `npm run settle` | Sends result emails for closed auctions (run every minute in production) |
| `npm test` | Bidding, Gem Key and security tests |

## How it works

**Proxy bidding.** Every bid is a secret maximum. The house bids for each bidder only as much as needed:
the price is the second-highest maximum plus one increment, capped at the highest maximum. When the leader's
maximum covers the reserve, the price jumps to the reserve. Bids in the last two minutes extend the close.
Concurrent bids are serialised with an optimistic lock on `Auction.version`. See `src/lib/bidding-engine.ts`.

**Gem Keys.** A stone's facts and the SHA-256 of each photograph are put into canonical JSON and signed with
Ed25519. The key code is a fingerprint of that payload, and anyone can check it at `/verify`. Editing any certified
fact or photograph revokes the old key and issues a new one. See `src/lib/gemkey.ts`.

**Email (Brevo).** Sign-up verification codes, sign-in codes, password reset, bid receipts, outbid alerts,
win notices, closed-lot results, and admin sale summaries. See `src/lib/email.ts` and `src/lib/email-templates.ts`.

## Security

- **Email verification.** New accounts must confirm a six-digit emailed code before they can sign in or bid.
- **Two-step sign-in.** An emailed code is always required for admins and optional for everyone else (account page).
- **One-time codes.** Codes are stored only as HMAC-SHA256, bound to user and purpose, expire after 10 minutes,
  allow 5 attempts, and have a 60-second resend cooldown.
- **Passwords.** bcrypt (12 rounds). New passwords need at least 10 characters, must not contain your name or email,
  and are checked against Have I Been Pwned's breach list. Only a 5-character hash prefix leaves the server.
- **Rate limiting.** Postgres-backed, so it holds across server instances. Limits apply to sign-in (per IP and per email),
  registration, code sending, password reset and bidding.
- **Sessions.** Signed httpOnly cookies tied to `User.sessionVersion`. Changing your password or choosing
  "Sign out everywhere" ends every other session at once.
- **No account enumeration.** Sign-in and password reset respond the same way whether or not an email is registered.
- **Audit log.** The `SecurityEvent` table records sign-ins, failures, code lockouts, password changes and admin
  edits. Users can see their own recent activity on the account page.
- **Headers.**
  - A nonce-based Content Security Policy, so only the site's own scripts run.
  - `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff`, a strict Referrer-Policy, Permissions-Policy and COOP.
  - HSTS in production.
- **Uploads.** File types are checked by magic bytes; files are stored by content hash with strict file-name
  validation and served sandboxed.
- **CSRF.** Next.js server actions check the request origin.

## Production

- Use a managed PostgreSQL database (Neon and Supabase have free tiers) and set `DATABASE_URL`.
- Set `APP_URL` to the public HTTPS origin, so QR codes and email links point at the right host.
- Schedule `npm run settle` every minute.
- Keep `GEMKEY_PRIVATE_KEY` and `SESSION_SECRET` secret and backed up.
- Photographs are stored in `uploads/` on local disk. Use persistent storage, or move them to object storage.
- Only trust `X-Forwarded-For` (used for rate limiting) behind a proxy that sets it.
