import { api, checkRequest, json, requireSession } from '@/server/http';
import { getInventory } from '@/server/inventory';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  return api(async () => {
    checkRequest(request);
    await requireSession(request);
    return json(await getInventory());
  });
}
