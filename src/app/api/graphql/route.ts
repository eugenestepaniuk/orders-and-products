import { z } from 'zod';
import { api, checkRequest, json, readJson, requireSession } from '@/server/http';
import { executeSummary } from '@/server/graphql';

const inputSchema = z
  .object({
    query: z.string().min(1).max(5000),
    variables: z
      .record(z.string().max(80), z.union([z.string().max(200), z.number(), z.boolean(), z.null()]))
      .optional(),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  return api(async () => {
    checkRequest(request, { mutation: true });
    await requireSession(request);
    const { query, variables } = await readJson(request, inputSchema);
    const result = await executeSummary(query, variables);
    return json(result.body, result.status);
  });
}
