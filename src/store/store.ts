import {
  configureStore,
  createAsyncThunk,
  createSelector,
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit';
import { requestJson, RequestError } from '../shared/api.ts';
import { inventorySchema } from '../shared/validation.ts';
import { EMPTY_INVENTORY, type ApiCode, type Inventory, type Product } from '../shared/types.ts';
import { sumPrices } from '../shared/format.ts';

interface InventoryState {
  data: Inventory;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: ApiCode | null;
  requestId: string | null;
}

export const refreshInventory = createAsyncThunk<Inventory, void, { rejectValue: ApiCode }>(
  'inventory/refresh',
  async (_, { signal, rejectWithValue }) => {
    try {
      return inventorySchema.parse(await requestJson('/api/inventory', { signal }));
    } catch (error) {
      return rejectWithValue(error instanceof RequestError ? error.code : 'unavailable');
    }
  },
);

const initialInventory: InventoryState = {
  data: EMPTY_INVENTORY,
  status: 'idle',
  error: null,
  requestId: null,
};
const inventorySlice = createSlice({
  name: 'inventory',
  initialState: initialInventory,
  reducers: {},
  extraReducers(builder) {
    builder.addCase(refreshInventory.pending, (state, action) => {
      state.status = 'loading';
      state.error = null;
      state.requestId = action.meta.requestId;
    });
    builder.addCase(refreshInventory.fulfilled, (state, action) => {
      if (state.requestId !== action.meta.requestId) return;
      state.data = action.payload;
      state.status = 'ready';
      state.requestId = null;
    });
    builder.addCase(refreshInventory.rejected, (state, action) => {
      if (state.requestId !== action.meta.requestId) return;
      state.status = 'error';
      state.error = action.payload ?? 'unavailable';
      state.requestId = null;
    });
  },
});

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    search: '',
    productType: '',
    selectedOrderId: null as number | null,
    sessions: null as number | null,
    connected: false,
  },
  reducers: {
    searchChanged(state, action: PayloadAction<string>) {
      state.search = action.payload;
    },
    productTypeChanged(state, action: PayloadAction<string>) {
      state.productType = action.payload;
    },
    orderSelected(state, action: PayloadAction<number | null>) {
      state.selectedOrderId = action.payload;
    },
    sessionsChanged(state, action: PayloadAction<number | null>) {
      state.sessions = action.payload;
    },
    connectionChanged(state, action: PayloadAction<boolean>) {
      state.connected = action.payload;
    },
  },
});

export const {
  searchChanged,
  productTypeChanged,
  orderSelected,
  sessionsChanged,
  connectionChanged,
} = uiSlice.actions;

export function makeStore(data: Inventory = EMPTY_INVENTORY, error: ApiCode | null = null) {
  return configureStore({
    reducer: { inventory: inventorySlice.reducer, ui: uiSlice.reducer },
    preloadedState: {
      inventory: {
        ...initialInventory,
        data,
        error,
        status: error ? ('error' as const) : ('ready' as const),
      },
    },
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];

export const selectInventory = (state: RootState) => state.inventory.data;
export const selectOrders = (state: RootState) => state.inventory.data.orders;
export const selectProducts = (state: RootState) => state.inventory.data.products;
const selectSearch = (state: RootState) => state.ui.search.trim().toLowerCase();
const selectType = (state: RootState) => state.ui.productType;

export const selectVisibleProducts = createSelector(
  [selectProducts, selectSearch, selectType],
  (products, search, type) =>
    products.filter(
      (product) =>
        (!type || product.type === type) &&
        (!search || `${product.title} ${product.serialNumber}`.toLowerCase().includes(search)),
    ),
);

export const selectVisibleOrders = createSelector([selectOrders, selectSearch], (orders, search) =>
  orders.filter((order) => !search || order.title.toLowerCase().includes(search)),
);

export const selectProductTypes = createSelector([selectProducts], (products) =>
  [...new Set(products.map((product) => product.type))].sort(),
);

export const selectOrdersById = createSelector(
  [selectOrders],
  (orders) => new Map(orders.map((order) => [order.id, order])),
);

export const selectOrderSummaries = createSelector(
  [selectOrders, selectProducts],
  (orders, products) => {
    const grouped = new Map<number, Product[]>();
    for (const product of products) {
      const items = grouped.get(product.orderId) ?? [];
      items.push(product);
      grouped.set(product.orderId, items);
    }
    return new Map(
      orders.map((order) => {
        const items = grouped.get(order.id) ?? [];
        return [order.id, { products: items, totals: sumPrices(items) }];
      }),
    );
  },
);
