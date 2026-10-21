import assert from 'node:assert/strict';
import { test } from 'node:test';
import { groupProducts } from '../../public/workers/analytics.js';
import { executeSummary } from '../../src/server/graphql.ts';
import { fixtures } from '../../database/fixtures.ts';

test('chart worker groups inventory by type without changing its input', () => {
  const input = fixtures.products.map(({ type }) => ({ type }));
  const original = structuredClone(input);
  assert.deepEqual(groupProducts(input), [
    { type: 'Monitors', count: 4 },
    { type: 'Keyboards', count: 2 },
    { type: 'Laptops', count: 2 },
  ]);
  assert.deepEqual(input, original);
  assert.deepEqual(groupProducts([]), []);
});

test('GraphQL rejects invalid and oversized queries before database access', async () => {
  for (const query of [
    '{',
    '{ unknown }',
    'query A { __typename } query B { __typename }',
    `{ ${Array.from({ length: 31 }, (_, index) => `f${index}: __typename`).join(' ')} }`,
  ]) {
    const result = await executeSummary(query);
    assert.equal(result.status, 400, query);
    assert.ok('errors' in result.body);
  }
});

test('GraphQL only loads data when a query actually requests the summary', async () => {
  const result = await executeSummary('{ __typename }');
  assert.equal(result.status, 200);
  assert.equal('data' in result.body && result.body.data?.__typename, 'Query');
});
