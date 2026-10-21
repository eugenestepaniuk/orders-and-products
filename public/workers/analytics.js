/** @param {{type: string}[]} products */
export function groupProducts(products) {
  const counts = new Map();
  for (const product of products) counts.set(product.type, (counts.get(product.type) || 0) + 1);
  return [...counts]
    .map(([type, count]) => ({ type, count }))
    .sort((left, right) => right.count - left.count || left.type.localeCompare(right.type));
}

if (typeof self !== 'undefined' && typeof document === 'undefined') {
  self.addEventListener('message', (event) => {
    const { requestId, products } = event.data;
    self.postMessage({ requestId, groups: groupProducts(products) });
  });
}
