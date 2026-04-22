import { Capacitor } from '@capacitor/core';
import { CapacitorHorizon } from 'capacitor-horizon';

export interface NativeContext {
  deviceInfo: {
    model: string;
    platform: string;
    osVersion: string;
  };
  permissions: {
    contacts: string;
    calls: string;
  };
  isBatteryOptimized: boolean;
}

class WebNativeService {
  /**
   * Determines if the app is running natively on a mobile device.
   */
  public isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Gets the native context from the CapacitorHorizon plugin.
   * On web, this will return the mock context defined in web.ts.
   */
  public async getNativeContext(): Promise<NativeContext> {
    try {
      const response = await CapacitorHorizon.getNativeContext();
      return response.context;
    } catch (error) {
      console.error('Failed to get native context from WebNative extension:', error);
      // Fallback if plugin fails to load
      return {
        deviceInfo: {
          model: 'Unknown Browser',
          platform: 'web',
          osVersion: 'Unknown',
        },
        permissions: {
          contacts: 'denied',
          calls: 'denied',
        },
        isBatteryOptimized: false,
      };
    }
  }

  /**
   * Tests the native bridge connection.
   */
  public async ping(message: string = 'Ping from Web'): Promise<string> {
    try {
      const response = await CapacitorHorizon.echo({ value: message });
      return response.value;
    } catch (error) {
      console.error('WebNative ping failed:', error);
      return 'Failed';
    }
  }
}

export const WebNative = new WebNativeService();
