'use client';

import { useState } from 'react';
import { Provider } from 'react-redux';
import { makeStore } from './store';
import type { ApiCode, Inventory } from '@/shared/types';

export function InventoryProvider({
  children,
  initialInventory,
  initialError,
}: {
  children: React.ReactNode;
  initialInventory: Inventory;
  initialError: ApiCode | null;
}) {
  const [store] = useState(() => makeStore(initialInventory, initialError));
  return <Provider store={store}>{children}</Provider>;
}
