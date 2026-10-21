import type { SslOptions } from 'mysql2';

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export function appOrigin(): string {
  let url: URL;
  try {
    url = new URL(
      process.env.APP_ORIGIN || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000',
    );
  } catch {
    throw new Error('APP_ORIGIN must be an HTTP origin.');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.pathname !== '/' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error('APP_ORIGIN must be an HTTP origin.');
  }
  return url.origin;
}

export function jwtKey(): Uint8Array {
  const key = new TextEncoder().encode(requireEnv('JWT_SECRET'));
  if (key.byteLength < 32) throw new Error('JWT_SECRET must contain at least 32 bytes.');
  return key;
}
export function databaseTlsOptions(): SslOptions | undefined {
  const mode = process.env.DATABASE_SSL_MODE?.trim() || 'disabled';
  if (mode === 'disabled') return undefined;
  if (mode !== 'verify') throw new Error('DATABASE_SSL_MODE must be disabled or verify.');
  return {
    ca: requireEnv('DATABASE_SSL_CA').replace(/\\n/g, '\n'),
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true,
    verifyIdentity: true,
  };
}
