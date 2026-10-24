import assert from 'node:assert/strict';
import { test } from 'node:test';
import { codesMatch, generateCode, hashCode } from '../src/lib/otp';
import { passwordProblem } from '../src/lib/password';

const SECRET = 'test-secret';

test('codes are six digits, including leading zeros', () => {
  for (let i = 0; i < 200; i++) assert.match(generateCode(), /^\d{6}$/);
});

test('a code matches only its own user and purpose', () => {
  const hash = hashCode('123456', 'user-a', 'SIGN_IN', SECRET);
  assert.equal(codesMatch('123456', hash, 'user-a', 'SIGN_IN', SECRET), true);
  assert.equal(codesMatch('123457', hash, 'user-a', 'SIGN_IN', SECRET), false);
  assert.equal(codesMatch('123456', hash, 'user-b', 'SIGN_IN', SECRET), false);
  assert.equal(codesMatch('123456', hash, 'user-a', 'RESET_PASSWORD', SECRET), false);
  assert.equal(codesMatch('123456', hash, 'user-a', 'SIGN_IN', 'other-secret'), false);
});

test('stored hashes never contain the code', () => {
  assert.doesNotMatch(hashCode('424242', 'u', 'VERIFY_EMAIL', SECRET), /424242/);
});

test('password policy', () => {
  assert.match(passwordProblem('short', 'a@b.com')!, /at least 10/);
  assert.match(passwordProblem('nimsara-secret-1', 'nimsara@gmail.com')!, /email/);
  assert.match(passwordProblem('Perera-Gems-2026', 'x@y.com', 'Perera Ana')!, /name/);
  assert.match(passwordProblem('aaaaaaaaaaaa', 'x@y.com')!, /predictable/);
  assert.equal(passwordProblem('violet-harbour-lantern', 'ana@example.com', 'Ana Perera'), null);
});
