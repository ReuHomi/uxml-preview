/**
 * The default measurer, in a real browser, against Unity's boxes (human decision 2026-10-21, review re-check R1-W).
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Why this file: the contract tests answer text sizes from the dump (a measuring stub) and the golden harness
 * measures with a fixed function that never wraps. Neither caught C1 (a default Label wrapped) or R1-W (a
 * wrapping text shrank its box to its longest line): both live in createDefaultMeasureText and the layout's
 * use of it. Here nothing is stubbed: render() without measureText, in Chromium, so the canvas measurer runs.
 *
 * The font: Inter-Regular.ttf, passed to the preview with Unity's FaceInfo (pointSize 90, ascent 87.1875,
 * descent -21.73295, lineHeight 108.9205). Unity's runtime default is NotInter, whose FaceInfo is Inter's
 * (tests/text-cohort/unity-runtime/), and the editor's default is Inter. Glyph widths still differ a little
 * between Chrome's and Unity's rasterisers, so the values judged are the ones that do not move with them:
 * line counts (through heights), heights, and box widths that the box's container decides.
 *
 * Sources: tests/layout/unity/6000.3.25f1/{probe-panel,probe-editor-070}/g-clamp.json and c-edge.json
 * (PanelDump / ProbeDump 0.7.0-r3, each probe alone in its Unity process); probes in
 * tests/layout/unity/probes-0.7.0/. Drawn on Unity's panel size, 800x600.
 *   R1-W — a text that wraps keeps the width it was offered: cs-te (TextElement), cs-wrap (Label with
 *          white-space: normal) and row-te-el (TextElement in a row) are 95/94/95 wide on the runtime panel,
 *          95/98/95 on the editor theme, not their longest line.
 *   C1   — a default Label and Button are one clipped line: cs-label, cs-button, cs-ellipsis, st-label.
 *   C4   — a multiline TextField's inner text keeps its wrapped height in a 40px field: ml-fixed inner text
 *          138x85 runtime, 154x59 editor; the field is 160x40.
 *   T2   — a percentage font-size is read as pixels: in a 10px parent `font-size: 200%` is 200 (not 20), 50% is
 *          50, and 200% under a 50% under 20px is 200 (t2-percent.json, both versions and themes: fontSize 200,
 *          50, 200). Judged: the painted font-size and letter-spacing (10px at 200 is 20px, spacing being a
 *          percentage of the font size), the box heights, which follow the size, and the widths within 1%.
 * Not judged: the runtime height of cs-te (Unity draws it 17, one line, inside this probe's Unity-side
 * contamination — docs/accuracy.md), and row-label / rh-label (20 in Unity, 21 here: the 1px left over when
 * the panel overflows, a known difference — docs/accuracy.md).
 *
 * Deps/Effects: UXML_TEXT_CHROMIUM, UXML_TEXT_FONTS (Inter-Regular.ttf); bundles src/ with Vite in memory.
 * Exits 1 when it cannot run or any row fails.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const notRun = (why) => {
  console.error(`텍스트 코호트가 실행되지 않음 (measure-real): ${why}`);
  process.exit(1);
};
const chromiumPath = process.env.UXML_TEXT_CHROMIUM;
const fontDir = process.env.UXML_TEXT_FONTS;
if (!chromiumPath || !existsSync(chromiumPath)) notRun('UXML_TEXT_CHROMIUM is not a Chromium executable');
if (!fontDir || !existsSync(join(fontDir, 'Inter-Regular.ttf'))) notRun('UXML_TEXT_FONTS has no Inter-Regular.ttf');

const UNITY = join(ROOT, 'tests', 'layout', 'unity');
const dump = (theme, probe) => JSON.parse(readFileSync(join(UNITY, '6000.3.25f1', theme === 'runtime' ? 'probe-panel' : 'probe-editor-070', `${probe}.json`), 'utf8').replace(/\bNaN\b/g, 'null'));
const probe = (name) => readFileSync(join(UNITY, 'probes-0.7.0', `${name}.uxml`), 'utf8');

const { chromium } = await import('playwright-core');
const { build } = await import('vite');
const bundled = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false, lib: { entry: join(ROOT, 'src/index.ts'), formats: ['iife'], name: 'UxmlCore', fileName: 'core' } } });
const coreJs = (Array.isArray(bundled) ? bundled[0] : bundled).output[0].code;
const browser = await chromium.launch({ executablePath: chromiumPath });
const page = await browser.newPage();
await page.route('http://measure.test/**', (route) => {
  const path = new URL(route.request().url()).pathname;
  if (path === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><style>@font-face{font-family:"u-inter";src:url("/inter.ttf")}body{margin:0}</style><script src="/core.js"></script>' });
  if (path === '/inter.ttf') return route.fulfill({ body: readFileSync(join(fontDir, 'Inter-Regular.ttf')) });
  return route.fulfill({ contentType: 'text/javascript', body: coreJs });
});
await page.goto('http://measure.test/');

/** Boxes of the named elements, and of a text part found by its text, drawn with the default measurer. */
const draw = (uxml, theme, partText, paintedOf) => page.evaluate(async ({ uxml, theme, partText, paintedOf }) => {
  await document.fonts.load('14px "u-inter"', 'Ag');
  const core = globalThis.UxmlCore;
  await core.loadLayoutEngine();
  const face = { pointSize: 90, ascentLine: 87.1875, descentLine: -21.73295, lineHeight: 108.9205 };
  const host = document.createElement('div');
  document.body.replaceChildren(host);
  const r = core.render(core.parse(uxml, '* { -unity-font-definition: url("project://database/Assets/Fonts/Inter-Regular.ttf"); }'), host,
    { theme, size: { width: 800, height: 600 }, resolveFont: () => ({ family: 'u-inter', faceInfo: face }) });
  const boxes = {};
  const walk = (n) => {
    const a = n.attributes.find((x) => x.name === 'name');
    if (a) {
      const b = r.boxes.get(n.id);
      boxes[a.value] = [Math.round(b.width), Math.round(b.height)];
      if (paintedOf) {
        // The element that holds the text: its computed font-size and letter-spacing.
        let el = r.elements.get(n.id);
        while (el.children.length === 1 && el.children[0].textContent === el.textContent) el = el.children[0];
        const cs = getComputedStyle(el.firstChild?.nodeType === 1 ? el.firstChild : el);
        boxes[`${a.value}#css`] = [cs.fontSize, cs.letterSpacing];
      }
    }
    n.children.forEach(walk);
  };
  walk(r.document.root);
  if (partText) {
    // The deepest painted element whose text is the value: the inner text part.
    let found = null;
    const visit = (e) => { for (const c of e.children) visit(c); if (found === null && e.textContent === partText) found = e; };
    visit(host);
    const b = found.getBoundingClientRect();
    boxes['#part'] = [Math.round(b.width), Math.round(b.height)];
  }
  r.dispose();
  return boxes;
}, { uxml, theme, partText, paintedOf });

const rows = [];
const judge = (label, ours, unity) => {
  const ok = ours !== undefined && ours[0] === unity[0] && ours[1] === unity[1];
  rows.push(ok);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}: ours ${ours?.join('x')}, Unity ${unity.join('x')}`);
};
const judgeWidth = (label, ours, unity) => {
  const ok = ours !== undefined && ours[0] === unity[0];
  rows.push(ok);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label} (width): ours ${ours?.[0]}, Unity ${unity[0]}`);
};

for (const theme of ['runtime', 'editor']) {
  const gc = dump(theme, 'g-clamp');
  const u = (name) => { const e = gc.elements.find((x) => x.name === name); return [e.w, e.h]; };
  const ours = await draw(probe('g-clamp'), theme);
  // R1-W
  for (const name of ['cs-wrap', 'row-te-el']) judge(`${theme} R1-W ${name}`, ours[name], u(name));
  if (theme === 'editor') judge(`${theme} R1-W cs-te`, ours['cs-te'], u('cs-te'));
  else judgeWidth(`${theme} R1-W cs-te`, ours['cs-te'], u('cs-te'));
  // C1
  for (const name of ['cs-label', 'cs-button', 'cs-ellipsis', 'st-label']) judge(`${theme} C1 ${name}`, ours[name], u(name));
  // C4
  const ce = dump(theme, 'c-edge');
  const value = 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod';
  const edge = await draw(probe('c-edge'), theme, value);
  const field = ce.elements.find((x) => x.name === 'ml-fixed');
  const inner = ce.elements.find((x) => x.path.endsWith('ml-fixed/unity-text-input/VisualElement[0]/TextElement[0]'));
  judge(`${theme} C4 ml-fixed`, edge['ml-fixed'], [field.w, field.h]);
  judge(`${theme} C4 ml-fixed inner text`, edge['#part'], [inner.w, inner.h]);
}

for (const theme of ['runtime', 'editor']) {
  const t2 = dump(theme, 't2-percent');
  const ours = await draw(probe('t2-percent'), theme, undefined, true);
  for (const [name, size, spacing] of [['pc200', 200, 0], ['pc50', 50, 0], ['nest200', 200, 0], ['pc200-ls', 200, 20]]) {
    const e = t2.elements.find((x) => x.name === name);
    const css = ours[`${name}#css`] ?? [];
    const okCss = parseFloat(css[0]) === size && (spacing === 0 ? css[1] === 'normal' || parseFloat(css[1]) === 0 : parseFloat(css[1]) === spacing);
    const okBox = ours[name] !== undefined && ours[name][1] === e.h && Math.abs(ours[name][0] - e.w) <= e.w * 0.01;
    rows.push(okCss && okBox);
    console.log(`${okCss && okBox ? 'ok  ' : 'FAIL'} ${theme} T2 ${name}: painted font-size ${css[0]}, letter-spacing ${css[1]} (Unity ${size}px, ${spacing}px); box ${ours[name]?.join('x')}, Unity ${e.w}x${e.h}`);
  }
}

await browser.close();
const failed = rows.filter((ok) => !ok).length;
console.log(`measure real: ${rows.length - failed}/${rows.length}`);
process.exit(failed === 0 ? 0 : 1);
