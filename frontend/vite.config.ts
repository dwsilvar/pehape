import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import monacoEditorPlugin from 'vite-plugin-monaco-editor';
import fs from 'fs';
import path from 'path';

// Cargar configuración desde config/network_config.json como único punto de entrada
const networkConfigPath = path.resolve(__dirname, '../config/network_config.json');
let config = { port: 3000, api_url: 'http://localhost:5001' };

if (fs.existsSync(networkConfigPath)) {
  try {
    const rawData = fs.readFileSync(networkConfigPath, 'utf-8');
    const netConfig = JSON.parse(rawData);

    const backendPort = netConfig.backend_port ?? 5001;
    const frontendPort = netConfig.frontend_port ?? 3000;

    // Si backend_host es "0.0.0.0", usamos localhost para el proxy del navegador
    const rawHost = netConfig.backend_host ?? '0.0.0.0';
    const backendHost = rawHost === '0.0.0.0' ? 'localhost' : rawHost;

    config.port = frontendPort;
    config.api_url = `http://${backendHost}:${backendPort}`;
    console.log(`Loaded defaults from network_config.json: port=${config.port}, api_url=${config.api_url}`);
  } catch (e) {
    console.error('Error parsing config/network_config.json, using defaults.', e);
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
        target: config.api_url,
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
        target: config.api_url,
        changeOrigin: true,
      },
      '/allure-report': {
        target: config.api_url,
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