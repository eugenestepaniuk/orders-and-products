import { test as base } from '@playwright/test';
import { seed } from '../../scripts/seed.ts';
import { testPool } from '../support/database.ts';

export const test = base.extend<{ inventoryData: undefined }>({
  inventoryData: [
    async ({ baseURL }, use) => {
      if (!baseURL || !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) {
        throw new Error('Browser fixtures only reset the local test environment.');
      }
      const pool = testPool();
      try {
        await seed(pool, { username: 'qa-demo', password: 'public-qa-password', reset: true });
        await use(undefined);
      } finally {
        await pool.end();
      }
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
