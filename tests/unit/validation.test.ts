import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  inventorySchema,
  loginSchema,
  orderInputSchema,
  productInputSchema,
} from '../../src/shared/validation.ts';
import { fixtures } from '../../database/fixtures.ts';

const product = {
  orderId: 1,
  title: 'Office monitor',
  type: 'Monitors',
  serialNumber: 'SN-1',
  isNew: true,
  warrantyStart: '2026-02-01',
  warrantyEnd: '2027-02-01',
  usdMinor: 10029,
  uahMinor: 420001,
};

test('order input trims text and accepts leap days', () => {
  assert.deepEqual(
    orderInputSchema.parse({ title: '  Order  ', description: '  Notes  ', date: '2028-02-29' }),
    {
      title: 'Order',
      description: 'Notes',
      date: '2028-02-29',
    },
  );
  for (const date of ['2026-02-29', '2026-13-01', '2026-02-30', '29/06/2017']) {
    assert.equal(
      orderInputSchema.safeParse({ title: 'Order', description: '', date }).success,
      false,
      date,
    );
  }
});

test('forms reject blank titles, oversized values and unexpected properties', () => {
  assert.equal(
    orderInputSchema.safeParse({ title: ' ', description: '', date: '2026-02-01' }).success,
    false,
  );
  assert.equal(
    orderInputSchema.safeParse({ title: 'x'.repeat(161), description: '', date: '2026-02-01' })
      .success,
    false,
  );
  assert.equal(
    loginSchema.safeParse({ username: 'demo', password: 'test', role: 'admin' }).success,
    false,
  );
  assert.equal(
    loginSchema.safeParse({ username: 'demo', password: 'x'.repeat(129) }).success,
    false,
  );
});

test('product prices must be nonnegative integer minor units', () => {
  assert.equal(productInputSchema.safeParse(product).success, true);
  for (const usdMinor of [-1, 0.5, NaN, Infinity, 100_000_000_001]) {
    assert.equal(
      productInputSchema.safeParse({ ...product, usdMinor }).success,
      false,
      String(usdMinor),
    );
  }
  assert.equal(
    productInputSchema.safeParse({ ...product, usdMinor: 0, uahMinor: 0 }).success,
    true,
  );
});

test('warranty cannot end before it starts; same-day warranty is valid', () => {
  const result = productInputSchema.safeParse({ ...product, warrantyEnd: '2026-01-31' });
  assert.equal(result.success, false);
  if (!result.success) assert.deepEqual(result.error.issues[0].path, ['warrantyEnd']);
  assert.equal(
    productInputSchema.safeParse({ ...product, warrantyEnd: product.warrantyStart }).success,
    true,
  );
  for (const orderId of [0, -1, 1.5])
    assert.equal(productInputSchema.safeParse({ ...product, orderId }).success, false);
});

test('demo inventory contains valid prices and explicit order relationships', () => {
  assert.equal(inventorySchema.safeParse(fixtures).success, true);
  const ids = new Set(fixtures.orders.map((order) => order.id));
  for (const item of fixtures.products) {
    assert.ok(ids.has(item.orderId));
    assert.deepEqual(item.prices.map((price) => price.currency).sort(), ['UAH', 'USD']);
  }
  assert.equal(
    fixtures.products.some((item) => item.orderId === 4),
    false,
  );
});
