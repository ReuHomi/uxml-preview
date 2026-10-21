/**
 * 0.7.0 bundle G — the settings screen: every control together, on both themes, from Unity dumps.
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Design: docs/design/0.7.0-design.md section 6 (the acceptance screen). Probes in
 * tests/layout/unity/probes-0.7.0/: g-settings (+ .uss), g-settings-states (Apply forced hover and
 * active, Name forced focus), g-settings-ko (Korean text, Pretendard). Dumps:
 * tests/layout/unity/<version>/{probe-panel,probe-editor-070}/g-settings*.json, PanelDump / ProbeDump
 * 0.7.0-r3, each probe alone in its own Unity process (tests/layout/unity/dump-solo.sh; plan 27-3).
 *
 * Judged, against 6000.3.25f1 (6000.0.40f1 agrees, first test):
 *   - every element the file names: its box, exactly;
 *   - every part a control builds, matched to Unity's element as classes.test.ts does (Unity's name,
 *     or the class the preview names an unnamed part by): its box, exactly. Unity's scrollers are not
 *     built (known difference) and there are none here;
 *   - the states variant: the resolved colours of Apply and Name (and their parts) are Unity's;
 *   - nothing in the screen is drawn as a fallback.
 * Text: the stub answers Unity's MeasureTextSize, or the layout width where Unity laid a text out
 * 1-2px wider (as bundle-e.test.ts; solo dumps, so that width is the reference). No tolerance.
 * Known differences are named, not tolerated: KNOWN lists them with their reason, and a listed row
 * that matches fails (stale).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { loadLayoutEngine, parse, resolveStyles } from '../../src/index';
import type { ElementNode, MeasureText, Theme } from '../../src/index';
import { layoutDocument } from '../../src/layout/yoga';

const UNITY = join(process.cwd(), 'tests', 'layout', 'unity');
const PROBES = join(UNITY, 'probes-0.7.0');
const FOLDER: Record<Theme, string> = { runtime: 'probe-panel', editor: 'probe-editor-070' };
const BASE = '6000.3.25f1';
const PROBE_FILES = ['g-settings', 'g-settings-states', 'g-settings-ko'] as const;

interface DumpElement {
  path: string; name: string; type: string; classes: string[];
  x: number; y: number; w: number; h: number;
  text?: string; measured?: { w: number; h: number }; style: Record<string, string>;
}
interface Dump { metadata: { panel: { width: number; height: number } }; elements: DumpElement[] }

const readDump = (version: string, theme: Theme, probe: string): Dump =>
  JSON.parse(readFileSync(join(UNITY, version, FOLDER[theme], `${probe}.json`), 'utf8').replace(/\bNaN\b/g, 'null')) as Dump;
const attr = (node: ElementNode, name: string): string | undefined => node.attributes.find((a) => a.name === name)?.value;

/** `${theme} ${probe} ${unity path} ${field}` → why the preview differs. Filled from the first run's evidence only. */
const HALF_PIXEL = 'a centred ProgressBar title at a half pixel: Unity rounds up, the preview floors a measured text node (bundle-f.test.ts KNOWN_HALF_PIXEL)';
const KNOWN: Record<string, string> = Object.fromEntries(PROBE_FILES.map((probe) => [
  `runtime ${probe} settings/right/account/download/unity-progress-bar/VisualElement[0]/VisualElement[1]/Label[0] x`, HALF_PIXEL,
]));

beforeAll(async () => {
  await loadLayoutEngine();
});

function unityMeasure(dump: Dump): MeasureText {
  const sizes = new Map<string, { width: number; height: number }>();
  for (const e of dump.elements) {
    if (e.measured !== undefined && e.text !== undefined) sizes.set(`${e.text}|${Number(e.style['fontSize'])}`, { width: e.measured.w, height: e.measured.h });
  }
  for (const e of dump.elements) {
    if (e.measured === undefined || e.text === undefined) continue;
    const s = e.style;
    const over = e.w - Number(s['paddingLeft']) - Number(s['paddingRight']) - Number(s['borderLeftWidth']) - Number(s['borderRightWidth']) - e.measured.w;
    if (over >= 1 && over <= 2) sizes.set(`${e.text}|${Number(s['fontSize'])}`, { width: e.measured.w + over, height: e.measured.h });
  }
  // A TextField's placeholder and password mask are not in the dump as text (Unity keeps the value
  // there). Their inner text element is stretched to the field (flex-grow 1, 232px here), so its
  // width does not decide any box: the stub answers width 0 and the dumped inner line height.
  const inner = new Map<number, number>();
  for (const e of dump.elements) {
    if (e.path.endsWith('/unity-text-input/TextElement[0]')) inner.set(Number(e.style['fontSize']), e.h - Number(e.style['paddingTop']) - Number(e.style['paddingBottom']));
  }
  return (text, context) => {
    const hit = sizes.get(`${text}|${context.fontSize}`);
    if (hit !== undefined) return hit;
    if ((/^\*+$/.test(text) || text === 'Optional' || text === '선택 사항') && inner.has(context.fontSize)) return { width: 0, height: inner.get(context.fontSize)! };
    throw new Error(`no Unity measurement for ${JSON.stringify(text)} at ${context.fontSize}px`);
  };
}

function named(root: ElementNode): Map<string, ElementNode> {
  const out = new Map<string, ElementNode>();
  const walk = (n: ElementNode): void => {
    const name = attr(n, 'name');
    if (name !== undefined && name !== '') out.set(name, n);
    n.children.forEach(walk);
  };
  walk(root);
  return out;
}

function forcedStates(root: ElementNode): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [name, node] of named(root)) {
    const states = (attr(node, 'class') ?? '').split(/\s+/).filter((c) => c.startsWith('force-')).map((c) => c.slice('force-'.length));
    if (states.length > 0) out[`#${name}`] = states;
  }
  return out;
}

function layout(theme: Theme, probe: string) {
  const dump = readDump(BASE, theme, probe);
  const uss = readFileSync(join(PROBES, `${probe}.uss`), 'utf8');
  const doc = parse(readFileSync(join(PROBES, `${probe}.uxml`), 'utf8'), uss);
  const resolved = resolveStyles(doc, { theme, states: forcedStates(doc.root) });
  const tree = layoutDocument(doc.root, resolved.styles, resolved.partStyles, { theme, size: dump.metadata.panel, measureText: unityMeasure(dump) });
  return { dump, doc, resolved, tree };
}

/** Every judged box of a probe: [label, ours, Unity's]. */
function boxes(theme: Theme, probe: string): Array<[string, number[], number[]]> {
  const { dump, doc, tree } = layout(theme, probe);
  try {
    const nodes = named(doc.root);
    const out: Array<[string, number[], number[]]> = [];
    for (const u of dump.elements) {
      const node = nodes.get(u.name);
      if (node === undefined) continue;
      const b = tree.boxes.get(node.id)!;
      out.push([u.path, [b.left, b.top, b.width, b.height], [u.x, u.y, u.w, u.h]]);
      const inside = dump.elements.filter((e) => e.path.startsWith(`${u.path}/`));
      const used = new Set<string>();
      for (const part of tree.parts.get(node.id) ?? []) {
        const twin = inside.find((e) => !used.has(e.path) && !nodes.has(e.name) && (e.name === part.name || (e.name === '' && e.classes.includes(part.name))));
        if (twin === undefined) continue; // classes.test.ts judges that every part has its Unity twin
        used.add(twin.path);
        // A Slider's dragger is moved by a paint-only translate (bundle-d.test.ts); Unity's box is after it.
        const [tx = 0, ty = 0] = (part.style.get('translate')?.value ?? '').split(/\s+/).filter((v) => v !== '').map((v) => parseFloat(v));
        // Unity's dumped positions carry three decimals; ours are rounded to the same to compare.
        const r3 = (v: number): number => Math.round(v * 1000) / 1000;
        out.push([twin.path, [r3(part.box.left + tx), r3(part.box.top + ty), part.box.width, part.box.height], [twin.x, twin.y, twin.w, twin.h]]);
      }
    }
    return out;
  } finally {
    tree.dispose();
  }
}

describe('bundle G — the evidence', () => {
  it('6000.0.40f1 and 6000.3.25f1 lay the screen out alike (editor text widths within the generator difference)', () => {
    for (const theme of ['runtime', 'editor'] as const) {
      for (const probe of PROBE_FILES) {
        const a = readDump('6000.0.40f1', theme, probe);
        const b = readDump(BASE, theme, probe);
        expect(b.elements.map((e) => e.path), `${theme} ${probe}`).toEqual(a.elements.map((e) => e.path));
        for (const [i, e] of a.elements.entries()) {
          const o = b.elements[i]!;
          // The editor theme: 6000.0 Standard, 6.3 Advanced (plan 27); text-sized boxes move by a few px.
          const slack = theme === 'editor' ? 4 : 0;
          [o.x - e.x, o.y - e.y, o.w - e.w, o.h - e.h].forEach((d) => expect(Math.abs(d), `${theme} ${probe} ${e.path}`).toBeLessThanOrEqual(slack));
        }
      }
    }
  });
});

for (const theme of ['runtime', 'editor'] as const) {
  describe(`bundle G — ${theme} theme`, () => {
    for (const probe of PROBE_FILES) {
      it(`${probe}: every named element and every part lands where Unity puts it`, () => {
        const problems: string[] = [];
        const stale: string[] = [];
        for (const [path, ours, unity] of boxes(theme, probe)) {
          (['x', 'y', 'w', 'h'] as const).forEach((field, i) => {
            const key = `${theme} ${probe} ${path} ${field}`;
            const differs = ours[i] !== unity[i];
            if (KNOWN[key] !== undefined) {
              if (!differs) stale.push(key);
              // The known difference is the half pixel rounded down: exactly 1px less, nothing else (review X2).
              else if (ours[i] !== unity[i]! - 1) problems.push(`${path} ${field}: ours ${ours[i]}, Unity ${unity[i]} (known: Unity - 1)`);
              return;
            }
            if (differs) problems.push(`${path} ${field}: ours ${ours[i]}, Unity ${unity[i]}`);
          });
        }
        if (problems.length > 0) console.info(`SETTINGS ${theme} ${probe}\n  ${problems.join('\n  ')}`);
        expect(problems).toEqual([]);
        expect(stale, 'a known difference that now matches').toEqual([]);
      });
    }

    it('g-settings-states: Apply (hover + active) and Name (focus) take Unity\'s colours', () => {
      const { dump, doc, resolved, tree } = layout(theme, 'g-settings-states');
      try {
        const nodes = named(doc.root);
        const toRgba = (t: string): number[] => {
          const s = t.trim().toLowerCase();
          if (s === 'transparent') return [0, 0, 0, 0];
          const hex = /^#([0-9a-f]+)$/.exec(s)?.[1];
          if (hex !== undefined) {
            const full = hex.length <= 4 ? [...hex].map((c) => c + c).join('') : hex;
            const n = (i: number): number => parseInt(full.slice(i, i + 2), 16) / 255;
            return [n(0), n(2), n(4), full.length === 8 ? n(6) : 1];
          }
          const p = /^rgba?\(([^)]*)\)$/.exec(s)![1]!.split(',').map((x) => Number(x.trim()));
          return [p[0]! / 255, p[1]! / 255, p[2]! / 255, p[3] ?? 1];
        };
        const unityRgba = (t: string): number[] => /rgba\(([^)]*)\)/.exec(t)![1]!.split(',').map(Number);
        const check = (get: (p: string) => string | undefined, u: DumpElement, label: string): void => {
          for (const [css, key] of [['color', 'color'], ['background-color', 'backgroundColor'], ['border-top-color', 'borderTopColor'], ['border-left-color', 'borderLeftColor']] as const) {
            const ours = toRgba(get(css) ?? 'transparent');
            const theirs = unityRgba(u.style[key]!);
            ours.forEach((c, i) => expect(Math.abs(c - theirs[i]!), `${label} ${css}`).toBeLessThanOrEqual(0.0011));
          }
        };
        for (const name of ['apply', 'player-name']) {
          const u = dump.elements.find((e) => e.name === name)!;
          const node = nodes.get(name)!;
          check((p) => resolved.styles.get(node.id)?.get(p)?.value, u, name);
          const inside = dump.elements.filter((e) => e.path.startsWith(`${u.path}/`));
          for (const part of tree.parts.get(node.id) ?? []) {
            const twin = inside.find((e) => e.name === part.name || (e.name === '' && e.classes.includes(part.name)));
            if (twin !== undefined) check((p) => part.style.get(p)?.value, twin, `${name} ${part.name}`);
          }
        }
      } finally {
        tree.dispose();
      }
    });

    it('nothing on the screen falls back', () => {
      const { tree } = layout(theme, 'g-settings');
      try {
        expect(tree.warnings.filter((w) => w.kind === 'unsupported-control')).toEqual([]);
      } finally {
        tree.dispose();
      }
    });
  });
}
