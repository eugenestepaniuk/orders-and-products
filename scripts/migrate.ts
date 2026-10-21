import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import type { Pool } from 'mysql2/promise';
import { getPool, closePool } from '../src/server/db.ts';

export async function migrate(pool: Pool): Promise<void> {
  const sql = await readFile(new URL('../database/schema.sql', import.meta.url), 'utf8');
  for (const statement of sql
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)) {
    await pool.query(statement);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await migrate(getPool());
    console.info('Database schema is ready.');
  } finally {
    await closePool();
  }
}
