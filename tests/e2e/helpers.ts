import { expect, type Page } from '@playwright/test';

export async function login(page: Page, useForm = false) {
  if (!useForm && process.env.E2E_SESSION_TOKEN) {
    await page.context().addCookies([
      {
        name: 'inventory_session',
        value: process.env.E2E_SESSION_TOKEN,
        url: process.env.E2E_BASE_URL || 'http://127.0.0.1:5173',
        httpOnly: true,
        sameSite: 'Strict',
      },
    ]);
    await page.goto('/en/orders');
  } else {
    await page.goto('/en/login');
    await page.getByLabel('Username', { exact: true }).fill('qa-demo');
    await page.getByLabel('Password', { exact: true }).fill('public-qa-password');
    const responsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/auth/login' &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    expect((await responsePromise).status()).toBe(200);
  }
  await expect(page).toHaveURL(/\/en\/orders$/);
  await expect(page.locator('.order-row')).toHaveCount(4);
  await expect(page.getByTestId('session-count')).toHaveText('1');
}
