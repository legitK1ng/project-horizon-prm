import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor Configuration — Project Horizon PRM
 *
 * server.allowNavigation: whitelist every host the native WebView is allowed
 * to communicate with. Add your Tailscale Funnel URL here once you have it.
 *
 * IMPORTANT: Remove `server.url` before production builds — it overrides the
 * bundled app with a remote URL, which is only useful for live reload.
 */
const isDev = process.env.NODE_ENV !== 'production';

const config: CapacitorConfig = {
  appId: 'com.legitk1ng.horizon',
  appName: 'HorizonPRM',
  webDir: 'dist',

  server: {
    // Live reload during native dev — comment out for production build
    // url: 'http://YOUR_DEV_MACHINE_IP:5173',
    // cleartext: true,

    allowNavigation: [
      // Supabase direct — replace with your self-hosted domain if local
      '*.supabase.co',
      '*.supabase.com',
      // Tailscale Funnel — confirmed live
      'hp-z2g3-mini-workstation.tailb79f25.ts.net',
    ],
  },

  ios: {
    // Allow WKWebView to reach non-HTTPS during dev. Remove for App Store builds.
    allowsLinkPreview: false,
    // NSAppTransportSecurity must be configured in Info.plist — see setup guide
    contentInset: 'automatic',
  },

  android: {
    // Allow cleartext only if using local Tailscale IPs (not Funnel)
    // allowMixedContent: isDev,
    captureInput: true,
    webContentsDebuggingEnabled: isDev,
  },

  plugins: {
    // @capacitor/preferences storage namespace
    Preferences: {
      group: 'HorizonPRMStore',
    },
  },
};

export default config;

