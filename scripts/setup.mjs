// First-run setup: writes .env with a session secret and an Ed25519 gem-key pair.
// Safe to re-run — existing values are kept, only missing ones are added.
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const ENV_FILE = '.env';

const existing = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf8') : '';
const has = name => new RegExp(`^${name}=`, 'm').test(existing);

const additions = [];
if (!has('DATABASE_URL')) additions.push('DATABASE_URL="file:./dev.db"');
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
  console.log(`Added ${additions.length} value(s) to ${ENV_FILE}`);
} else {
  console.log(`${ENV_FILE} already complete`);
}

mkdirSync('uploads', { recursive: true });
