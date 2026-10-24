// First-run setup: writes .env with a session secret and an Ed25519 gem-key pair.
// Safe to re-run — existing values are kept, only missing ones are added.
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const ENV_FILE = '.env';

const existing = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf8') : '';
const has = name => new RegExp(`^${name}=`, 'm').test(existing);

const additions = [];
if (!has('DATABASE_URL')) {
  additions.push('# PostgreSQL. Replace CHANGE_ME with the password of your postgres user.');
  additions.push('DATABASE_URL="postgresql://postgres:CHANGE_ME@localhost:5432/manikara?schema=public"');
} else if (/^DATABASE_URL="?file:/m.test(existing)) {
  console.error('DATABASE_URL in .env still points at SQLite. Change it to your PostgreSQL URL, e.g.\n' +
    '  DATABASE_URL="postgresql://postgres:PASSWORD@localhost:5432/manikara?schema=public"');
  process.exit(1);
}
if (!/BREVO_API_KEY/.test(existing)) {
  additions.push('# Brevo transactional email. Leave empty in development to print emails in the terminal.');
  additions.push('BREVO_API_KEY=""');
  additions.push('# MAIL_FROM_EMAIL must be a sender you have verified in Brevo, e.g. no-reply@yourdomain.com');
  additions.push('MAIL_FROM_EMAIL=""');
  additions.push('MAIL_FROM_NAME="Manikara"');
}
if (!has('APP_URL')) additions.push('APP_URL="http://localhost:3000"');
if (!has('SESSION_SECRET')) additions.push(`SESSION_SECRET="${randomBytes(32).toString('base64url')}"`);

if (!has('GEMKEY_PRIVATE_KEY') || !has('GEMKEY_PUBLIC_KEY')) {
  if (has('GEMKEY_PRIVATE_KEY') || has('GEMKEY_PUBLIC_KEY')) {
    console.error('.env has only one half of the gem-key pair. Fix or remove it before re-running setup.');
    process.exit(1);
  }
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const b64 = pem => Buffer.from(pem, 'utf8').toString('base64');
  additions.push(`GEMKEY_PRIVATE_KEY="${b64(privateKey.export({ type: 'pkcs8', format: 'pem' }))}"`);
  additions.push(`GEMKEY_PUBLIC_KEY="${b64(publicKey.export({ type: 'spki', format: 'pem' }))}"`);
}

if (additions.length) {
  const sep = existing && !existing.endsWith('\n') ? '\n' : '';
  writeFileSync(ENV_FILE, existing + sep + additions.join('\n') + '\n');
  console.log(`Updated ${ENV_FILE}`);
} else {
  console.log(`${ENV_FILE} already complete`);
}

mkdirSync('uploads', { recursive: true });
