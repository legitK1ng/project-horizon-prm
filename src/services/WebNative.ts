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
    // HARVEST (additive): port Eclipse's more-robust guard — only call the
    // native plugin when it is actually registered, otherwise fall back
    // cleanly. Avoids attempting an undefined-plugin call on web/Nexus.
    if (!Capacitor.isPluginAvailable('CapacitorHorizon')) {
      console.warn('[WebNative] CapacitorHorizon plugin not detected. Running with Web Fallback.');
      return this.getWebFallbackContext();
    }

    try {
      const response = await CapacitorHorizon.getNativeContext();
      return response.context;
    } catch (error) {
      console.error('Failed to get native context from WebNative extension:', error);
      // Fallback if plugin fails to load
      return this.getWebFallbackContext();
    }
  }

  /**
   * Tests the native bridge connection.
   */
  public async ping(message: string = 'Ping from Web'): Promise<string> {
    // HARVEST (additive): port Eclipse's guard so web/non-native environments
    // return a clean mock instead of attempting an unregistered plugin call.
    if (!Capacitor.isPluginAvailable('CapacitorHorizon')) {
      return 'Mock Ping: Success (Web)';
    }

    try {
      const response = await CapacitorHorizon.echo({ value: message });
      return response.value;
    } catch (error) {
      console.error('WebNative ping failed:', error);
      return 'Failed';
    }
  }

  /**
   * HARVEST (additive): Eclipse's centralized fallback for non-native
   * environments or when the CapacitorHorizon plugin is missing/unavailable.
   * Centralizing keeps both getNativeContext() and ping() returning a single
   * consistent Web fallback shape.
   */
  private getWebFallbackContext(): NativeContext {
    return {
      deviceInfo: {
        model: 'Web Browser / Nexus',
        platform: 'web',
        osVersion: 'N/A',
      },
      permissions: {
        contacts: 'denied',
        calls: 'denied',
      },
      isBatteryOptimized: false,
    };
  }
}

export const WebNative = new WebNativeService();
