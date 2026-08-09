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
      // `unity-project/index` is Node-only (uses `node:fs`) and ships on its
      // own `exports` subpath so the main entry stays browser-safe.
      entry: {
        index: resolve(here, 'src/index.ts'),
        'unity-project/index': resolve(here, 'src/unity-project/index.ts'),
      },
      name: 'UxmlPreview',
      fileName: (_format, entryName) => `${entryName}.js`,
      formats: ['es'],
    },
    outDir: resolve(here, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      external: [
        // yoga-layout is a declared dependency, so consumers install it
        // themselves. Bundling it inlines a base64 WebAssembly blob and would
        // ship a second copy to anyone already using Yoga.
        'yoga-layout',
        'yoga-layout/load',
        // Node builtins used by unity-project/index.ts only.
        'node:fs/promises',
        'node:path',
      ],
    },
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
    // Only `yoga-layout/load` is imported: the package's default entry uses
    // top-level await, which would make this library's whole module graph
    // async and stop `render` from being a synchronous call.
    include: ['yoga-layout/load'],
  },
}));
