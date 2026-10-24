# Manikara

Fine gemstone auctions with signed Gem Keys.

## Getting started

```sh
npm install
npm run setup   # writes .env (session secret + Ed25519 key pair), migrates, seeds demo data
npm run dev     # http://localhost:3000
```

Demo accounts (password `manikara123`): `admin@manikara.test` (admin), `ana@manikara.test`, `ben@manikara.test`.
Promote any registered account with `npm run make-admin -- someone@example.com`.

`npm run seed` wipes and re-seeds the database. `npm test` runs the bidding and Gem Key tests.

## How it works

**Proxy bidding.** Every bid is a secret maximum. The house bids for each bidder only as much as needed:
the price is the second-highest maximum plus one increment, capped at the highest maximum. Ties go to whoever
got there first. When the leader's maximum covers the reserve, the price jumps to the reserve. Bids in the
final two minutes extend the close by two minutes. Concurrent bids are serialised with an optimistic lock
on `Auction.version`. The rules are in `src/lib/bidding-engine.ts`.

**Gem Keys.** When a stone is created, its facts and the SHA-256 of each photograph are put into canonical
JSON and signed with Ed25519. The key code is a fingerprint of that payload, and anyone can check it at
`/verify`. Changing any certified fact or photograph revokes the old key and issues a new one, and the
old key then shows as superseded. Raw records are at `/api/keys/<code>` and the public key at `/api/public-key`.
The logic is in `src/lib/gemkey.ts`.

## Production notes

- Switch `provider` in `prisma/schema.prisma` to `postgresql` and point `DATABASE_URL` at your server.
- Set `APP_URL` to the public origin so QR codes link to the right host.
- Keep `GEMKEY_PRIVATE_KEY` secret and backed up. If you lose it, you can't issue keys that verify against the published public key.
- Uploaded photographs are stored on local disk in `uploads/`.
