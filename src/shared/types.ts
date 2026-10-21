export type Locale = 'ru' | 'en';
export type Currency = 'USD' | 'UAH';

export interface Price {
  currency: Currency;
  amountMinor: number;
}

export interface Product {
  id: number;
  orderId: number;
  title: string;
  type: string;
  serialNumber: string;
  isNew: boolean;
  photo: string;
  warrantyStart: string;
  warrantyEnd: string;
  createdAt: string;
  prices: Price[];
}

export interface Order {
  id: number;
  title: string;
  description: string;
  createdAt: string;
}

export interface Inventory {
  orders: Order[];
  products: Product[];
}

export interface Session {
  userId: string;
  username: string;
  expiresAt: number;
}

export type InventoryEvent = {
  type: 'order.created' | 'order.deleted' | 'product.created';
  resourceId: number;
};

export interface ServerEvents {
  'sessions:count': (count: number) => void;
  'inventory:changed': (event: InventoryEvent) => void;
  'session:expired': () => void;
}

export type ApiCode =
  | 'invalid_request'
  | 'invalid_credentials'
  | 'auth_required'
  | 'forbidden'
  | 'not_found'
  | 'too_many_requests'
  | 'request_too_large'
  | 'unavailable'
  | 'network_error';

export const EMPTY_INVENTORY: Inventory = { orders: [], products: [] };
