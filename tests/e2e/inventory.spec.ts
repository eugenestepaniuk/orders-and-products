import { test, expect } from './fixtures';
import { login } from './helpers';

test('login validates input, rejects bad credentials and hydrates the inventory', async ({
  page,
  context,
}) => {
  await page.goto('/en/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByLabel('Username', { exact: true })).toBeFocused();
  await page.getByLabel('Username', { exact: true }).fill('qa-demo');
  await page.getByLabel('Password', { exact: true }).fill('incorrect');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText(
    'Incorrect username or password.',
  );
  await login(page, true);
  const session = (await context.cookies()).find((cookie) => cookie.name === 'inventory_session');
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe('Strict');
  expect(await page.evaluate(() => Object.keys(localStorage))).not.toContain('inventory_session');
  const response = await page.request.get('/en/orders');
  expect(await response.text()).toContain(
    'class="order-row__title">Поставка оборудования для рабочих мест',
  );
  const clock = page.locator('.top-menu__time');
  const before = await clock.textContent();
  await expect(clock).not.toHaveText(before || '', { timeout: 2500 });
});

test('an order opens beside the list, shows its own products and closes with focus restored', async ({
  page,
}) => {
  await login(page);
  const order = page.getByRole('button', {
    name: 'Open order: Поставка оборудования для рабочих мест',
    exact: true,
  });
  await order.click();
  const details = page.getByRole('complementary', { name: 'Selected order' });
  await expect(details).toBeVisible();
  await expect(details.locator('.detail-products__row')).toHaveCount(3);
  await expect(details).toContainText('Dell UltraSharp');
  await expect(details).not.toContainText('HP EliteBook');
  await details.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(details).toHaveCount(0);
  await expect(order).toBeFocused();
  await page.getByRole('button', { name: 'Open order: Приход без продуктов', exact: true }).click();
  await expect(page.locator('.order-details')).toContainText('No products found');
});

test('type filter persists after reload and search combines with it', async ({ page }) => {
  await login(page);
  await page.locator('nav').getByRole('link', { name: 'Products', exact: true }).click();
  await expect(page.locator('.product-row')).toHaveCount(8);
  await page.getByLabel('Type', { exact: true }).selectOption('Monitors');
  await expect(page.locator('.product-row')).toHaveCount(4);
  await page.reload();
  await expect(page.getByLabel('Type', { exact: true })).toHaveValue('Monitors');
  await expect(page.locator('.product-row')).toHaveCount(4);
  await page.getByLabel('Search inventory').fill('m-1003');
  await expect(page.locator('.product-row')).toHaveCount(1);
  await expect(page.locator('.product-row')).toContainText('Dell Professional');
  await page.getByLabel('Search inventory').fill('no such product');
  await expect(page.getByRole('heading', { name: 'No products found' })).toBeVisible();
  await page.getByLabel('Search inventory').fill('');
  await page.getByLabel('Type', { exact: true }).selectOption('');
  await expect(page.locator('.product-row')).toHaveCount(8);
});

test('two tabs share the session counter and receive committed inventory changes', async ({
  page,
  context,
}) => {
  await login(page);
  const second = await context.newPage();
  await second.goto('/en/orders');
  await expect(page.getByTestId('session-count')).toHaveText('2');
  await expect(second.getByTestId('session-count')).toHaveText('2');

  await page.getByRole('button', { name: 'Add order', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog.getByLabel('Title', { exact: true })).toBeFocused();
  await dialog.getByLabel('Title', { exact: true }).fill('QA temporary order');
  await dialog.getByLabel('Date', { exact: true }).fill('2026-10-19');
  await dialog.getByLabel('Description', { exact: true }).fill('Removed in the same test.');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.order-row')).toHaveCount(5);
  await expect(second.locator('.order-row')).toHaveCount(5);

  await page.getByRole('button', { name: 'Open order: QA temporary order', exact: true }).click();
  await page
    .locator('.order-details')
    .getByRole('button', { name: 'Add product', exact: true })
    .click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Title', { exact: true }).fill('QA temporary product');
  await dialog.getByLabel('Type', { exact: true }).fill('Monitors');
  await dialog.getByLabel('Serial number', { exact: true }).fill('QA-TEMP-1');
  await dialog.getByLabel('Warranty starts').fill('2026-10-19');
  await dialog.getByLabel('Warranty ends').fill('2026-10-18');
  await dialog.getByLabel('Price, USD', { exact: true }).fill('12.29');
  await dialog.getByLabel('Price, UAH', { exact: true }).fill('490.21');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog.getByText('End date must be on or after the start date.')).toBeVisible();
  await dialog.getByLabel('Warranty ends').fill('2027-10-19');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.order-details')).toContainText('QA temporary product');
  await page.locator('.order-details').getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.locator('.order-details')).toHaveCount(0);
  await expect(
    page.locator('.order-row').filter({ hasText: 'QA temporary order' }).locator('.prices'),
  ).toBeVisible();
  await expect(page.locator('.order-row').filter({ hasText: 'QA temporary order' })).toContainText(
    '12.29',
  );

  const deleteButton = page.getByRole('button', {
    name: 'Delete: QA temporary order',
    exact: true,
  });
  await deleteButton.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  await expect(deleteButton).toBeVisible();
  await deleteButton.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.locator('.order-row')).toHaveCount(4);
  await expect(second.locator('.order-row')).toHaveCount(4);
  await second.close();
  await expect(page.getByTestId('session-count')).toHaveText('1');
});

test('analytics runs the worker, loads the map on demand and switches language', async ({
  page,
}) => {
  await login(page);
  const workers: string[] = [];
  page.on('worker', (worker) => workers.push(worker.url()));
  await page.locator('nav').getByRole('link', { name: 'Analytics', exact: true }).click();
  await expect(page.locator('.analytics-table tbody tr')).toHaveCount(3);
  await expect(page.locator('.analytics-card__metric strong')).toHaveText(['4', '8']);
  expect(workers.some((url) => url.endsWith('/workers/analytics.js'))).toBe(true);
  await expect(page.locator('.leaflet-container')).toHaveCount(0);
  await page.getByRole('button', { name: 'Load interactive map' }).click();
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await expect(page.locator('.leaflet-interactive')).toHaveCount(2);
  await page.getByRole('link', { name: 'Language', exact: true }).click();
  await expect(page).toHaveURL(/\/ru\/analytics$/);
  await expect(page.getByRole('heading', { name: 'Обзор инвентаря' })).toBeVisible();
});

test('mobile navigation traps focus and Escape closes it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.getByRole('button', { name: 'Open navigation' }).click();
  const navigation = page.getByRole('dialog', { name: 'Navigation' });
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Orders', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(navigation.getByRole('button', { name: 'Sign out', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeFocused();
  await expect(navigation).toHaveCount(0);
});

test('a failed refresh keeps inventory, supports retry and logout ends API access', async ({
  page,
}) => {
  await login(page);
  await page.route('**/api/inventory', (route) => route.abort('failed'));
  await page.reload();
  await expect(
    page
      .getByRole('main')
      .getByRole('alert')
      .filter({ hasText: 'Could not connect to the server.' }),
  ).toBeVisible();
  await expect(page.locator('.order-row')).toHaveCount(4);
  await page.unroute('**/api/inventory');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/login$/);
  expect((await page.request.get('/api/inventory')).status()).toBe(401);
});
