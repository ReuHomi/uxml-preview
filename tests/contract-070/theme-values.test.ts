/**
 * 0.7.0 bundle A, step A2 — what each theme draws, from Unity dumps.
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Every expected number is read from a committed dump at run time, never typed in:
 *   - editor theme: tests/layout/unity/6000.0.40f1/probe-editor-070/ (ProbeDump, an
 *     EditorWindow under the dark editor theme; 6000.0.40f1 is the editor theme's
 *     measured version, THEME_UNITY_VERSION)
 *   - runtime theme: tests/layout/unity/6000.3.25f1/probe-panel/ (PanelDump, a real
 *     runtime panel with Unity's default runtime theme). 6000.0.40f1 gives the same
 *     values; the first test holds that, so the version label cannot hide a difference.
 * Probe sources: tests/layout/unity/probes-0.7.0/. PanelDump was checked against
 * UxmlLayoutDump in step A0 (tests/golden/panel-dump.test.ts).
 *
 * Text is measured by a stub that returns Unity's own `measured` size for each
 * (text, font size) the dump holds and throws for anything else, so a wrong default
 * font size fails here instead of measuring something plausible.
 *
 * Facts the dumps settle (bundle A plan, section 2 and section 9):
 *   - Label and Button have flex-shrink 0 in both themes; TextElement and
 *     VisualElement keep 1 (c07-TextElement).
 *   - Only the element with enabled="false" is dimmed: Unity gives that element
 *     the class `unity-disabled` and opacity 0.5; its disabled descendants keep 1
 *     (nested-disabled). A Button inside still takes the theme's :disabled colours.
 *   - The runtime vertical scroller is 24px wide, the editor's 13px
 *     (golden-panel/scrollview-overflowing, golden/scrollview-overflowing).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { loadLayoutEngine, parse, render } from '../../src/index';
import type { ElementNode, MeasureText, RenderResult, Theme } from '../../src/index';
import { CASES } from '../golden/cases';

const UNITY = join(process.cwd(), 'tests', 'layout', 'unity');
const PROBES = join(UNITY, 'probes-0.7.0');
const SOURCE: Record<Theme, string> = {
  editor: join(UNITY, '6000.0.40f1', 'probe-editor-070'),
  runtime: join(UNITY, '6000.3.25f1', 'probe-panel'),
};
const THEMES = ['editor', 'runtime'] as const;

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

const readDump = (dir: string, probe: string): Dump =>
  JSON.parse(readFileSync(join(dir, `${probe}.json`), 'utf8').replace(/\bNaN\b/g, 'null')) as Dump;
const probeFile = (file: string): string => readFileSync(join(PROBES, file), 'utf8');

beforeAll(async () => {
  await loadLayoutEngine();
});

/** Unity's measured size per (text, font size); anything else is a defect. */
function unityMeasure(dump: Dump): MeasureText {
  const sizes = new Map<string, { width: number; height: number }>();
  for (const e of dump.elements) {
    if (e.measured === undefined || e.text === undefined) continue;
    sizes.set(`${e.text}|${Number(e.style['fontSize'])}`, { width: e.measured.w, height: e.measured.h });
  }
  // Where Unity's layout gave a text 1-2px more than its MeasureTextSize, use that layout width,
  // read from the box (as bundle-e.test.ts). The dumps are solo dumps (plan section 27-2), so it is
  // the reference value: c07-existing free/label-auto is 107 alone (106 after other probes).
  for (const e of dump.elements) {
    if (e.measured === undefined || e.text === undefined) continue;
    const s = e.style;
    const over = e.w - Number(s['paddingLeft']) - Number(s['paddingRight']) - Number(s['borderLeftWidth']) - Number(s['borderRightWidth']) - e.measured.w;
    if (over >= 1 && over <= 2) sizes.set(`${e.text}|${Number(s['fontSize'])}`, { width: e.measured.w + over, height: e.measured.h });
  }
  return (text, context) => {
    const hit = sizes.get(`${text}|${context.fontSize}`);
    if (hit === undefined) throw new Error(`no Unity measurement for ${JSON.stringify(text)} at ${context.fontSize}px`);
    return hit;
  };
}

function draw(theme: Theme, probe: string, options: Parameters<typeof render>[2] = {}): { r: RenderResult; dump: Dump } {
  const dump = readDump(SOURCE[theme], probe);
  let uss: string | undefined;
  try {
    uss = probeFile(`${probe}.uss`);
  } catch {
    uss = undefined;
  }
  const doc = parse(probeFile(`${probe}.uxml`), uss);
  const r = render(doc, document.createElement('div'), {
    theme,
    size: dump.metadata.panel,
    measureText: unityMeasure(dump),
    ...options,
  });
  return { r, dump };
}

function nodeByName(r: RenderResult, name: string): ElementNode {
  let found: ElementNode | undefined;
  const walk = (n: ElementNode): void => {
    if (n.attributes.some((a) => a.name === 'name' && a.value === name)) found = n;
    n.children.forEach(walk);
  };
  walk(r.document!.root);
  if (found === undefined) throw new Error(`no element named ${name}`);
  return found;
}

const dumped = (dump: Dump, name: string): DumpElement => {
  const e = dump.elements.find((x) => x.name === name);
  if (e === undefined) throw new Error(`dump has no ${name}`);
  return e;
};

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
const unityRgba = (text: string): number[] =>
  /rgba\(([^)]*)\)/.exec(text)![1]!.split(',').map(Number);

/** The preview's value for a property, with Unity's initial value when nothing set it. */
const INITIAL: Record<string, string> = {
  'background-color': 'transparent',
  'border-top-color': 'transparent',
  'border-right-color': 'transparent',
  'border-bottom-color': 'transparent',
  'border-left-color': 'transparent',
  opacity: '1',
  'flex-shrink': '1',
  '-unity-text-align': 'upper-left',
};
function value(r: RenderResult, name: string, property: string): string {
  const v = r.styles!.get(nodeByName(r, name).id)?.get(property)?.value ?? INITIAL[property] ?? '0';
  return v.trim();
}
const px = (v: string): number => parseFloat(v);
const keyword = (v: string): string => v.replace(/-/g, '').toLowerCase();

const COLOUR: Array<[string, string]> = [
  ['color', 'color'],
  ['background-color', 'backgroundColor'],
  ['border-top-color', 'borderTopColor'],
  ['border-right-color', 'borderRightColor'],
  ['border-bottom-color', 'borderBottomColor'],
  ['border-left-color', 'borderLeftColor'],
];
const LENGTH: Array<[string, string]> = [
  ['font-size', 'fontSize'],
  ['margin-top', 'marginTop'],
  ['margin-right', 'marginRight'],
  ['margin-bottom', 'marginBottom'],
  ['margin-left', 'marginLeft'],
  ['padding-top', 'paddingTop'],
  ['padding-right', 'paddingRight'],
  ['padding-bottom', 'paddingBottom'],
  ['padding-left', 'paddingLeft'],
  ['border-top-width', 'borderTopWidth'],
  ['border-right-width', 'borderRightWidth'],
  ['border-bottom-width', 'borderBottomWidth'],
  ['border-left-width', 'borderLeftWidth'],
  ['border-top-left-radius', 'borderTopLeftRadius'],
  ['border-top-right-radius', 'borderTopRightRadius'],
  ['border-bottom-left-radius', 'borderBottomLeftRadius'],
  ['border-bottom-right-radius', 'borderBottomRightRadius'],
  ['flex-shrink', 'flexShrink'],
  ['opacity', 'opacity'],
];

function expectStyle(r: RenderResult, dump: Dump, name: string, colours = COLOUR): void {
  const u = dumped(dump, name);
  for (const [css, unity] of LENGTH) {
    expect(px(value(r, name, css)), `${name} ${css}`).toBeCloseTo(Number(u.style[unity]), 3);
  }
  for (const [css, unity] of colours) {
    const ours = rgba(value(r, name, css));
    const theirs = unityRgba(u.style[unity]!);
    ours.forEach((c, i) => expect(Math.abs(c - theirs[i]!), `${name} ${css} [${i}] ${value(r, name, css)} vs ${u.style[unity]}`).toBeLessThanOrEqual(0.0011));
  }
  expect(keyword(value(r, name, '-unity-text-align')), `${name} -unity-text-align`).toBe(keyword(u.style['unityTextAlign']!));
}

const EXISTING = ['col', 've', 'label', 'button', 'button-empty', 'image', 'scroll', 'scroll-child', 'label-disabled', 'button-disabled', 'free', 'label-auto', 'button-auto'];

describe('theme values (A2)', () => {
  it('the runtime values are the same on 6000.0.40f1 and 6000.3.25f1', () => {
    for (const probe of ['c07-existing', 'c07-states', 'nested-disabled']) {
      const a = readDump(join(UNITY, '6000.0.40f1', 'probe-panel'), probe).elements;
      const b = readDump(join(UNITY, '6000.3.25f1', 'probe-panel'), probe).elements;
      // 6.3 reports properties 6000.0 does not have (aspectRatio, filter, ...); compare the shared ones.
      const shared = (e: DumpElement, keys: string[]) => keys.map((k) => e.style[k]);
      expect(a.map((e) => [e.path, e.x, e.y, e.w, e.h, shared(e, Object.keys(a[0]!.style))])).toEqual(
        b.map((e) => [e.path, e.x, e.y, e.w, e.h, shared(e, Object.keys(a[0]!.style))]),
      );
    }
  });

  for (const theme of THEMES) {
    describe(theme, () => {
      it('places Label, Button, Image and ScrollView where Unity does (c07-existing)', () => {
        const { r, dump } = draw(theme, 'c07-existing');
        try {
          for (const name of EXISTING) {
            const u = dumped(dump, name);
            const b = r.boxes.get(nodeByName(r, name).id)!;
            expect([b.left, b.top, b.width, b.height], name).toEqual([u.x, u.y, u.w, u.h]);
          }
        } finally {
          r.dispose();
        }
      });

      it('gives text, Label and Button Unity resolved values (c07-existing)', () => {
        const { r, dump } = draw(theme, 'c07-existing');
        try {
          for (const name of ['ve', 'label', 'button', 'image', 'label-disabled', 'button-disabled', 'label-auto', 'button-auto']) {
            expectStyle(r, dump, name);
          }
        } finally {
          r.dispose();
        }
      });

      it('colours Button hover, active and focus as Unity does (c07-states)', () => {
        const { r, dump } = draw(theme, 'c07-states', {
          states: {
            '#st-button-hover': ['hover'],
            '#st-button-active': ['hover', 'active'],
            '#st-button-focus': ['focus'],
          },
        });
        try {
          for (const name of ['st-button', 'st-button-hover', 'st-button-active', 'st-button-focus']) {
            expectStyle(r, dump, name);
          }
        } finally {
          r.dispose();
        }
      });

      it('dims only the element written disabled (nested-disabled)', () => {
        const { r, dump } = draw(theme, 'nested-disabled');
        try {
          for (const name of ['outer', 'inner', 'innermost', 'btn', 'selfonly', 'plain']) {
            expect(px(value(r, name, 'opacity')), `${name} opacity`).toBe(Number(dumped(dump, name).style['opacity']));
          }
          // The Button inside the disabled subtree is :disabled, so it takes the disabled colours.
          expectStyle(r, dump, 'btn', COLOUR.filter(([css]) => css === 'background-color' || css === 'color'));
          // Painted: no opacity below 0.5 anywhere, so nothing is dimmed twice.
          const painted = [...r.elements.values()].map((el) => el.style.opacity).filter((o) => o !== '').map(Number);
          expect(Math.min(...painted, 1)).toBe(0.5);
        } finally {
          r.dispose();
        }
      });
    });
  }

  it.each([
    ['editor', join(UNITY, '6000.0.40f1', 'golden', 'scrollview-overflowing.json')],
    ['runtime', join(process.cwd(), 'tests', 'golden', 'unity-runtime', 'scrollview-overflowing.json')],
  ] as const)('%s: the vertical scroller takes the width Unity gives it', (theme, file) => {
    const raw = readFileSync(file, 'utf8');
    const want = Number(/"sv-over-a": \{ ?"x": [-\d.]+, ?"y": [-\d.]+, ?"width": ([-\d.]+)/.exec(raw.replace(/\s+/g, ' '))![1]);
    const golden = CASES.find((c) => c.name === 'scrollview-overflowing')!;
    const r = render(parse(golden.uxml, golden.uss), document.createElement('div'), {
      theme,
      size: { width: 400, height: 300 },
      measureText: () => ({ width: 0, height: 0 }),
    });
    try {
      expect(r.boxes.get(nodeByName(r, 'sv-over-a').id)!.width).toBe(want);
    } finally {
      r.dispose();
    }
  });
});
