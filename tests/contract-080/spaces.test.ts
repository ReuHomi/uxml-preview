/**
 * 0.8.0 — spaces by text generator (docs/backlog.md, 0.8 item 3: N2 runs in a runtime Label, T6 trailing
 * spaces in a TextField).
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Evidence: tests/layout/unity/<version>/{probe-panel,probe-editor-070}/r15-label-spaces.json and
 * r15-tf-spaces.json (6000.0.40f1, 6000.3.25f1; runtime panel 14px, editor 12px), and
 * tests/layout/unity/<version>/probe-editor/spaces.json (20px). The first test below reads those numbers
 * from the dumps, so the table is the dumps', not this file's.
 *
 *   Label, NoWrap ("measured" = Unity's MeasureTextSize, box = layout):
 *     Standard (runtime panel both versions, 6000.0 editor): "a     b     c" 64 vs "a b c" 33 (runtime),
 *       55 vs 28 (editor) — runs kept. spaces.json 6000.0: "   abc" 52 vs 6000.3 35 — leading kept.
 *     Advanced (6000.3 editor): 28 vs 28 — runs collapse; spaces.json "   abc" 35 — leading dropped.
 *   TextField inner text (TextElement in unity-text-input):
 *     every generator keeps runs and leading spaces (64/55, "     lead" 48/41);
 *     "trail     ": the layout box counts the trailing spaces on every generator (49 runtime, 43 editor,
 *       padding 2+2); Unity's MeasureTextSize drops them on Standard (25 runtime, 22 editor) and counts
 *       them on Advanced (39). The box is what Unity lays out, so the box is pinned.
 *
 * Read, not dumped for a Label (assumption, judged when a Label probe with trailing spaces is dumped —
 * docs/backlog.md): Standard drops trailing spaces of a Label. The evidence is MeasureTextSize on the
 * TextField's text ("trail     " measures as "trail" on Standard), which agrees with the Label measurements
 * above for runs and leading spaces. Wrapping a Standard normal text at a run of spaces is not dumped either.
 *
 * The measurer here is createDefaultMeasureText without a canvas (vitest), so widths are relations, not
 * Unity's pixels; the real browser check is tests/text-cohort/paint-spaces.mjs.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { createDefaultMeasureText, loadLayoutEngine, parse, resolveStyles } from '../../src/index';
import type { ElementNode, Theme } from '../../src/index';
import { layoutDocument } from '../../src/layout/yoga';

beforeAll(async () => {
  await loadLayoutEngine();
});

const UNITY = join(process.cwd(), 'tests', 'layout', 'unity');
const PROBES = join(UNITY, 'probes-0.7.0');
const VERSIONS = ['6000.0.40f1', '6000.3.25f1'] as const;
const SETS = { runtime: 'probe-panel', editor: 'probe-editor-070' } as const;

interface DumpElement { path: string; name?: string; type: string; text?: string; w: number; measured?: { w: number }; style: Record<string, string> }
const dump = (version: string, set: string, file: string) =>
  JSON.parse(readFileSync(join(UNITY, version, set, file), 'utf8').replace(/\bNaN\b/g, 'null')) as { elements: DumpElement[] };
const byPath = (d: { elements: DumpElement[] }, path: string) => d.elements.find((e) => e.path === path)!;
const inner = (field: string) => `col/${field}/unity-text-input/TextElement[0]`;

it('the dumps say what is pinned below', () => {
  // [version, theme] → [generator, l-runs, l-plain measured; tf-trail box, tf-trail measured]
  const table: Record<string, [string, number, number, number, number]> = {
    '6000.0.40f1 runtime': ['Standard', 64, 33, 49, 25],
    '6000.3.25f1 runtime': ['Standard', 64, 33, 49, 25],
    '6000.0.40f1 editor': ['Standard', 55, 28, 43, 22],
    '6000.3.25f1 editor': ['Advanced', 28, 28, 43, 39],
  };
  for (const version of VERSIONS) {
    for (const theme of ['runtime', 'editor'] as const) {
      const labels = dump(version, SETS[theme], 'r15-label-spaces.json');
      const fields = dump(version, SETS[theme], 'r15-tf-spaces.json');
      const runs = byPath(labels, 'col/l-runs');
      const trail = byPath(fields, inner('tf-trail'));
      expect([runs.style['unityTextGenerator'], runs.measured!.w, byPath(labels, 'col/l-plain').measured!.w, trail.w, trail.measured!.w],
        `${version} ${theme}`).toEqual(table[`${version} ${theme}`]);
      // TextField runs and leading spaces: kept on every generator.
      expect(byPath(fields, inner('tf-runs')).measured!.w).toBeGreaterThan(byPath(fields, inner('tf-plain')).measured!.w + 20);
    }
  }
  const lead = (v: string) => dump(v, 'probe-editor', 'spaces.json').elements.find((e) => e.name === 'lead')!.w;
  expect([lead('6000.0.40f1'), lead('6000.3.25f1')]).toEqual([52, 35]);
});

describe('the measurer follows the generator (Label text, white-space normal and nowrap)', () => {
  const measure = createDefaultMeasureText();
  const width = (text: string, whiteSpace: string, textGenerator?: 'standard' | 'advanced') =>
    measure(text, { fontSize: 14, fontStyle: 'normal', whiteSpace, ...(textGenerator ? { textGenerator } : {}) }, 0).width;

  for (const ws of ['nowrap', 'normal']) {
    it(`standard, ${ws}: runs of spaces are kept`, () => {
      expect(width('a     b     c', ws, 'standard')).toBe(width('a     b     c', 'pre', 'standard'));
      expect(width('a     b     c', ws, 'standard')).toBeGreaterThan(width('a b c', ws, 'standard'));
    });

    it(`standard, ${ws}: leading spaces are kept`, () => {
      expect(width('     lead', ws, 'standard')).toBe(width('     lead', 'pre', 'standard'));
      expect(width('     lead', ws, 'standard')).toBeGreaterThan(width('lead', ws, 'standard'));
    });

    it(`standard, ${ws}: trailing spaces are dropped`, () => {
      expect(width('trail     ', ws, 'standard')).toBe(width('trail', ws, 'standard'));
      expect(width('a  b  ', ws, 'standard')).toBe(width('a  b', ws, 'standard'));
    });

    it(`advanced, ${ws}: runs collapse and leading and trailing spaces are dropped`, () => {
      expect(width('a     b     c', ws, 'advanced')).toBe(width('a b c', ws, 'advanced'));
      expect(width('     lead', ws, 'advanced')).toBe(width('lead', ws, 'advanced'));
      expect(width('trail     ', ws, 'advanced')).toBe(width('trail', ws, 'advanced'));
    });
  }
});

describe('layout: the probes laid out with the default measurer', () => {
  const nodeByName = (root: ElementNode, name: string): ElementNode => {
    let found: ElementNode | undefined;
    const walk = (n: ElementNode): void => {
      if (n.attributes.some((a) => a.name === 'name' && a.value === name)) found = n;
      n.children.forEach(walk);
    };
    walk(root);
    if (found === undefined) throw new Error(`no element named ${name}`);
    return found;
  };
  const layout = (theme: Theme, probe: string, uss = '') => {
    const doc = parse(readFileSync(join(PROBES, probe), 'utf8'), uss);
    const resolved = resolveStyles(doc, { theme });
    const tree = layoutDocument(doc.root, resolved.styles, resolved.partStyles, {
      theme, size: { width: 800, height: 600 }, measureText: createDefaultMeasureText(),
    });
    return { doc, tree };
  };

  // [theme, extra USS, runs kept]: the 6000.0 editor is Standard, written here as the property.
  const cases: [Theme, string, boolean][] = [
    ['runtime', '', true],
    ['editor', '', false],
    ['editor', 'Label { -unity-text-generator: standard; }', true],
  ];
  for (const [theme, uss, kept] of cases) {
    it(`${theme}${uss ? ' + standard' : ''}: a Label's run of spaces is ${kept ? 'kept' : 'collapsed'} (r15-label-spaces)`, () => {
      const { doc, tree } = layout(theme, 'r15-label-spaces.uxml', uss);
      try {
        const runs = tree.boxes.get(nodeByName(doc.root, 'l-runs').id)!.width;
        const plain = tree.boxes.get(nodeByName(doc.root, 'l-plain').id)!.width;
        if (kept) expect(runs).toBeGreaterThan(plain + 8 * 0.25 * (theme === 'runtime' ? 14 : 12));
        else expect(runs).toBe(plain);
      } finally {
        tree.dispose();
      }
    });
  }

  for (const theme of ['runtime', 'editor'] as const) {
    it(`${theme}: a TextField's inner text counts its trailing spaces (r15-tf-spaces, every generator)`, () => {
      const { doc, tree } = layout(theme, 'r15-tf-spaces.uxml');
      try {
        const fs = theme === 'runtime' ? 14 : 12;
        const measure = createDefaultMeasureText();
        const pre = (text: string) => measure(text, { fontSize: fs, fontStyle: 'normal', whiteSpace: 'pre' }, 0).width;
        const part = (name: string) => (tree.parts.get(nodeByName(doc.root, name).id) ?? [])
          .find((p) => p.name === 'unity-text-element--inner-input-field-component')!.box;
        // padding 2 + 2 (the dumps' TextElement style).
        expect(part('tf-trail').width).toBeCloseTo(4 + pre('trail     '), 5);
        expect(part('tf-trail').width).toBeGreaterThan(4 + pre('trail') + 4 * pre(' '));
        expect(part('tf-lead').width).toBeCloseTo(4 + pre('     lead'), 5);
      } finally {
        tree.dispose();
      }
    });
  }
});
