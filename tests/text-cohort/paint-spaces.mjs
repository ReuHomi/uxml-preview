/**
 * 0.8.0 — spaces as painted, in a real browser (docs/backlog.md 0.8 item 3: N2, T6).
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Evidence (tests/contract-080/spaces.test.ts reads the numbers from the dumps):
 *   r15-label-spaces.json — a Label keeps runs of spaces on the Standard generator (runtime panel both versions,
 *     6000.0 editor: "a     b     c" 64 vs "a b c" 33 at 14px) and collapses them on Advanced (6000.3 editor,
 *     28 vs 28). spaces.json — Standard keeps leading spaces ("   abc" 52 vs 35 on Advanced).
 *   r15-tf-spaces.json — a TextField's inner text box counts trailing spaces on every generator (49 runtime,
 *     43 editor, padding 4).
 *   Standard drops a Label's trailing spaces: read from MeasureTextSize on the TextField text, not dumped for a
 *     Label (assumption, spaces.test.ts header).
 *
 * What is judged: measuring and painting agree. The box comes from the measurer; the glyphs from the browser.
 *   S1 — runtime Label runs: the painted line is as wide as the content box (1px), and the box is wider than
 *        "a b c" by at least eight spaces (1px). Also with white-space: normal.
 *   S2 — editor Label runs (Advanced): the box equals "a b c" (0.5px) and the painted line equals the box (1px).
 *   S3 — runtime Label leading spaces: the ink starts at least five spaces after the content left (1px) and
 *        ends inside the box (1px).
 *   S4 — runtime Label trailing spaces, centred in a 160px Label: the ink is centred in the box (1px) — the
 *        trailing spaces are neither measured nor painted.
 *   S5 — TextField trailing spaces, both themes: the inner text box is at least the ink of "trail" plus five
 *        spaces (1px).
 *
 * Deps/Effects: UXML_TEXT_CHROMIUM, UXML_TEXT_FONTS (Inter-Regular.ttf); bundles src/ with Vite in memory.
 * Exits 1 when it cannot run or any row fails.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const notRun = (why) => {
  console.error(`텍스트 코호트가 실행되지 않음 (paint-spaces): ${why}`);
  process.exit(1);
};
const chromiumPath = process.env.UXML_TEXT_CHROMIUM;
const fontDir = process.env.UXML_TEXT_FONTS;
if (!chromiumPath || !existsSync(chromiumPath)) notRun('UXML_TEXT_CHROMIUM is not a Chromium executable');
if (!fontDir || !existsSync(join(fontDir, 'Inter-Regular.ttf'))) notRun('UXML_TEXT_FONTS has no Inter-Regular.ttf');

// FaceInfo as Unity reports it (tests/text-cohort/unity/<version>/).
const FONT = { file: 'Inter-Regular.ttf', family: 'sp-inter', face: { pointSize: 90, ascentLine: 87.1875, descentLine: -21.73295, lineHeight: 108.9205 } };

const { chromium } = await import('playwright-core');
const { build } = await import('vite');
const bundled = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false, lib: { entry: join(ROOT, 'src/index.ts'), formats: ['iife'], name: 'UxmlCore', fileName: 'core' } } });
const coreJs = (Array.isArray(bundled) ? bundled[0] : bundled).output[0].code;

const browser = await chromium.launch({ executablePath: chromiumPath });
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
await page.route('http://paint.test/**', (route) => {
  const path = decodeURIComponent(new URL(route.request().url()).pathname);
  if (path === '/') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><style>body{margin:0}@font-face{font-family:"${FONT.family}";src:url("/f/${FONT.file}")}</style><script src="/core.js"></script>` });
  if (path === '/core.js') return route.fulfill({ contentType: 'text/javascript', body: coreJs });
  if (path.startsWith('/f/')) return route.fulfill({ body: readFileSync(join(fontDir, path.slice(3))) });
  return route.fulfill({ status: 404, body: '' });
});
await page.goto('http://paint.test/');
await page.evaluate(async (font) => {
  await document.fonts.load(`20px "${font.family}"`, 'AgVa');
  await globalThis.UxmlCore.loadLayoutEngine();
  globalThis.SP = {
    // Draws `body`, returns the named element's content box and the painted ink of its text.
    measure(body, uss, theme, name, text) {
      document.body.replaceChildren();
      const host = document.createElement('div');
      document.body.append(host);
      const core = globalThis.UxmlCore;
      const doc = core.parse(`<ui:UXML xmlns:ui="UnityEngine.UIElements">${body}</ui:UXML>`, uss);
      const r = core.render(doc, host, { theme, size: { width: 800, height: 600 }, resolveFont: () => ({ family: font.family, faceInfo: font.face }) });
      let node = null;
      const walk = (n) => {
        if (n.attributes.some((a) => a.name === 'name' && a.value === name)) node = n;
        n.children.forEach(walk);
      };
      walk(r.document.root);
      const el = r.elements.get(node.id);
      // The deepest element whose text content is the text (a TextField's inner text part).
      let textEl = null;
      const visit = (n) => {
        for (const c of n.children) visit(c);
        if (textEl === null && n.textContent === text) textEl = n;
      };
      visit(el);
      textEl ??= el;
      const cs = getComputedStyle(textEl);
      const rect = textEl.getBoundingClientRect();
      const left = rect.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft);
      const right = rect.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight);
      // Ink: the client rects of the non-space characters.
      const ink = { left: Infinity, right: -Infinity };
      const nodes = document.createTreeWalker(textEl, NodeFilter.SHOW_TEXT);
      for (let t = nodes.nextNode(); t; t = nodes.nextNode()) {
        for (let i = 0; i < t.data.length; i++) {
          if (t.data[i] === ' ') continue;
          const range = document.createRange();
          range.setStart(t, i);
          range.setEnd(t, i + 1);
          for (const q of range.getClientRects()) {
            if (q.width === 0) continue;
            ink.left = Math.min(ink.left, q.left);
            ink.right = Math.max(ink.right, q.right);
          }
        }
      }
      r.dispose();
      return { left, right, content: right - left, inkLeft: ink.left, inkRight: ink.right };
    },
    space(px) {
      const c = document.createElement('canvas').getContext('2d');
      c.font = `${px}px "${font.family}"`;
      return c.measureText(' ').width;
    },
  };
}, FONT);

const results = [];
const check = (section, name, ok, detail) => {
  results.push({ section, name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${section.padEnd(4)} ${name} — ${detail}`);
};
const label = (name, text, style = '') => `<ui:VisualElement style="align-items: flex-start;"><ui:Label name="${name}" text="${text}" style="${style}" /></ui:VisualElement>`;
const measure = (body, uss, theme, name, text) => page.evaluate(({ body, uss, theme, name, text }) => globalThis.SP.measure(body, uss, theme, name, text), { body, uss, theme, name, text });
const space = (px) => page.evaluate((px) => globalThis.SP.space(px), px);
const f = (n) => n.toFixed(2);

// ---------------------------------------------------------------- S1
for (const ws of ['nowrap', 'normal']) {
  const style = `white-space: ${ws};`;
  const runs = await measure(label('l', 'a     b     c', style), '', 'runtime', 'l', 'a     b     c');
  const plain = await measure(label('l', 'a b c', style), '', 'runtime', 'l', 'a b c');
  const sp = await space(14);
  check('S1', `runtime Label runs (${ws}): painted = box`, Math.abs((runs.inkRight - runs.inkLeft) - runs.content) <= 1,
    `ink ${f(runs.inkRight - runs.inkLeft)}, box ${f(runs.content)}`);
  check('S1', `runtime Label runs (${ws}): kept`, runs.content >= plain.content + 8 * sp - 1,
    `"a     b     c" ${f(runs.content)} vs "a b c" ${f(plain.content)} (+8 spaces = ${f(8 * sp)})`);
}

// ---------------------------------------------------------------- S2
{
  const runs = await measure(label('l', 'a     b     c'), '', 'editor', 'l', 'a     b     c');
  const plain = await measure(label('l', 'a b c'), '', 'editor', 'l', 'a b c');
  check('S2', 'editor Label runs: collapsed', Math.abs(runs.content - plain.content) <= 0.5, `${f(runs.content)} vs "a b c" ${f(plain.content)}`);
  check('S2', 'editor Label runs: painted = box', Math.abs((runs.inkRight - runs.inkLeft) - runs.content) <= 1,
    `ink ${f(runs.inkRight - runs.inkLeft)}, box ${f(runs.content)}`);
}

// ---------------------------------------------------------------- S3
{
  const lead = await measure(label('l', '     lead'), '', 'runtime', 'l', '     lead');
  const sp = await space(14);
  check('S3', 'runtime Label leading spaces: painted after them', lead.inkLeft >= lead.left + 5 * sp - 1,
    `ink left ${f(lead.inkLeft - lead.left)} from the content left, five spaces ${f(5 * sp)}`);
  check('S3', 'runtime Label leading spaces: ink inside the box', lead.inkRight <= lead.right + 1,
    `ink right ${f(lead.inkRight)}, box right ${f(lead.right)}`);
}

// ---------------------------------------------------------------- S4
{
  const style = 'width: 160px; -unity-text-align: middle-center;';
  const t = await measure(label('l', 'trail     ', style), '', 'runtime', 'l', 'trail     ');
  const inkCentre = (t.inkLeft + t.inkRight) / 2;
  const boxCentre = (t.left + t.right) / 2;
  check('S4', 'runtime Label trailing spaces: centred ink', Math.abs(inkCentre - boxCentre) <= 1,
    `ink centre ${f(inkCentre - t.left)}, box centre ${f(boxCentre - t.left)}`);
}

// ---------------------------------------------------------------- S5
for (const theme of ['runtime', 'editor']) {
  const px = theme === 'runtime' ? 14 : 12;
  const body = '<ui:VisualElement style="align-items: flex-start;"><ui:TextField name="t" value="trail     " /></ui:VisualElement>';
  const t = await measure(body, '', theme, 't', 'trail     ');
  const sp = await space(px);
  check('S5', `${theme} TextField trailing spaces: counted`, t.content >= (t.inkRight - t.inkLeft) + 5 * sp - 1,
    `inner text box ${f(t.content)}, ink of "trail" ${f(t.inkRight - t.inkLeft)} + five spaces ${f(5 * sp)}`);
}

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`paint spaces: ${results.length - failed}/${results.length}`);
process.exit(failed === 0 ? 0 : 1);
