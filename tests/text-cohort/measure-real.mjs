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
 * Sources: tests/layout/unity/6000.3.25f1/{probe-panel,probe-editor-070}/{g-clamp,c-edge,t2-percent,r1w-wrap,
 * r1w-wrap2,r1w-long}.json (PanelDump / ProbeDump 0.7.0-r3, each probe alone in its Unity process); probes in
 * tests/layout/unity/probes-0.7.0/. Drawn on Unity's panel size, 800x600.
 *   R1-W — the width of a text that wraps (r1w-wrap, r1w-wrap2: every sentence used once, so no Unity-side
 *          contamination). Advanced (the 6.3 editor): the longest line. Standard (the runtime panel): the width up
 *          to the last glyph that fit when a line broke — the line, its space and the start of the next word —
 *          floor + 1. A word longer than the line breaks between characters (long100, longlb100). Japanese and
 *          Chinese break between characters (ja100, zh100). Judged: every text's box, width and height.
 *          r1w-long (2026-10-21, both versions and themes alike): a word longer than the line breaks between
 *          characters in Korean and English, in a TextElement (kolong, enlong), a Label with white-space: normal
 *          (kolb, enlb) and a multiline TextField with white-space: normal (entf, kotf; the field's box).
 *          Replaced 2026-10-21 (human approval): the first expectations came from g-clamp's cs-te, cs-wrap and
 *          row-te-el, whose sentence the probe repeats with different wrap settings (the Unity-side contamination):
 *          old 95/94/95 runtime, 95/98/95 editor.
 *          Known differences, judged by height only and failing once the width matches: the runtime ko100 (Korean,
 *          Pretendard: Unity 83 wide, the longest line floor + 1 — the rule's next-word start over-counts by 4px)
 *          and the runtime te10 (10px: Unity 77, the rule 79).
 *   C1   — a default Label and Button are one clipped line: cs-label, cs-button, cs-ellipsis, st-label.
 *   C4   — a multiline TextField's inner text keeps its wrapped height in a 40px field: ml-fixed inner text
 *          138x85 runtime, 154x59 editor; the field is 160x40.
 *   T2   — a percentage font-size is read as pixels: in a 10px parent `font-size: 200%` is 200 (not 20), 50% is
 *          50, and 200% under a 50% under 20px is 200 (t2-percent.json, both versions and themes: fontSize 200,
 *          50, 200). Judged: the painted font-size and letter-spacing (10px at 200 is 20px, spacing being a
 *          percentage of the font size), the box heights, which follow the size, and the widths within 1%.
 * Not judged: the runtime height of st-label (contaminated: 21 here, 25 alone — plan section 34), the runtime height of cs-te (Unity draws it 17, one line, inside this probe's Unity-side
 * contamination — docs/accuracy.md), and row-label / rh-label (20 in Unity, 21 here: the 1px left over when
 * the panel overflows, a known difference — docs/accuracy.md).
 *
 * R1-W also checks the painted text: its ink stays inside the box (1px), so a word the measurer breaks is broken
 * when painted too.
 *
 * Deps/Effects: UXML_TEXT_CHROMIUM, UXML_TEXT_FONTS (Inter, Noto Sans JP/SC, Pretendard); bundles src/ with Vite in memory.
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
const FONTS = {
  'Inter-Regular.ttf': { family: 'u-inter', face: { pointSize: 90, ascentLine: 87.1875, descentLine: -21.73295, lineHeight: 108.9205 } },
  'NotoSansJP-Regular.otf': { family: 'u-noto-jp', face: { pointSize: 90, ascentLine: 104.4, descentLine: -25.92, lineHeight: 130.32 } },
  'NotoSansSC-Regular.otf': { family: 'u-noto-sc', face: { pointSize: 90, ascentLine: 104.4, descentLine: -25.92, lineHeight: 130.32 } },
  'Pretendard-Regular.otf': { family: 'u-pretendard', face: { pointSize: 90, ascentLine: 85.64941, descentLine: -21.70898, lineHeight: 107.3584 } },
};
for (const file of Object.keys(FONTS)) if (!fontDir || !existsSync(join(fontDir, file))) notRun(`UXML_TEXT_FONTS has no ${file}`);

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
  if (path === '/') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><style>${Object.entries(FONTS).map(([file, f]) => `@font-face{font-family:"${f.family}";src:url("/f/${file}")}`).join('')}body{margin:0}</style><script src="/core.js"></script>` });
  if (path.startsWith('/f/')) return route.fulfill({ body: readFileSync(join(fontDir, path.slice(3))) });
  return route.fulfill({ contentType: 'text/javascript', body: coreJs });
});
await page.goto('http://measure.test/');

/** Boxes of the named elements, and of a text part found by its text, drawn with the default measurer. */
const draw = (uxml, theme, partText, paintedOf, uss = '') => page.evaluate(async ({ uxml, theme, partText, paintedOf, uss, fonts }) => {
  for (const f of Object.values(fonts)) await document.fonts.load(`14px "${f.family}"`, 'Ag\u3086\u6625\ud558');
  const core = globalThis.UxmlCore;
  await core.loadLayoutEngine();
  const host = document.createElement('div');
  document.body.replaceChildren(host);
  // Unity's default font has Inter's FaceInfo (NotInter on the runtime panel); a probe class names another font.
  // On :root, so it is inherited like Unity's panel default: a `*` rule would hit a TextField's inner text
  // directly and override the font the field inherits (r1w-long kotf).
  const r = core.render(core.parse(uxml, `:root { -unity-font-definition: url("project://database/Assets/Fonts/Inter-Regular.ttf"); } ${uss}`), host,
    { theme, size: { width: 800, height: 600 }, resolveFont: (path) => {
      const file = Object.keys(fonts).find((k) => path.endsWith(k)) ?? 'Inter-Regular.ttf';
      return { family: fonts[file].family, faceInfo: fonts[file].face };
    } });
  const boxes = {};
  const walk = (n) => {
    const a = n.attributes.find((x) => x.name === 'name');
    if (a) {
      const b = r.boxes.get(n.id);
      boxes[a.value] = [Math.round(b.width), Math.round(b.height)];
      // How far the painted text runs past the element's box (right, bottom), from its text nodes' rects.
      const el = r.elements.get(n.id);
      const box = el.getBoundingClientRect();
      let right = -Infinity, bottom = -Infinity;
      const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let t = tw.nextNode(); t !== null; t = tw.nextNode()) {
        const range = document.createRange();
        range.selectNodeContents(t);
        for (const q of range.getClientRects()) if (q.width > 0) { right = Math.max(right, q.right); bottom = Math.max(bottom, q.bottom); }
      }
      boxes[`${a.value}#ink`] = [right - box.right, bottom - box.bottom];
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
}, { uxml, theme, partText, paintedOf, uss, fonts: FONTS });

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
  // C1
  for (const name of ['cs-label', 'cs-button', 'cs-ellipsis']) judge(`${theme} C1 ${name}`, ours[name], u(name));
  // st-label's runtime height (21) is contaminated: alone, Unity draws it 25 (2026-10-21 check, plan section 34);
  // in this probe the preview's 21 comes from the panel overflowing. Its width is judged on both themes.
  if (theme === 'editor') judge(`${theme} C1 st-label`, ours['st-label'], u('st-label'));
  else judgeWidth(`${theme} C1 st-label`, ours['st-label'], u('st-label'));
  // C4
  const ce = dump(theme, 'c-edge');
  const value = 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod';
  const edge = await draw(probe('c-edge'), theme, value);
  const field = ce.elements.find((x) => x.name === 'ml-fixed');
  const inner = ce.elements.find((x) => x.path.endsWith('ml-fixed/unity-text-input/VisualElement[0]/TextElement[0]'));
  judge(`${theme} C4 ml-fixed`, edge['ml-fixed'], [field.w, field.h]);
  judge(`${theme} C4 ml-fixed inner text`, edge['#part'], [inner.w, inner.h]);
}

// R1-W: every text of the two clean wrap probes.
const KNOWN_R1W = new Set(['runtime ko100', 'runtime te10']);
for (const theme of ['runtime', 'editor']) {
  for (const name of ['r1w-wrap', 'r1w-wrap2', 'r1w-long']) {
    const d = dump(theme, name);
    const uss = existsSync(join(UNITY, 'probes-0.7.0', `${name}.uss`)) ? readFileSync(join(UNITY, 'probes-0.7.0', `${name}.uss`), 'utf8') : '';
    const ours = await draw(probe(name), theme, undefined, false, uss);
    for (const e of d.elements.filter((x) => (x.text !== undefined || x.type === 'TextField') && x.name)) {
      if (KNOWN_R1W.has(`${theme} ${e.name}`)) {
        const ok = ours[e.name] !== undefined && ours[e.name][1] === e.h && ours[e.name][0] !== e.w;
        rows.push(ok);
        console.log(`${ok ? 'know' : 'FAIL'} ${theme} R1-W ${e.name} (known width difference): ours ${ours[e.name]?.join('x')}, Unity ${e.w}x${e.h}`);
      } else judge(`${theme} R1-W ${e.name}`, ours[e.name], [e.w, e.h]);
      // The painted text breaks where the measurer broke it: its ink stays inside the box (1px).
      const [overRight, overBottom] = ours[`${e.name}#ink`] ?? [Infinity, Infinity];
      const inside = overRight <= 1 && overBottom <= 1;
      rows.push(inside);
      console.log(`${inside ? 'ok  ' : 'FAIL'} ${theme} R1-W ${e.name} painted inside its box: past the right ${overRight.toFixed(1)}px, past the bottom ${overBottom.toFixed(1)}px`);
    }
  }
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
