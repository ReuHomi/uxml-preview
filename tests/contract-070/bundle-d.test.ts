/**
 * 0.7.0 bundle D — Slider and SliderInt, on both themes, from Unity dumps.
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Expected values are read from the committed 6000.3.25f1 dumps at run time:
 *   runtime — tests/layout/unity/6000.3.25f1/probe-panel/{c07-Slider,c07-SliderInt,d-slider,d-sliderint,c07-states}.json
 *   editor  — tests/layout/unity/6000.3.25f1/probe-editor-070/ (same files)
 * Probes: tests/layout/unity/probes-0.7.0/. Why 6.3 for both (bundle A plan, section 20):
 * 6000.0.40f1 gives every box, class and judged value the same apart from the text
 * generator and one colour's alpha rounding (editor dragger border 0.502 against 0.5);
 * the first test checks that.
 *
 * What the dumps show (both themes):
 *   Slider (unity-base-field [unity-base-field--no-label] unity-base-slider
 *   unity-base-slider--horizontal|--vertical unity-slider) builds, in order:
 *     a Label when `label` is non-empty (no name; ... unity-slider__label),
 *     an unnamed VisualElement (unity-base-field__input unity-base-slider__input unity-slider__input),
 *       inside it #unity-drag-container (unity-base-slider__drag-container), which holds three
 *         siblings: #unity-tracker, #unity-dragger-border, #unity-dragger;
 *       and, with show-input-field="true", after the drag container a TextField
 *         #unity-text-field (TextField's classes + unity-base-slider__text-field) with its own
 *         #unity-text-input and inner TextElement showing the value ("7").
 *   SliderInt: the same with unity-slider-int, unity-slider-int__label, unity-slider-int__input.
 *   This preview names the unnamed parts by their most specific class (unity-slider__label,
 *   unity-slider__input, ...-int variants); every other part by Unity's name. All of them,
 *   the nested TextField's included, are parts of the Slider.
 *
 * The dragger and its border move by `translate`, the measured rule (section 20):
 *   t = clamp((value - low) / (high - low), 0, 1)
 *   horizontal: translate-x = t * (drag container width - dragger width)
 *   vertical:   translate-y = (1 - t) * (drag container height - dragger height)
 * Unity's boxes include the translate; this preview's layout boxes do not (translate is
 * paint, as everywhere here). So a part's layout box is held to Unity's box less its
 * translate, and its `translate` value to Unity's.
 *
 * Text is measured with Unity's own sizes per (text, font size). Not drawn, not judged:
 * dragging, changing the value (0.8 candidates); the look of the dragger is boxes and colours.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { loadLayoutEngine, parse, render, resolveStyles, PART_ATTRIBUTE } from '../../src/index';
import type { ElementNode, MeasureText, RenderResult, Theme } from '../../src/index';
import { layoutDocument } from '../../src/layout/yoga';

const UNITY = join(process.cwd(), 'tests', 'layout', 'unity');
const PROBES = join(UNITY, 'probes-0.7.0');
const FOLDER: Record<Theme, string> = { runtime: 'probe-panel', editor: 'probe-editor-070' };
const BASE = '6000.3.25f1';
const PROBE_FILES = ['c07-Slider', 'c07-SliderInt', 'd-slider', 'd-sliderint'] as const;
const SLIDERS = ['Slider', 'SliderInt'];

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
const probeText = (name: string): string => readFileSync(join(PROBES, `${name}.uxml`), 'utf8');
const find = (dump: Dump, path: string): DumpElement | undefined => dump.elements.find((x) => x.path === path);
const translateOf = (e: DumpElement): [number, number] => {
  const m = /\(([-\d.]+),\s*([-\d.]+)/.exec(e.style['translate'] ?? '');
  return m === null ? [0, 0] : [Number(m[1]), Number(m[2])];
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
  return (text, context) => {
    const hit = sizes.get(`${text}|${context.fontSize}`);
    if (hit === undefined) throw new Error(`no Unity measurement for ${JSON.stringify(text)} at ${context.fontSize}px`);
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

/** Unity's parts of a slider: every element inside it (sliders here have no file children). */
const unityParts = (dump: Dump, slider: DumpElement): DumpElement[] => dump.elements.filter((e) => e.path.startsWith(`${slider.path}/`));
/** The preview's name for a Unity part: Unity's name, else its most specific class. */
function partName(e: DumpElement): string {
  if (e.name !== '') return e.name;
  const specific = e.classes.filter((c) => /^unity-slider(-int)?__/.test(c));
  if (specific.length !== 1) throw new Error(`${e.path}: no single specific class in ${e.classes.join(' ')}`);
  return specific[0]!;
}

/** #rgb, #rrggbb, #rrggbbaa, rgb(), rgba(), transparent → [r, g, b, a] in 0..1. */
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

/** translate written as USS (`38.4px 0px`, `0 56px`, ...) → [x, y] in px. */
function ourTranslate(value: string | undefined): [number, number] {
  if (value === undefined || value.trim() === '' || value.trim() === 'none') return [0, 0];
  const parts = value.trim().split(/\s+/).map((p) => parseFloat(p));
  return [parts[0] ?? 0, parts[1] ?? 0];
}

function layout(theme: Theme, probe: string, states?: Record<string, string[]>) {
  const dump = readDump(BASE, theme, probe);
  const doc = parse(probeText(probe));
  const resolved = resolveStyles(doc, { theme, ...(states === undefined ? {} : { states }) });
  const tree = layoutDocument(doc.root, resolved.styles, resolved.partStyles, {
    theme,
    size: dump.metadata.panel,
    measureText: unityMeasure(dump),
  });
  return { dump, doc, resolved, tree };
}

const slidersOf = (dump: Dump, nodes: Map<string, ElementNode>): DumpElement[] =>
  dump.elements.filter((e) => SLIDERS.includes(e.type) && nodes.has(e.name));

describe('bundle D — the evidence', () => {
  it('6000.0.40f1 and 6000.3.25f1 agree on every box, class and judged value', () => {
    const judged = ['fontSize', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
      'borderTopWidth', 'borderLeftWidth', 'flexShrink', 'flexGrow', 'opacity', 'color', 'borderTopColor', 'borderLeftColor', 'translate', 'position'];
    for (const theme of ['runtime', 'editor'] as const) {
      for (const probe of PROBE_FILES) {
        const a = readDump('6000.0.40f1', theme, probe);
        const b = readDump(BASE, theme, probe);
        expect(b.elements.map((e) => e.path)).toEqual(a.elements.map((e) => e.path));
        a.elements.forEach((e, i) => {
          const o = b.elements[i]!;
          expect([o.x, o.y, o.w, o.h], `${theme} ${probe} ${e.path}`).toEqual([e.x, e.y, e.w, e.h]);
          expect(o.classes, `${theme} ${probe} ${e.path}`).toEqual(e.classes);
          for (const k of judged) expect(o.style[k], `${theme} ${probe} ${e.path} ${k}`).toBe(e.style[k]);
          // Background alpha may differ by output rounding only (0.502 against 0.5).
          unityRgba(o.style['backgroundColor']!).forEach((c, j) => expect(Math.abs(c - unityRgba(e.style['backgroundColor']!)[j]!)).toBeLessThanOrEqual(0.0025));
        });
      }
    }
  });

  it('the dragger rule holds on every slider in every dump (both versions, both themes)', () => {
    for (const version of ['6000.0.40f1', BASE]) {
      for (const theme of ['runtime', 'editor'] as const) {
        for (const probe of PROBE_FILES) {
          const dump = readDump(version, theme, probe);
          const doc = parse(probeText(probe));
          const nodes = named(doc.root);
          for (const s of slidersOf(dump, nodes)) {
            const node = nodes.get(s.name)!;
            const low = Number(attr(node, 'low-value') ?? '0');
            const high = Number(attr(node, 'high-value') ?? (s.type === 'SliderInt' ? '10' : '10'));
            const value = Number(attr(node, 'value') ?? String(low));
            const t = Math.min(1, Math.max(0, high === low ? 0 : (value - low) / (high - low)));
            const container = unityParts(dump, s).find((e) => e.name === 'unity-drag-container')!;
            const dragger = unityParts(dump, s).find((e) => e.name === 'unity-dragger')!;
            const [tx, ty] = translateOf(dragger);
            const vertical = s.classes.includes('unity-base-slider--vertical');
            if (vertical) {
              expect(tx, `${version} ${theme} ${s.path}`).toBe(0);
              expect(Math.abs(ty - (1 - t) * (container.h - dragger.h)), `${version} ${theme} ${s.path} ty ${ty}`).toBeLessThanOrEqual(0.01);
            } else {
              expect(ty, `${version} ${theme} ${s.path}`).toBe(0);
              expect(Math.abs(tx - t * (container.w - dragger.w)), `${version} ${theme} ${s.path} tx ${tx}`).toBeLessThanOrEqual(0.01);
            }
            const border = unityParts(dump, s).find((e) => e.name === 'unity-dragger-border')!;
            expect(translateOf(border), `${version} ${theme} ${s.path} border`).toEqual([tx, ty]);
          }
        }
      }
    }
  });
});

for (const theme of ['runtime', 'editor'] as const) {
  describe(`bundle D — ${theme} theme`, () => {
    for (const probe of PROBE_FILES) {
      it(`${probe}: every slider and each of its parts lands where Unity puts it, the dragger by translate`, () => {
        const { dump, doc, tree } = layout(theme, probe);
        try {
          const nodes = named(doc.root);
          for (const s of slidersOf(dump, nodes)) {
            const node = nodes.get(s.name)!;
            const b = tree.boxes.get(node.id)!;
            expect([b.left, b.top, b.width, b.height], s.path).toEqual([s.x, s.y, s.w, s.h]);
            const parts = tree.parts.get(node.id) ?? [];
            const unity = unityParts(dump, s);
            expect(parts.map((p) => p.name).sort(), `${s.path} parts`).toEqual(unity.map(partName).sort());
            for (const u of unity) {
              const p = parts.find((x) => x.name === partName(u))!;
              const [tx, ty] = translateOf(u);
              const box = [p.box.left, p.box.top, p.box.width, p.box.height];
              const want = [u.x - tx, u.y - ty, u.w, u.h];
              box.forEach((v, i) => expect(Math.abs(v - want[i]!), `${s.path} ${p.name} box ${box.join(',')} vs ${want.join(',')}`).toBeLessThanOrEqual(0.01));
              const [ox, oy] = ourTranslate(p.style.get('translate')?.value);
              expect(Math.abs(ox - tx) + Math.abs(oy - ty), `${s.path} ${p.name} translate ${ox},${oy} vs ${tx},${ty}`).toBeLessThanOrEqual(0.01);
            }
          }
          expect(tree.warnings.filter((w) => w.kind === 'unsupported-control')).toEqual([]);
        } finally {
          tree.dispose();
        }
      });

      it(`${probe}: every slider and its parts get Unity's resolved values`, () => {
        const { dump, doc, resolved, tree } = layout(theme, probe);
        try {
          const nodes = named(doc.root);
          for (const s of slidersOf(dump, nodes)) {
            const node = nodes.get(s.name)!;
            expectStyle((p) => resolved.styles.get(node.id)?.get(p)?.value, s, s.path);
            const parts = tree.parts.get(node.id) ?? [];
            for (const u of unityParts(dump, s)) {
              const p = parts.find((x) => x.name === partName(u));
              expect(p, `${s.path} ${partName(u)}`).toBeDefined();
              expectStyle((q) => p!.style.get(q)?.value, u, `${s.path} ${p!.name}`);
            }
          }
        } finally {
          tree.dispose();
        }
      });
    }

    it('draws the label, the value in the input field, and the dragger moved by translate', () => {
      const dump = readDump(BASE, theme, 'c07-Slider');
      const r: RenderResult = render(parse(probeText('c07-Slider')), document.createElement('div'), {
        theme,
        size: dump.metadata.panel,
        measureText: unityMeasure(dump),
      });
      try {
        const nodes = named(r.document!.root);
        const el = (name: string) => r.elements.get(nodes.get(name)!.id)!;
        const parts = (name: string, part: string) => [...el(name).querySelectorAll(`[${PART_ATTRIBUTE}="${part}"]`)];
        expect(parts('s-label', 'unity-slider__label').map((e) => e.textContent)).toEqual(['Label']);
        expect(parts('s-input', 'unity-text-element--inner-input-field-component').map((e) => e.textContent)).toEqual(['5']);
        const dragger = parts('s-max', 'unity-dragger') as HTMLElement[];
        expect(dragger).toHaveLength(1);
        const u = dump.elements.find((e) => e.path.startsWith('col/s-max/') && e.name === 'unity-dragger')!;
        const m = /translate\(\s*([-\d.]+)px\s*,\s*([-\d.]+)(?:px)?\s*\)/.exec(dragger[0]!.style.transform);
        expect(m, dragger[0]!.style.transform).not.toBeNull();
        expect(Math.abs(Number(m![1]) - translateOf(u)[0]) + Math.abs(Number(m![2]) - translateOf(u)[1])).toBeLessThanOrEqual(0.01);
      } finally {
        r.dispose();
      }
    });

    it('hover on the slider changes no part, as in Unity (c07-states st-slider-hover)', () => {
      const { dump, doc, tree } = layout(theme, 'c07-states', { '#st-slider-hover': ['hover'] });
      try {
        const node = named(doc.root).get('st-slider-hover')!;
        const s = dump.elements.find((e) => e.path === 'col/st-slider-hover')!;
        const parts = tree.parts.get(node.id) ?? [];
        for (const u of unityParts(dump, s)) {
          const p = parts.find((x) => x.name === partName(u));
          expect(p, partName(u)).toBeDefined();
          expectStyle((q) => p!.style.get(q)?.value, u, `hover ${p!.name}`);
        }
      } finally {
        tree.dispose();
      }
    });
  });
}
