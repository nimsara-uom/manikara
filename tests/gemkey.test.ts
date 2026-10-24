import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { before, test } from 'node:test';
import { canonicalJson, checkKey, factsFromGem, issueKey, normalizeCode } from '../src/lib/gemkey';

before(() => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const b64 = (s: string | Buffer) => Buffer.from(s).toString('base64');
  process.env.GEMKEY_PRIVATE_KEY = b64(privateKey.export({ type: 'pkcs8', format: 'pem' }));
  process.env.GEMKEY_PUBLIC_KEY = b64(publicKey.export({ type: 'spki', format: 'pem' }));
});

const gem = {
  name: 'Test Stone ', species: 'Sapphire', carat: 2.5, colorName: 'Blue', colorHex: '#3B5BDB', clarity: 'VS',
  cut: 'Oval', origin: 'Sri Lanka', treatment: 'None', lab: 'GIA', reportNo: '123',
  images: [{ sha256: 'bbb', position: 1 }, { sha256: 'aaa', position: 0 }],
};

test('facts are normalised: trimmed, fixed-precision carats, lowercase hex, images in order', () => {
  const f = factsFromGem(gem);
  assert.equal(f.name, 'Test Stone');
  assert.equal(f.carat, '2.50');
  assert.equal(f.colorHex, '#3b5bdb');
  assert.deepEqual(f.images, ['aaa', 'bbb']);
});

test('canonical JSON ignores key order', () => {
  assert.equal(canonicalJson({ b: 1, a: [2, { d: 3, c: 4 }] }), canonicalJson({ a: [2, { c: 4, d: 3 }], b: 1 }));
});

test('an issued key verifies and matches its gem', () => {
  const facts = factsFromGem(gem);
  const key = issueKey(facts);
  assert.match(key.code, /^MK-[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
  const r = checkKey({ ...key, revokedAt: null }, facts);
  assert.deepEqual([r.signatureValid, r.codeValid, r.matchesGem, r.revoked], [true, true, true, false]);
});

test('editing the gem breaks the match but not the signature', () => {
  const key = issueKey(factsFromGem(gem));
  const r = checkKey({ ...key, revokedAt: null }, factsFromGem({ ...gem, carat: 2.51 }));
  assert.equal(r.signatureValid, true);
  assert.equal(r.matchesGem, false);
});

test('a tampered payload fails both signature and code checks', () => {
  const key = issueKey(factsFromGem(gem));
  const payload = key.payload.replace('"2.50"', '"5.00"');
  const r = checkKey({ ...key, payload, revokedAt: null }, null);
  assert.equal(r.signatureValid, false);
  assert.equal(r.codeValid, false);
});

test('normalizeCode accepts sloppy input and rejects garbage', () => {
  const { code } = issueKey(factsFromGem(gem));
  assert.equal(normalizeCode(code.toLowerCase().replace(/-/g, ' ')), code);
  assert.equal(normalizeCode('mk-0000-0000-0000-000o'), 'MK-0000-0000-0000-0000');
  assert.equal(normalizeCode('MK-1234'), null);
  assert.equal(normalizeCode('MK-UUUU-UUUU-UUUU-UUUU'), null);
});
