import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import monacoEditorPlugin from 'vite-plugin-monaco-editor';
import fs from 'fs';
import path from 'path';

// Cargar configuración desde app_config.json
const configPath = path.resolve(__dirname, 'app_config.json');
let config = { port: 3000, api_url: 'http://localhost:5001' };

if (fs.existsSync(configPath)) {
  try {
    const rawData = fs.readFileSync(configPath, 'utf-8');
    config = { ...config, ...JSON.parse(rawData) };
    console.log(`Loaded configuration from ${configPath}`);
  } catch (e) {
    console.error('Error loading app_config.json, using defaults.', e);
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    (monacoEditorPlugin as any).default({})
  ],
  server: {
    port: config.port,
    proxy: {
      '/api/execution-status': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        // Disable response buffering so SSE events flow immediately through the proxy
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            // Ensure the proxy doesn't buffer SSE streams
            proxyRes.headers['x-accel-buffering'] = 'no';
            proxyRes.headers['cache-control'] = 'no-cache';
          });
        },
      },
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/allure-report': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },

  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  optimizeDeps: {
    include: [
      'monaco-themes/themes/Monokai.json?raw'
    ]
  }
});