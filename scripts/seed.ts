import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { fixtures } from '../database/fixtures.ts';
import { getPool, closePool } from '../src/server/db.ts';
import { requireEnv } from '../src/server/config.ts';
import { hashPassword } from '../src/server/auth.ts';

export async function seed(
  pool: Pool,
  options: { username: string; password: string; reset?: boolean },
): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [users] = await connection.execute<RowDataPacket[]>(
      'SELECT id FROM users WHERE username = ?',
      [options.username],
    );
    const passwordHash = await hashPassword(options.password);
    if (users.length)
      await connection.execute('UPDATE users SET password_hash = ? WHERE username = ?', [
        passwordHash,
        options.username,
      ]);
    else
      await connection.execute('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)', [
        randomUUID(),
        options.username,
        passwordHash,
      ]);
    if (options.reset) {
      await connection.query('DELETE FROM product_prices');
      await connection.query('DELETE FROM products');
      await connection.query('DELETE FROM orders');
    }
    const [counts] = await connection.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS count FROM orders',
    );
    if (!Number(counts[0].count) && (options.reset || !users.length)) {
      for (const order of fixtures.orders) {
        await connection.execute(
          'INSERT INTO orders (id, title, description, created_at) VALUES (?, ?, ?, ?)',
          [
            order.id,
            order.title,
            order.description,
            order.createdAt.slice(0, 23).replace('T', ' '),
          ],
        );
      }
      for (const product of fixtures.products) {
        await connection.execute(
          'INSERT INTO products (id, order_id, title, type, serial_number, is_new, photo, warranty_start, warranty_end, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            product.id,
            product.orderId,
            product.title,
            product.type,
            product.serialNumber,
            product.isNew,
            product.photo,
            product.warrantyStart,
            product.warrantyEnd,
            product.createdAt.slice(0, 23).replace('T', ' '),
          ],
        );
        for (const price of product.prices)
          await connection.execute(
            'INSERT INTO product_prices (product_id, currency, amount_minor) VALUES (?, ?, ?)',
            [product.id, price.currency, price.amountMinor],
          );
      }
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.env.ALLOW_DEMO_SEED !== '1')
    throw new Error('Set ALLOW_DEMO_SEED=1 to create demo records.');
  try {
    await seed(getPool(), {
      username: requireEnv('DEMO_USERNAME'),
      password: requireEnv('DEMO_PASSWORD'),
    });
    console.info('Demo account and inventory are ready. Existing inventory was kept.');
  } finally {
    await closePool();
  }
}
