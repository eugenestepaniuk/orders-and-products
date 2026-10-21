import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  formatDate,
  formatMoney,
  formatWarrantyDate,
  parseMoney,
  sumPrices,
} from '../../src/shared/format.ts';
import { fixtures } from '../../database/fixtures.ts';

test('decimal input becomes exact minor units without rounding', () => {
  for (const [input, expected] of [
    ['0', 0],
    ['0.29', 29],
    [' 19,9 ', 1990],
    ['650.50', 65050],
    ['999999999.99', 99999999999],
  ] as const) {
    assert.equal(parseMoney(input), expected, input);
  }
  for (const input of [
    '',
    '-1',
    '1.001',
    '1e3',
    'Infinity',
    '.50',
    '10 000',
    '1,2.3',
    '1000000000',
  ]) {
    assert.equal(parseMoney(input), null, input);
  }
});

test('order totals use only its products and keep currencies independent', () => {
  const products = fixtures.products.filter((product) => product.orderId === 1);
  assert.equal(products.length, 3);
  assert.deepEqual(sumPrices(products), [
    { currency: 'USD', amountMinor: 76550 },
    { currency: 'UAH', amountMinor: 1990300 },
  ]);
  assert.deepEqual(sumPrices([]), [
    { currency: 'USD', amountMinor: 0 },
    { currency: 'UAH', amountMinor: 0 },
  ]);
});

test('adding small prices preserves every cent', () => {
  assert.deepEqual(
    sumPrices([
      {
        prices: [
          { currency: 'USD', amountMinor: 10 },
          { currency: 'UAH', amountMinor: 99 },
        ],
      },
      {
        prices: [
          { currency: 'USD', amountMinor: 20 },
          { currency: 'UAH', amountMinor: 1 },
        ],
      },
    ]),
    [
      { currency: 'USD', amountMinor: 30 },
      { currency: 'UAH', amountMinor: 100 },
    ],
  );
});

test('date formats are distinct, include warranty years and use UTC', () => {
  assert.equal(formatDate('2017-06-29T23:59:00.000Z', 'en'), '29 Jun 2017');
  assert.equal(formatDate('2017-06-29T23:59:00.000Z', 'en', true), '29/06');
  assert.equal(formatWarrantyDate('2025-06-29', 'en'), '29/06/2025');
  assert.match(formatDate('2017-06-29', 'ru'), /2017/);
  assert.match(formatMoney(65050, 'USD', 'en'), /650\.50/);
  assert.match(formatMoney(65050, 'UAH', 'ru'), /650,50/);
});
