/**
 * 0.7.0 — where a Slider's own file children go (human instruction 2026-10-17, after D).
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Source: tests/layout/unity/<version>/{probe-panel,probe-editor-070}/d-slider-children.json
 * (PanelDump / ProbeDump 0.7.0-r3), probe tests/layout/unity/probes-0.7.0/d-slider-children.uxml.
 * On both versions and both themes a Label written inside a Slider or SliderInt is a child
 * of the slider element itself (path sc-h/sc-h-child), after the slider's parts: Unity's
 * contentContainer is the slider. In a horizontal slider it lands after the input, at the
 * row's end, and makes the slider as tall as it needs (runtime 31 against 24 without it).
 * Expected values: the 6000.3.25f1 dumps (6000.0.40f1 gives the same boxes; first test).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { loadLayoutEngine, parse, resolveStyles } from '../../src/index';
import type { ElementNode, MeasureText, Theme } from '../../src/index';
import { layoutDocument } from '../../src/layout/yoga';

const UNITY = join(process.cwd(), 'tests', 'layout', 'unity');
const PROBE = join(UNITY, 'probes-0.7.0', 'd-slider-children.uxml');
const FOLDER: Record<Theme, string> = { runtime: 'probe-panel', editor: 'probe-editor-070' };
const PAIRS = [['sc-h', 'col/sc-h'], ['sc-label', 'col/sc-label'], ['sc-int', 'col/sc-int'], ['sc-v', 'row/sc-v']] as const;

interface DumpElement { path: string; name: string; x: number; y: number; w: number; h: number; text?: string; measured?: { w: number; h: number }; style: Record<string, string> }
interface Dump { metadata: { panel: { width: number; height: number } }; elements: DumpElement[] }
const readDump = (version: string, theme: Theme): Dump =>
  JSON.parse(readFileSync(join(UNITY, version, FOLDER[theme], 'd-slider-children.json'), 'utf8').replace(/\bNaN\b/g, 'null')) as Dump;
const at = (dump: Dump, path: string): DumpElement => {
  const e = dump.elements.find((x) => x.path === path);
  if (e === undefined) throw new Error(`dump has no ${path}`);
  return e;
};

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

beforeAll(async () => {
  await loadLayoutEngine();
});

describe('Slider children — the dumps', () => {
  it('the child is the slider\'s own child, after its parts, on both versions and themes', () => {
    for (const theme of ['runtime', 'editor'] as const) {
      const a = readDump('6000.0.40f1', theme);
      const b = readDump('6000.3.25f1', theme);
      for (const [name, path] of PAIRS) {
        const child = at(b, `${path}/${name}-child`);
        const inside = b.elements.filter((e) => e.path.startsWith(`${path}/`));
        expect(inside[inside.length - 1]!.path, `${theme} ${path}`).toBe(child.path);
        for (const p of [path, child.path]) {
          const u = at(b, p);
          const o = at(a, p);
          expect([o.x, o.y, o.w, o.h], `${theme} ${p}`).toEqual([u.x, u.y, u.w, u.h]);
        }
      }
    }
  });
});

for (const theme of ['runtime', 'editor'] as const) {
  describe(`Slider children — ${theme} theme`, () => {
    it('the child and the slider land where Unity puts them', () => {
      const dump = readDump('6000.3.25f1', theme);
      const doc = parse(readFileSync(PROBE, 'utf8'));
      const resolved = resolveStyles(doc, { theme });
      const tree = layoutDocument(doc.root, resolved.styles, resolved.partStyles, { theme, size: dump.metadata.panel, measureText: unityMeasure(dump) });
      try {
        for (const [name, path] of PAIRS) {
          for (const [n, p] of [[name, path], [`${name}-child`, `${path}/${name}-child`]] as const) {
            const b = tree.boxes.get(nodeByName(doc.root, n).id)!;
            const u = at(dump, p);
            expect([b.left, b.top, b.width, b.height], n).toEqual([u.x, u.y, u.w, u.h]);
          }
        }
      } finally {
        tree.dispose();
      }
    });
  });
}
