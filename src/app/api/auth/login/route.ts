import { loginSchema } from '@/shared/validation';
import { api, ApiError, checkRequest, json, readJson } from '@/server/http';
import { getPool, type UserRow } from '@/server/db';
import { createToken, verifyPassword, SESSION_COOKIE, cookieOptions } from '@/server/auth';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  return api(async () => {
    checkRequest(request, { mutation: true, login: true });
    const input = await readJson(request, loginSchema);
    const [users] = await getPool().execute<UserRow[]>(
      'SELECT id, username, password_hash FROM users WHERE username = ? LIMIT 1',
      [input.username],
    );
    const user = users[0];
    const dummy = `${'0'.repeat(32)}:${'0'.repeat(128)}`;
    const valid = await verifyPassword(input.password, user?.password_hash ?? dummy);
    if (!user || !valid) throw new ApiError(401, 'invalid_credentials');
    const token = await createToken(user);
    const response = json({ username: user.username });
    const options = cookieOptions();
    response.headers.set(
      'Set-Cookie',
      `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${options.maxAge}${options.secure ? '; Secure' : ''}`,
    );
    return response;
  });
}
