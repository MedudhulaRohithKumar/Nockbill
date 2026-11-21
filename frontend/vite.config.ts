import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function resolveAllowedHosts(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;
  const hosts = raw
    .split(',')
    .map((h) => h.trim())
    .filter((h) => h.length > 0 && h !== '*');
  return hosts.length > 0 ? hosts : undefined;
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Restrict DNS rebinding by default; opt in via VITE_ALLOWED_HOSTS="host1,host2" when tunneling (M7)
    allowedHosts: resolveAllowedHosts(process.env.VITE_ALLOWED_HOSTS),
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Split large vendor graphs for better browser cache hit ratio & LCP (B11)
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/react-router')) {
            return 'react-vendor';
          }
          if (id.includes('/recharts/') || id.includes('/d3-') || id.includes('/victory-vendor/') || id.includes('/lodash')) {
            return 'recharts-vendor';
          }
          if (id.includes('/lucide-react/')) {
            return 'icons-vendor';
          }
          return undefined;
        },
      },
    },
  },
});
