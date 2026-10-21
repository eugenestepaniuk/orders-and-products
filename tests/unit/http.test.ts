import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { z } from 'zod';
import {
  api,
  ApiError,
  checkRequest,
  readJson,
  requireSession,
  takeRateLimit,
} from '../../src/server/http.ts';

const previousOrigin = process.env.APP_ORIGIN;
process.env.APP_ORIGIN = 'http://localhost:3000';
beforeEach(() => globalThis.inventoryLimits?.clear());
after(() => {
  globalThis.inventoryLimits?.clear();
  if (previousOrigin === undefined) delete process.env.APP_ORIGIN;
  else process.env.APP_ORIGIN = previousOrigin;
});
const schema = z.object({ title: z.string().trim().min(1) }).strict();
const request = (body: BodyInit, headers: Record<string, string> = {}) =>
  new Request('http://localhost:3000/api/orders', {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
const hasStatus = (status: number) => (error: unknown) =>
  error instanceof ApiError && error.status === status;

test('HTTP input accepts JSON only and applies the shared schema', async () => {
  assert.deepEqual(await readJson(request('{"title":"  Order  "}'), schema), { title: 'Order' });
  await assert.rejects(
    readJson(request('title=Order', { 'Content-Type': 'text/plain' }), schema),
    hasStatus(415),
  );
  await assert.rejects(readJson(request('{'), schema), hasStatus(400));
  await assert.rejects(readJson(request('{"title":" "}'), schema), hasStatus(400));
  await assert.rejects(readJson(request('{"title":"Order","admin":true}'), schema), hasStatus(400));
});

test('body size is bounded by actual bytes, including chunked requests', async () => {
  await assert.rejects(
    readJson(
      request(JSON.stringify({ title: 'a'.repeat(16_384) }), { 'Content-Length': '1' }),
      schema,
    ),
    hasStatus(413),
  );
  let cancelled = false;
  const stream = new ReadableStream({
    pull(controller) {
      controller.enqueue(new Uint8Array(4096));
    },
    cancel() {
      cancelled = true;
    },
  });
  const streamed = new Request('http://localhost:3000/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: stream,
    duplex: 'half',
  } as RequestInit);
  await assert.rejects(readJson(streamed, schema), hasStatus(413));
  assert.equal(cancelled, true);
});

test('malformed UTF-8 cannot become accepted JSON', async () => {
  await assert.rejects(
    readJson(request(new Uint8Array([0xff, 0xfe, 0x7b])), schema),
    hasStatus(400),
  );
});

test('mutations require the configured same origin', () => {
  for (const origin of ['https://other.example', 'null', '']) {
    assert.throws(
      () => checkRequest(request('{}', { Origin: origin }), { mutation: true }),
      hasStatus(403),
    );
  }
  assert.doesNotThrow(() =>
    checkRequest(request('{}', { Origin: 'http://localhost:3000' }), { mutation: true }),
  );
});

test('rate limits reset after the window and separate login from ordinary requests', (context) => {
  context.mock.timers.enable({ apis: ['Date'], now: 1000 });
  assert.equal(takeRateLimit('a', 2, 100), true);
  assert.equal(takeRateLimit('a', 2, 100), true);
  assert.equal(takeRateLimit('a', 2, 100), false);
  assert.equal(takeRateLimit('b', 2, 100), true);
  context.mock.timers.tick(100);
  assert.equal(takeRateLimit('a', 2, 100), true);
  const login = request('{}', {
    Origin: 'http://localhost:3000',
    'x-inventory-client-ip': 'test-ip',
  });
  for (let index = 0; index < 8; index += 1) checkRequest(login, { login: true, mutation: true });
  assert.throws(() => checkRequest(login, { login: true, mutation: true }), hasStatus(429));
  assert.doesNotThrow(() => checkRequest(login));
});

test('protected requests reject missing or malformed sessions', async () => {
  await assert.rejects(requireSession(request('{}')), hasStatus(401));
  await assert.rejects(
    requireSession(request('{}', { Cookie: 'inventory_session=invalid' })),
    hasStatus(401),
  );
});

test('API errors have stable codes and never expose internal failure messages', async (context) => {
  const logs = context.mock.method(console, 'error', () => undefined);
  const unavailable = await api(async () => {
    throw new Error('private internal database details');
  });
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await unavailable.json(), { code: 'unavailable' });
  assert.equal(
    JSON.stringify(logs.mock.calls).includes('private internal database details'),
    false,
  );
  const missing = await api(async () => {
    throw new ApiError(404, 'not_found');
  });
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { code: 'not_found' });
});
