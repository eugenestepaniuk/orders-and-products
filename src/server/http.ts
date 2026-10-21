import type { ZodType } from 'zod';
import type { ApiCode, Session } from '../shared/types.ts';
import { readSessionCookie, verifyToken } from './auth.ts';
import { appOrigin } from './config.ts';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiCode;
  constructor(status: number, code: ApiCode) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

type RateEntry = { count: number; resetAt: number };
declare global {
  var inventoryLimits: Map<string, RateEntry> | undefined;
}

export function takeRateLimit(key: string, limit: number, windowMs = 60_000): boolean {
  const store = (globalThis.inventoryLimits ??= new Map());
  const now = Date.now();
  for (const [storedKey, value] of store) {
    if (value.resetAt <= now) store.delete(storedKey);
  }
  const previous = store.get(key);
  if (!previous && store.size >= 10_000) return false;
  const entry = previous ?? { count: 0, resetAt: now + windowMs };
  if (entry.count >= limit) return false;
  entry.count += 1;
  store.set(key, entry);
  return true;
}

export async function requireSession(request: Request): Promise<Session> {
  const session = await verifyToken(readSessionCookie(request.headers.get('cookie')));
  if (!session) throw new ApiError(401, 'auth_required');
  return session;
}

export function checkRequest(
  request: Request,
  options: { mutation?: boolean; login?: boolean } = {},
): void {
  if (options.mutation && request.headers.get('origin') !== appOrigin()) {
    throw new ApiError(403, 'forbidden');
  }
  const ip = request.headers.get('x-inventory-client-ip') || 'unknown';
  if (!takeRateLimit(`${options.login ? 'login' : 'api'}:${ip}`, options.login ? 8 : 120)) {
    throw new ApiError(429, 'too_many_requests');
  }
}

export async function readJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  if (
    request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
  ) {
    throw new ApiError(415, 'invalid_request');
  }
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'invalid_request');
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > 16_384) {
        await reader.cancel();
        throw new ApiError(413, 'request_too_large');
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let data: unknown;
  try {
    data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new ApiError(400, 'invalid_request');
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new ApiError(400, 'invalid_request');
  return parsed.data;
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function api(action: () => Promise<Response>): Promise<Response> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof ApiError) return json({ code: error.code }, error.status);
    console.error('[api] request failed', {
      errorClass: error instanceof Error ? error.name : 'unknown',
    });
    return json({ code: 'unavailable' }, 503);
  }
}
