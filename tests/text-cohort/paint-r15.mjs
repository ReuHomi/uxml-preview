/**
 * 0.7.0 review fixes, round 1.5 — what is painted, measured in a real browser (human decision 2026-10-21).
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Why a browser: every item here is about the painted page, which jsdom does not lay out. The box tests
 * (contract-070/*) passed while these defects were there: a box can be right and the glyphs inside it
 * wrong. Each section names its evidence.
 *
 * T9  — painted lines sit where the measurer put them. The measurer's line k (0-based) spans
 *       [k·adv, k·adv + fs·r] from the text's content top: Standard adv = fs·lineHeight/pointSize,
 *       Advanced adv = fs·r, r = (ascent − descent)/pointSize (measure.ts textHeight, plan §29,
 *       tests/text-cohort/unity-runtime/). Criterion: each painted line's centre within 1px of the
 *       measured line's centre, as many painted lines as measured, the last painted line inside the box
 *       (+1px). Jua (FaceInfo r 1.0, lineHeight 1.25) separates the generators; Inter does not.
 *       A line break (\n) is a line in Unity whatever the white-space (g-clamp.json reg-plain:
 *       "Hello world\nwide text", NoWrap, two lines), so a no-wrap Label with \n paints its lines.
 * S4  — a :checked forced through `states` paints like value="true": Unity puts Checked on the control
 *       and its input part (6000.3.25f1/probe-panel/c07-Toggle.json: t-checked and its
 *       VisualElement[0]/[1] input), and value="true" is pinned against Unity (bundle-e.test.ts).
 *       Criterion: the forced render's part geometry, check-mark SVG and author :checked rules equal the
 *       value="true" render's. Toggle and RadioButton, both themes.
 * K9  — an author rule beats the painter's substitute colours: an author background-color on
 *       .unity-toggle__checkmark is the painted background, and an author
 *       -unity-background-image-tint-color is the check mark's colour, on both themes (CLAUDE.md:
 *       the theme is the lowest origin; the editor box colours are a stand-in for Unity's texture).
 * T12 — kerning follows each text's own generator: a Standard parent does not switch kerning off for an
 *       Advanced child. Criterion: computed font-kerning none / normal, and the child's painted width
 *       within 1px of its box (Jua kerns Latin pairs, plan §29).
 * T1  — pre-wrap keeps runs of spaces when it wraps (probe-editor/spaces-prewrap.json): painted lines
 *       equal the measured lines and no painted line is wider than the box + 1px.
 * T7  — a TextField keeps runs of spaces in its value on both themes and versions
 *       (tests/layout/unity/<version>/{probe-panel,probe-editor-070}/r15-tf-spaces.json:
 *       "a     b     c" measures 64 against "a b c" 33 on the runtime panel, 55 against 28 on the
 *       editor). Criterion: the painted value is as wide as the inner text box (1px), and wider than
 *       "a b c" by at least eight spaces.
 * C5  — a text wider than its box, as Unity's pictures show it (r15-overflow, -panelPng, both versions,
 *       both themes; docs/design/0.7.0-r15-shots/): a Label's glyphs run past its box; overflow: hidden
 *       cuts them at the box; text-overflow: ellipsis alone changes nothing, with overflow: hidden it
 *       ends in an ellipsis; a Button's centred text runs past both sides (6.3; 6000.0 clips it — the
 *       preview draws 6.3).
 *
 * Deps/Effects: as paint.mjs — UXML_TEXT_CHROMIUM, UXML_TEXT_FONTS (Inter-Regular.ttf, Jua-Regular.ttf),
 * bundles src/ with Vite in memory. Exits 1 when it cannot run or any row fails.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const notRun = (why) => {
  console.error(`텍스트 코호트가 실행되지 않음 (paint-r15): ${why}`);
  process.exit(1);
};
const chromiumPath = process.env.UXML_TEXT_CHROMIUM;
const fontDir = process.env.UXML_TEXT_FONTS;
if (!chromiumPath || !existsSync(chromiumPath)) notRun('UXML_TEXT_CHROMIUM is not a Chromium executable');
for (const file of ['Inter-Regular.ttf', 'Jua-Regular.ttf']) {
  if (!fontDir || !existsSync(join(fontDir, file))) notRun(`UXML_TEXT_FONTS has no ${file}`);
}

// FaceInfo as Unity reports it (tests/text-cohort/unity/<version>/).
const FONTS = {
  inter: { file: 'Inter-Regular.ttf', family: 'r15-inter', face: { pointSize: 90, ascentLine: 87.1875, descentLine: -21.73295, lineHeight: 108.9205 } },
  jua: { file: 'Jua-Regular.ttf', family: 'r15-jua', face: { pointSize: 90, ascentLine: 72, descentLine: -18, lineHeight: 112.5 } },
};

const { chromium } = await import('playwright-core');
const { build } = await import('vite');
const bundled = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false, lib: { entry: join(ROOT, 'src/index.ts'), formats: ['iife'], name: 'UxmlCore', fileName: 'core' } } });
const coreJs = (Array.isArray(bundled) ? bundled[0] : bundled).output[0].code;

const browser = await chromium.launch({ executablePath: chromiumPath });
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
await page.route('http://paint.test/**', (route) => {
  const path = decodeURIComponent(new URL(route.request().url()).pathname);
  if (path === '/') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><style>body{margin:0}${Object.values(FONTS).map((f) => `@font-face{font-family:"${f.family}";src:url("/f/${f.file}")}`).join('')}</style><script src="/core.js"></script>` });
  if (path === '/core.js') return route.fulfill({ contentType: 'text/javascript', body: coreJs });
  if (path.startsWith('/f/')) return route.fulfill({ body: readFileSync(join(fontDir, path.slice(3))) });
  return route.fulfill({ status: 404, body: '' });
});
await page.goto('http://paint.test/');
await page.evaluate(async (fonts) => {
  for (const f of Object.values(fonts)) await document.fonts.load(`20px "${f.family}"`, 'AgVa');
  await globalThis.UxmlCore.loadLayoutEngine();
  // Shared helpers, kept on window for the evaluate calls below.
  globalThis.R15 = {
    fonts,
    draw(body, uss, { theme, font, states } = {}) {
      document.body.replaceChildren();
      const host = document.createElement('div');
      document.body.append(host);
      const core = globalThis.UxmlCore;
      const f = fonts[font ?? 'inter'];
      const doc = core.parse(`<ui:UXML xmlns:ui="UnityEngine.UIElements">${body}</ui:UXML>`, uss);
      const r = core.render(doc, host, { theme, size: { width: 800, height: 600 },
        resolveFont: () => ({ family: f.family, faceInfo: f.face }), ...(states ? { states } : {}) });
      const named = new Map();
      const walk = (n) => {
        const a = n.attributes.find((x) => x.name === 'name');
        if (a) named.set(a.value, n);
        n.children.forEach(walk);
      };
      walk(r.document.root);
      return { r, el: (name) => r.elements.get(named.get(name).id), box: (name) => r.boxes.get(named.get(name).id), face: f.face };
    },
    // Painted lines of the text under `el`: client rects of its text, grouped by their vertical centre.
    lines(el) {
      const range = document.createRange();
      range.selectNodeContents(el);
      const rows = [];
      for (const q of range.getClientRects()) {
        if (q.width === 0 || q.height === 0) continue;
        const c = (q.top + q.bottom) / 2;
        const row = rows.find((x) => Math.abs(x.c - c) < q.height / 2);
        if (row) { row.left = Math.min(row.left, q.left); row.right = Math.max(row.right, q.right); row.top = Math.min(row.top, q.top); row.bottom = Math.max(row.bottom, q.bottom); }
        else rows.push({ c, left: q.left, right: q.right, top: q.top, bottom: q.bottom });
      }
      return rows.sort((a, b) => a.c - b.c);
    },
    // The deepest element whose text is `text`.
    textHost(el, text) {
      let found = null;
      const visit = (n) => {
        for (const c of n.children) visit(c);
        if (found === null && n.textContent === text) found = n;
      };
      visit(el);
      return found ?? el;
    },
    contentTop(host) {
      const cs = getComputedStyle(host);
      return host.getBoundingClientRect().top + parseFloat(cs.borderTopWidth) + parseFloat(cs.paddingTop);
    },
  };
}, FONTS);

const results = [];
const check = (section, name, ok, detail) => {
  results.push({ section, name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${section.padEnd(4)} ${name} — ${detail}`);
};

// ---------------------------------------------------------------- T9
const T9_TEXT = 'Alpha beta&#10;Gamma delta&#10;Epsilon';
const T9_WRAP = 'alpha beta gamma delta epsilon zeta eta theta';
// [label, UXML, USS, text, lines]: lines is the measured line count where the text fixes it (explicit
// breaks, no wrapping); otherwise it is read back from the box height. A TextField's inner text box can be
// taller than its text (the input's minimum), so its count cannot come from the box.
const T9_CASES = [
  ['label \\n (no-wrap)', `<ui:Label name="t" text="${T9_TEXT}" />`, '#t { padding: 0; margin: 0; font-size: 20px; }', 'Alpha beta\nGamma delta\nEpsilon', 3],
  ['label wraps', `<ui:Label name="t" text="${T9_WRAP}" />`, '#t { padding: 0; margin: 0; font-size: 20px; width: 120px; white-space: normal; }', T9_WRAP, null],
  ['TextElement wraps', `<ui:TextElement name="t" text="${T9_WRAP}" />`, '#t { padding: 0; margin: 0; font-size: 20px; width: 120px; }', T9_WRAP, null],
  ['TextField multiline', `<ui:TextField name="t" multiline="true" value="${T9_TEXT}" />`, '#t { font-size: 20px; }', 'Alpha beta\nGamma delta\nEpsilon', 3],
];
for (const theme of ['runtime', 'editor']) {
  for (const font of ['jua', 'inter']) {
    for (const [label, body, uss, text, lines] of T9_CASES) {
      for (const authorStandard of theme === 'editor' ? [false, true] : [false]) {
        const row = await page.evaluate(({ body, uss, theme, font, text, authorStandard, lines }) => {
          const R = globalThis.R15;
          const d = R.draw(`<ui:VisualElement style="align-items: flex-start;">${body}</ui:VisualElement>`,
            `${uss} * { -unity-font-definition: url("project://database/Assets/Fonts/f.ttf"); }${authorStandard ? ' #t { -unity-text-generator: standard; }' : ''}`, { theme, font });
          const host = R.textHost(d.el('t'), text);
          const standard = theme === 'runtime' || authorStandard;
          const fs = 20, r = (d.face.ascentLine - d.face.descentLine) / d.face.pointSize, lh = (d.face.lineHeight ?? d.face.ascentLine - d.face.descentLine) / d.face.pointSize;
          const adv = standard ? fs * lh : fs * r;
          const top = R.contentTop(host);
          const cs = getComputedStyle(host);
          const contentBottom = host.getBoundingClientRect().bottom - parseFloat(cs.borderBottomWidth) - parseFloat(cs.paddingBottom);
          const painted = R.lines(host);
          const measuredLines = lines ?? Math.max(1, Math.round((host.getBoundingClientRect().height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth) - fs * r) / adv) + 1);
          const offsets = painted.map((p, k) => (p.c - top) - (k * adv + fs * r / 2));
          const lastBottom = painted.length ? painted[painted.length - 1].bottom : 0;
          d.r.dispose();
          return { generator: standard ? 'standard' : 'advanced', paintedLines: painted.length, measuredLines, offsets, overBottom: lastBottom - contentBottom };
        }, { body, uss, theme, font, text, authorStandard, lines });
        const worst = Math.max(0, ...row.offsets.map(Math.abs));
        const ok = row.paintedLines === row.measuredLines && worst <= 1 && row.overBottom <= 1;
        check('T9', `${theme}${authorStandard ? '+standard' : ''} ${font} ${label}`, ok,
          `${row.generator}: painted ${row.paintedLines} lines, measured ${row.measuredLines}; worst line offset ${worst.toFixed(2)}px; last line past the box ${row.overBottom.toFixed(2)}px`);
      }
    }
  }
}

// ---------------------------------------------------------------- S4
for (const theme of ['runtime', 'editor']) {
  for (const control of ['Toggle', 'RadioButton']) {
    const row = await page.evaluate(({ theme, control }) => {
      const R = globalThis.R15;
      const uss = '.unity-toggle__input:checked, .unity-radio-button__input:checked { margin-left: 13px; }';
      const geometry = (d) => {
        const el = d.el('c');
        const rects = [...el.querySelectorAll('*')].filter((e) => !(e instanceof SVGElement) || e.tagName === 'svg')
          .map((e) => { const b = e.getBoundingClientRect(); return `${e.tagName}:${Math.round(b.left)},${Math.round(b.top)},${Math.round(b.width)}x${Math.round(b.height)}`; });
        return { rects: rects.join(' '), svg: el.querySelectorAll('svg').length };
      };
      const checked = R.draw(`<ui:${control} name="c" label="Label" value="true" />`, uss, { theme });
      const a = geometry(checked);
      checked.r.dispose();
      const forced = R.draw(`<ui:${control} name="c" label="Label" value="false" />`, uss, { theme, states: { '#c': ['checked'] } });
      const b = geometry(forced);
      forced.r.dispose();
      return { same: a.rects === b.rects && a.svg === b.svg, a, b };
    }, { theme, control });
    check('S4', `${theme} ${control}`, row.same, row.same ? `forced :checked paints as value="true" (${row.a.svg} svg)` : `value="true" ${row.a.svg} svg vs forced ${row.b.svg} svg; geometry ${row.a.rects === row.b.rects ? 'same' : 'differs'}`);
  }
}

// ---------------------------------------------------------------- K9
for (const theme of ['runtime', 'editor']) {
  const row = await page.evaluate(({ theme }) => {
    const R = globalThis.R15;
    const d = R.draw('<ui:Toggle name="c" label="Label" value="true" />',
      '.unity-toggle__checkmark { background-color: rgb(1, 2, 3); -unity-background-image-tint-color: rgb(200, 0, 0); }', { theme });
    const svg = d.el('c').querySelector('svg');
    const mark = svg?.parentElement;
    const out = { bg: mark ? getComputedStyle(mark).backgroundColor : null, stroke: svg?.querySelector('path')?.getAttribute('stroke') ?? null };
    d.r.dispose();
    return out;
  }, { theme });
  const strokeOk = /^(rgb\(200, ?0, ?0\)|#c80000)$/i.test(row.stroke ?? '');
  check('K9', `${theme} author checkmark background`, row.bg === 'rgb(1, 2, 3)', `painted ${row.bg}`);
  check('K9', `${theme} author checkmark tint`, strokeOk, `stroke ${row.stroke}`);
}

// ---------------------------------------------------------------- T12
for (const theme of ['runtime', 'editor']) {
  const row = await page.evaluate(({ theme }) => {
    const R = globalThis.R15;
    const d = R.draw('<ui:TextElement name="p" text="Parent"><ui:Label name="c" text="AVAVAV To Ty" /></ui:TextElement>',
      '#p { -unity-text-generator: standard; font-size: 20px; align-items: flex-start; } #c { -unity-text-generator: advanced; padding: 0; margin: 0; font-size: 20px; }', { theme, font: 'jua' });
    const child = R.textHost(d.el('c'), 'AVAVAV To Ty');
    const parent = R.textHost(d.el('p'), 'Parent');
    const lines = R.lines(child);
    const out = { parent: getComputedStyle(parent).fontKerning, child: getComputedStyle(child).fontKerning,
      painted: lines.length ? lines[0].right - lines[0].left : 0, box: d.box('c').width };
    d.r.dispose();
    return out;
  }, { theme });
  const ok = row.parent === 'none' && row.child !== 'none' && Math.abs(row.painted - row.box) <= 1;
  check('T12', `${theme} standard parent, advanced child`, ok, `parent ${row.parent}, child ${row.child}; child painted ${row.painted.toFixed(2)} in box ${row.box}`);
}

// ---------------------------------------------------------------- T1
for (const theme of ['runtime', 'editor']) {
  const text = 'a    b    c    d    e    f    g    h';
  const row = await page.evaluate(({ theme, text }) => {
    const R = globalThis.R15;
    const d = R.draw(`<ui:VisualElement style="align-items: flex-start;"><ui:Label name="t" text="${text}" /></ui:VisualElement>`,
      '#t { padding: 0; margin: 0; font-size: 20px; width: 160px; white-space: pre-wrap; }', { theme });
    const host = R.textHost(d.el('t'), text);
    const face = d.face, fs = 20, r = (face.ascentLine - face.descentLine) / face.pointSize;
    const lines = R.lines(host);
    const out = { painted: lines.length, measured: Math.max(1, Math.round(d.box('t').height / (fs * r))),
      widest: Math.max(...lines.map((l) => l.right - l.left)), box: d.box('t').width };
    d.r.dispose();
    return out;
  }, { theme, text });
  const ok = row.painted === row.measured && row.widest <= row.box + 1;
  check('T1', `${theme} pre-wrap runs`, ok, `painted ${row.painted} lines, measured ${row.measured}; widest ${row.widest.toFixed(2)} in ${row.box}`);
}

// ---------------------------------------------------------------- T7
for (const theme of ['runtime', 'editor']) {
  const row = await page.evaluate(({ theme }) => {
    const R = globalThis.R15;
    const width = (value) => {
      const d = R.draw(`<ui:VisualElement style="align-items: flex-start;"><ui:TextField name="t" value="${value}" /></ui:VisualElement>`, '', { theme });
      const host = R.textHost(d.el('t'), value);
      const cs = getComputedStyle(host);
      const content = host.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
      const lines = R.lines(host);
      const painted = lines.length ? lines[0].right - lines[0].left : 0;
      d.r.dispose();
      return { content, painted };
    };
    const space = (() => {
      const c = document.createElement('canvas').getContext('2d');
      c.font = `${theme === 'runtime' ? 14 : 12}px "r15-inter"`;
      return c.measureText(' ').width;
    })();
    return { runs: width('a     b     c'), plain: width('a b c'), space };
  }, { theme });
  check('T7', `${theme} TextField runs: painted = box`, Math.abs(row.runs.painted - row.runs.content) <= 1,
    `painted ${row.runs.painted.toFixed(2)}, inner text box ${row.runs.content.toFixed(2)}`);
  check('T7', `${theme} TextField runs: kept`, row.runs.content >= row.plain.content + 8 * row.space - 1,
    `"a     b     c" box ${row.runs.content.toFixed(2)} vs "a b c" ${row.plain.content.toFixed(2)} (+8 spaces = ${(8 * row.space).toFixed(2)})`);
}

// ---------------------------------------------------------------- C5
const OVERFLOW_UXML = readFileSync(join(ROOT, 'tests', 'layout', 'unity', 'probes-0.7.0', 'r15-overflow.uxml'), 'utf8')
  .replace(/^<ui:UXML[^>]*>/, '').replace(/<\/ui:UXML>\s*$/, '');
for (const theme of ['runtime', 'editor']) {
  const row = await page.evaluate(({ theme, body }) => {
    const R = globalThis.R15;
    const d = R.draw(body, '', { theme });
    const text = 'The quick brown fox jumps';
    const col = d.el('col').getBoundingClientRect();
    const out = { colRight: col.right };
    for (const name of ['o-label', 'o-button', 'o-hidden', 'o-ellipsis', 'o-ellipsis-hidden']) {
      const el = d.el(name);
      el.setAttribute('data-r15', name);
      const b = el.getBoundingClientRect();
      const lines = R.lines(R.textHost(el, text));
      out[name] = { left: b.left, right: b.right, top: b.top, bottom: b.bottom, inkLeft: lines[0]?.left ?? 0, inkRight: lines[0]?.right ?? 0 };
    }
    return out;
  }, { theme, body: OVERFLOW_UXML });
  // Pixels decide what is visible: a band right of the column (the column's own background ends at its
  // edge, so the band starts past it), and the box's last 14px.
  const shot = async (name, clip) => page.screenshot({ clip, type: 'png' });
  const strip = (r) => ({ x: Math.round(row.colRight) + 2, y: Math.round(r.top) + 2, width: 30, height: Math.round(r.bottom - r.top) - 4 });
  const tail = (r) => ({ x: Math.round(r.right) - 16, y: Math.round(r.top), width: 14, height: Math.round(r.bottom - r.top) });
  const blank = (png) => png.equals(Buffer.alloc(0)) ? true : null;
  const bufferOf = async (clip) => (await shot('', clip)).toString('base64');
  const allBackground = async (clip) => {
    const data = await page.evaluate(async ({ b64 }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const px = g.getImageData(0, 0, c.width, c.height).data;
      const first = [px[0], px[1], px[2]];
      for (let i = 0; i < px.length; i += 4) if (Math.abs(px[i] - first[0]) + Math.abs(px[i + 1] - first[1]) + Math.abs(px[i + 2] - first[2]) > 30) return false;
      return true;
    }, { b64: await bufferOf(clip) });
    return data;
  };
  void blank;
  const label = row['o-label'];
  check('C5', `${theme} Label glyphs run past the box`, label.inkRight > label.right + 5 && !(await allBackground(strip(label))), `ink right ${label.inkRight.toFixed(1)} vs box right ${label.right.toFixed(1)}`);
  const hidden = row['o-hidden'];
  check('C5', `${theme} overflow: hidden cuts at the box`, await allBackground(strip(hidden)), 'nothing painted right of the box');
  const ell = row['o-ellipsis'];
  check('C5', `${theme} ellipsis alone changes nothing`, !(await allBackground(strip(ell))), 'glyphs still run past the box');
  const eh = row['o-ellipsis-hidden'];
  const tailA = await bufferOf(tail(eh));
  const tailB = await bufferOf(tail(hidden));
  check('C5', `${theme} ellipsis + hidden ends in an ellipsis`, (await allBackground(strip(eh))) && tailA !== tailB, 'cut at the box, and its last 14px differ from overflow: hidden alone');
  const button = row['o-button'];
  check('C5', `${theme} Button text runs past both sides (6.3)`, button.inkLeft < button.left - 5 && button.inkRight > button.right + 5, `ink ${button.inkLeft.toFixed(1)}–${button.inkRight.toFixed(1)} vs box ${button.left.toFixed(1)}–${button.right.toFixed(1)}`);
}

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`paint r15: ${results.length - failed}/${results.length}`);
process.exit(failed === 0 ? 0 : 1);
