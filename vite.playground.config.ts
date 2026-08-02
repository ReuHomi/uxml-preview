import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Builds the playground as a static site for GitHub Pages.
 *
 * Separate from vite.config.ts rather than a third branch inside it: that file
 * already switches between serving the playground and building the library, and
 * a config that means three different things depending on how it was invoked is
 * how the LIB_BUILD bug got in.
 *
 * `base` matches the repository name, because Pages serves a project site from
 * /<repo>/ and every asset URL has to agree.
 */
export default defineConfig({
  root: resolve(here, 'playground'),
  base: '/uxml-preview/',
  build: {
    outDir: resolve(here, 'dist-site'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Unlike the npm package, this bundle inlines yoga-layout and its
        // WebAssembly, so the site redistributes MIT-licensed code and has to
        // carry the notice. yoga's own header says "@format" rather than
        // "@license", so no minifier preserves it automatically.
        banner:
          '/*! uxml-preview — Apache-2.0. Bundles yoga-layout (MIT, ' +
          'Copyright (c) Meta Platforms, Inc. and affiliates). ' +
          'Full notices: https://github.com/ReuHomi/uxml-preview/blob/main/THIRD-PARTY-NOTICES.md */',
      },
    },
  },
  optimizeDeps: {
    include: ['yoga-layout/load'],
  },
});
