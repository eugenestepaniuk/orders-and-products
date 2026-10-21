import { buildSchema, execute, parse, specifiedRules, validate, visit } from 'graphql';
import { sumPrices } from '../shared/format.ts';
import { getInventory } from './inventory.ts';

export const schema = buildSchema(`
  type Total { currency: String!, amountMinor: Float! }
  type Summary { orderCount: Int!, productCount: Int!, totals: [Total!]! }
  type Query { summary: Summary! }
`);

export async function executeSummary(query: string, variables?: Record<string, unknown>) {
  let document;
  try {
    document = parse(query, { maxTokens: 1000 });
  } catch {
    return { status: 400, body: { errors: [{ message: 'Invalid GraphQL document.' }] } };
  }
  let fields = 0;
  visit(document, {
    Field() {
      fields += 1;
    },
  });
  if (
    fields > 30 ||
    document.definitions.filter((node) => node.kind === 'OperationDefinition').length !== 1
  ) {
    return { status: 400, body: { errors: [{ message: 'Query exceeds the supported limits.' }] } };
  }
  const errors = validate(schema, document, specifiedRules, { maxErrors: 5 });
  if (errors.length)
    return { status: 400, body: { errors: errors.map((error) => ({ message: error.message })) } };

  let inventory: ReturnType<typeof getInventory> | undefined;
  const result = await execute({
    schema,
    document,
    variableValues: variables,
    rootValue: {
      summary: async () => {
        const data = await (inventory ??= getInventory());
        return {
          orderCount: data.orders.length,
          productCount: data.products.length,
          totals: sumPrices(data.products),
        };
      },
    },
  });
  if (result.errors?.length) {
    return { status: 503, body: { errors: [{ message: 'Unable to load inventory totals.' }] } };
  }
  return { status: 200, body: { data: result.data } };
}
