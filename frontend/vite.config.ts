import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
// UI de desenvolvimento: porta 5055 (UI_PORT). Se estiver ocupada, o Vite
// auto-incrementa automaticamente (5056, 5057, ...) — mesmo comportamento do
// launcher em produção. O backend dev (uvicorn) fica em 8000 e recebe o
// proxy de /api.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5055,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
