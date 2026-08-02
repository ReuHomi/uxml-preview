import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import dts from 'vite-plugin-dts';

const here = dirname(fileURLToPath(import.meta.url));

// `vite` (serve) runs the playground; `vite build` builds the library.
//
// Every path below is absolute on purpose. The mode used to be switched by a
// LIB_BUILD env var that no script ever set, so the library build ran with
// root = playground/ and vite-plugin-dts resolved `include: ['src']` against
// playground/. It found nothing, reported success, and emitted no .d.ts —
// leaving package.json "types" pointing at a file that did not exist.
export default defineConfig(({ command }) => ({
  root: command === 'serve' ? resolve(here, 'playground') : here,
  build: {
    lib: {
      entry: resolve(here, 'src/index.ts'),
      name: 'UxmlPreview',
      fileName: 'index',
      formats: ['es'],
    },
    outDir: resolve(here, 'dist'),
    emptyOutDir: true,
  },
  // Declarations are a build artifact; generating them on every dev reload
  // would only slow the playground down.
  plugins:
    command === 'build'
      ? [
          dts({
            include: [resolve(here, 'src')],
            entryRoot: resolve(here, 'src'),
            outDir: resolve(here, 'dist'),
          }),
        ]
      : [],
  optimizeDeps: {
    // yoga-layout ships WASM; let Vite handle it explicitly
    exclude: ['yoga-layout'],
  },
}));
