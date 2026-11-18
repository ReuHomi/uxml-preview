/**
 * 0.8.0 — spaces, the preview's boxes against Unity's (r8-trail, r8-wrap), in a real browser.
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Every Label box of tests/layout/unity/probes-0.8.0/r8-trail and r8-wrap must equal Unity's, width and height:
 *   - runtime panel: the 6000.0.40f1 and 6000.3.25f1 dumps (probe-panel, the same numbers on both);
 *   - editor theme: the 6000.3.25f1 dump (probe-editor-070). The preview's editor theme is 6.3's; the 6000.0
 *     editor is Standard where 6.3 is Advanced (a known difference, docs/supported.md), so its dump is not judged.
 * Each probe was dumped alone (dump-solo.sh) and every text in it is different (CLAUDE.md rule 7).
 * What it settles (tests/contract-080/spaces-r8.test.ts header): (a) Standard drops a Label's trailing spaces;
 * (b) at a break inside a run of spaces, Standard counts the run only when a glyph after it fits.
 *
 * The font: Inter-Regular.ttf with Unity's FaceInfo, on :root, as measure-real.mjs does.
 * Deps/Effects: UXML_TEXT_CHROMIUM, UXML_TEXT_FONTS (Inter-Regular.ttf); bundles src/ with Vite in memory.
 * Exits 1 when it cannot run or any row fails.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const notRun = (why) => {
  console.error(`텍스트 코호트가 실행되지 않음 (measure-spaces): ${why}`);
  process.exit(1);
};
const chromiumPath = process.env.UXML_TEXT_CHROMIUM;
const fontDir = process.env.UXML_TEXT_FONTS;
if (!chromiumPath || !existsSync(chromiumPath)) notRun('UXML_TEXT_CHROMIUM is not a Chromium executable');
if (!fontDir || !existsSync(join(fontDir, 'Inter-Regular.ttf'))) notRun('UXML_TEXT_FONTS has no Inter-Regular.ttf');

const FACE = { pointSize: 90, ascentLine: 87.1875, descentLine: -21.73295, lineHeight: 108.9205 };

const { chromium } = await import('playwright-core');
const { build } = await import('vite');
const bundled = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false, lib: { entry: join(ROOT, 'src/index.ts'), formats: ['iife'], name: 'UxmlCore', fileName: 'core' } } });
const coreJs = (Array.isArray(bundled) ? bundled[0] : bundled).output[0].code;

const browser = await chromium.launch({ executablePath: chromiumPath });
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
await page.route('http://paint.test/**', (route) => {
  const path = decodeURIComponent(new URL(route.request().url()).pathname);
  if (path === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><style>body{margin:0}@font-face{font-family:"ms-inter";src:url("/f/Inter-Regular.ttf")}</style><script src="/core.js"></script>' });
  if (path === '/core.js') return route.fulfill({ contentType: 'text/javascript', body: coreJs });
  if (path.startsWith('/f/')) return route.fulfill({ body: readFileSync(join(fontDir, path.slice(3))) });
  return route.fulfill({ status: 404, body: '' });
});
await page.goto('http://paint.test/');
await page.evaluate(async () => {
  await document.fonts.load('14px "ms-inter"', 'AgVa');
  await globalThis.UxmlCore.loadLayoutEngine();
});

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} — ${detail}`);
};

const PROBES = join(ROOT, 'tests', 'layout', 'unity', 'probes-0.8.0');
const SETS = [
  ['runtime', 'probe-panel', ['6000.0.40f1', '6000.3.25f1']],
  ['editor', 'probe-editor-070', ['6000.3.25f1']],
];
for (const probe of ['r8-trail', 'r8-wrap']) {
  const uxml = readFileSync(join(PROBES, `${probe}.uxml`), 'utf8');
  const uss = readFileSync(join(PROBES, `${probe}.uss`), 'utf8');
  for (const [theme, set, versions] of SETS) {
    const boxes = await page.evaluate(({ uxml, uss, theme, face }) => {
      const core = globalThis.UxmlCore;
      const host = document.createElement('div');
      document.body.replaceChildren(host);
      const r = core.render(core.parse(uxml, `:root { -unity-font-definition: url("project://database/Assets/Fonts/Inter-Regular.ttf"); } ${uss}`), host,
        { theme, size: { width: 800, height: 600 }, resolveFont: () => ({ family: 'ms-inter', faceInfo: face }) });
      const out = {};
      const walk = (n) => {
        const a = n.attributes.find((x) => x.name === 'name');
        if (a) { const b = r.boxes.get(n.id); out[a.value] = [b.width, b.height]; }
        n.children.forEach(walk);
      };
      walk(r.document.root);
      r.dispose();
      return out;
    }, { uxml, uss, theme, face: FACE });
    for (const version of versions) {
      const d = JSON.parse(readFileSync(join(ROOT, 'tests', 'layout', 'unity', version, set, `${probe}.json`), 'utf8').replace(/\bNaN\b/g, 'null'));
      for (const e of d.elements) {
        if (e.type !== 'Label') continue;
        const [w, h] = boxes[e.name];
        check(`${version} ${theme} ${probe} ${e.name}`, w === e.w && h === e.h,
          `${JSON.stringify(e.text)} Unity ${e.w}x${e.h}, preview ${w}x${h}`);
      }
    }
  }
}

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`measure spaces: ${results.length - failed}/${results.length}`);
process.exit(failed === 0 ? 0 : 1);
