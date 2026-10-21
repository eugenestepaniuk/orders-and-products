import { test, expect } from './fixtures';
import { io } from 'socket.io-client';
import { login } from './helpers';

test('REST, GraphQL and WebSocket refuse unauthenticated access', async ({ request, baseURL }) => {
  expect((await request.get('/api/inventory')).status()).toBe(401);
  expect(
    (
      await request.post('/api/graphql', {
        headers: { Origin: baseURL! },
        data: { query: '{ summary { productCount } }' },
      })
    ).status(),
  ).toBe(401);
  expect((await request.delete('/api/orders/1', { headers: { Origin: baseURL! } })).status()).toBe(
    401,
  );
  const socket = io(baseURL!, {
    transports: ['websocket'],
    reconnection: false,
    extraHeaders: { Origin: baseURL! },
  });
  try {
    const failure = await new Promise<Error>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Socket authentication timed out')), 5000);
      socket.once('connect_error', (error) => {
        clearTimeout(timer);
        resolve(error);
      });
      socket.once('connect', () => {
        clearTimeout(timer);
        reject(new Error('Unauthenticated socket connected'));
      });
    });
    expect(failure.message).toBe('auth_required');
  } finally {
    socket.disconnect();
  }
});

test('API checks Origin, body size, identifiers and GraphQL query limits', async ({
  page,
  baseURL,
}) => {
  await login(page);
  const request = page.request;
  expect(
    (
      await request.post('/api/orders', {
        headers: { Origin: 'https://other.example' },
        data: { title: 'Rejected', date: '2026-10-19', description: '' },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post('/api/orders', {
        headers: { Origin: baseURL! },
        data: { title: 'a'.repeat(17_000), date: '2026-10-19', description: '' },
      })
    ).status(),
  ).toBe(413);
  expect((await request.delete('/api/orders/0', { headers: { Origin: baseURL! } })).status()).toBe(
    400,
  );
  expect(
    (
      await request.post('/api/graphql', {
        headers: { Origin: baseURL! },
        data: { query: '{ unknown }' },
      })
    ).status(),
  ).toBe(400);
  expect((await request.get('/api/inventory')).headers()['cache-control']).toBe('no-store');
});

test('each SSR response uses its own CSP nonce and active scripts receive it', async ({ page }) => {
  await login(page);
  const first = await page.request.get('/en/orders');
  const second = await page.request.get('/en/orders');
  const policy = first.headers()['content-security-policy'];
  expect(policy).toContain("script-src 'self' 'nonce-");
  expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  expect(policy).not.toBe(second.headers()['content-security-policy']);
  const nonces = await page.evaluate(() =>
    [...document.scripts]
      .filter((script) => !script.type || script.type === 'module')
      .map((script) => script.nonce),
  );
  expect(nonces.length).toBeGreaterThan(0);
  expect(nonces.every(Boolean)).toBe(true);
});

test('stored markup is displayed as text without executing it', async ({ page, baseURL }) => {
  await login(page);
  const title = '<img src=x onerror="window.inventoryXss=true">';
  const response = await page.request.post('/api/orders', {
    headers: { Origin: baseURL! },
    data: { title, date: '2026-10-19', description: '' },
  });
  expect(response.status()).toBe(201);
  const { id } = (await response.json()) as { id: number };
  try {
    await expect(page.locator('.order-row').filter({ hasText: title })).toBeVisible();
    expect(await page.evaluate(() => 'inventoryXss' in window)).toBe(false);
    expect(await page.locator('.order-row img').count()).toBe(0);
  } finally {
    expect(
      (await page.request.delete(`/api/orders/${id}`, { headers: { Origin: baseURL! } })).status(),
    ).toBe(200);
  }
});
