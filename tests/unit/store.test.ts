import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtures } from '../../database/fixtures.ts';
import {
  makeStore,
  orderSelected,
  productTypeChanged,
  refreshInventory,
  searchChanged,
  selectOrderSummaries,
  selectProductTypes,
  selectVisibleOrders,
  selectVisibleProducts,
} from '../../src/store/store.ts';

test('each request gets an isolated Redux store', () => {
  const first = makeStore(fixtures);
  const second = makeStore(fixtures);
  first.dispatch(searchChanged('Dell'));
  first.dispatch(orderSelected(1));
  assert.equal(second.getState().ui.search, '');
  assert.equal(second.getState().ui.selectedOrderId, null);
});

test('product filter combines type with case-insensitive title or serial search', () => {
  const store = makeStore(fixtures);
  store.dispatch(productTypeChanged('Monitors'));
  assert.equal(selectVisibleProducts(store.getState()).length, 4);
  store.dispatch(searchChanged('  dell  '));
  assert.deepEqual(
    selectVisibleProducts(store.getState()).map((product) => product.id),
    [1, 5],
  );
  store.dispatch(searchChanged('m-1003'));
  assert.deepEqual(
    selectVisibleProducts(store.getState()).map((product) => product.id),
    [5],
  );
  store.dispatch(searchChanged('unknown product'));
  assert.deepEqual(selectVisibleProducts(store.getState()), []);
  store.dispatch(searchChanged(''));
  store.dispatch(productTypeChanged(''));
  assert.equal(selectVisibleProducts(store.getState()).length, fixtures.products.length);
});

test('order search and type options come from the current inventory', () => {
  const store = makeStore(fixtures);
  store.dispatch(searchChanged('РЕЗЕРВНОЕ'));
  assert.deepEqual(
    selectVisibleOrders(store.getState()).map((order) => order.id),
    [3],
  );
  assert.deepEqual(selectProductTypes(store.getState()), ['Keyboards', 'Laptops', 'Monitors']);
  const state = store.getState();
  assert.equal(selectProductTypes(state), selectProductTypes(state));
});

test('order summaries are memoized and include zero totals for an empty order', () => {
  const store = makeStore(fixtures);
  const summaries = selectOrderSummaries(store.getState());
  assert.equal(summaries.get(1)?.products.length, 3);
  assert.deepEqual(summaries.get(4), {
    products: [],
    totals: [
      { currency: 'USD', amountMinor: 0 },
      { currency: 'UAH', amountMinor: 0 },
    ],
  });
  store.dispatch(searchChanged('Dell'));
  assert.equal(selectOrderSummaries(store.getState()), summaries);
});

test('a late HTTP response cannot overwrite newer inventory', () => {
  const store = makeStore(fixtures);
  const current = { orders: fixtures.orders.slice(0, 1), products: [] };
  store.dispatch(refreshInventory.pending('old-request', undefined));
  store.dispatch(refreshInventory.pending('new-request', undefined));
  store.dispatch(refreshInventory.fulfilled(current, 'new-request', undefined));
  store.dispatch(refreshInventory.fulfilled(fixtures, 'old-request', undefined));
  assert.deepEqual(store.getState().inventory.data, current);
  assert.equal(store.getState().inventory.status, 'ready');
});

test('failed refresh keeps the last inventory available for retry', () => {
  const store = makeStore(fixtures);
  store.dispatch(refreshInventory.pending('request', undefined));
  store.dispatch(refreshInventory.rejected(null, 'request', undefined, 'network_error'));
  assert.equal(store.getState().inventory.error, 'network_error');
  assert.equal(store.getState().inventory.data.products.length, fixtures.products.length);
});

test('refresh validates API data before replacing the store', async (context) => {
  const store = makeStore(fixtures);
  context.mock.method(globalThis, 'fetch', async () =>
    Response.json({ orders: [], products: [{ id: 'invalid' }] }),
  );
  await store.dispatch(refreshInventory());
  assert.equal(store.getState().inventory.error, 'unavailable');
  assert.equal(store.getState().inventory.data.products.length, fixtures.products.length);
});
