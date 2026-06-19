import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor Configuration — Project Horizon PRM
 *
 * Live reload strategy (Goal 3):
 *   - Set HORIZON_DEV_URL env var (or HORIZON_LIVE_URL) to point the APK's
 *     WebView at a remotely accessible dev server.
 *   - The dev server is exposed via Tailscale Funnel on port 10000.
 *   - When the env var is set, ANY code change on your desktop hot-reloads
 *     in the APK immediately, even when the phone is not on local WiFi.
 *
 * To enable live reload:
 *   1. Start Vite dev server: npm run dev
 *   2. Start Tailscale funnel: tailscale funnel --bg 10000
 *      (or use the supervisor which does this automatically)
 *   3. Set the env var and rebuild capacitor config:
 *      $env:HORIZON_LIVE_URL="https://hp-z2g3-mini-workstation.tailb79f25.ts.net:10000"
 *      npx cap sync android
 *   4. Install updated APK or use `npx cap run android`
 *
 * To disable live reload (production build):
 *   Remove HORIZON_LIVE_URL env var, then: npm run build && npx cap sync android
 *
 * IMPORTANT: Never ship an APK with server.url set — it loads code from the
 * internet and breaks offline use. Only set it for development.
 */

const LIVE_RELOAD_URL =
  process.env.HORIZON_LIVE_URL ||   // Tailscale Funnel URL (preferred)
  process.env.HORIZON_DEV_URL  ||   // Alternative env var name
  null;

const TAILSCALE_HOST = 'hp-z2g3-mini-workstation.tailb79f25.ts.net';

const config: CapacitorConfig = {
  appId: 'com.legitk1ng.horizon',
  appName: 'HorizonPRM',
  webDir: 'dist',

  server: {
    // Live reload — only set when HORIZON_LIVE_URL is provided.
    // Remove for production builds.
    ...(LIVE_RELOAD_URL
      ? { url: LIVE_RELOAD_URL, cleartext: true }
      : {}),

    allowNavigation: [
      // Supabase
      '*.supabase.co',
      '*.supabase.com',
      // Tailscale Funnel — all ports (API on 8443, ingest on 443, dev on 10000)
      TAILSCALE_HOST,
      `*.tailb79f25.ts.net`,
      // Local dev
      'localhost',
      '127.0.0.1',
    ],
  },

  ios: {
    allowsLinkPreview: false,
    contentInset: 'automatic',
  },

  android: {
    // Allow cleartext HTTP to Tailscale IPs and localhost during dev
    allowMixedContent: !!LIVE_RELOAD_URL,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },

  plugins: {
    Preferences: {
      group: 'HorizonPRMStore',
    },
  },
};

export default config;
