import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { appOrigin, databaseTlsOptions, jwtKey } from '../../src/server/config.ts';
import { createPool } from '../../src/server/db.ts';

const previousOrigin = process.env.APP_ORIGIN;
const previousKey = process.env.JWT_SECRET;
const previousEnvironment = Object.fromEntries(
  ['RENDER_EXTERNAL_URL', 'DATABASE_SSL_MODE', 'DATABASE_SSL_CA'].map((key) => [
    key,
    process.env[key],
  ]),
);
after(() => {
  if (previousOrigin === undefined) delete process.env.APP_ORIGIN;
  else process.env.APP_ORIGIN = previousOrigin;
  if (previousKey === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousKey;
  for (const [key, value] of Object.entries(previousEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('application origin rejects paths, credentials and non-HTTP protocols', () => {
  for (const value of [
    'invalid',
    'file:///tmp',
    'https://example.test/path',
    'https://user:password@example.test',
    'https://example.test?query=1',
    'https://example.test#fragment',
  ]) {
    process.env.APP_ORIGIN = value;
    assert.throws(appOrigin, { message: 'APP_ORIGIN must be an HTTP origin.' });
  }
  process.env.APP_ORIGIN = 'https://example.test:8443';
  assert.equal(appOrigin(), 'https://example.test:8443');
});

test('database configuration errors never include the supplied URL', () => {
  for (const value of [
    'not a database URL',
    'mysql://demo:private-test-value@host/db/bad',
    'mysql://demo:%XX@host/database',
  ]) {
    assert.throws(
      () => createPool(value),
      (error) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, 'Invalid database configuration.');
        assert.equal('input' in error, false);
        assert.equal(String(error).includes(value), false);
        return true;
      },
    );
  }
});

test('the platform origin is validated and an explicit origin takes precedence', () => {
  delete process.env.APP_ORIGIN;
  process.env.RENDER_EXTERNAL_URL = 'https://inventory-demo.onrender.com';
  assert.equal(appOrigin(), 'https://inventory-demo.onrender.com');
  process.env.APP_ORIGIN = 'https://inventory.example';
  assert.equal(appOrigin(), 'https://inventory.example');
  delete process.env.APP_ORIGIN;
  process.env.RENDER_EXTERNAL_URL = 'https://inventory-demo.onrender.com/private';
  assert.throws(appOrigin, { message: 'APP_ORIGIN must be an HTTP origin.' });
});

test('hosted database TLS requires a CA and cannot disable identity verification', () => {
  delete process.env.DATABASE_SSL_MODE;
  delete process.env.DATABASE_SSL_CA;
  assert.equal(databaseTlsOptions(), undefined);
  process.env.DATABASE_SSL_MODE = 'verify';
  assert.throws(databaseTlsOptions, /Missing environment variable: DATABASE_SSL_CA/);
  process.env.DATABASE_SSL_CA = 'synthetic-test-ca\\nline-two';
  assert.deepEqual(databaseTlsOptions(), {
    ca: 'synthetic-test-ca\nline-two',
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true,
    verifyIdentity: true,
  });
  process.env.DATABASE_SSL_MODE = 'insecure';
  assert.throws(databaseTlsOptions, { message: 'DATABASE_SSL_MODE must be disabled or verify.' });
});

test('a missing or short JWT signing key prevents startup', () => {
  delete process.env.JWT_SECRET;
  assert.throws(jwtKey, /Missing environment variable: JWT_SECRET/);
  process.env.JWT_SECRET = 'short';
  assert.throws(jwtKey, /at least 32 bytes/);
});
