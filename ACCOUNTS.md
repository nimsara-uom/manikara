# Manikara: logins and accounts

Every login used by this project, and where to find it.

> **This file holds no real secrets.** Real passwords and keys live only in `.env`, which is never committed to git.
> Don't paste them into this file.

---

## 1. Website demo accounts

These are created by `npm run seed` (also part of `npm run setup`). Running `npm run seed` again **wipes the database** and recreates them.

| Role | Email | Password | Notes |
| --- | --- | --- | --- |
| Admin | `admin@manikara.test` | `Manikara#2026` | Can reach the admin panel. Always asks for an emailed sign-in code. |
| Bidder | `ana@manikara.test` | `Manikara#2026` | Has demo bids and a watched lot |
| Bidder | `ben@manikara.test` | `Manikara#2026` | Has demo bids |

- **Website:** http://localhost:3000 (start it with `npm run dev`)
- **Sign in:** http://localhost:3000/login
- **Admin panel:** http://localhost:3000/admin (admins only)

### Where the codes for demo accounts appear

The `.test` addresses aren't real, so emails to them are **never sent**. They are printed in the terminal running `npm run dev`, like this:

```
✉  [email not sent: test address]
   To: House Admin <admin@manikara.test>
   Subject: Your Manikara sign-in code
   ...
   Your code: 123 456
```

Type that code into the website. Codes expire after **10 minutes** and stop working after **5 wrong tries**.

---

## 2. Your own website account

1. Go to http://localhost:3000/register and sign up with your real email.
2. Enter the six-digit code from your inbox. Check spam if it isn't there.
3. To make yourself an admin, run this in the project folder:
   ```
   npm run make-admin -- your@email.com
   ```
   Then sign out and sign in again. An **ADMIN** link appears in the menu.

**Password rules:** at least 10 characters, not containing your name or email, and not found in known data breaches.

**Forgotten password:** use "Forgot password?" on the sign-in page (http://localhost:3000/forgot).

**Locked out after too many attempts:** sign-in is paused for 15 minutes after 8 wrong passwords for the same email. Wait, or reset your password.

### Account settings (http://localhost:3000/account)

- Turn bid emails on or off
- Turn two-step sign-in on or off (always on for admins)
- Change your password
- **Sign out everywhere:** ends every session on every device
- **Recent activity:** your sign-ins, failed attempts and devices

---

## 3. PostgreSQL database

| What | Value |
| --- | --- |
| Server | PostgreSQL 18, installed on this computer (Windows service `postgresql-x64-18`) |
| Host / port | `localhost` / `5432` |
| Username | `postgres` |
| Password | Saved in `.env`, inside `DATABASE_URL` (the part between `postgres:` and `@`) |
| Database name | `manikara` |

The full address is in `.env`:
```
DATABASE_URL="postgresql://postgres:PASSWORD@localhost:5432/manikara?schema=public"
```

**Forgotten the password?** Open PowerShell **as administrator** and run:
```
powershell -ExecutionPolicy Bypass -File "C:\Users\H P\manikara\scripts\reset-postgres-password.ps1"
```
It sets a new password, saves it into `.env`, and shows it on screen.

### Looking at the data

- **Prisma Studio (easiest):** run `npx prisma studio` in the project folder. Tables open in your browser like a spreadsheet; no login needed.
- **pgAdmin 4:** installed with PostgreSQL; find it in the Start menu. Connect to `localhost`, user `postgres`, using the password from `.env`.

Use the website's admin panel to edit stones, not the database tools. Editing directly skips re-issuing the Gem Key.

---

## 4. Brevo (email sending)

| What | Where |
| --- | --- |
| Brevo dashboard | https://app.brevo.com (sign in with your own Brevo account) |
| API key | In `.env` as `BREVO_API_KEY`. It must start with **`xkeysib-`** (from Brevo > SMTP & API > **API Keys**). Keys starting with `xsmtpsib-` are SMTP keys and **will not work**. |
| Sender address | In `.env` as `MAIL_FROM_EMAIL`. It must be verified in Brevo (Senders, Domains & Dedicated IPs > Senders). |
| Sender name | In `.env` as `MAIL_FROM_NAME` (default `Manikara`) |

If `BREVO_API_KEY` is empty, no emails are sent. They are printed in the terminal instead, which is fine for development.

---

## 5. Other secrets in `.env`

Never share these, and keep a backup copy somewhere safe.

| Name | What it is | If it's lost or leaked |
| --- | --- | --- |
| `SESSION_SECRET` | Signs sign-in cookies and protects one-time codes | Replace it with a new random value. Everyone is signed out. |
| `GEMKEY_PRIVATE_KEY` | Signs every Gem Key | **Lost:** new keys won't match the published public key. **Leaked:** someone could forge Gem Keys. |
| `GEMKEY_PUBLIC_KEY` | Lets anyone check Gem Keys (published at `/api/public-key`) | Not secret, but it must stay paired with the private key |
| `APP_URL` | The site's public address, used in emails and QR codes | Set it to the real `https://…` address when the site goes live |

If `.env` is deleted, `npm run setup` creates a new one. You would have to put the database password and Brevo details back in, and existing Gem Keys would no longer verify.

---

## 6. Quick reference

| I want to… | Do this |
| --- | --- |
| Start the website | `npm run dev`, then open http://localhost:3000 |
| Sign in as admin (demo) | `admin@manikara.test` / `Manikara#2026`, then the code from the terminal |
| Make my account an admin | `npm run make-admin -- my@email.com` |
| Reset all demo data | `npm run seed` (**deletes everything**) |
| See the database | `npx prisma studio` |
| Reset the database password | Run `scripts\reset-postgres-password.ps1` as administrator |
| Send result emails for closed lots now | `npm run settle` |
