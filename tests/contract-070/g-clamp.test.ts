/**
 * 0.7.0 — when Unity clips a text's width to the width it is offered (human instruction
 * 2026-10-18: apply the rule wherever Unity applies it, not only where a bundle needed it).
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Source: tests/layout/unity/<version>/{probe-panel,probe-editor-070}/g-clamp.json (PanelDump /
 * ProbeDump 0.7.0-r3, 2026-10-18, the probe run alone in its Unity process), probe
 * tests/layout/unity/probes-0.7.0/g-clamp.uxml. A one-line text (178px runtime, 153px editor)
 * in a 100px box, every way a text can be offered a width. Both versions and both themes agree:
 *   clipped to the offered width (Yoga's AtMost):
 *     a Label, a Button, a Label with text-overflow ellipsis in a column with align-items
 *     flex-start (cs-*); a Label in a row (row-label) and in a row with overflow hidden
 *     (rh-label); a stretched Label (st-label) is the column's width anyway;
 *   not clipped (narrower than what is offered, or nothing offered):
 *     an absolutely placed Label (abs-label: Unity offers it no width), a Label in a row whose own width is
 *     auto (free-label: the root still offers the panel's width, AtMost 800; 178px is under it. A text wider
 *     than the panel is clipped to it — c-edge.json `wide`, review C8, review-k2.test.ts).
 *     The preview's Yoga offers an absolute element its containing block's width (AtMost), which
 *     Unity's does not: absolute text is not clipped whatever the preview's Yoga offers;
 *   not clipped although offered:
 *     a TextField's inner text (tf-narrow, as tf-long in c-textfield): Unity measures the input
 *     text unbounded, and the field clips it by drawing.
 *   The registry scene (reg-*: "Hello world\nwide text", align-self flex-start, nowrap, in 100px):
 *     the text is two lines, 75px wide on the runtime panel, so it is not clipped, and
 *     letter-spacing 3px and word-spacing 5px widen its box (78 -> 82, 79). With letter-spacing
 *     20px both generators exceed 100 and are clipped on the runtime panel (94 and 94).
 *
 * Not judged here, found by this probe: on the runtime panel (both versions) four no-wrap Labels
 *   (st-label, row-label, rh-label, free-label) are 12-13px high instead of their 17px line. Cause
 *   found 2026-10-19 (t-bis-*, t-cache-*, t-fit* dumps): this probe writes the same text earlier
 *   with white-space normal (cs-te, cs-wrap), and Unity's later layouts of that string come out
 *   short — remove cs-te and cs-wrap and all four are 25px, as the preview draws them. A Unity-side
 *   contamination within one document, not part of the clipping and not reproduced. The heights of
 *   those four are not judged on the runtime theme; the second test pins the observation. The
 *   editor theme keeps 15 everywhere.
 *
 * Expected boxes: the 6000.3.25f1 dumps, judged exactly (human decision 2026-10-18: the solo dump
 * is the reference and no tolerance is widened). The stub answers MeasureTextSize, except where
 * Unity's layout gave the text 1-2px more: there it answers that layout width, read from the box
 * (as bundle-e.test.ts). These dumps were taken alone in their Unity process (plan section 27-2).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { loadLayoutEngine, parse, resolveStyles } from '../../src/index';
import type { ElementNode, MeasureText, Theme } from '../../src/index';
import { layoutDocument } from '../../src/layout/yoga';

const UNITY = join(process.cwd(), 'tests', 'layout', 'unity');
const FOLDER: Record<Theme, string> = { runtime: 'probe-panel', editor: 'probe-editor-070' };

interface DumpElement { path: string; name: string; x: number; y: number; w: number; h: number; text?: string; measured?: { w: number; h: number }; style: Record<string, string> }
interface Dump { metadata: { panel: { width: number; height: number } }; elements: DumpElement[] }
const readDump = (version: string, theme: Theme): Dump =>
  JSON.parse(readFileSync(join(UNITY, version, FOLDER[theme], 'g-clamp.json'), 'utf8').replace(/\bNaN\b/g, 'null')) as Dump;
const at = (dump: Dump, path: string): DumpElement => {
  const e = dump.elements.find((x) => x.path === path);
  if (e === undefined) throw new Error(`dump has no ${path}`);
  return e;
};
const inner = (e: DumpElement): number => e.w - ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth'].reduce((s, k) => s + Number(e.style[k]), 0);

const CLIPPED = ['col-start/cs-label', 'col-start/cs-button', 'col-start/cs-ellipsis', 'row/row-label', 'row-hidden/rh-label'];
const UNCLIPPED = ['abs-host/abs-label', 'free/free-label', 'tf-host/tf-narrow/unity-text-input/TextElement[0]'];
// The open finding (header): runtime heights not judged.
const RUNTIME_SHORT = ['col-stretch/st-label', 'row/row-label', 'row-hidden/rh-label', 'free/free-label'];
const REGISTRY = ['reg/reg-plain', 'reg/reg-letter', 'reg/reg-word', 'reg/reg-gen', 'reg/reg-gen-std'];

beforeAll(async () => {
  await loadLayoutEngine();
});

function unityMeasure(dump: Dump): MeasureText {
  const sizes = new Map<string, { width: number; height: number }>();
  for (const e of dump.elements) {
    if (e.measured === undefined || e.text === undefined) continue;
    const key = `${e.text}|${Number(e.style['fontSize'])}|${e.style['letterSpacing'] ?? ''}|${e.style['wordSpacing'] ?? ''}|${e.style['unityTextGenerator'] ?? ''}`;
    sizes.set(key, { width: e.measured.w, height: e.measured.h });
  }
  // Unity's layout width where it is 1-2px over MeasureTextSize (header). Clipped rows are under it.
  for (const e of dump.elements) {
    if (e.measured === undefined || e.text === undefined) continue;
    const s = e.style;
    const over = e.w - Number(s['paddingLeft']) - Number(s['paddingRight']) - Number(s['borderLeftWidth']) - Number(s['borderRightWidth']) - e.measured.w;
    const key = `${e.text}|${Number(s['fontSize'])}|${s['letterSpacing'] ?? ''}|${s['wordSpacing'] ?? ''}|${s['unityTextGenerator'] ?? ''}`;
    if (over >= 1 && over <= 2) sizes.set(key, { width: e.measured.w + over, height: e.measured.h });
  }
  return (text, context) => {
    const ls = context.letterSpacing ?? 0, ws = context.wordSpacing ?? 0;
    const hit = [...sizes].find(([k]) => {
      const [t, size, l, w, g] = k.split('|');
      return t === text && Number(size) === context.fontSize && parseFloat(l!) === ls && parseFloat(w!) === ws &&
        (ls === 0 || g!.toLowerCase() === context.textGenerator);
    });
    if (hit === undefined) throw new Error(`no Unity measurement for ${JSON.stringify(text)} at ${context.fontSize}px ls ${ls} ws ${ws} ${context.textGenerator}`);
    return hit[1];
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

describe('text clipping — the dumps', () => {
  it('clipped where offered a width, not where nothing is offered, never a TextField\'s text', () => {
    for (const version of ['6000.0.40f1', '6000.3.25f1']) {
      for (const theme of ['runtime', 'editor'] as const) {
        const d = readDump(version, theme);
        for (const p of CLIPPED) expect(inner(at(d, p)), `${version} ${theme} ${p}`).toBeLessThan(at(d, p).measured!.w);
        for (const p of UNCLIPPED) expect(inner(at(d, p)), `${version} ${theme} ${p}`).toBeGreaterThanOrEqual(at(d, p).measured!.w);
        expect(at(d, 'reg/reg-letter').w, `${version} ${theme} letter-spacing widens the registry scene`).toBeGreaterThan(at(d, 'reg/reg-plain').w);
        expect(at(d, 'reg/reg-word').w, `${version} ${theme} word-spacing widens the registry scene`).toBeGreaterThan(at(d, 'reg/reg-plain').w);
      }
    }
  });

  it('the contamination: runtime no-wrap text after the same text wrapped is 12-13px high', () => {
    for (const version of ['6000.0.40f1', '6000.3.25f1']) {
      const d = readDump(version, 'runtime');
      const text = (p: string): number => at(d, p).h - Number(at(d, p).style['paddingTop']) - Number(at(d, p).style['paddingBottom']);
      expect(text('col-start/cs-label'), `${version} AtMost`).toBe(17);
      for (const p of RUNTIME_SHORT) expect(text(p), `${version} ${p}`).toBeLessThan(14);
      expect(text('abs-host/abs-label'), `${version} absolute`).toBe(17);
      const e = readDump(version, 'editor');
      for (const p of ['col-start/cs-label', 'col-stretch/st-label', 'row/row-label', 'row-hidden/rh-label']) expect(at(e, p).h, `${version} editor ${p}`).toBe(15);
    }
  });
});

for (const theme of ['runtime', 'editor'] as const) {
  describe(`text clipping — ${theme} theme`, () => {
    it('each text lands as wide as Unity makes it', () => {
      const dump = readDump('6000.3.25f1', theme);
      const doc = parse(readFileSync(join(UNITY, 'probes-0.7.0', 'g-clamp.uxml'), 'utf8'));
      const resolved = resolveStyles(doc, { theme });
      const tree = layoutDocument(doc.root, resolved.styles, resolved.partStyles, { theme, size: dump.metadata.panel, measureText: unityMeasure(dump) });
      const slack = 0;
      try {
        for (const p of [...CLIPPED, 'col-stretch/st-label']) {
          const b = tree.boxes.get(nodeByName(doc.root, p.split('/').pop()!).id)!;
          const u = at(dump, p);
          expect([b.left, b.width], `${p} (clipped: the box decides)`).toEqual([u.x, u.w]);
          // Runtime clipped heights: the open finding in the header, not judged.
          if (theme === 'editor' || !RUNTIME_SHORT.includes(p)) expect(b.height, `${p} height`).toBe(u.h);
        }
        for (const p of [...UNCLIPPED.slice(0, 2), ...REGISTRY]) {
          const b = tree.boxes.get(nodeByName(doc.root, p.split('/').pop()!).id)!;
          const u = at(dump, p);
          if (theme === 'editor' || !RUNTIME_SHORT.includes(p)) expect(b.height, `${p} height`).toBe(u.h);
          expect(Math.abs(b.width - u.w), `${p} width ours ${b.width}, Unity ${u.w}`).toBeLessThanOrEqual(slack);
        }
        const field = nodeByName(doc.root, 'tf-narrow');
        const text = (tree.parts.get(field.id) ?? []).find((x) => x.name === 'unity-text-element--inner-input-field-component')!;
        const u = at(dump, UNCLIPPED[2]!);
        expect(Math.abs(text.box.width - u.w), `tf-narrow inner text ours ${text.box.width}, Unity ${u.w} (not clipped)`).toBeLessThanOrEqual(slack);
      } finally {
        tree.dispose();
      }
    });
  });
}
