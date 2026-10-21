import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import type { RowDataPacket } from 'mysql2/promise';
import { migrate } from '../../scripts/migrate.ts';
import { seed } from '../../scripts/seed.ts';
import { closePool, getPool } from '../../src/server/db.ts';
import { getInventory, addOrder, addProduct, deleteOrder } from '../../src/server/inventory.ts';
import { ApiError } from '../../src/server/http.ts';
import { eventBus } from '../../src/server/events.ts';
import { executeSummary } from '../../src/server/graphql.ts';
import { sumPrices } from '../../src/shared/format.ts';
import type { InventoryEvent } from '../../src/shared/types.ts';
import { testDatabaseUrl } from '../support/database.ts';

process.env.DATABASE_URL = testDatabaseUrl();
const credentials = {
  username: 'integration-demo',
  password: 'public-integration-password',
  reset: true,
};
before(async () => {
  await migrate(getPool());
  await migrate(getPool());
});
beforeEach(async () => {
  await seed(getPool(), credentials);
});
after(async () => {
  await closePool();
});

test('MySQL round trip preserves relationships, minor units and UTC dates', async () => {
  const data = await getInventory();
  assert.equal(data.orders.length, 4);
  assert.equal(data.products.length, 8);
  assert.deepEqual(
    data.orders.map((order) => order.id),
    [4, 3, 2, 1],
  );
  assert.equal(
    data.products
      .find((product) => product.id === 3)
      ?.prices.find((price) => price.currency === 'USD')?.amountMinor,
    65050,
  );
  assert.equal(data.products[0].warrantyEnd, '2025-06-29');
  assert.equal(data.orders.find((order) => order.id === 1)?.createdAt, '2017-06-29T12:09:33.000Z');
});

test('successful writes publish domain events after data is committed', async () => {
  const events: InventoryEvent[] = [];
  const listener = (event: InventoryEvent) => events.push(event);
  eventBus().on('inventory:changed', listener);
  try {
    const orderId = await addOrder({
      title: 'Integration order',
      date: '2026-10-19',
      description: 'Temporary test record',
    });
    const productId = await addProduct({
      orderId,
      title: 'Integration product',
      type: 'Monitors',
      serialNumber: 'TEST-1',
      isNew: true,
      warrantyStart: '2026-10-19',
      warrantyEnd: '2027-10-19',
      usdMinor: 29,
      uahMinor: 1049,
    });
    const data = await getInventory();
    assert.deepEqual(sumPrices(data.products.filter((product) => product.orderId === orderId)), [
      { currency: 'USD', amountMinor: 29 },
      { currency: 'UAH', amountMinor: 1049 },
    ]);
    assert.deepEqual(events, [
      { type: 'order.created', resourceId: orderId },
      { type: 'product.created', resourceId: productId },
    ]);
  } finally {
    eventBus().off('inventory:changed', listener);
  }
});

test('deleting an order cascades to its products and both currency rows', async () => {
  await deleteOrder(1);
  const data = await getInventory();
  assert.equal(
    data.orders.some((order) => order.id === 1),
    false,
  );
  assert.equal(
    data.products.some((product) => product.orderId === 1),
    false,
  );
  assert.equal(data.products.length, 5);
  const [rows] = await getPool().query<RowDataPacket[]>(
    'SELECT COUNT(*) AS count FROM product_prices WHERE product_id IN (1, 3, 4)',
  );
  assert.equal(Number(rows[0].count), 0);
  await assert.rejects(
    deleteOrder(1),
    (error) => error instanceof ApiError && error.status === 404,
  );
});

test('a failed product transaction leaves no half-saved product or event', async () => {
  const events: InventoryEvent[] = [];
  const listener = (event: InventoryEvent) => events.push(event);
  eventBus().on('inventory:changed', listener);
  const product = {
    orderId: 1,
    title: 'Must roll back',
    type: 'Monitors',
    serialNumber: 'ROLLBACK',
    isNew: true,
    warrantyStart: '2026-10-19',
    warrantyEnd: '2027-10-19',
    usdMinor: 100_000_000_001,
    uahMinor: 1,
  };
  try {
    await assert.rejects(addProduct(product));
    assert.equal((await getInventory()).products.length, 8);
    assert.deepEqual(events, []);
    await assert.rejects(
      addProduct({ ...product, usdMinor: 1, orderId: 4_294_967_295 }),
      (error) => error instanceof ApiError && error.status === 404,
    );
    assert.deepEqual(events, []);
  } finally {
    eventBus().off('inventory:changed', listener);
  }
});

test('parameterized SQL stores markup and SQL syntax as ordinary text', async () => {
  const title = "<img src=x onerror=alert(1)> '; DROP TABLE orders; --";
  const id = await addOrder({ title, description: '', date: '2026-10-19' });
  const data = await getInventory();
  assert.equal(data.orders.find((order) => order.id === id)?.title, title);
  assert.equal(data.orders.length, 5);
});

test('GraphQL summary agrees with the relational inventory and stored currencies', async () => {
  const result = await executeSummary(
    '{ summary { orderCount productCount totals { currency amountMinor } } }',
  );
  assert.equal(result.status, 200);
  const data = await getInventory();
  assert.deepEqual(JSON.parse(JSON.stringify(result.body)), {
    data: { summary: { orderCount: 4, productCount: 8, totals: sumPrices(data.products) } },
  });
});

test('seeding preserves existing or intentionally empty inventory without duplicate accounts', async () => {
  const id = await addOrder({ title: 'Keep my data', description: '', date: '2026-10-19' });
  await seed(getPool(), { ...credentials, reset: false });
  assert.ok((await getInventory()).orders.some((order) => order.id === id));
  const [rows] = await getPool().execute<RowDataPacket[]>(
    'SELECT COUNT(*) AS count FROM users WHERE username = ?',
    [credentials.username],
  );
  assert.equal(Number(rows[0].count), 1);
  await getPool().query('DELETE FROM orders');
  await seed(getPool(), { ...credentials, reset: false });
  assert.deepEqual((await getInventory()).orders, []);
  assert.deepEqual((await getInventory()).products, []);
});
