import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from '../package.json';

// https://vitejs.dev/config/
// UI de desenvolvimento: porta 5055 (UI_PORT). Se estiver ocupada, o Vite
// auto-incrementa automaticamente (5056, 5057, ...) — mesmo comportamento do
// launcher em produção. O backend dev (uvicorn) fica em 8010 (a 8000 costuma
// ser usada por outros serviços locais) e recebe o proxy de /api.
export default defineConfig({
  plugins: [react()],
  // Versão do aplicativo injetada em build time a partir do package.json da
  // raiz: cada release no NPM (bump de versão) atualiza a UI automaticamente —
  // a sidebar exibe "LeadMaster vX.Y.ZZ" sem nenhuma alteração manual no
  // código React. Usada via `__APP_VERSION__` (declarado em vite-env.d.ts).
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    port: 5055,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8010',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
