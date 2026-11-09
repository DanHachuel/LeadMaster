/// <reference types="vite/client" />

// Versão do app injetada em build time pelo Vite (`define.__APP_VERSION__`
// em vite.config.ts), lida do package.json da raiz. Atualiza sozinha a cada
// release no NPM — nenhuma alteração manual no código React.
declare const __APP_VERSION__: string;
