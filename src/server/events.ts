import { EventEmitter } from 'node:events';
import type { InventoryEvent } from '../shared/types.ts';

declare global {
  var inventoryEvents: EventEmitter | undefined;
}

// Route bundles and the custom server share this bus in one Node process.
export function eventBus(): EventEmitter {
  return (globalThis.inventoryEvents ??= new EventEmitter());
}

export function publishChange(event: InventoryEvent): void {
  eventBus().emit('inventory:changed', event);
}
