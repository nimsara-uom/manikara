// Gem Keys: a short public code plus an Ed25519 signature over the gem's facts.
//
//   payload   = canonical JSON of { facts, nonce, issuedAt }
//   code      = "MK-" + first 16 Crockford-base32 chars of SHA-256(payload)
//   signature = Ed25519(payload) with the house private key
//
// Anyone holding the public key (served at /api/public-key) can check that a
// payload was issued by Manikara and that its code matches.
import { createHash, createPrivateKey, createPublicKey, randomBytes, sign, verify } from 'node:crypto';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32, no I L O U

export type GemFacts = {
  name: string;
  species: string;
  carat: string; // fixed 2 decimals, avoids float drift
  colorName: string;
  colorHex: string;
  clarity: string;
  cut: string;
  origin: string;
  treatment: string;
  lab: string;
  reportNo: string;
  images: string[]; // SHA-256 of each photograph, in order
};

type GemLike = {
  name: string; species: string; carat: number; colorName: string; colorHex: string; clarity: string;
  cut: string; origin: string; treatment: string; lab: string; reportNo: string;
  images: { sha256: string; position: number }[];
};

export function factsFromGem(gem: GemLike): GemFacts {
  return {
    name: gem.name.trim(),
    species: gem.species.trim(),
    carat: gem.carat.toFixed(2),
    colorName: gem.colorName.trim(),
    colorHex: gem.colorHex.toLowerCase(),
    clarity: gem.clarity.trim(),
    cut: gem.cut.trim(),
    origin: gem.origin.trim(),
    treatment: gem.treatment.trim(),
    lab: gem.lab.trim(),
    reportNo: gem.reportNo.trim(),
    images: [...gem.images].sort((a, b) => a.position - b.position).map(i => i.sha256),
  };
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function base32(buf: Uint8Array): string {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = ((value << 8) | byte) & 0xffff;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function codeForPayload(payload: string): string {
  const digest = createHash('sha256').update(payload, 'utf8').digest();
  return 'MK-' + base32(digest).slice(0, 16).match(/.{4}/g)!.join('-');
}

/** Accepts sloppy user input ("mk 7f3a 91c2…", lowercase, O for 0) and returns the canonical code. */
export function normalizeCode(input: string): string | null {
  let s = input.toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (s.startsWith('MK')) s = s.slice(2);
  s = s.replace(/O/g, '0').replace(/[IL]/g, '1');
  if (s.length !== 16 || [...s].some(c => !ALPHABET.includes(c))) return null;
  return 'MK-' + s.match(/.{4}/g)!.join('-');
}

function pem(envName: string): string {
  const raw = process.env[envName];
  if (!raw) throw new Error(`${envName} is not set. Run \`npm run setup\` to generate signing keys.`);
  return Buffer.from(raw, 'base64').toString('utf8');
}

export function publicKeyPem(): string {
  return pem('GEMKEY_PUBLIC_KEY');
}

export function issueKey(facts: GemFacts) {
  const payload = canonicalJson({
    v: 1,
    issuer: 'Manikara',
    facts,
    nonce: randomBytes(16).toString('hex'),
    issuedAt: new Date().toISOString(),
  });
  const signature = sign(null, Buffer.from(payload, 'utf8'), createPrivateKey(pem('GEMKEY_PRIVATE_KEY'))).toString('base64');
  return { code: codeForPayload(payload), payload, signature };
}

export type KeyCheck = {
  signatureValid: boolean; // signed by our private key
  codeValid: boolean; // code really is the hash of the payload
  matchesGem: boolean; // payload facts equal the gem record as it stands today
  revoked: boolean;
  facts: GemFacts | null;
};

export function checkKey(
  record: { code: string; payload: string; signature: string; revokedAt: Date | null },
  currentFacts: GemFacts | null,
): KeyCheck {
  let signatureValid = false;
  try {
    signatureValid = verify(null, Buffer.from(record.payload, 'utf8'), createPublicKey(publicKeyPem()),
      Buffer.from(record.signature, 'base64'));
  } catch { signatureValid = false; }

  let facts: GemFacts | null = null;
  try { facts = (JSON.parse(record.payload) as { facts: GemFacts }).facts; } catch { /* corrupt payload */ }

  return {
    signatureValid,
    codeValid: codeForPayload(record.payload) === record.code,
    matchesGem: !!facts && !!currentFacts && canonicalJson(facts) === canonicalJson(currentFacts),
    revoked: !!record.revokedAt,
    facts,
  };
}
