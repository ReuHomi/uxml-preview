/**
 * 0.7.0 — Unity clips a measured text's height to the height it is offered, as it clips the width
 * (found by bundle G, 2026-10-19: the settings screen in a 400x300 golden panel shrinks its footer
 * to 34px and Unity's buttons follow to 30, while the preview's overflow at 39).
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Source: tests/layout/unity/<version>/{probe-panel,probe-editor-070}/g-clamp-h.json (PanelDump /
 * ProbeDump 0.7.0-r3, the probe alone in its Unity process), probe
 * tests/layout/unity/probes-0.7.0/g-clamp-h.uxml. Both versions and both themes agree:
 *   clipped (Yoga offers an AtMost height): a Label, a Button and a TextElement in a 20px row with
 *     align-items flex-start (rs-*), a Label in a 20px column — flex-shrink 0 or 1 (cf-, cs-label),
 *     and a TextField's inner text in a 20px row (tf: the field is 22 on the runtime panel, not 39).
 *     The box never goes below its padding and border (rs-button 22 = 10 + 10 + 1 + 1 on the
 *     runtime panel): the text gets what is left, down to 0;
 *   not clipped: an absolutely placed Label (abs-label, 25 in a 10px host), a row of auto height
 *     (free-label).
 * Unlike the width (g-clamp.test.ts), a TextField's inner text is clipped in height.
 * Expected boxes: the 6000.3.25f1 dumps, exactly. The stub answers MeasureTextSize, or the layout
 * width where Unity laid a text out 1-2px wider (as bundle-e.test.ts).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { loadLayoutEngine, parse, resolveStyles } from '../../src/index';
import type { ElementNode, MeasureText, Theme } from '../../src/index';
import { layoutDocument } from '../../src/layout/yoga';

const UNITY = join(process.cwd(), 'tests', 'layout', 'unity');
const FOLDER: Record<Theme, string> = { runtime: 'probe-panel', editor: 'probe-editor-070' };
const NAMES = ['rs-label', 'rs-button', 'rs-te', 'rt-label', 'rt-button', 'cf-label', 'cs-label', 'abs-label', 'tf', 'free-label'];

interface DumpElement { path: string; name: string; x: number; y: number; w: number; h: number; text?: string; measured?: { w: number; h: number }; style: Record<string, string> }
interface Dump { metadata: { panel: { width: number; height: number } }; elements: DumpElement[] }
const readDump = (version: string, theme: Theme): Dump =>
  JSON.parse(readFileSync(join(UNITY, version, FOLDER[theme], 'g-clamp-h.json'), 'utf8').replace(/\bNaN\b/g, 'null')) as Dump;
const at = (dump: Dump, name: string): DumpElement => dump.elements.find((e) => e.name === name)!;

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

describe('height clipping — the dumps', () => {
  it('clipped where a height is offered, not when absolute or unoffered; both versions agree', () => {
    for (const theme of ['runtime', 'editor'] as const) {
      const a = readDump('6000.0.40f1', theme);
      const b = readDump('6000.3.25f1', theme);
      for (const n of NAMES) expect([at(a, n).w, at(a, n).h], `${theme} ${n}`).toEqual([at(b, n).w, at(b, n).h].map((v, i) => (i === 0 && n === 'rs-te' ? at(a, n).w : v)));
      const r = readDump('6000.3.25f1', 'runtime');
      const text = (n: string): number => at(r, n).h - Number(at(r, n).style['paddingTop']) - Number(at(r, n).style['paddingBottom']) - Number(at(r, n).style['borderTopWidth']) - Number(at(r, n).style['borderBottomWidth']);
      expect(text('rs-label'), 'a Label in a 20px row: 14 less 4 + 4 padding').toBe(6);
      expect(text('rs-button'), 'a Button keeps its padding and border, its text gets 0').toBe(0);
      expect(text('abs-label'), 'absolute: not clipped').toBe(17);
      expect(text('free-label'), 'unoffered: not clipped').toBe(17);
      expect(at(r, 'tf').h, 'a TextField in a 20px row').toBe(22);
    }
  });
});

for (const theme of ['runtime', 'editor'] as const) {
  describe(`height clipping — ${theme} theme`, () => {
    it('each text lands as tall as Unity makes it', () => {
      const dump = readDump('6000.3.25f1', theme);
      const doc = parse(readFileSync(join(UNITY, 'probes-0.7.0', 'g-clamp-h.uxml'), 'utf8'));
      const resolved = resolveStyles(doc, { theme });
      const tree = layoutDocument(doc.root, resolved.styles, resolved.partStyles, { theme, size: dump.metadata.panel, measureText: unityMeasure(dump) });
      try {
        const problems: string[] = [];
        for (const n of NAMES) {
          const b = tree.boxes.get(nodeByName(doc.root, n).id)!;
          const u = at(dump, n);
          if (b.left !== u.x || b.top !== u.y || b.width !== u.w || b.height !== u.h) problems.push(`${n}: ours ${[b.left, b.top, b.width, b.height].join(',')}, Unity ${[u.x, u.y, u.w, u.h].join(',')}`);
        }
        expect(problems).toEqual([]);
      } finally {
        tree.dispose();
      }
    });
  });
}
