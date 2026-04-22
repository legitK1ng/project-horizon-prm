import { registerPlugin } from '@capacitor/core';

import type { CapacitorHorizonPlugin } from './definitions';

const CapacitorHorizon = registerPlugin<CapacitorHorizonPlugin>('CapacitorHorizon', {
  web: () => import('./web').then((m) => new m.CapacitorHorizonWeb()),
});

export * from './definitions';
export { CapacitorHorizon };
