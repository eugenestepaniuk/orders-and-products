import type { ApiCode } from './types.ts';

export class RequestError extends Error {
  readonly code: ApiCode;
  constructor(code: ApiCode) {
    super(code);
    this.code = code;
  }
}

const codes = new Set<ApiCode>([
  'invalid_request',
  'invalid_credentials',
  'auth_required',
  'forbidden',
  'not_found',
  'too_many_requests',
  'request_too_large',
  'unavailable',
  'network_error',
]);

export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { credentials: 'same-origin', ...init });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new RequestError('network_error');
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const candidate = body && typeof body === 'object' && 'code' in body ? body.code : undefined;
    throw new RequestError(
      typeof candidate === 'string' && codes.has(candidate as ApiCode)
        ? (candidate as ApiCode)
        : 'unavailable',
    );
  }
  return body as T;
}
