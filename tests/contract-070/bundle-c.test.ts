/**
 * 0.7.0 bundle C — TextField, on both themes, from Unity dumps.
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Expected values are read from the committed 6000.3.25f1 dumps at run time:
 *   runtime — tests/layout/unity/6000.3.25f1/probe-panel/{c07-TextField,c-textfield,c-textfield-hook,c07-states}.json
 *   editor  — tests/layout/unity/6000.3.25f1/probe-editor-070/ (same files)
 * Probes: tests/layout/unity/probes-0.7.0/. Why 6.3 for both (bundle A plan, section 17):
 * 6000.0.40f1 differs only through text measurement (generator Standard against
 * Advanced, 1px), and some of its rows disagree with their own measurement by 1px.
 * The first test checks that claim on every theme value this file judges.
 *
 * What the dumps show:
 *   - TextField (classes unity-base-field, unity-base-text-field, unity-text-field, and
 *     unity-base-field--no-label without a label) builds, in order:
 *       a Label when `label` is non-empty (no name; classes ... unity-text-field__label),
 *       TextInput `#unity-text-input` (classes unity-base-text-field__input,
 *         unity-base-field__input, unity-text-field__input, plus --single-line or
 *         --multiline, plus --placeholder while the placeholder shows),
 *       inside it, when multiline, a VisualElement `.unity-base-text-field__multiline-container`,
 *       innermost a TextElement (no name; classes unity-text-element,
 *         unity-text-element__selectable, unity-text-element--inner-input-field-component).
 *     Unity names only the input. This preview names the other parts by their most
 *     specific class: `unity-text-field__label`, `unity-base-text-field__multiline-container`,
 *     `unity-text-element--inner-input-field-component`.
 *   - Password: the box is the mask's width, not the value's (iiiiii and WWWWWW give the
 *     same box); the mask character is `*` unless `mask-character` says otherwise.
 *   - Placeholder: while the value is empty the placeholder text sets the auto width and
 *     the input carries --placeholder with its colour; with a value it is gone.
 *   - An empty value is one line high (17 runtime, 15 editor) although Unity measures 0.
 *   - A long single line overflows the input; multiline wraps only with white-space: normal.
 *   - Label min-width 150 runtime, 120 editor; a longer label grows and the input shrinks.
 *   - Author rules on #unity-text-input, .unity-text-field__input, .unity-text-field__label reach.
 *
 * The measurer returns Unity's own sizes per (text, font size). Unity's `measured` is
 * taken before masking and is 0 for a placeholder, so three sizes are read from boxes
 * instead (the TextElement's width less its 2+2 padding, its height):
 *   "******" from tf-auto-pw-i, the placeholder "Type here" from tf-auto-ph, and the
 *   wrapped sentence from tf-ml-long-wrap (its height; the width is whatever the preview
 *   asks to wrap at, which the test checks is Unity's).
 *   [추론] "######" (mask-character="#") is given the width of "******": no box judged
 *   here depends on it (its row is stretched to the column).
 * Not drawn, not judged: the caret, the selection, editing (0.8 candidates).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { loadLayoutEngine, parse, render, resolveStyles, PART_ATTRIBUTE } from '../../src/index';
import type { ElementNode, MeasureText, RenderResult, Theme } from '../../src/index';
import { layoutDocument } from '../../src/layout/yoga';
import type { LayoutPart } from '../../src/layout/yoga';

const UNITY = join(process.cwd(), 'tests', 'layout', 'unity');
const PROBES = join(UNITY, 'probes-0.7.0');
const FOLDER: Record<Theme, string> = { runtime: 'probe-panel', editor: 'probe-editor-070' };
const BASE = '6000.3.25f1';

const LABEL = 'unity-text-field__label';
const INPUT = 'unity-text-input';
const CONTAINER = 'unity-base-text-field__multiline-container';
const TEXT = 'unity-text-element--inner-input-field-component';
const WRAPPED = 'The quick brown fox jumps over the lazy dog and keeps running past the river bank';

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
const ussOf = (name: string): string | undefined => (name === 'c-textfield-hook' ? readFileSync(join(PROBES, `${name}.uss`), 'utf8') : undefined);
const at = (dump: Dump, path: string): DumpElement => {
  const e = dump.elements.find((x) => x.path === path);
  if (e === undefined) throw new Error(`dump has no ${path}`);
  return e;
};
const find = (dump: Dump, path: string): DumpElement | undefined => dump.elements.find((x) => x.path === path);

beforeAll(async () => {
  await loadLayoutEngine();
});

/** Unity's dump paths for a TextField's parts. */
function partPaths(dump: Dump, field: string): Partial<Record<string, string>> {
  const out: Partial<Record<string, string>> = { [INPUT]: `${field}/unity-text-input` };
  if (find(dump, `${field}/Label[0]`) !== undefined) out[LABEL] = `${field}/Label[0]`;
  if (find(dump, `${field}/unity-text-input/VisualElement[0]`) !== undefined) {
    out[CONTAINER] = `${field}/unity-text-input/VisualElement[0]`;
    out[TEXT] = `${field}/unity-text-input/VisualElement[0]/TextElement[0]`;
  } else {
    out[TEXT] = `${field}/unity-text-input/TextElement[0]`;
  }
  return out;
}

/** Unity's sizes per (text, font size), plus the three read from boxes (header). */
function unityMeasure(dump: Dump, wrapWidths: number[] = []): MeasureText {
  const sizes = new Map<string, { width: number; height: number }>();
  for (const e of dump.elements) {
    if (e.measured !== undefined && e.text !== undefined) sizes.set(`${e.text}|${Number(e.style['fontSize'])}`, { width: e.measured.w, height: e.measured.h });
  }
  const fromBox = (path: string): { width: number; height: number } => {
    const t = find(dump, path);
    return t === undefined ? { width: 0, height: 0 } : { width: t.w - 4, height: t.h };
  };
  const fs = (path: string): number => Number(find(dump, path)?.style['fontSize'] ?? NaN);
  const pw = 'free/tf-auto-pw-i/unity-text-input/TextElement[0]';
  const ph = 'free/tf-auto-ph/unity-text-input/TextElement[0]';
  const wrap = find(dump, 'col/tf-ml-long-wrap/unity-text-input/VisualElement[0]/TextElement[0]');
  if (find(dump, pw) !== undefined) {
    sizes.set(`******|${fs(pw)}`, fromBox(pw));
    sizes.set(`######|${fs(pw)}`, fromBox(pw));
  }
  if (find(dump, ph) !== undefined) sizes.set(`Type here|${fs(ph)}`, fromBox(ph));
  return (text, context, availableWidth) => {
    const hit = sizes.get(`${text}|${context.fontSize}`);
    if (hit === undefined) throw new Error(`no Unity measurement for ${JSON.stringify(text)} at ${context.fontSize}px`);
    if (text === WRAPPED && wrap !== undefined && context.whiteSpace === 'normal' && Number.isFinite(availableWidth) && availableWidth > 0 && availableWidth < hit.width) {
      wrapWidths.push(availableWidth);
      return { width: availableWidth, height: wrap.h };
    }
    return hit;
  };
}

function nodeByName(root: ElementNode, name: string): ElementNode {
  let found: ElementNode | undefined;
  const walk = (n: ElementNode): void => {
    if (n.attributes.some((a) => a.name === 'name' && a.value === name)) found = n;
    n.children.forEach(walk);
  };
  walk(root);
  if (found === undefined) throw new Error(`no element named ${name}`);
  return found;
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
  'border-top-color': 'transparent',
  'border-right-color': 'transparent',
  'border-bottom-color': 'transparent',
  'border-left-color': 'transparent',
  opacity: '1',
  'flex-shrink': '1',
  'flex-grow': '0',
};
const LENGTH: Array<[string, string]> = [
  ['font-size', 'fontSize'],
  ['margin-top', 'marginTop'], ['margin-right', 'marginRight'], ['margin-bottom', 'marginBottom'], ['margin-left', 'marginLeft'],
  ['padding-top', 'paddingTop'], ['padding-right', 'paddingRight'], ['padding-bottom', 'paddingBottom'], ['padding-left', 'paddingLeft'],
  ['border-top-width', 'borderTopWidth'], ['border-right-width', 'borderRightWidth'], ['border-bottom-width', 'borderBottomWidth'], ['border-left-width', 'borderLeftWidth'],
  ['flex-shrink', 'flexShrink'], ['flex-grow', 'flexGrow'],
  ['opacity', 'opacity'],
];
const COLOUR: Array<[string, string]> = [
  ['color', 'color'],
  ['background-color', 'backgroundColor'],
  ['border-top-color', 'borderTopColor'], ['border-right-color', 'borderRightColor'],
  ['border-bottom-color', 'borderBottomColor'], ['border-left-color', 'borderLeftColor'],
];

function expectStyle(get: (property: string) => string | undefined, u: DumpElement, label: string): void {
  const value = (p: string): string => (get(p) ?? INITIAL[p] ?? '0').trim();
  for (const [css, unity] of LENGTH) {
    expect(parseFloat(value(css)), `${label} ${css}`).toBeCloseTo(Number(u.style[unity]), 3);
  }
  for (const [css, unity] of COLOUR) {
    const ours = rgba(value(css));
    const theirs = unityRgba(u.style[unity]!);
    ours.forEach((c, i) => expect(Math.abs(c - theirs[i]!), `${label} ${css} [${i}] ${value(css)} vs ${u.style[unity]}`).toBeLessThanOrEqual(0.0011));
  }
  // min-width: Unity's "Auto" is no value.
  const min = get('min-width');
  if (u.style['minWidth'] === 'Auto') expect(min === undefined || min === 'auto', `${label} min-width ${min}`).toBe(true);
  else expect(parseFloat(min ?? 'NaN'), `${label} min-width`).toBeCloseTo(Number(u.style['minWidth']), 3);
}

const PROBE_FILES = ['c07-TextField', 'c-textfield', 'c-textfield-hook'] as const;
const fieldsOf = (dump: Dump): DumpElement[] => dump.elements.filter((e) => e.type === 'TextField');

function layout(theme: Theme, probe: string, wrapWidths: number[] = []) {
  const dump = readDump(BASE, theme, probe);
  const doc = parse(probeText(probe), ussOf(probe));
  const resolved = resolveStyles(doc, { theme });
  const tree = layoutDocument(doc.root, resolved.styles, resolved.partStyles, {
    theme,
    size: dump.metadata.panel,
    measureText: unityMeasure(dump, wrapWidths),
  });
  return { dump, doc, resolved, tree };
}

function draw(theme: Theme, probe: string, states?: Record<string, string[]>): { r: RenderResult; dump: Dump } {
  const dump = readDump(BASE, theme, probe);
  const r = render(parse(probeText(probe), ussOf(probe)), document.createElement('div'), {
    theme,
    size: dump.metadata.panel,
    measureText: unityMeasure(dump),
    ...(states === undefined ? {} : { states }),
  });
  return { r, dump };
}

describe('bundle C — the evidence', () => {
  it('6000.0.40f1 and 6000.3.25f1 give every judged theme value the same, on both themes', () => {
    const judged = ['fontSize', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
      'borderTopWidth', 'borderLeftWidth', 'flexShrink', 'flexGrow', 'opacity', 'color', 'backgroundColor', 'borderTopColor', 'borderLeftColor', 'minWidth', 'whiteSpace'];
    for (const theme of ['runtime', 'editor'] as const) {
      for (const probe of PROBE_FILES) {
        const a = readDump('6000.0.40f1', theme, probe);
        const b = readDump(BASE, theme, probe);
        for (const e of a.elements.filter((x) => x.path.includes('/tf-') || x.path.startsWith('col/tf-') || x.path.startsWith('free/tf-'))) {
          const o = at(b, e.path);
          for (const k of judged) expect(o.style[k], `${theme} ${probe} ${e.path} ${k}`).toBe(e.style[k]);
          expect(o.classes, `${theme} ${probe} ${e.path} classes`).toEqual(e.classes);
        }
      }
    }
  });
});

for (const theme of ['runtime', 'editor'] as const) {
  describe(`bundle C — ${theme} theme`, () => {
    for (const probe of PROBE_FILES) {
      it(`${probe}: every TextField and each of its parts lands where Unity puts it`, () => {
        const { dump, doc, tree } = layout(theme, probe);
        try {
          for (const f of fieldsOf(dump)) {
            const node = nodeByName(doc.root, f.name);
            const b = tree.boxes.get(node.id)!;
            expect([b.left, b.top, b.width, b.height], f.path).toEqual([f.x, f.y, f.w, f.h]);
            const parts = tree.parts.get(node.id) ?? [];
            const expected = partPaths(dump, f.path);
            expect(parts.map((p) => p.name).sort(), `${f.path} parts`).toEqual(Object.keys(expected).sort());
            for (const [name, path] of Object.entries(expected)) {
              const p = parts.find((x) => x.name === name)!;
              const u = at(dump, path!);
              expect([p.box.left, p.box.top, p.box.width, p.box.height], `${f.path} ${name}`).toEqual([u.x, u.y, u.w, u.h]);
            }
          }
          expect(tree.warnings.filter((w) => w.kind === 'unsupported-control')).toEqual([]);
        } finally {
          tree.dispose();
        }
      });

      it(`${probe}: TextField and its parts get Unity's resolved values`, () => {
        const { dump, doc, resolved, tree } = layout(theme, probe);
        try {
          for (const f of fieldsOf(dump)) {
            const node = nodeByName(doc.root, f.name);
            expectStyle((p) => resolved.styles.get(node.id)?.get(p)?.value, f, f.path);
            const parts: LayoutPart[] = tree.parts.get(node.id) ?? [];
            for (const [name, path] of Object.entries(partPaths(dump, f.path))) {
              const p = parts.find((x) => x.name === name);
              expect(p, `${f.path} ${name}`).toBeDefined();
              expectStyle((q) => p!.style.get(q)?.value, at(dump, path!), `${f.path} ${name}`);
            }
          }
        } finally {
          tree.dispose();
        }
      });
    }

    it('multiline wraps at Unity\'s width only with white-space: normal', () => {
      const widths: number[] = [];
      const { dump, tree } = layout(theme, 'c-textfield', widths);
      try {
        const inner = at(dump, 'col/tf-ml-long-wrap/unity-text-input/VisualElement[0]/TextElement[0]');
        expect(widths.length).toBeGreaterThan(0);
        // The preview asks to wrap at the TextElement's content width (its box less 2+2 padding).
        expect(widths.every((w) => Math.abs(w - (inner.w - 4)) <= 0.5), `asked ${widths.join(', ')}, Unity ${inner.w - 4}`).toBe(true);
      } finally {
        tree.dispose();
      }
    });

    it('draws the value, the mask or the placeholder as the inner text, and nothing for a caret', () => {
      const { r } = draw(theme, 'c07-TextField');
      const { r: r2 } = draw(theme, 'c-textfield');
      try {
        const textOf = (res: RenderResult, name: string): string | null => {
          const el = res.elements.get(nodeByName(res.document!.root, name).id)!;
          const inner = [...el.querySelectorAll(`[${PART_ATTRIBUTE}="${TEXT}"]`)];
          expect(inner, `${name} inner text`).toHaveLength(1);
          return inner[0]!.textContent;
        };
        expect(textOf(r, 'tf-value')).toBe('Hello');
        expect(textOf(r, 'tf-plain')).toBe('');
        expect(textOf(r, 'tf-placeholder')).toBe('Type here');
        expect(textOf(r, 'tf-multiline')).toBe('One\nTwo');
        expect(textOf(r, 'tf-password')).toBe('******');
        expect(textOf(r2, 'tf-pw-mask')).toBe('######');
        expect(textOf(r2, 'tf-pw-empty')).toBe('');
        expect(textOf(r2, 'tf-ph-value')).toBe('Hello');
        expect(textOf(r2, 'tf-ph-disabled')).toBe('Type here');
        // The secret never reaches the DOM.
        const field = r.elements.get(nodeByName(r.document!.root, 'tf-password').id)!;
        expect(field.textContent).not.toContain('secret');
        // Label text is drawn in the label part.
        const labelled = r.elements.get(nodeByName(r.document!.root, 'tf-label').id)!;
        expect([...labelled.querySelectorAll(`[${PART_ATTRIBUTE}="${LABEL}"]`)].map((e) => e.textContent)).toEqual(['Label']);
      } finally {
        r.dispose();
        r2.dispose();
      }
    });

    it('hover and focus change the input border as Unity\'s (c07-states)', () => {
      const dump = readDump(BASE, theme, 'c07-states');
      for (const [name, state] of [['st-text-hover', 'hover'], ['st-text-focus', 'focus']] as const) {
        const doc = parse(probeText('c07-states'));
        const resolved = resolveStyles(doc, { theme, states: { [`#${name}`]: [state] } });
        const tree = layoutDocument(doc.root, resolved.styles, resolved.partStyles, {
          theme,
          size: dump.metadata.panel,
          measureText: () => ({ width: 0, height: 0 }),
        });
        try {
          const input = (tree.parts.get(nodeByName(doc.root, name).id) ?? []).find((p) => p.name === INPUT)!;
          const u = at(dump, `col/${name}/unity-text-input`);
          for (const [css, unity] of COLOUR) {
            const ours = rgba(input.style.get(css)?.value ?? INITIAL[css] ?? 'transparent');
            const theirs = unityRgba(u.style[unity]!);
            ours.forEach((c, i) => expect(Math.abs(c - theirs[i]!), `${name} ${css} [${i}]`).toBeLessThanOrEqual(0.0011));
          }
        } finally {
          tree.dispose();
        }
      }
    });
  });
}

describe('bundle C — author USS reaches the parts by Unity\'s names', () => {
  it('measured: the hook rules land on both themes (c-textfield-hook)', () => {
    for (const theme of ['runtime', 'editor'] as const) {
      const { dump, doc, tree } = layout(theme, 'c-textfield-hook');
      try {
        const parts = tree.parts.get(nodeByName(doc.root, 'tf-hook').id) ?? [];
        const input = parts.find((p) => p.name === INPUT)!;
        const label = parts.find((p) => p.name === LABEL)!;
        expect(parseFloat(input.style.get('margin-left')!.value)).toBe(Number(at(dump, 'col/tf-hook/unity-text-input').style['marginLeft']));
        expect(rgba(input.style.get('background-color')!.value)).toEqual([1, 0, 0, 1]);
        expect(parseFloat(label.style.get('min-width')!.value)).toBe(50);
        expect(rgba(label.style.get('color')!.value)).toEqual([0, 0, 1, 1]);
      } finally {
        tree.dispose();
      }
    }
  });
});
