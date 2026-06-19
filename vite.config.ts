import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // When HORIZON_LIVE_URL is set, the Tailscale Funnel URL is used for HMR.
  // This lets the APK WebView receive hot-reload updates even off-LAN.
  const liveUrl = env.HORIZON_LIVE_URL || env.HORIZON_DEV_URL || '';
  let hmrConfig: Record<string, unknown> | undefined;
  if (liveUrl) {
    try {
      const u = new URL(liveUrl);
      hmrConfig = {
        protocol: u.protocol === 'https:' ? 'wss' : 'ws',
        host: u.hostname,
        port: u.port ? parseInt(u.port) : (u.protocol === 'https:' ? 443 : 80),
        clientPort: u.port ? parseInt(u.port) : (u.protocol === 'https:' ? 443 : 80),
      };
    } catch { /* ignore invalid URL */ }
  }

  return {
    plugins: [react()],

    server: {
      port: 3000,
      host: true,         // bind to 0.0.0.0 so Tailscale can reach it
      open: !liveUrl,     // don't auto-open browser in Tailscale mode
      strictPort: false,
      ...(hmrConfig ? { hmr: hmrConfig } : {}),
      proxy: {
        '/api': {
          target: env.VITE_BACKEND_URL || 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
        },
      },
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@/components': path.resolve(__dirname, './src/components'),
        '@/services': path.resolve(__dirname, './src/services'),
        '@/contexts': path.resolve(__dirname, './src/contexts'),
        '@/hooks': path.resolve(__dirname, './src/hooks'),
        '@/types': path.resolve(__dirname, './src/types'),
        '@/constants': path.resolve(__dirname, './src/constants'),
        '@/utils': path.resolve(__dirname, './src/utils'),
      },
    },

    define: {
      'import.meta.env.VITE_BACKEND_URL': JSON.stringify(env.VITE_BACKEND_URL),
    },

    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'charts': ['recharts'],
            'icons': ['lucide-react'],
          },
        },
      },
    },
  };
});
