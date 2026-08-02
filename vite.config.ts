import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  // playground is the dev server root; library build uses src/index.ts
  root: process.env.LIB_BUILD ? '.' : 'playground',
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'UxmlPreview',
      fileName: 'index',
      formats: ['es'],
    },
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
  plugins: [dts({ include: ['src'], outDir: 'dist' })],
  optimizeDeps: {
    // yoga-layout ships WASM; let Vite handle it explicitly
    exclude: ['yoga-layout'],
  },
});
