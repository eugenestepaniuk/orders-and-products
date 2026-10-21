'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { io, type Socket } from 'socket.io-client';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  connectionChanged,
  productTypeChanged,
  refreshInventory,
  selectProductTypes,
  sessionsChanged,
} from '@/store/store';
import type { Locale, ServerEvents } from '@/shared/types';

const STORAGE_KEY = 'inventory.product-type';

export function useInventoryConnection(locale: Locale) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const productType = useAppSelector((state) => state.ui.productType);
  const types = useAppSelector(selectProductTypes);
  const status = useAppSelector((state) => state.inventory.status);
  const error = useAppSelector((state) => state.inventory.error);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && saved.length <= 60) dispatch(productTypeChanged(saved));
    } catch {
      /* Storage can be disabled by the browser. */
    }
  }, [dispatch]);

  useEffect(() => {
    if (status === 'ready' && productType && !types.includes(productType)) {
      dispatch(productTypeChanged(''));
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, productType);
    } catch {
      /* Filtering still works without persistence. */
    }
  }, [dispatch, productType, status, types]);

  useEffect(() => {
    if (error === 'auth_required') router.replace(`/${locale}/login`);
  }, [error, locale, router]);

  useEffect(() => {
    const socket: Socket<ServerEvents> = io({ transports: ['websocket'], withCredentials: true });
    socket.on('connect', () => {
      dispatch(connectionChanged(true));
      void dispatch(refreshInventory());
    });
    socket.on('disconnect', () => {
      dispatch(connectionChanged(false));
      dispatch(sessionsChanged(null));
    });
    socket.on('sessions:count', (count) => {
      if (Number.isInteger(count) && count >= 0) dispatch(sessionsChanged(count));
    });
    socket.on('inventory:changed', () => {
      void dispatch(refreshInventory());
    });
    socket.on('session:expired', () => router.replace(`/${locale}/login`));
    socket.on('connect_error', (failure) => {
      dispatch(connectionChanged(false));
      if (failure.message === 'auth_required') router.replace(`/${locale}/login`);
    });
    return () => {
      socket.disconnect();
    };
  }, [dispatch, locale, router]);
}
