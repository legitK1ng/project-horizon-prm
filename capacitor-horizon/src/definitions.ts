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

export interface CapacitorHorizonPlugin {
  echo(options: { value: string }): Promise<{ value: string }>;
  getNativeContext(): Promise<{ context: NativeContext }>;
}
