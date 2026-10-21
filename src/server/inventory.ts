import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { Inventory, Currency, Price } from '../shared/types.ts';
import type { OrderInput, ProductInput } from '../shared/validation.ts';
import { getPool } from './db.ts';
import { ApiError } from './http.ts';
import { publishChange } from './events.ts';

interface OrderRow extends RowDataPacket {
  id: number;
  title: string;
  description: string;
  created_at: string;
}
interface ProductRow extends RowDataPacket {
  id: number;
  order_id: number;
  title: string;
  type: string;
  serial_number: string;
  is_new: number;
  photo: string;
  warranty_start: string;
  warranty_end: string;
  created_at: string;
}
interface PriceRow extends RowDataPacket {
  product_id: number;
  currency: Currency;
  amount_minor: string;
}

function utc(value: string): string {
  return `${value.replace(' ', 'T')}Z`;
}

export async function getInventory(): Promise<Inventory> {
  const connection = await getPool().getConnection();
  try {
    await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
    const [orders] = await connection.query<OrderRow[]>(
      'SELECT id, title, description, created_at FROM orders ORDER BY created_at DESC, id DESC',
    );
    const [products] = await connection.query<ProductRow[]>(
      'SELECT id, order_id, title, type, serial_number, is_new, photo, warranty_start, warranty_end, created_at FROM products ORDER BY id',
    );
    const [prices] = await connection.query<PriceRow[]>(
      'SELECT product_id, currency, amount_minor FROM product_prices ORDER BY currency',
    );
    await connection.commit();
    const pricesByProduct = new Map<number, Price[]>();
    for (const price of prices) {
      const list = pricesByProduct.get(price.product_id) ?? [];
      list.push({ currency: price.currency, amountMinor: Number(price.amount_minor) });
      pricesByProduct.set(price.product_id, list);
    }
    return {
      orders: orders.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        createdAt: utc(row.created_at),
      })),
      products: products.map((row) => ({
        id: row.id,
        orderId: row.order_id,
        title: row.title,
        type: row.type,
        serialNumber: row.serial_number,
        isNew: Boolean(row.is_new),
        photo: row.photo,
        warrantyStart: row.warranty_start,
        warrantyEnd: row.warranty_end,
        createdAt: utc(row.created_at),
        prices: pricesByProduct.get(row.id) ?? [],
      })),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function addOrder(input: OrderInput): Promise<number> {
  const [result] = await getPool().execute<ResultSetHeader>(
    'INSERT INTO orders (title, description, created_at) VALUES (?, ?, ?)',
    [input.title, input.description, `${input.date} 12:00:00`],
  );
  publishChange({ type: 'order.created', resourceId: result.insertId });
  return result.insertId;
}

export async function deleteOrder(id: number): Promise<void> {
  const [result] = await getPool().execute<ResultSetHeader>('DELETE FROM orders WHERE id = ?', [
    id,
  ]);
  if (!result.affectedRows) throw new ApiError(404, 'not_found');
  publishChange({ type: 'order.deleted', resourceId: id });
}

export async function addProduct(input: ProductInput): Promise<number> {
  const connection = await getPool().getConnection();
  let id: number;
  try {
    await connection.beginTransaction();
    const [orders] = await connection.execute<RowDataPacket[]>(
      'SELECT id FROM orders WHERE id = ? FOR SHARE',
      [input.orderId],
    );
    if (!orders.length) throw new ApiError(404, 'not_found');
    const [result] = await connection.execute<ResultSetHeader>(
      'INSERT INTO products (order_id, title, type, serial_number, is_new, photo, warranty_start, warranty_end, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3))',
      [
        input.orderId,
        input.title,
        input.type,
        input.serialNumber,
        input.isNew,
        '/images/monitor.svg',
        input.warrantyStart,
        input.warrantyEnd,
      ],
    );
    id = result.insertId;
    await connection.execute(
      'INSERT INTO product_prices (product_id, currency, amount_minor) VALUES (?, ?, ?), (?, ?, ?)',
      [id, 'USD', input.usdMinor, id, 'UAH', input.uahMinor],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  publishChange({ type: 'product.created', resourceId: id });
  return id;
}
