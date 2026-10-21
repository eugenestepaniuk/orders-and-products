import { api, checkRequest, json } from '@/server/http';
import { SESSION_COOKIE, cookieOptions } from '@/server/auth';

export async function POST(request: Request): Promise<Response> {
  return api(async () => {
    checkRequest(request, { mutation: true });
    const response = json({ ok: true });
    response.headers.set(
      'Set-Cookie',
      `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${cookieOptions().secure ? '; Secure' : ''}`,
    );
    return response;
  });
}
