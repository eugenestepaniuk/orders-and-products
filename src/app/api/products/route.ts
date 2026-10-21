import { productInputSchema } from '@/shared/validation';
import { api, checkRequest, json, readJson, requireSession } from '@/server/http';
import { addProduct } from '@/server/inventory';

export async function POST(request: Request): Promise<Response> {
  return api(async () => {
    checkRequest(request, { mutation: true });
    await requireSession(request);
    return json({ id: await addProduct(await readJson(request, productInputSchema)) }, 201);
  });
}
