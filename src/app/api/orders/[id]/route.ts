import { api, ApiError, checkRequest, json, requireSession } from '@/server/http';
import { deleteOrder } from '@/server/inventory';

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return api(async () => {
    checkRequest(request, { mutation: true });
    await requireSession(request);
    const { id } = await context.params;
    if (!/^[1-9]\d{0,9}$/.test(id) || Number(id) > 4_294_967_295)
      throw new ApiError(400, 'invalid_request');
    await deleteOrder(Number(id));
    return json({ ok: true });
  });
}
