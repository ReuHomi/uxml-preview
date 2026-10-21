/**
 * 0.7.0 cleanup round R1 — three values the review found unmeasured, now measured.
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Every expected value is read from dumps made for this round (2026-10-17), after the
 * changes they check, on both versions and both themes:
 *   runtime — tests/layout/unity/<version>/probe-panel/r1-*.json (PanelDump 0.7.0-r1)
 *   editor  — tests/layout/unity/<version>/probe-editor-070/r1-*.json (ProbeDump 0.7.0-r1)
 * Probes: tests/layout/unity/probes-0.7.0/r1-*.uxml (r1-text-spacing is the 0.6.0
 * text-spacing probe unchanged: the same sentence and values).
 *
 *   1. Runtime spacing. The runtime panel measures text with the standard generator
 *      when none is written (every r1-text-spacing row: Standard, both versions), so a
 *      letter gap sits beside spaces too. Held as Unity's widening per row, within 1px,
 *      as the 0.6.0 editor test holds it.
 *   2. GroupBox text="": no title on either theme or version. text=" " builds one.
 *   3. An author rule on `.unity-group-box__label` reaches the title (margin-left 17,
 *      colour red: the same on both versions and both themes).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { createDefaultMeasureText, loadLayoutEngine, parse, render, resolveStyles } from '../../src/index';
import type { ElementNode, MeasureText, Theme } from '../../src/index';
import { layoutDocument } from '../../src/layout/yoga';

const UNITY = join(process.cwd(), 'tests', 'layout', 'unity');
const PROBES = join(UNITY, 'probes-0.7.0');
const VERSIONS = ['6000.0.40f1', '6000.3.25f1'] as const;
const FOLDER: Record<Theme, string> = { runtime: 'probe-panel', editor: 'probe-editor-070' };
const TITLE = 'unity-group-box__label';

interface DumpElement {
  path: string;
  name: string;
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
  metadata: { dumper: string; panel: { width: number; height: number } };
  elements: DumpElement[];
}

const readDump = (version: string, theme: Theme, probe: string): Dump =>
  JSON.parse(readFileSync(join(UNITY, version, FOLDER[theme], `${probe}.json`), 'utf8').replace(/\bNaN\b/g, 'null')) as Dump;
const probe = (name: string): string => readFileSync(join(PROBES, `${name}.uxml`), 'utf8');
const at = (dump: Dump, path: string): DumpElement => {
  const e = dump.elements.find((x) => x.path === path);
  if (e === undefined) throw new Error(`dump has no ${path}`);
  return e;
};
const unityRgba = (text: string): number[] => /rgba\(([^)]*)\)/.exec(text)![1]!.split(',').map(Number);

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

beforeAll(async () => {
  await loadLayoutEngine();
});

// [row, base row] in r1-text-spacing: each spaced Label against the unspaced one at its size.
const SPACED: ReadonlyArray<readonly [string, string]> = [
  ['ls1-12', 'b12'], ['ls2-12', 'b12'], ['ls5-12', 'b12'], ['ws5-12', 'b12'], ['ws10-12', 'b12'], ['lsws-12', 'b12'],
  ['ls1-20', 'b20'], ['ls2-20', 'b20'], ['ls5-20', 'b20'], ['ws5-20', 'b20'], ['ws10-20', 'b20'], ['lsws-20', 'b20'],
];

describe('R1 — runtime theme: letter- and word-spacing as the runtime panel draws them', () => {
  for (const version of VERSIONS) {
    it(`${version}: the runtime panel measures unstyled text with the standard generator`, () => {
      const dump = readDump(version, 'runtime', 'r1-text-spacing');
      expect(dump.metadata.dumper).toBe('PanelDump');
      for (const [row] of SPACED) expect(at(dump, `col/${row}`).style['unityTextGenerator'], row).toBe('Standard');
    });

    it(`${version}: each spaced Label widens like Unity's within 1px`, () => {
      const dump = readDump(version, 'runtime', 'r1-text-spacing');
      const r = render(parse(probe('r1-text-spacing')), document.createElement('div'), {
        theme: 'runtime',
        size: dump.metadata.panel,
        measureText: createDefaultMeasureText(),
      });
      try {
        const root = r.document!.root;
        const width = (name: string): number => r.boxes.get(nodeByName(root, name).id)!.width;
        for (const [row, base] of SPACED) {
          const unity = at(dump, `col/${row}`).w - at(dump, `col/${base}`).w;
          const ours = width(row) - width(base);
          expect(Math.abs(ours - unity), `${row}: ours +${ours}, Unity +${unity}`).toBeLessThanOrEqual(1);
        }
      } finally {
        r.dispose();
      }
    });
  }
});

for (const theme of ['runtime', 'editor'] as const) {
  describe(`R1 — ${theme} theme: GroupBox titles`, () => {
    for (const version of VERSIONS) {
      it(`${version}: text="" builds no title, text=" " builds one`, () => {
        const dump = readDump(version, theme, 'r1-groupbox-empty');
        expect(dump.elements.some((e) => e.path.startsWith('col/g-empty-text/'))).toBe(false);
        expect(dump.elements.filter((e) => e.path.startsWith('col/g-empty-text-child/')).map((e) => e.name)).toEqual(['g-empty-text-child-label']);
        expect(at(dump, 'col/g-space/Label[0]').classes).toContain(TITLE);

        const doc = parse(probe('r1-groupbox-empty'));
        const resolved = resolveStyles(doc, { theme });
        const tree = layoutDocument(doc.root, resolved.styles, resolved.partStyles, {
          theme,
          size: dump.metadata.panel,
          measureText: unityMeasure(dump),
        });
        try {
          const titles = (name: string) => (tree.parts.get(nodeByName(doc.root, name).id) ?? []).filter((p) => p.name === TITLE);
          expect(titles('g-empty-text')).toEqual([]);
          expect(titles('g-empty-text-child')).toEqual([]);
          expect(titles('g-space')).toHaveLength(1);
          // Boxes before g-space, whose title height differs by version on the editor theme
          // (6000.0.40f1: 0, 6000.3.25f1: 15) and is not judged here.
          for (const [name, path] of [
            ['g-empty-text', 'col/g-empty-text'], ['g-empty-text-child', 'col/g-empty-text-child'],
            ['g-empty-text-child-label', 'col/g-empty-text-child/g-empty-text-child-label'],
          ] as const) {
            const b = tree.boxes.get(nodeByName(doc.root, name).id)!;
            const u = at(dump, path);
            expect([b.left, b.top, b.width, b.height], name).toEqual([u.x, u.y, u.w, u.h]);
          }
        } finally {
          tree.dispose();
        }
      });

      it(`${version}: an author rule on .${TITLE} reaches the title`, () => {
        const dump = readDump(version, theme, 'r1-groupbox-author');
        const u = at(dump, 'col/g/Label[0]');
        expect(u.classes).toContain(TITLE);
        const doc = parse(probe('r1-groupbox-author'), readFileSync(join(PROBES, 'r1-groupbox-author.uss'), 'utf8'));
        const resolved = resolveStyles(doc, { theme });
        const tree = layoutDocument(doc.root, resolved.styles, resolved.partStyles, {
          theme,
          size: dump.metadata.panel,
          measureText: unityMeasure(dump),
        });
        try {
          const title = (tree.parts.get(nodeByName(doc.root, 'g').id) ?? []).find((p) => p.name === TITLE)!;
          expect(parseFloat(title.style.get('margin-left')!.value)).toBe(Number(u.style['marginLeft']));
          const colour = title.style.get('color')!.value;
          expect(unityRgba(u.style['color']!)).toEqual([1, 0, 0, 1]);
          expect(colour.replace(/\s/g, '')).toMatch(/^(rgb\(255,0,0\)|#f00|#ff0000|red)$/i);
          expect([title.box.left, title.box.top, title.box.width, title.box.height], 'title box').toEqual([u.x, u.y, u.w, u.h]);
          const inside = tree.boxes.get(nodeByName(doc.root, 'g-label').id)!;
          const ui = at(dump, 'col/g/g-label');
          expect([inside.left, inside.top, inside.width, inside.height], 'g-label').toEqual([ui.x, ui.y, ui.w, ui.h]);
        } finally {
          tree.dispose();
        }
      });
    }
  });
}
