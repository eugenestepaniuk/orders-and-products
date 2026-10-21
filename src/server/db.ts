import mysql from 'mysql2/promise';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { SslOptions } from 'mysql2';
import { databaseTlsOptions, requireEnv } from './config.ts';

declare global {
  var inventoryPool: Pool | undefined;
}

export function createPool(url: string, ssl?: SslOptions): Pool {
  let parsed: URL;
  let user: string;
  let password: string;
  try {
    parsed = new URL(url);
    user = decodeURIComponent(parsed.username);
    password = decodeURIComponent(parsed.password);
  } catch {
    throw new Error('Invalid database configuration.');
  }
  if (
    parsed.protocol !== 'mysql:' ||
    !parsed.hostname ||
    !user ||
    !/^\/[a-zA-Z0-9_]+$/.test(parsed.pathname) ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error('Invalid database configuration.');
  }
  return mysql.createPool({
    host: parsed.hostname,
    port: Number(parsed.port || 3306),
    user,
    password,
    database: parsed.pathname.slice(1),
    ssl,
    connectionLimit: 5,
    waitForConnections: true,
    timezone: 'Z',
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
  });
}

export function getPool(): Pool {
  return (globalThis.inventoryPool ??= createPool(
    requireEnv('DATABASE_URL'),
    databaseTlsOptions(),
  ));
}

export async function closePool(): Promise<void> {
  await globalThis.inventoryPool?.end();
  globalThis.inventoryPool = undefined;
}

export interface UserRow extends RowDataPacket {
  id: string;
  username: string;
  password_hash: string;
}
