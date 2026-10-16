/**
 * What is painted fits the box that was measured — in a real browser.
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Found by the 0.6.0 adversarial review (Grok) and reproduced on 2026-10-16 in
 * Chrome 155 with Inter: the measurer widens letter-spaced text the way Unity's
 * advanced generator does (no spacing at the gaps beside a space; dump
 * text-spacing-advanced.json, 6000.3.25f1: "Hello World Foo" 12px, letter 5 → +7),
 * but CSS letter-spacing was applied after every character, spaces and the last
 * one included. "a b c d e f g h i j k l m n o p" at 14px with letter 8 painted
 * 211.72px into a 194px box. The box is Unity's; the painting has to follow it.
 *
 * Criteria: unwrapped text — painted width within 1px of the box width;
 * wrapped text — the painted line count equals the measured one and no painted
 * line is wider than the box + 1px.
 *
 * Deps/Effects: like run.mjs — UXML_TEXT_CHROMIUM, UXML_TEXT_FONTS (Inter-Regular.ttf),
 * bundles src/ with Vite in memory. Exits 1 when it cannot run.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const notRun = (why) => {
  console.error(`텍스트 코호트가 실행되지 않음 (paint): ${why}`);
  process.exit(1);
};
const chromiumPath = process.env.UXML_TEXT_CHROMIUM;
const fontDir = process.env.UXML_TEXT_FONTS;
if (!chromiumPath || !existsSync(chromiumPath)) notRun('UXML_TEXT_CHROMIUM is not a Chromium executable');
if (!fontDir || !existsSync(join(fontDir, 'Inter-Regular.ttf'))) notRun('UXML_TEXT_FONTS has no Inter-Regular.ttf');

// [text, font size, letter-spacing, word-spacing, extra USS, wraps]
const CASES = [
  ['Hello World Foo', 12, 5, 0, '', false],
  ['Hello World Foo', 20, 5, 0, '', false],
  ['Hello World Foo', 12, 5, 10, '', false],
  ['a b c d e f g h i j k l m n o p', 14, 8, 0, '', false],
  ['many  spaces   between    words     here', 14, 6, 4, '', false],
  ['Hello World Foo', 12, 5, 0, '-unity-text-generator: standard;', false],
  ['a b c d e f g h i j k l m n o p', 14, 8, 0, '-unity-text-generator: standard;', false],
  ['the quick brown fox jumps over the lazy dog again and again and again', 14, 6, 0, 'width: 200px; white-space: normal;', true],
  ['a b c d e f g h i j k l m n o p q r s t u v w x y z', 16, 10, 5, 'width: 150px; white-space: normal;', true],
];

const { chromium } = await import('playwright-core');
const { build } = await import('vite');
const bundled = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false, lib: { entry: join(ROOT, 'src/index.ts'), formats: ['iife'], name: 'UxmlCore', fileName: 'core' } } });
const coreJs = (Array.isArray(bundled) ? bundled[0] : bundled).output[0].code;

const browser = await chromium.launch({ executablePath: chromiumPath });
const page = await browser.newPage();
await page.route('http://paint.test/**', (route) => {
  const path = decodeURIComponent(new URL(route.request().url()).pathname);
  if (path === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><style>@font-face{font-family:"cohort-inter";src:url("/f/Inter-Regular.ttf")}</style><script src="/core.js"></script>' });
  if (path === '/core.js') return route.fulfill({ contentType: 'text/javascript', body: coreJs });
  if (path.startsWith('/f/')) return route.fulfill({ body: readFileSync(join(fontDir, path.slice(3))) });
  return route.fulfill({ status: 404, body: '' });
});
await page.goto('http://paint.test/');
const rows = await page.evaluate(async (cases) => {
  await document.fonts.load('14px "cohort-inter"');
  const core = globalThis.UxmlCore;
  await core.loadLayoutEngine();
  const face = { pointSize: 90, ascentLine: 87.1875, descentLine: -21.73295 };
  const out = [];
  for (const [text, fs, ls, ws, extra, wraps] of cases) {
    const host = document.createElement('div');
    document.body.append(host);
    const doc = core.parse(
      `<ui:UXML xmlns:ui="UnityEngine.UIElements"><ui:VisualElement style="align-items: flex-start;"><ui:Label name="t" text="${text}" /></ui:VisualElement></ui:UXML>`,
      `#t { padding: 0; margin: 0; white-space: nowrap; font-size: ${fs}px; letter-spacing: ${ls}px; word-spacing: ${ws}px; -unity-font-definition: url("project://database/Assets/Fonts/Inter-Regular.ttf"); ${extra} }`,
    );
    const r = core.render(doc, host, { size: { width: 800, height: 600 }, resolveFont: () => ({ family: 'cohort-inter', faceInfo: face }) });
    let id;
    const walk = (n) => {
      if (n.attributes.some((a) => a.name === 'name' && a.value === 't')) id = n.id;
      n.children.forEach(walk);
    };
    walk(r.document.root);
    const el = r.elements.get(id);
    const box = r.boxes.get(id);
    // Every painted line: group the text's client rects by their top edge.
    const range = document.createRange();
    range.selectNodeContents(el);
    const lines = new Map();
    for (const q of range.getClientRects()) {
      if (q.width === 0) continue;
      const top = Math.round(q.top);
      const l = lines.get(top) ?? { left: Infinity, right: -Infinity };
      l.left = Math.min(l.left, q.left);
      l.right = Math.max(l.right, q.right);
      lines.set(top, l);
    }
    const widths = [...lines.values()].map((l) => l.right - l.left);
    const lineHeight = (fs * (face.ascentLine - face.descentLine)) / face.pointSize;
    out.push({ text, fs, ls, ws, extra, wraps, boxW: box.width, boxH: box.height, measuredLines: Math.max(1, Math.round(box.height / lineHeight)), paintedLines: lines.size, widest: Math.max(...widths) });
    r.dispose();
    host.remove();
  }
  return out;
}, CASES);
await browser.close();

let failed = 0;
for (const r of rows) {
  const ok = r.wraps
    ? r.paintedLines === r.measuredLines && r.widest <= r.boxW + 1
    : r.paintedLines === 1 && Math.abs(r.widest - r.boxW) <= 1;
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${JSON.stringify(r.text)} ${r.fs}px ls ${r.ls} ws ${r.ws} ${r.extra} box ${r.boxW}x${r.boxH} (${r.measuredLines} lines) painted ${r.widest.toFixed(2)} (${r.paintedLines} lines)`);
}
console.log(`paint vs measure: ${rows.length - failed}/${rows.length}`);
process.exit(failed === 0 ? 0 : 1);
