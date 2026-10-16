/**
 * 0.7.0 bundle B — GroupBox and Box, on both themes, from Unity dumps.
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Every expected number is read from the committed dumps at run time:
 *   editor  — tests/layout/unity/6000.0.40f1/probe-editor-070/c07-GroupBox.json, c07-Box.json
 *   runtime — tests/layout/unity/6000.3.25f1/probe-panel/c07-GroupBox.json, c07-Box.json
 * Probe sources: tests/layout/unity/probes-0.7.0/c07-GroupBox.uxml, c07-Box.uxml.
 * Text is measured with Unity's own sizes per (text, font size); anything else throws.
 *
 * What the dumps show (bundle A plan, section 14):
 *   - GroupBox carries `unity-group-box`. With a non-empty `text` Unity builds a title
 *     Label before the file's children (classes unity-text-element, unity-label,
 *     unity-group-box__label; no name). With no text it builds none (g-empty).
 *     Unity gives the title no name, so this preview names the part by its class,
 *     `unity-group-box__label`.
 *   - Box carries `unity-box` and builds nothing.
 *   - `enabled="false"` dims the GroupBox or Box itself (unity-disabled, 0.5), not its
 *     children — the bundle A rule.
 * Judged: boxes, the title part's box and resolved values. Painting the title text is
 * checked as present, not as pixels.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { loadLayoutEngine, parse, render, resolveStyles, PART_ATTRIBUTE } from '../../src/index';
import type { ElementNode, MeasureText, RenderResult, Theme } from '../../src/index';
import { layoutDocument } from '../../src/layout/yoga';

const UNITY = join(process.cwd(), 'tests', 'layout', 'unity');
const PROBES = join(UNITY, 'probes-0.7.0');
const SOURCE: Record<Theme, string> = {
  editor: join(UNITY, '6000.0.40f1', 'probe-editor-070'),
  runtime: join(UNITY, '6000.3.25f1', 'probe-panel'),
};
const TITLE = 'unity-group-box__label';

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

const readDump = (theme: Theme, probe: string): Dump =>
  JSON.parse(readFileSync(join(SOURCE[theme], `${probe}.json`), 'utf8').replace(/\bNaN\b/g, 'null')) as Dump;

beforeAll(async () => {
  await loadLayoutEngine();
});

function unityMeasure(dump: Dump): MeasureText {
  const sizes = new Map<string, { width: number; height: number }>();
  for (const e of dump.elements) {
    if (e.measured === undefined || e.text === undefined) continue;
    sizes.set(`${e.text}|${Number(e.style['fontSize'])}`, { width: e.measured.w, height: e.measured.h });
  }
  return (text, context) => {
    const hit = sizes.get(`${text}|${context.fontSize}`);
    if (hit === undefined) throw new Error(`no Unity measurement for ${JSON.stringify(text)} at ${context.fontSize}px`);
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

const at = (dump: Dump, path: string): DumpElement => {
  const e = dump.elements.find((x) => x.path === path);
  if (e === undefined) throw new Error(`dump has no ${path}`);
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
const unityRgba = (text: string): number[] => /rgba\(([^)]*)\)/.exec(text)![1]!.split(',').map(Number);

const INITIAL: Record<string, string> = {
  'background-color': 'transparent',
  'border-top-color': 'transparent',
  'border-right-color': 'transparent',
  'border-bottom-color': 'transparent',
  'border-left-color': 'transparent',
  opacity: '1',
  'flex-shrink': '1',
};
const LENGTH: Array<[string, string]> = [
  ['font-size', 'fontSize'],
  ['margin-top', 'marginTop'], ['margin-right', 'marginRight'], ['margin-bottom', 'marginBottom'], ['margin-left', 'marginLeft'],
  ['padding-top', 'paddingTop'], ['padding-right', 'paddingRight'], ['padding-bottom', 'paddingBottom'], ['padding-left', 'paddingLeft'],
  ['border-top-width', 'borderTopWidth'], ['border-right-width', 'borderRightWidth'], ['border-bottom-width', 'borderBottomWidth'], ['border-left-width', 'borderLeftWidth'],
  ['flex-shrink', 'flexShrink'],
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
}

function draw(theme: Theme, probe: string): { r: RenderResult; dump: Dump; container: HTMLElement } {
  const dump = readDump(theme, probe);
  const container = document.createElement('div');
  const r = render(parse(readFileSync(join(PROBES, `${probe}.uxml`), 'utf8')), container, {
    theme,
    size: dump.metadata.panel,
    measureText: unityMeasure(dump),
  });
  return { r, dump, container };
}

const box = (r: RenderResult, node: ElementNode): number[] => {
  const b = r.boxes.get(node.id)!;
  return [b.left, b.top, b.width, b.height];
};

for (const theme of ['editor', 'runtime'] as const) {
  describe(`bundle B — ${theme} theme`, () => {
    it('GroupBox and its children land where Unity puts them', () => {
      const { r, dump } = draw(theme, 'c07-GroupBox');
      try {
        const root = r.document!.root;
        for (const [name, path] of [
          ['col', 'col'], ['g-empty', 'col/g-empty'], ['g-text', 'col/g-text'], ['g-child', 'col/g-child'],
          ['g-child-label', 'col/g-child/g-child-label'], ['g-disabled', 'col/g-disabled'],
          ['g-disabled-label', 'col/g-disabled/g-disabled-label'], ['free', 'free'], ['g-auto', 'free/g-auto'],
        ] as const) {
          const u = at(dump, path);
          expect(box(r, nodeByName(root, name)), name).toEqual([u.x, u.y, u.w, u.h]);
        }
        // g-auto's own (unnamed) Label child, after the title.
        const auto = nodeByName(root, 'g-auto').children[0]!;
        const u = at(dump, 'free/g-auto/Label[1]');
        expect(box(r, auto), 'g-auto child').toEqual([u.x, u.y, u.w, u.h]);
        expect(r.warnings.filter((w) => w.kind === 'unsupported-control')).toEqual([]);
      } finally {
        r.dispose();
      }
    });

    it('builds the title Label only when there is text, where Unity puts it, with its values', () => {
      const dump = readDump(theme, 'c07-GroupBox');
      const doc = parse(readFileSync(join(PROBES, 'c07-GroupBox.uxml'), 'utf8'));
      const resolved = resolveStyles(doc, { theme });
      const tree = layoutDocument(doc.root, resolved.styles, resolved.partStyles, {
        theme,
        size: dump.metadata.panel,
        measureText: unityMeasure(dump),
      });
      try {
        const titleOf = (name: string) => (tree.parts.get(nodeByName(doc.root, name).id) ?? []).filter((p) => p.name === TITLE);
        expect(titleOf('g-empty')).toEqual([]);
        for (const [name, path] of [
          ['g-text', 'col/g-text/Label[0]'], ['g-child', 'col/g-child/Label[0]'],
          ['g-disabled', 'col/g-disabled/Label[0]'], ['g-auto', 'free/g-auto/Label[0]'],
        ] as const) {
          const parts = titleOf(name);
          expect(parts, `${name} title`).toHaveLength(1);
          const u = at(dump, path);
          expect(u.classes).toContain(TITLE);
          const b = parts[0]!.box;
          expect([b.left, b.top, b.width, b.height], `${name} title box`).toEqual([u.x, u.y, u.w, u.h]);
          expectStyle((p) => parts[0]!.style.get(p)?.value, u, `${name} title`);
        }
      } finally {
        tree.dispose();
      }
    });

    it('gives GroupBox, its title and its children Unity resolved values', () => {
      const { r, dump } = draw(theme, 'c07-GroupBox');
      try {
        const root = r.document!.root;
        for (const [name, path] of [
          ['g-empty', 'col/g-empty'], ['g-text', 'col/g-text'], ['g-child', 'col/g-child'],
          ['g-child-label', 'col/g-child/g-child-label'], ['g-disabled', 'col/g-disabled'],
          ['g-disabled-label', 'col/g-disabled/g-disabled-label'],
        ] as const) {
          expectStyle((p) => r.styles!.get(nodeByName(root, name).id)?.get(p)?.value, at(dump, path), name);
        }
      } finally {
        r.dispose();
      }
    });

    it('paints the title text as a part of the GroupBox', () => {
      const { r } = draw(theme, 'c07-GroupBox');
      try {
        const root = r.document!.root;
        const group = r.elements.get(nodeByName(root, 'g-text').id)!;
        const title = [...group.querySelectorAll(`[${PART_ATTRIBUTE}="${TITLE}"]`)];
        expect(title).toHaveLength(1);
        expect(title[0]!.textContent).toBe('Group');
        const empty = r.elements.get(nodeByName(root, 'g-empty').id)!;
        expect(empty.querySelectorAll(`[${PART_ATTRIBUTE}="${TITLE}"]`)).toHaveLength(0);
      } finally {
        r.dispose();
      }
    });

    it('Box and its children land where Unity puts them, with Unity resolved values', () => {
      const { r, dump } = draw(theme, 'c07-Box');
      try {
        const root = r.document!.root;
        for (const [name, path] of [
          ['col', 'col'], ['b-empty', 'col/b-empty'], ['b-child', 'col/b-child'],
          ['b-child-label', 'col/b-child/b-child-label'], ['b-disabled', 'col/b-disabled'],
          ['b-disabled-label', 'col/b-disabled/b-disabled-label'], ['free', 'free'], ['b-auto', 'free/b-auto'],
        ] as const) {
          const u = at(dump, path);
          expect(box(r, nodeByName(root, name)), name).toEqual([u.x, u.y, u.w, u.h]);
          if (name !== 'col' && name !== 'free') expectStyle((p) => r.styles!.get(nodeByName(root, name).id)?.get(p)?.value, u, name);
        }
        const auto = nodeByName(root, 'b-auto').children[0]!;
        const u = at(dump, 'free/b-auto/Label[0]');
        expect(box(r, auto), 'b-auto child').toEqual([u.x, u.y, u.w, u.h]);
        expect(r.warnings.filter((w) => w.kind === 'unsupported-control')).toEqual([]);
      } finally {
        r.dispose();
      }
    });
  });
}

describe('bundle B — author USS', () => {
  it('reaches the title through its measured class', () => {
    // Unity's own theme styles the title through `.unity-group-box__label` (the margin
    // -5 above is that rule); an author rule on the same class reaches it the same way.
    const doc = parse(
      '<ui:UXML xmlns:ui="UnityEngine.UIElements"><ui:GroupBox name="g" text="Group" /></ui:UXML>',
      '.unity-group-box__label { margin-left: 17px; }',
    );
    const resolved = resolveStyles(doc, { theme: 'runtime' });
    const tree = layoutDocument(doc.root, resolved.styles, resolved.partStyles, {
      theme: 'runtime',
      size: { width: 400, height: 300 },
      measureText: () => ({ width: 10, height: 10 }),
    });
    try {
      const title = (tree.parts.get(nodeByName(doc.root, 'g').id) ?? []).find((p) => p.name === TITLE)!;
      expect(title.style.get('margin-left')?.value).toBe('17px');
    } finally {
      tree.dispose();
    }
  });
});
