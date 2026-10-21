import { defineConfig } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:5173';
const slowServer = process.env.E2E_SLOW_SERVER === '1';
const origin = new URL(baseURL);
if (!['localhost', '127.0.0.1'].includes(origin.hostname)) {
  throw new Error('Browser tests only run against a local throwaway environment.');
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: slowServer ? 90_000 : 30_000,
  expect: { timeout: slowServer ? 30_000 : 10_000 },
  forbidOnly: Boolean(process.env.CI),
  outputDir: '.qa/playwright-results',
  reporter: [['list'], ['json', { outputFile: '.qa/playwright-report.json' }]],
  use: {
    baseURL,
    channel: 'chrome',
    headless: true,
    viewport: { width: 1440, height: 900 },
    locale: 'en-GB',
    timezoneId: 'Europe/Kyiv',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
