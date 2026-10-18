/**
 * Text cohort: the preview's text boxes in a real Chromium against Unity's,
 * for the same UXML, fonts and sizes (tests/text-cohort/README.md).
 *
 * Deps/Effects: launches the Chromium at UXML_TEXT_CHROMIUM, reads font files
 * from UXML_TEXT_FONTS, bundles src/ with Vite in memory, writes
 * tests/text-cohort/results.json. Exits 1 when it cannot run — a cohort that
 * did not run is never counted as passing — and when a mandatory criterion
 * fails for an unexplained (c) reason, or docs/accuracy.md does not carry the
 * table this run produced.
 *
 * Sets (0.7.0 item T): `unity/<version>/` is the editor-theme set (ProbeDump in an editor
 * window), drawn with theme 'editor'; `unity-runtime/<version>/` is the runtime-panel set
 * (PanelDump, each probe in its own Unity process — tests/layout/unity/dump-solo.sh), drawn
 * with theme 'runtime'. Each set has its own table in docs/accuracy.md; they are never added.
 * spec.known keys are "<version> <name>" for the editor set, "runtime <version> <name>" for
 * the runtime one.
 *
 * Criteria (2026-10-16 instruction): line count must match; height must match
 * the FaceInfo formula exactly; width passes within 1px or 1%; the line-break
 * boundary cases get their own table. Coefficients come from FaceInfo as Unity
 * reported it, never from a fit.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const UPDATE = process.env.UXML_TEXT_UPDATE === '1';

function notRun(why) {
  console.error(`텍스트 코호트가 실행되지 않음: ${why}`);
  process.exit(1);
}

const chromiumPath = process.env.UXML_TEXT_CHROMIUM;
const fontDir = process.env.UXML_TEXT_FONTS;
if (!chromiumPath) notRun('UXML_TEXT_CHROMIUM is not set (path to a Chromium executable, see tests/text-cohort/README.md)');
if (!existsSync(chromiumPath)) notRun(`no Chromium at UXML_TEXT_CHROMIUM=${chromiumPath}`);
if (!fontDir || !existsSync(fontDir)) notRun(`UXML_TEXT_FONTS is not a directory: ${fontDir ?? '(unset)'}`);

const spec = JSON.parse(readFileSync(join(HERE, 'spec.json'), 'utf8'));
for (const f of spec.fonts) {
  if (!existsSync(join(fontDir, f.file))) notRun(`font file missing: ${join(fontDir, f.file)}`);
}

let chromium;
try {
  ({ chromium } = await import('playwright-core'));
} catch {
  notRun('playwright-core is not installed (pnpm install)');
}

// --- Unity side -------------------------------------------------------------
const SETS = [
  { id: 'editor', dir: 'unity', theme: 'editor', title: 'Unity', known: (v, name) => `${v} ${name}` },
  { id: 'runtime', dir: 'unity-runtime', theme: 'runtime', title: 'Unity (런타임 패널)', known: (v, name) => `runtime ${v} ${name}` },
].filter((set) => existsSync(join(HERE, set.dir)));
const faceInfo = {};
for (const set of SETS) {
  set.versions = readdirSync(join(HERE, set.dir)).sort();
  set.unity = {};
  for (const v of set.versions) {
    set.unity[v] = {};
    for (const file of readdirSync(join(HERE, set.dir, v)).filter((f) => f.endsWith('.json'))) {
      const json = JSON.parse(readFileSync(join(HERE, set.dir, v, file), 'utf8').replace(/\bNaN\b/g, 'null'));
      for (const e of json.elements) {
        if (e.type !== 'Label' || e.name.startsWith('default-')) continue;
        set.unity[v][e.name] = { w: e.w, h: e.h, fontSize: Number(e.style.fontSize), faceInfo: e.faceInfo, generator: e.style.unityTextGenerator };
        const id = spec.fonts.find((f) => e.name.startsWith(`${f.id}-`))?.id;
        // Fonts register with the editor set's reference FaceInfo, as before T.
        if (id !== undefined && set.id === 'editor' && v === set.versions.at(-1)) faceInfo[id] = e.faceInfo;
      }
    }
  }
}

// --- Preview side, in Chromium ------------------------------------------------
const { build } = await import('vite');
const bundled = await build({
  configFile: false,
  logLevel: 'silent',
  build: { write: false, minify: false, lib: { entry: join(ROOT, 'src/index.ts'), formats: ['iife'], name: 'UxmlCore', fileName: 'core' } },
});
const coreJs = (Array.isArray(bundled) ? bundled[0] : bundled).output[0].code;

const docs = [];
for (const file of readdirSync(join(HERE, 'probes')).filter((f) => f.endsWith('.uxml')).sort()) {
  const uss = join(HERE, 'probes', file.replace(/\.uxml$/, '.uss'));
  docs.push({ name: file, uxml: readFileSync(join(HERE, 'probes', file), 'utf8'), uss: existsSync(uss) ? readFileSync(uss, 'utf8') : undefined });
}
const fonts = spec.fonts.map((f) => ({ id: f.id, file: f.file, family: `cohort-${f.id}`, faceInfo: faceInfo[f.id] }));

const browser = await chromium.launch({ executablePath: chromiumPath });
const chromiumVersion = browser.version();
const page = await browser.newPage();
const fontCss = fonts.map((f) => `@font-face { font-family: "${f.family}"; src: url("/fonts/${encodeURIComponent(f.file)}"); }`).join('\n');
await page.route('http://cohort.test/**', (route) => {
  const path = decodeURIComponent(new URL(route.request().url()).pathname);
  if (path === '/') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><style>${fontCss}</style><script src="/core.js"></script>` });
  if (path === '/core.js') return route.fulfill({ contentType: 'text/javascript', body: coreJs });
  if (path.startsWith('/fonts/')) return route.fulfill({ body: readFileSync(join(fontDir, path.slice('/fonts/'.length))) });
  return route.fulfill({ status: 404, body: '' });
});
await page.goto('http://cohort.test/');
const preview = await page.evaluate(async ({ docs, fonts, themes }) => {
  await Promise.all(fonts.map((f) => document.fonts.load(`20px "${f.family}"`, 'Ag한漢あ')));
  const core = globalThis.UxmlCore;
  await core.loadLayoutEngine();
  const byFile = Object.fromEntries(fonts.map((f) => [f.file, f]));
  const boxes = {};
  for (const theme of themes) {
  boxes[theme] = {};
  for (const d of docs) {
    const host = document.createElement('div');
    document.body.append(host);
    const doc = core.parse(d.uxml, d.uss);
    const r = core.render(doc, host, {
      theme,
      size: { width: 800, height: 600 },
      resolveFont: (path) => {
        const f = byFile[path.split('/').pop()];
        return f === undefined ? null : { family: f.family, faceInfo: f.faceInfo };
      },
    });
    const walk = (n) => {
      const name = n.attributes.find((a) => a.name === 'name')?.value;
      const box = r.boxes.get(n.id);
      if (name !== undefined && box !== undefined) boxes[theme][name] = { w: box.width, h: box.height };
      n.children.forEach(walk);
    };
    walk(r.document.root);
    r.dispose();
    host.remove();
  }
  }
  // Canvas metrics, for fonts given without FaceInfo (instruction 8).
  const ctx = document.createElement('canvas').getContext('2d');
  const canvas = {};
  for (const f of fonts) {
    ctx.font = `90px "${f.family}"`;
    const m = ctx.measureText('Hg');
    canvas[f.id] = { ascent: m.fontBoundingBoxAscent, descent: m.fontBoundingBoxDescent };
  }
  return { boxes, canvas };
}, { docs, fonts, themes: SETS.map((set) => set.theme) });
await browser.close();

// --- Judgement ----------------------------------------------------------------
const ratio = (fi) => (fi.ascentLine - fi.descentLine) / fi.pointSize;
const fontOf = (name) => spec.fonts.find((f) => name.startsWith(`${f.id}-`));
const sentenceOf = (name) => name.split('-').find((part) => part in spec.sentences);
const noGlyphs = (name) => (fontOf(name)?.noGlyphs ?? []).includes(sentenceOf(name));
// Line-break cases: boundary (-bm2/-bp2) and fixed-width wrap (-wN) rows.
const LINE_BREAK_CASE = /-(b[pm]\d+|w\d+)$/;
// spec.known: "<version> <name>" -> a measured difference the preview does not reproduce, with the reason.
const KNOWN = spec.known ?? {};
const lines = (h, fs, fi) => Math.max(1, Math.round(h / (fs * ratio(fi))));

/**
 * The Standard text generator's measured height rule (README): exact integers round up by one,
 * lines advance by lineHeight. Found on 6000.0's editor (Standard there); item T found the same
 * rule on the runtime panel of both versions (Standard on both), so it is the generator's rule,
 * not the version's.
 */
function height60(n, fs, fi) {
  const x = fs * ratio(fi) + (n - 1) * fs * (fi.lineHeight / fi.pointSize);
  return Math.floor(x) + 1;
}

// The Advanced generator's values, the reference a Standard row is explained against: the editor
// set's newest version (6.3, Advanced). Before item T this was "the newest version of the same set".
const ADVANCED = (() => {
  const editor = SETS.find((set) => set.id === 'editor');
  return editor === undefined ? {} : editor.unity[editor.versions.at(-1)];
})();

function judge(set, v) {
  const unity = set.unity;
  const boxes = preview.boxes[set.theme];
  const rows = [];
  for (const [name, u] of Object.entries(unity[v])) {
    const p = boxes[name];
    if (p === undefined) {
      rows.push({ name, missing: true, cls: 'c' });
      continue;
    }
    const nU = lines(u.h, u.fontSize, u.faceInfo);
    const nP = lines(p.h, u.fontSize, u.faceInfo);
    const dw = p.w - u.w;
    const dh = p.h - u.h;
    const widthOk = Math.abs(dw) <= Math.max(1, u.w * 0.01);
    // A row Unity laid out with the Standard generator is explained against the Advanced
    // reference (6.3 editor): a value the preview shares with it within tolerance is a
    // generator difference, (a) — measured: Standard draws Jua 2-4px wider than Advanced.
    const matchesRef = (field) => ref !== undefined && Math.abs(p[field] - ref[field]) <= Math.max(1, ref[field] * 0.01);
    const why = (delta, versionRule) => {
      if (noGlyphs(name)) return 'a';
      if (versionRule) return 'a';
      if (Math.abs(delta) <= 1) return 'b';
      return 'c';
    };
    const standard = u.generator === 'Standard';
    const ref = standard ? ADVANCED[name] : undefined;
    const row = { name, boundary: LINE_BREAK_CASE.test(name), unity: { w: u.w, h: u.h }, preview: p, linesU: nU, linesP: nP, dw, dh, widthOk };
    // A line count that flips at a boundary case because the natural widths differ
    // by at most 1px is (b); the boundary cases sit 2px from Unity 6000.0's width.
    // Only when the preview's own count agrees with its own natural width: a measurer
    // that keeps text wider than the box on one line has not wrapped it, and no 1px
    // difference explains that (0.6.0 measured CJK as one word and passed here as (b)).
    // The wrap cases (-wN, several lines) have no 1px explanation at all.
    if (nU !== nP) {
      const natural = name.replace(LINE_BREAK_CASE, '');
      // A Standard row also runs the 1px test against the Advanced reference's natural
      // width: a 1px preview difference stacked on a generator difference is still 1px.
      const widthGap = (table) => (table[natural] !== undefined && boxes[natural] !== undefined
        ? Math.abs(boxes[natural].w - table[natural].w) : Infinity);
      const nw = Math.min(widthGap(unity[v]), standard ? widthGap(ADVANCED) : Infinity);
      const refLines = ref === undefined ? undefined : lines(ref.h, u.fontSize, u.faceInfo);
      const pN = boxes[natural]?.w;
      const consistent = pN !== undefined && (nP > 1) === (pN > p.w);
      const bOk = /-b[pm]\d+$/.test(name) && consistent && nw <= 1;
      row.linesCls = noGlyphs(name) || refLines === nP || KNOWN[set.known(v, name)] !== undefined ? 'a' : bOk ? 'b' : 'c';
    } else if (KNOWN[set.known(v, name)] !== undefined) {
      row.staleKnown = true;
    }
    // A height that differs because the line count differs is that difference, not another one.
    if (dh !== 0) row.heightCls = row.linesCls ?? why(dh, (standard && height60(nU, u.fontSize, u.faceInfo) === u.h) || matchesRef('h'));
    if (!widthOk) row.widthCls = why(dw, matchesRef('w'));
    rows.push(row);
  }
  return rows;
}

for (const set of SETS) {
  set.summary = {};
  set.report = [];
  for (const v of set.versions) {
    const rows = judge(set, v);
    const plain = rows.filter((r) => !r.boundary);
    const bound = rows.filter((r) => r.boundary);
    const count = (list, ok) => `${list.filter(ok).length}/${list.length}`;
    const classes = (key) => ['a', 'b', 'c'].map((c) => rows.filter((r) => r[key] === c).length).join('/');
    set.summary[v] = {
      lines: count(plain, (r) => r.linesCls === undefined),
      height: count(plain, (r) => r.heightCls === undefined),
      width: count(plain, (r) => r.widthOk),
      boundaryLines: count(bound, (r) => r.linesCls === undefined),
      failuresABC: { lines: classes('linesCls'), height: classes('heightCls'), width: classes('widthCls') },
      widthDelta: { min: Math.min(...rows.map((r) => r.dw)), max: Math.max(...rows.map((r) => r.dw)) },
      unexplained: rows.filter((r) => r.missing || r.staleKnown || r.linesCls === 'c' || r.heightCls === 'c' || r.widthCls === 'c').map((r) => r.name),
    };
    set.report.push(...rows.map((r) => ({ version: v, ...r })));
  }
}

const canvasVsFaceInfo = Object.fromEntries(
  fonts.map((f) => {
    const c = preview.canvas[f.id];
    return [f.id, { faceInfo: Number(ratio(f.faceInfo).toFixed(4)), canvas: Number(((c.ascent + c.descent) / 90).toFixed(4)) }];
  }),
);

const editorSet = SETS.find((set) => set.id === 'editor');
const result = { chromium: chromiumVersion, unity: editorSet.versions, summary: editorSet.summary, canvasVsFaceInfo, rows: editorSet.report };
const runtimeSet = SETS.find((set) => set.id === 'runtime');
if (runtimeSet !== undefined) result.runtime = { unity: runtimeSet.versions, summary: runtimeSet.summary, rows: runtimeSet.report };
writeFileSync(join(HERE, 'results.json'), JSON.stringify(result, null, 1) + '\n');

const tableOf = (set) => [
  `| ${set.title} | 줄 수 | 높이 | 너비(1px/1%) | 경계 줄 수 | 실패 (a/b/c): 줄·높이·너비 | 너비 Δ 범위 |`,
  '|---|---:|---:|---:|---:|---|---|',
  ...set.versions.map((v) => {
    const s = set.summary[v];
    return `| ${v} | ${s.lines} | ${s.height} | ${s.width} | ${s.boundaryLines} | ${s.failuresABC.lines} · ${s.failuresABC.height} · ${s.failuresABC.width} | ${s.widthDelta.min}…${s.widthDelta.max} |`;
  }),
].join('\n');
console.log(`Chromium ${chromiumVersion}\n`);
for (const set of SETS) console.log(`${tableOf(set)}\n`);
console.log('canvas vs FaceInfo (ascent+descent)/size:', JSON.stringify(canvasVsFaceInfo));

let failed = false;
const accuracy = readFileSync(join(ROOT, 'docs', 'accuracy.md'), 'utf8');
for (const set of SETS) {
  for (const v of set.versions) {
    if (set.summary[v].unexplained.length > 0) {
      failed = true;
      console.error(`${set.id} ${v}: unexplained (c): ${set.summary[v].unexplained.join(', ')}`);
    }
  }
  if (!UPDATE && !accuracy.includes(tableOf(set))) {
    failed = true;
    console.error(`docs/accuracy.md does not carry the ${set.id} table (rerun with UXML_TEXT_UPDATE=1 to only print it).`);
  }
}
process.exit(failed ? 1 : 0);
