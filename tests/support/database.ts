import { createPool } from '../../src/server/db.ts';

export function testDatabaseUrl(): string {
  const value = process.env.TEST_DATABASE_URL;
  if (!value) throw new Error('TEST_DATABASE_URL is required. Use the throwaway test-db service.');
  const url = new URL(value);
  if (
    url.protocol !== 'mysql:' ||
    !['localhost', '127.0.0.1', 'test-db'].includes(url.hostname) ||
    url.pathname !== '/inventory_test' ||
    url.username !== 'inventory_test'
  ) {
    throw new Error(
      'Tests can only reset the local inventory_test database with the inventory_test user.',
    );
  }
  return value;
}

export function testPool() {
  return createPool(testDatabaseUrl());
}
