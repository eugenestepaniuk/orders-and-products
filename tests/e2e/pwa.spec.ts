import { test, expect } from './fixtures';
import { login } from './helpers';

test('PWA has an install manifest and serves a safe offline fallback', async ({
  page,
  context,
}) => {
  await login(page);
  const manifest = await (await page.request.get('/manifest.webmanifest')).json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.length).toBeGreaterThan(0);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
          once: true,
        }),
      );
  });
  await page.goto('/en/products');
  await expect(page.locator('.product-row')).toHaveCount(8);
  const cachedUrls = await page.evaluate(async () => {
    const result: string[] = [];
    for (const key of await caches.keys()) {
      const cache = await caches.open(key);
      result.push(...(await cache.keys()).map((request) => new URL(request.url).pathname));
    }
    return result;
  });
  expect(cachedUrls).toContain('/offline.html');
  expect(cachedUrls.some((url) => url.startsWith('/api/') || /\/(ru|en)\//.test(url))).toBe(false);
  await context.setOffline(true);
  try {
    await page.goto('/en/orders');
    await expect(page.locator('h1')).toContainText('Нет подключения');
    await expect(page.locator('.order-row')).toHaveCount(0);
  } finally {
    await context.setOffline(false);
  }
});
