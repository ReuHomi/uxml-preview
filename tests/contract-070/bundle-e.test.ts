/**
 * 0.7.0 bundle E — Toggle and RadioButton, on both themes, from Unity dumps.
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Expected values are read from the committed 6000.3.25f1 dumps at run time:
 *   runtime — tests/layout/unity/6000.3.25f1/probe-panel/{c07-Toggle,c07-RadioButton,e-toggle,e-radio}.json
 *   editor  — tests/layout/unity/6000.3.25f1/probe-editor-070/ (same files)
 * Probes: tests/layout/unity/probes-0.7.0/. 6000.0.40f1 gives the same classes and judged values;
 * boxes are the same on the runtime panel and within 1px on the editor (text generator) (first test).
 *
 * What the dumps show (bundle A plan, section 23):
 *   Toggle (unity-base-field [unity-base-field--no-label] unity-toggle):
 *     [a Label when `label` is non-empty: unity-toggle__label],
 *     an unnamed input (unity-base-field__input unity-toggle__input) holding #unity-checkmark
 *     (unity-toggle__checkmark) and, when `text` is non-empty, a Label (unity-toggle__text).
 *   RadioButton (unity-base-field [--no-label] unity-radio-button): the same with radio-button
 *     classes, and the checkmark inside an unnamed unity-radio-button__checkmark-background.
 *   value="true" is not a class: the `:checked` pseudo-state sits on the control and on its
 *   input part only. The radio checkmark is 0x0 unchecked and 12x12 (runtime) / 6x6 (editor)
 *   checked. Forced hover/focus/active (class force-* in the probe; `states` here) sit on
 *   the control only and change none of its parts.
 *   Unnamed parts are named by their most specific class (unity-toggle__label, ...).
 * The checkmark's picture (Unity's textures check, d_toggle_bg, d_toggle_on) cannot be used
 * here: its box, colours and whether something is drawn are judged; its shape is judging
 * rule 5 (a person, screenshots in the bundle E report).
 *
 * RadioButtonGroup is not in this bundle (drawn as a fallback): c07-RadioButton's `free`
 * row sits below one, so there the controls' y is not judged.
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
const PROBE_FILES = ['c07-Toggle', 'c07-RadioButton', 'e-toggle', 'e-radio'] as const;
const CHECKS = ['Toggle', 'RadioButton'];
const KEBAB: Record<string, string> = { Toggle: 'toggle', RadioButton: 'radio-button' };

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
const attr = (node: ElementNode, name: string): string | undefined => node.attributes.find((a) => a.name === name)?.value;

beforeAll(async () => {
  await loadLayoutEngine();
});

function unityMeasure(dump: Dump): MeasureText {
  const sizes = new Map<string, { width: number; height: number }>();
  for (const e of dump.elements) {
    if (e.measured !== undefined && e.text !== undefined) sizes.set(`${e.text}|${Number(e.style['fontSize'])}`, { width: e.measured.w, height: e.measured.h });
  }
  // Where Unity's layout gave a Label's text 1-2px more than its MeasureTextSize (the
  // runtime-panel difference found in bundle C, item T), the stub uses the layout width,
  // read from the box less padding and border. Only rows 1-2px over count, so a Label
  // stretched by min-width or flex is not read. Such a row checks the structure, not
  // the text width. In these dumps: c07-RadioButton runtime "Text" (29 -> 30).
  for (const e of dump.elements) {
    if (e.measured === undefined || e.text === undefined) continue;
    const s = e.style;
    const inner = e.w - Number(s['paddingLeft']) - Number(s['paddingRight']) - Number(s['borderLeftWidth']) - Number(s['borderRightWidth']);
    const over = inner - e.measured.w;
    if (over >= 1 && over <= 2) sizes.set(`${e.text}|${Number(s['fontSize'])}`, { width: inner, height: e.measured.h });
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

/** The probe's forced states, as the preview's `states` option (force-hover → hover, ...). */
function forcedStates(root: ElementNode): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [name, node] of named(root)) {
    const states = (attr(node, 'class') ?? '').split(/\s+/).filter((c) => c.startsWith('force-')).map((c) => c.slice('force-'.length));
    if (states.length > 0) out[`#${name}`] = states;
  }
  return out;
}

const unityParts = (dump: Dump, control: DumpElement): DumpElement[] => dump.elements.filter((e) => e.path.startsWith(`${control.path}/`));
function partName(control: DumpElement, e: DumpElement): string {
  if (e.name !== '') return e.name;
  const prefix = `unity-${KEBAB[control.type]}__`;
  const specific = e.classes.filter((c) => c.startsWith(prefix));
  if (specific.length !== 1) throw new Error(`${e.path}: no single ${prefix} class in ${e.classes.join(' ')}`);
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

function layout(theme: Theme, probe: string) {
  const dump = readDump(BASE, theme, probe);
  const doc = parse(probeText(probe));
  const resolved = resolveStyles(doc, { theme, states: forcedStates(doc.root) });
  const tree = layoutDocument(doc.root, resolved.styles, resolved.partStyles, { theme, size: dump.metadata.panel, measureText: unityMeasure(dump) });
  return { dump, doc, resolved, tree };
}

const checksOf = (dump: Dump, nodes: Map<string, ElementNode>): DumpElement[] =>
  dump.elements.filter((e) => CHECKS.includes(e.type) && nodes.has(e.name));
const yJudged = (probe: string, u: DumpElement): boolean => !(probe === 'c07-RadioButton' && u.path.startsWith('free/'));

describe('bundle E — the evidence', () => {
  it('6000.0.40f1 and 6000.3.25f1 agree on every box, class and judged value', () => {
    const judged = ['fontSize', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
      'borderTopWidth', 'borderLeftWidth', 'flexShrink', 'flexGrow', 'opacity', 'color', 'backgroundColor', 'borderTopColor', 'borderLeftColor'];
    for (const theme of ['runtime', 'editor'] as const) {
      for (const probe of PROBE_FILES) {
        const a = readDump('6000.0.40f1', theme, probe);
        const b = readDump(BASE, theme, probe);
        // RadioButtonGroup (not in this bundle) renamed its container in 6.3; it is left out.
        const outsideGroup = (e: DumpElement): boolean => !e.path.startsWith('col/rg');
        expect(b.elements.filter(outsideGroup).map((e) => e.path)).toEqual(a.elements.filter(outsideGroup).map((e) => e.path));
        a.elements.filter(outsideGroup).forEach((e) => {
          const o = b.elements.find((x) => x.path === e.path)!;
          // The editor's text generator differs by version (Standard/Advanced): text widths by 1px.
          const slack = theme === 'editor' ? 1 : 0;
          [o.x - e.x, o.y - e.y, o.w - e.w, o.h - e.h].forEach((d) => expect(Math.abs(d), `${theme} ${probe} ${e.path}`).toBeLessThanOrEqual(slack));
          expect(o.classes, `${theme} ${probe} ${e.path}`).toEqual(e.classes);
          for (const k of judged) expect(o.style[k], `${theme} ${probe} ${e.path} ${k}`).toBe(e.style[k]);
        });
      }
    }
  });

  it(':checked sits on the control and its input only; forced states on the control only (r3 dumps)', () => {
    for (const theme of ['runtime', 'editor'] as const) {
      for (const probe of ['e-toggle', 'e-radio']) {
        const dump = readDump(BASE, theme, probe) as Dump & { elements: Array<DumpElement & { pseudoStates?: string }> };
        for (const c of dump.elements.filter((e) => CHECKS.includes(e.type))) {
          for (const e of unityParts(dump, c) as Array<DumpElement & { pseudoStates?: string }>) {
            const states = (e.pseudoStates ?? '').split(',').map((s) => s.trim()).filter((s) => s !== '' && s !== 'None' && s !== '0');
            const isInput = e.classes.includes(`unity-${KEBAB[c.type]}__input`);
            const ownerChecked = ((c as DumpElement & { pseudoStates?: string }).pseudoStates ?? '').includes('Checked');
            expect(states, `${theme} ${e.path}`).toEqual(isInput && ownerChecked ? ['Checked'] : []);
          }
        }
      }
    }
  });
});

for (const theme of ['runtime', 'editor'] as const) {
  describe(`bundle E — ${theme} theme`, () => {
    for (const probe of PROBE_FILES) {
      it(`${probe}: every Toggle/RadioButton and each of its parts lands where Unity puts it`, () => {
        const { dump, doc, tree } = layout(theme, probe);
        try {
          const nodes = named(doc.root);
          for (const c of checksOf(dump, nodes)) {
            const node = nodes.get(c.name)!;
            const b = tree.boxes.get(node.id)!;
            const judgeY = yJudged(probe, c);
            const pick = (box: number[]): number[] => (judgeY ? box : [box[0]!, box[2]!, box[3]!]);
            expect(pick([b.left, b.top, b.width, b.height]), c.path).toEqual(pick([c.x, c.y, c.w, c.h]));
            const parts = tree.parts.get(node.id) ?? [];
            const unity = unityParts(dump, c);
            expect(parts.map((p) => p.name).sort(), `${c.path} parts`).toEqual(unity.map((e) => partName(c, e)).sort());
            for (const u of unity) {
              const p = parts.find((x) => x.name === partName(c, u))!;
              // Part boxes relative to the control, so a y not judged above does not leak in.
              const ours = [p.box.left - b.left, p.box.top - b.top, p.box.width, p.box.height];
              const want = [u.x - c.x, u.y - c.y, u.w, u.h];
              expect(ours, `${c.path} ${p.name}`).toEqual(want);
            }
          }
          expect(tree.warnings.filter((w) => w.kind === 'unsupported-control' && (w.subject as { type?: string } | undefined)?.type !== 'RadioButtonGroup')).toEqual([]);
        } finally {
          tree.dispose();
        }
      });

      it(`${probe}: every Toggle/RadioButton and its parts get Unity's resolved values`, () => {
        const { dump, doc, resolved, tree } = layout(theme, probe);
        try {
          const nodes = named(doc.root);
          for (const c of checksOf(dump, nodes)) {
            const node = nodes.get(c.name)!;
            expectStyle((p) => resolved.styles.get(node.id)?.get(p)?.value, c, c.path);
            const parts = tree.parts.get(node.id) ?? [];
            for (const u of unityParts(dump, c)) {
              const p = parts.find((x) => x.name === partName(c, u));
              expect(p, `${c.path} ${partName(c, u)}`).toBeDefined();
              expectStyle((q) => p!.style.get(q)?.value, u, `${c.path} ${p!.name}`);
            }
          }
        } finally {
          tree.dispose();
        }
      });
    }

    it('draws the label and the text, and marks a checked checkmark and only a checked one', () => {
      const dump = readDump(BASE, theme, 'e-toggle');
      const doc = parse(probeText('e-toggle'));
      const r: RenderResult = render(doc, document.createElement('div'), {
        theme, size: dump.metadata.panel, measureText: unityMeasure(dump), states: forcedStates(doc.root),
      });
      const dumpR = readDump(BASE, theme, 'e-radio');
      const docR = parse(probeText('e-radio'));
      const rr: RenderResult = render(docR, document.createElement('div'), {
        theme, size: dumpR.metadata.panel, measureText: unityMeasure(dumpR), states: forcedStates(docR.root),
      });
      try {
        const parts = (res: RenderResult, name: string, part: string): HTMLElement[] =>
          [...res.elements.get(named(res.document!.root).get(name)!.id)!.querySelectorAll(`[${PART_ATTRIBUTE}="${part}"]`)] as HTMLElement[];
        expect(parts(r, 't-both', 'unity-toggle__label').map((e) => e.textContent)).toEqual(['Label']);
        expect(parts(r, 't-both', 'unity-toggle__text').map((e) => e.textContent)).toEqual(['Text']);
        expect(parts(rr, 'r-both', 'unity-radio-button__text').map((e) => e.textContent)).toEqual(['Text']);
        const drawn = (e: HTMLElement): boolean => e.children.length > 0 || e.innerHTML.trim() !== '' || (e.style.backgroundImage !== '' && e.style.backgroundImage !== 'none');
        const [on] = parts(r, 't-both-checked', 'unity-checkmark');
        const [off] = parts(r, 't-both', 'unity-checkmark');
        expect(drawn(on!), 'checked toggle checkmark draws a mark').toBe(true);
        expect(drawn(off!), 'unchecked toggle checkmark draws none').toBe(false);
      } finally {
        r.dispose();
        rr.dispose();
      }
    });
  });
}
