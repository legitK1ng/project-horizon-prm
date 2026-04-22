import { WebPlugin } from '@capacitor/core';

import type { CapacitorHorizonPlugin, NativeContext } from './definitions';

export class CapacitorHorizonWeb extends WebPlugin implements CapacitorHorizonPlugin {
  async echo(options: { value: string }): Promise<{ value: string }> {
    console.log('ECHO', options);
    return options;
  }

  async getNativeContext(): Promise<{ context: NativeContext }> {
    return {
      context: {
        deviceInfo: {
          model: 'Web Browser',
          platform: 'web',
          osVersion: '1.0',
        },
        permissions: {
          contacts: 'denied',
          calls: 'denied',
        },
        isBatteryOptimized: false,
      }
    };
  }
}
