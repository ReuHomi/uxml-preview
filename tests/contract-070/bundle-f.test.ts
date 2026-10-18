/**
 * 0.7.0 bundle F — ProgressBar, TextElement and RepeatButton, on both themes, from Unity dumps.
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Expected values are read from the committed 6000.3.25f1 dumps at run time:
 *   runtime — tests/layout/unity/6000.3.25f1/probe-panel/<probe>.json
 *   editor  — tests/layout/unity/6000.3.25f1/probe-editor-070/<probe>.json
 * Probes (tests/layout/unity/probes-0.7.0/): c07-ProgressBar, c07-TextElement, c07-RepeatButton
 * (2026-10-16), f-progress, f-states, f-hook (+ .uss) (dumper 0.7.0-r3, 2026-10-18).
 *
 * What the dumps show:
 *   TextElement (unity-text-element) and RepeatButton (unity-text-element unity-repeat-button)
 *     are plain text: no theme margin, padding, border or background in either theme, no part,
 *     flex-shrink 1 (a Label has 0), colour inherited. A RepeatButton does not look like a
 *     button. Empty text is 0 high. With file children, the element's own text does not size
 *     it: its height is its children's (f-states rb-child, te-child). The text wraps with
 *     white-space normal (te-long).
 *   ProgressBar (unity-progress-bar) builds #unity-progress-bar (unity-progress-bar__container)
 *     > [unity-progress-bar__background > unity-progress-bar__progress, unity-progress-bar__title-container
 *     > a Label unity-progress-bar__title holding `title`]. File children go after the container,
 *     as the ProgressBar's own children (p-child).
 *   The bar (unity-progress-bar__progress) is absolutely placed; its width follows Unity's
 *     AbstractProgressBar: w = floor(background width - 2), filled = w * clamp(value, low, high) / high
 *     (low-value does not shift it), and the bar's right edge sits w - filled from the right.
 *     Every row of f-progress (values 0, 1, 25, 33.3, 50, 99, 100, 150, -10, a 10-20 range, a 200
 *     high, a 40 low, widths 101, 57, 80) is that, rounded, less the bar's margins (runtime 2 each
 *     side; editor 0). [측정]
 *   Forced hover/active/focus/disabled change no value of these three (f-states).
 *   The title Label is no wider than its container even when its text is (p-long: text 346,
 *     box 290 on the runtime theme): Unity clips a text to the width it is offered
 *     (g-clamp.test.ts has where it does and does not).
 *   Author USS reaches the parts by their classes, and a `TextElement` type selector does not
 *     reach a Label or a RepeatButton (f-hook).
 *
 * Text widths on the runtime theme. Unity lays a text out 0-2px wider than its MeasureTextSize,
 * and how much depends on what the same Unity process drew before (plan section 27). The human
 * decision (2026-10-18): the reference is the solo dump, each probe alone in a new Unity process
 * (tests/layout/unity/dump-solo.sh); no tolerance is widened. The committed dumps are solo dumps,
 * the stub reads a 1-2px wider layout width from the box (as bundle-e.test.ts), and every box is
 * judged exactly. The title clip (p-long) is the general rule of g-clamp.test.ts.
 *
 * Known differences, named rather than tolerated (as golden.test.ts KNOWN_DIVERGENCES): a centred
 * title whose free space is odd sits at a half pixel — (290 - 77) / 2 = 106.5 — and Unity puts it
 * at the next pixel up, while the preview's Yoga floors the position of a measured text node
 * (yoga-layout rounds a text node's left with forceFloor). Four runtime titles, x only, 1px:
 * KNOWN_HALF_PIXEL. Found when the 2px allowance was removed (2026-10-18); not fixed — changing the
 * rounding of text nodes moves every text box, so it waits for a decision and a prediction.
 *
 * Version difference (first test): on the editor theme a bar at or below low-value is 1px wide
 * on 6000.0.40f1 and 0 on 6000.3.25f1 (c07-ProgressBar p-plain, f-progress p-0, p-under). The
 * preview draws 6000.3.25f1 and says so with a version-dependent warning on the editor theme.
 * Everything else agrees (the editor's text generator moves text widths by 1px).
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { loadLayoutEngine, parse, render, resolveStyles, PART_ATTRIBUTE } from '../../src/index';
import type { ElementNode, MeasureText, RenderResult, Theme } from '../../src/index';
import { layoutDocument } from '../../src/layout/yoga';

const UNITY = join(process.cwd(), 'tests', 'layout', 'unity');
const PROBES = join(UNITY, 'probes-0.7.0');
const FOLDER: Record<Theme, string> = { runtime: 'probe-panel', editor: 'probe-editor-070' };
const BASE = '6000.3.25f1';
const PROBE_FILES = ['c07-ProgressBar', 'c07-TextElement', 'c07-RepeatButton', 'f-progress', 'f-states', 'f-hook'] as const;
const F = ['ProgressBar', 'TextElement', 'RepeatButton'];

interface DumpElement {
  path: string;
  name: string;
  type: string;
  classes: string[];
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
  measured?: { w: number; h: number };
  style: Record<string, string>;
}
interface Dump {
  metadata: { panel: { width: number; height: number } };
  elements: DumpElement[];
}

const readDump = (version: string, theme: Theme, probe: string): Dump =>
  JSON.parse(readFileSync(join(UNITY, version, FOLDER[theme], `${probe}.json`), 'utf8').replace(/\bNaN\b/g, 'null')) as Dump;
const readProbe = (probe: string): ReturnType<typeof parse> => {
  const uss = join(PROBES, `${probe}.uss`);
  return parse(readFileSync(join(PROBES, `${probe}.uxml`), 'utf8'), existsSync(uss) ? readFileSync(uss, 'utf8') : undefined);
};
const attr = (node: ElementNode, name: string): string | undefined => node.attributes.find((a) => a.name === name)?.value;

beforeAll(async () => {
  await loadLayoutEngine();
});

function unityMeasure(dump: Dump): MeasureText {
  const sizes = new Map<string, { width: number; height: number }>();
  for (const e of dump.elements) {
    if (e.measured !== undefined && e.text !== undefined) sizes.set(`${e.text}|${Number(e.style['fontSize'])}`, { width: e.measured.w, height: e.measured.h });
  }
  // Where Unity's layout gave a text 1-2px more than its MeasureTextSize, the stub uses the
  // layout width, read from the box less padding and border (as bundle-e.test.ts). The dumps
  // are solo dumps (each probe alone in its Unity process, plan section 27-2), so that width is
  // the reference value, not one process's order. Stretched rows (more than 2px over) are not read.
  for (const e of dump.elements) {
    if (e.measured === undefined || e.text === undefined) continue;
    const s = e.style;
    const inner = e.w - Number(s['paddingLeft']) - Number(s['paddingRight']) - Number(s['borderLeftWidth']) - Number(s['borderRightWidth']);
    const over = inner - e.measured.w;
    if (over >= 1 && over <= 2) sizes.set(`${e.text}|${Number(s['fontSize'])}`, { width: inner, height: e.measured.h });
  }
  // A text Unity wrapped (its box holds more than one measured line, f-states te-long): asked to
  // fit a narrower width with white-space normal, it answers Unity's wrapped height, as
  // bundle-c.test.ts does for its wrapping row. MeasureTextSize itself is one line.
  const wrapped = new Map<string, number>();
  for (const e of dump.elements) {
    if (e.measured === undefined || e.text === undefined) continue;
    const s = e.style;
    const content = e.h - Number(s['paddingTop']) - Number(s['paddingBottom']) - Number(s['borderTopWidth']) - Number(s['borderBottomWidth']);
    if (s['whiteSpace'] === 'Normal' && content >= 2 * e.measured.h) wrapped.set(`${e.text}|${Number(s['fontSize'])}`, content);
  }
  return (text, context, availableWidth) => {
    const key = `${text}|${context.fontSize}`;
    const hit = sizes.get(key);
    if (hit === undefined) throw new Error(`no Unity measurement for ${JSON.stringify(text)} at ${context.fontSize}px`);
    const lines = wrapped.get(key);
    if (lines !== undefined && context.whiteSpace === 'normal' && Number.isFinite(availableWidth) && availableWidth > 0 && availableWidth < hit.width) {
      return { width: availableWidth, height: lines };
    }
    return hit;
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

/** Unity elements built inside a control, its file children (named in the probe) and theirs excluded. */
const unityParts = (dump: Dump, control: DumpElement, nodes: Map<string, ElementNode>): DumpElement[] => {
  const inside = dump.elements.filter((e) => e.path.startsWith(`${control.path}/`));
  const fileRoots = inside.filter((e) => nodes.has(e.name)).map((e) => e.path);
  return inside.filter((e) => !fileRoots.some((r) => e.path === r || e.path.startsWith(`${r}/`)));
};
function partName(e: DumpElement): string {
  if (e.name !== '') return e.name;
  const specific = e.classes.filter((c) => c.startsWith('unity-progress-bar__'));
  if (specific.length !== 1) throw new Error(`${e.path}: no single unity-progress-bar__ class in ${e.classes.join(' ')}`);
  return specific[0]!;
}

function rgba(text: string): number[] {
  const t = text.trim().toLowerCase();
  if (t === 'transparent') return [0, 0, 0, 0];
  const hex = /^#([0-9a-f]+)$/.exec(t)?.[1];
  if (hex !== undefined) {
    const full = hex.length <= 4 ? [...hex].map((c) => c + c).join('') : hex;
    const n = (i: number): number => parseInt(full.slice(i, i + 2), 16) / 255;
    return [n(0), n(2), n(4), full.length === 8 ? n(6) : 1];
  }
  const fn = /^rgba?\(([^)]*)\)$/.exec(t)?.[1];
  if (fn !== undefined) {
    const p = fn.split(',').map((s) => Number(s.trim()));
    return [p[0]! / 255, p[1]! / 255, p[2]! / 255, p[3] ?? 1];
  }
  throw new Error(`not a colour: ${text}`);
}
const unityRgba = (text: string): number[] => /rgba\(([^)]*)\)/.exec(text)![1]!.split(',').map(Number);

const INITIAL: Record<string, string> = {
  'background-color': 'transparent',
  'border-top-color': 'transparent', 'border-right-color': 'transparent',
  'border-bottom-color': 'transparent', 'border-left-color': 'transparent',
  opacity: '1', 'flex-shrink': '1', 'flex-grow': '0',
};
const LENGTH: Array<[string, string]> = [
  ['font-size', 'fontSize'],
  ['margin-top', 'marginTop'], ['margin-right', 'marginRight'], ['margin-bottom', 'marginBottom'], ['margin-left', 'marginLeft'],
  ['padding-top', 'paddingTop'], ['padding-right', 'paddingRight'], ['padding-bottom', 'paddingBottom'], ['padding-left', 'paddingLeft'],
  ['border-top-width', 'borderTopWidth'], ['border-right-width', 'borderRightWidth'], ['border-bottom-width', 'borderBottomWidth'], ['border-left-width', 'borderLeftWidth'],
  ['flex-shrink', 'flexShrink'], ['flex-grow', 'flexGrow'], ['opacity', 'opacity'],
];
const COLOUR: Array<[string, string]> = [
  ['color', 'color'], ['background-color', 'backgroundColor'],
  ['border-top-color', 'borderTopColor'], ['border-right-color', 'borderRightColor'],
  ['border-bottom-color', 'borderBottomColor'], ['border-left-color', 'borderLeftColor'],
];

function expectStyle(get: (property: string) => string | undefined, u: DumpElement, label: string): void {
  const value = (p: string): string => (get(p) ?? INITIAL[p] ?? '0').trim();
  for (const [css, unity] of LENGTH) expect(parseFloat(value(css)), `${label} ${css}`).toBeCloseTo(Number(u.style[unity]), 3);
  for (const [css, unity] of COLOUR) {
    const ours = rgba(value(css));
    const theirs = unityRgba(u.style[unity]!);
    ours.forEach((c, i) => expect(Math.abs(c - theirs[i]!), `${label} ${css} [${i}] ${value(css)} vs ${u.style[unity]}`).toBeLessThanOrEqual(0.0011));
  }
}

function layout(theme: Theme, probe: string) {
  const dump = readDump(BASE, theme, probe);
  const doc = readProbe(probe);
  const resolved = resolveStyles(doc, { theme, states: forcedStates(doc.root) });
  const tree = layoutDocument(doc.root, resolved.styles, resolved.partStyles, { theme, size: dump.metadata.panel, measureText: unityMeasure(dump) });
  return { dump, doc, resolved, tree };
}

/** Every box exactly, on both themes (header). */
function expectBox(_theme: Theme, ours: number[], unity: number[], label: string): void {
  expect(ours, label).toEqual(unity);
}

/** [probe, part path] whose x Unity rounds up from a half pixel and the preview floors (header). */
const KNOWN_HALF_PIXEL = new Set([
  'runtime c07-ProgressBar col/p-title/unity-progress-bar/VisualElement[0]/VisualElement[1]/Label[0]',
  'runtime c07-ProgressBar col/p-disabled/unity-progress-bar/VisualElement[0]/VisualElement[1]/Label[0]',
  'runtime f-progress row/p-w101/unity-progress-bar/VisualElement[0]/VisualElement[1]/Label[0]',
  'runtime f-progress row/p-w57/unity-progress-bar/VisualElement[0]/VisualElement[1]/Label[0]',
  'runtime f-states col/p-forced/unity-progress-bar/VisualElement[0]/VisualElement[1]/Label[0]',
  'runtime f-hook col/p-hook/unity-progress-bar/VisualElement[0]/VisualElement[1]/Label[0]',
]);
const knownHalfPixelSeen = new Set<string>();

const controlsOf = (dump: Dump, nodes: Map<string, ElementNode>): DumpElement[] =>
  dump.elements.filter((e) => F.includes(e.type) && nodes.has(e.name));

describe('bundle F — the evidence', () => {
  it('6000.0.40f1 and 6000.3.25f1 agree, except the editor bar at or below low-value', () => {
    const judged = ['fontSize', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
      'borderTopWidth', 'borderLeftWidth', 'flexShrink', 'flexGrow', 'opacity', 'color', 'backgroundColor', 'borderTopColor', 'borderLeftColor'];
    const differences: string[] = [];
    for (const theme of ['runtime', 'editor'] as const) {
      for (const probe of PROBE_FILES) {
        const a = readDump('6000.0.40f1', theme, probe);
        const b = readDump(BASE, theme, probe);
        expect(b.elements.map((e) => e.path)).toEqual(a.elements.map((e) => e.path));
        a.elements.forEach((e, i) => {
          const o = b.elements[i]!;
          expect(o.classes, `${theme} ${probe} ${e.path}`).toEqual(e.classes);
          for (const k of judged) expect(o.style[k], `${theme} ${probe} ${e.path} ${k}`).toBe(e.style[k]);
          const isText = e.text !== undefined && e.text !== '';
          (['x', 'y', 'w', 'h'] as const).forEach((k) => {
            const d = Math.abs(o[k] - e[k]);
            if (d === 0 || (theme === 'editor' && isText && d <= 1)) return;
            differences.push(`${theme} ${probe} ${e.path} ${k} ${e[k]}->${o[k]}`);
          });
        });
      }
    }
    const bar = 'unity-progress-bar/VisualElement[0]/VisualElement[0]';
    expect(differences).toEqual([
      `editor c07-ProgressBar col/p-plain/${bar} w 1->0`,
      `editor f-progress col/p-0/${bar} w 1->0`,
      `editor f-progress col/p-under/${bar} w 1->0`,
    ]);
  });

  it('forced states change none of these controls\' values (f-states)', () => {
    for (const theme of ['runtime', 'editor'] as const) {
      const d = readDump(BASE, theme, 'f-states');
      const at = (name: string): DumpElement => d.elements.find((e) => e.name === name)!;
      for (const [forced, plain] of [['rb-hover', 'rb-child'], ['rb-active', 'rb-child'], ['rb-focus', 'rb-child'], ['rb-forced', 'rb-child'], ['te-hover', 'te-child']]) {
        for (const k of ['color', 'backgroundColor', 'borderTopColor', 'opacity', 'paddingLeft', 'marginTop']) {
          expect(at(forced!).style[k], `${theme} ${forced} ${k}`).toBe(at(plain!).style[k]);
        }
      }
    }
  });
});

for (const theme of ['runtime', 'editor'] as const) {
  describe(`bundle F — ${theme} theme`, () => {
    for (const probe of PROBE_FILES) {
      it(`${probe}: every control, each of its parts and its file children land where Unity puts them`, () => {
        const { dump, doc, tree } = layout(theme, probe);
        try {
          const nodes = named(doc.root);
          const controls = controlsOf(dump, nodes);
          expect(controls.length, probe).toBeGreaterThan(0);
          for (const c of controls) {
            const node = nodes.get(c.name)!;
            const b = tree.boxes.get(node.id)!;
            expectBox(theme, [b.left, b.top, b.width, b.height], [c.x, c.y, c.w, c.h], c.path);
            const parts = tree.parts.get(node.id) ?? [];
            const unity = unityParts(dump, c, nodes);
            expect(parts.map((p) => p.name).sort(), `${c.path} parts`).toEqual(unity.map(partName).sort());
            for (const u of unity) {
              const p = parts.find((x) => x.name === partName(u))!;
              const known = `${theme} ${probe} ${u.path}`;
              if (KNOWN_HALF_PIXEL.has(known) && p.box.left === u.x - 1) {
                knownHalfPixelSeen.add(known);
                expectBox(theme, [p.box.top, p.box.width, p.box.height], [u.y, u.w, u.h], `${c.path} ${p.name} (x: known half pixel)`);
                continue;
              }
              expectBox(theme, [p.box.left, p.box.top, p.box.width, p.box.height], [u.x, u.y, u.w, u.h], `${c.path} ${p.name}`);
            }
            for (const e of dump.elements.filter((x) => x.path.startsWith(`${c.path}/`) && nodes.has(x.name))) {
              const fb = tree.boxes.get(nodes.get(e.name)!.id)!;
              expectBox(theme, [fb.left, fb.top, fb.width, fb.height], [e.x, e.y, e.w, e.h], `${e.path} (file child)`);
            }
          }
          expect(tree.warnings.filter((w) => w.kind === 'unsupported-control')).toEqual([]);
        } finally {
          tree.dispose();
        }
      });

      it(`${probe}: every control and its parts get Unity's resolved values`, () => {
        const { dump, doc, resolved, tree } = layout(theme, probe);
        try {
          const nodes = named(doc.root);
          for (const c of controlsOf(dump, nodes)) {
            const node = nodes.get(c.name)!;
            expectStyle((p) => resolved.styles.get(node.id)?.get(p)?.value, c, c.path);
            const parts = tree.parts.get(node.id) ?? [];
            for (const u of unityParts(dump, c, nodes)) {
              const p = parts.find((x) => x.name === partName(u));
              expect(p, `${c.path} ${partName(u)}`).toBeDefined();
              expectStyle((q) => p!.style.get(q)?.value, u, `${c.path} ${p!.name}`);
            }
          }
          // f-hook: the type selector TextElement reaches a TextElement only.
          if (probe === 'f-hook') {
            for (const name of ['l-hook', 'rb-hook', 'te-hook']) {
              const u = dump.elements.find((e) => e.name === name)!;
              expectStyle((p) => resolved.styles.get(nodes.get(name)!.id)?.get(p)?.value, u, name);
            }
          }
        } finally {
          tree.dispose();
        }
      });
    }

    if (theme === 'runtime') {
      it('every known half-pixel row is still a half-pixel difference (none stale)', () => {
        expect([...knownHalfPixelSeen].sort()).toEqual([...KNOWN_HALF_PIXEL].sort());
      });
    }

    it('draws the text of a TextElement, a RepeatButton and a ProgressBar title, and the bar', () => {
      const draw = (probe: string): RenderResult => {
        const dump = readDump(BASE, theme, probe);
        const doc = readProbe(probe);
        return render(doc, document.createElement('div'), { theme, size: dump.metadata.panel, measureText: unityMeasure(dump), states: forcedStates(doc.root) });
      };
      const te = draw('c07-TextElement');
      const rb = draw('c07-RepeatButton');
      const pb = draw('c07-ProgressBar');
      try {
        const el = (r: RenderResult, name: string): HTMLElement => r.elements.get(named(r.document!.root).get(name)!.id)!;
        expect(el(te, 'te-plain').textContent).toBe('Text');
        expect(el(rb, 'rb-text').textContent).toBe('Repeat');
        const title = el(pb, 'p-title').querySelectorAll(`[${PART_ATTRIBUTE}="unity-progress-bar__title"]`);
        expect([...title].map((e) => e.textContent)).toEqual(['Loading']);
        const bar = el(pb, 'p-half').querySelector(`[${PART_ATTRIBUTE}="unity-progress-bar__progress"]`) as HTMLElement;
        expect(bar.style.width).toBe(theme === 'runtime' ? '141px' : '146px');
        expect(bar.style.backgroundColor).not.toBe('');
      } finally {
        te.dispose();
        rb.dispose();
        pb.dispose();
      }
    });

    it('warns about the version-dependent empty bar on the editor theme only', () => {
      const dump = readDump(BASE, theme, 'f-progress');
      const doc = readProbe('f-progress');
      const r = render(doc, document.createElement('div'), { theme, size: dump.metadata.panel, measureText: unityMeasure(dump) });
      try {
        const nodes = named(r.document!.root);
        const warned = r.warnings
          .filter((w) => w.kind === 'version-dependent' && (w.subject as { type?: string } | undefined)?.type === 'ProgressBar')
          .map((w) => [...nodes].find(([, n]) => n.id === w.node)?.[0])
          .sort();
        expect(warned).toEqual(theme === 'editor' ? ['p-0', 'p-under'] : []);
      } finally {
        r.dispose();
      }
    });
  });
}
