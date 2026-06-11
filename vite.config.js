import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Usar copias locales MIT de las librerías wokwi
      'avr8js': path.resolve(__dirname, 'wokwi-libs/avr8js/dist/esm'),
      '@wokwi/elements': path.resolve(__dirname, 'wokwi-libs/wokwi-elements/dist/esm'),
    },
  },
  server: {
    host: true,   // escucha en 0.0.0.0 → accesible por red local
    port: 5274,
    // Proxy para el backend durante desarrollo
    // Esto evita problemas de CORS: las peticiones a /api
    // se reenvían automáticamente al backend en :8001
    proxy: {
      '/api': {
        target: import.meta.env.VITE_API_URL,
        changeOrigin: true,
      },
    },
  },
});
