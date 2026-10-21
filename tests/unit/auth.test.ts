import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { SignJWT } from 'jose';
import {
  cookieOptions,
  createToken,
  hashPassword,
  readSessionCookie,
  SESSION_COOKIE,
  SESSION_SECONDS,
  verifyPassword,
  verifyToken,
} from '../../src/server/auth.ts';
import { jwtKey } from '../../src/server/config.ts';

const previousKey = process.env.JWT_SECRET;
const previousOrigin = process.env.APP_ORIGIN;
process.env.JWT_SECRET = 'public-unit-test-key-not-for-any-real-deployment';
process.env.APP_ORIGIN = 'https://inventory.example';
after(() => {
  if (previousKey === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousKey;
  if (previousOrigin === undefined) delete process.env.APP_ORIGIN;
  else process.env.APP_ORIGIN = previousOrigin;
});

test('password hashes have independent salts and reject incorrect passwords', async () => {
  const password = 'public-test-password';
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword('incorrect', first), false);
  for (const invalid of ['', 'salt:hash', `${first}:extra`]) {
    assert.equal(await verifyPassword(password, invalid), false);
  }
});

test('JWT verifies issuer, audience, signature and expiry', async () => {
  const user = { id: 'test-user', username: 'demo' };
  const token = await createToken(user);
  const session = await verifyToken(token);
  assert.equal(session?.userId, user.id);
  assert.equal(session?.username, user.username);
  assert.ok(session && session.expiresAt > Date.now());
  assert.ok(session && session.expiresAt <= Date.now() + SESSION_SECONDS * 1000);
  assert.equal(await verifyToken(), null);
  assert.equal(await verifyToken(`${token.slice(0, -8)}modified`), null);

  for (const claims of [
    { issuer: 'wrong-issuer', audience: 'inventory-ui', expires: '1h' },
    { issuer: 'orders-and-products', audience: 'wrong-audience', expires: '1h' },
    { issuer: 'orders-and-products', audience: 'inventory-ui', expires: '-1s' },
  ]) {
    const invalid = await new SignJWT({ username: user.username })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuer(claims.issuer)
      .setAudience(claims.audience)
      .setExpirationTime(claims.expires)
      .sign(jwtKey());
    assert.equal(await verifyToken(invalid), null);
  }
});

test('cookie is HttpOnly, same-site and secure over HTTPS', () => {
  assert.deepEqual(cookieOptions(), {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_SECONDS,
  });
  assert.equal(
    readSessionCookie(`unrelated=value; ${SESSION_COOKIE}=signed-token; other=1`),
    'signed-token',
  );
  assert.equal(readSessionCookie(`prefix_${SESSION_COOKIE}=wrong`), undefined);
  assert.equal(readSessionCookie(null), undefined);
});
