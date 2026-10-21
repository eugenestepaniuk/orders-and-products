import { api, json } from '@/server/http';
import { getPool } from '@/server/db';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  return api(async () => {
    await getPool().query('SELECT 1');
    return json({ status: 'ok' });
  });
}
