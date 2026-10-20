/**
 * 0.7.0 item T — the Standard text generator's height and width rules (human decision 2026-10-19:
 * required before release; the runtime theme drew 60/92 text heights against Unity's runtime panel).
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Evidence (plan section 29): the text cohort dumps.
 *   Standard: tests/text-cohort/unity-runtime/{6000.0.40f1,6000.3.25f1}/ (the runtime panel) and
 *             tests/text-cohort/unity/6000.0.40f1/ (the 6000.0 editor, Standard there) — value for value
 *             alike (77a8661).
 *   Advanced: tests/text-cohort/unity/6000.3.25f1/ (the 6.3 editor).
 * Rules, with r = (ascentLine - descentLine) / pointSize, lh = lineHeight / pointSize, n lines:
 *   Standard height = floor(fontSize * r + (n - 1) * fontSize * lh) + 1   — 234 of 235 rows in each Standard set
 *   Advanced height = ceil(n * fontSize * r)                               — 235 of 235 (unchanged)
 *   Standard width: glyphs without kerning; Advanced width: with kerning — Chromium canvas against the
 *   dumps, 84/84 rows each way (kerning on gives 81/84 on Standard, off gives 83/84 on Advanced).
 * The one Standard row no rule explains: noto-jp-zh-20-w60 (Noto Sans JP 20px in 60px, 7 lines; the rule
 * gives 203, Unity 202 on the 6000.0 editor and 201 on the runtime panel). Named in UNEXPLAINED; it must
 * stay a difference here (a stale entry fails), and test:text stays red on it until its cause is found.
 *
 * The generator is the resolved -unity-text-generator value, not the theme: the runtime theme resolves
 * Standard (bundle A), the editor theme Advanced, and an author's `-unity-text-generator: standard` on the
 * editor theme measures as Standard too.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { createDefaultMeasureText, loadLayoutEngine, parse, render, textHeight } from '../../src/index';
import type { ElementNode } from '../../src/index';
import type { FaceInfo } from '../../src/render/measure';

const COHORT = join(process.cwd(), 'tests', 'text-cohort');
const spec = JSON.parse(readFileSync(join(COHORT, 'spec.json'), 'utf8')) as { fonts: Array<{ id: string; noGlyphs?: string[] }>; sentences: Record<string, string> };
const UNEXPLAINED = new Set(['noto-jp-zh-20-w60']);

interface Row { name: string; h: number; fontSize: number; face: FaceInfo }
function rows(dir: string): Row[] {
  const out: Row[] = [];
  for (const f of readdirSync(join(COHORT, dir)).filter((x) => x.endsWith('.json'))) {
    const d = JSON.parse(readFileSync(join(COHORT, dir, f), 'utf8').replace(/\bNaN\b/g, 'null')) as { elements: Array<{ type: string; name: string; h: number; style: Record<string, string>; faceInfo?: FaceInfo }> };
    for (const e of d.elements) {
      if (e.type !== 'Label' || e.name.startsWith('default-') || e.faceInfo === undefined) continue;
      const font = spec.fonts.find((x) => e.name.startsWith(`${x.id}-`));
      const sentence = e.name.split('-').find((p) => p in spec.sentences);
      if (sentence !== undefined && (font?.noGlyphs ?? []).includes(sentence)) continue; // fallback glyphs: (a), not a rule
      out.push({ name: e.name, h: e.h, fontSize: Number(e.style['fontSize']), face: e.faceInfo });
    }
  }
  return out;
}
function byName(root: ElementNode, name: string): ElementNode {
  let found: ElementNode | undefined;
  const walk = (n: ElementNode): void => {
    if (n.attributes.some((a) => a.name === 'name' && a.value === name)) found = n;
    n.children.forEach(walk);
  };
  walk(root);
  if (found === undefined) throw new Error(`no element named ${name}`);
  return found;
}
const linesOf = (r: Row): number => Math.max(1, Math.round(r.h / (r.fontSize * (r.face.ascentLine - r.face.descentLine) / r.face.pointSize)));

beforeAll(async () => {
  await loadLayoutEngine();
});

describe('text height by generator — the cohort dumps', () => {
  for (const dir of ['unity-runtime/6000.0.40f1', 'unity-runtime/6000.3.25f1', 'unity/6000.0.40f1']) {
    it(`Standard (${dir}): every row but the unexplained one`, () => {
      const wrong: string[] = [];
      const stale: string[] = [];
      for (const r of rows(dir)) {
        const ours = textHeight(linesOf(r), r.fontSize, r.face, 0, 0, 'standard');
        if (UNEXPLAINED.has(r.name)) {
          if (ours === r.h) stale.push(r.name);
          continue;
        }
        if (ours !== r.h) wrong.push(`${r.name}: ours ${ours}, Unity ${r.h}`);
      }
      expect(wrong).toEqual([]);
      expect(stale, 'an unexplained row now matches: find out why, then drop it').toEqual([]);
    });
  }

  it('Advanced (unity/6000.3.25f1): every row, as before', () => {
    const wrong = rows('unity/6000.3.25f1').filter((r) => textHeight(linesOf(r), r.fontSize, r.face, 0, 0, 'advanced') !== r.h).map((r) => r.name);
    expect(wrong).toEqual([]);
    // Without the argument textHeight stays Advanced: callers that do not know the generator are unchanged.
    for (const r of rows('unity/6000.3.25f1')) expect(textHeight(linesOf(r), r.fontSize, r.face)).toBe(r.h);
  });
});

describe('the measurer follows the generator', () => {
  /** A canvas whose measureText records the kerning it was asked with. */
  function fakeDocument(): { doc: Document; kerning: string[] } {
    const kerning: string[] = [];
    const ctx = {
      font: '',
      fontKerning: 'auto',
      measureText(text: string) {
        kerning.push(this.fontKerning);
        return { width: text.length * 7, fontBoundingBoxAscent: NaN, fontBoundingBoxDescent: NaN };
      },
    };
    const doc = { createElement: () => ({ getContext: () => ctx }) } as unknown as Document;
    return { doc, kerning };
  }
  const JUA: FaceInfo = { pointSize: 90, ascentLine: 90, descentLine: 0, lineHeight: 90 }; // ratio 1: 10px is a whole 10

  it('Standard measures without kerning and with the Standard height; Advanced with kerning and ceil', () => {
    const standard = fakeDocument();
    const s = createDefaultMeasureText(standard.doc)('Hamburgefonts', { fontSize: 10, fontStyle: 'normal', whiteSpace: 'nowrap', textGenerator: 'standard', faceInfo: JUA }, 0);
    expect(standard.kerning.length).toBeGreaterThan(0);
    expect(new Set(standard.kerning)).toEqual(new Set(['none']));
    expect(s.height, 'Standard: floor(10) + 1').toBe(11);

    const advanced = fakeDocument();
    const a = createDefaultMeasureText(advanced.doc)('Hamburgefonts', { fontSize: 10, fontStyle: 'normal', whiteSpace: 'nowrap', textGenerator: 'advanced', faceInfo: JUA }, 0);
    expect(new Set(advanced.kerning)).toEqual(new Set(['normal']));
    expect(a.height, 'Advanced: ceil(10)').toBe(10);
  });

  const box = (theme: 'runtime' | 'editor', uss: string): number => {
    const doc = parse('<ui:UXML xmlns:ui="UnityEngine.UIElements"><ui:Label name="t" text="Hamburgefonts" /></ui:UXML>',
      `#t { font-size: 10px; padding: 0; margin: 0; -unity-font-definition: url("project://database/Assets/Fonts/Jua-Regular.ttf"); ${uss} }`);
    const r = render(doc, document.createElement('div'), { theme, size: { width: 400, height: 300 }, resolveFont: () => ({ family: 'Jua', faceInfo: JUA }) });
    try {
      return r.boxes.get(byName(r.document!.root, 't').id)!.height;
    } finally {
      r.dispose();
    }
  };

  it('the resolved -unity-text-generator decides, not the theme', () => {
    expect(box('runtime', ''), 'runtime theme: Standard').toBe(11);
    expect(box('editor', ''), 'editor theme: Advanced').toBe(10);
    expect(box('editor', '-unity-text-generator: standard;'), 'editor theme, author asks for Standard').toBe(11);
    expect(box('runtime', '-unity-text-generator: advanced;'), 'runtime theme, author asks for Advanced').toBe(10);
  });

  it('Standard text is painted without kerning, as it was measured', () => {
    const doc = parse('<ui:UXML xmlns:ui="UnityEngine.UIElements"><ui:Label name="s" text="AV" /><ui:Label name="a" text="AV" style="-unity-text-generator: advanced;" /></ui:UXML>');
    const r = render(doc, document.createElement('div'), { theme: 'runtime', size: { width: 400, height: 300 } });
    try {
      const [s, a] = ['s', 'a'].map((n) => r.elements.get(byName(r.document!.root, n).id)!);
      const kerningOf = (el: HTMLElement): string => {
        const own = el.style.getPropertyValue('font-kerning');
        const inner = [...el.querySelectorAll('*')].map((x) => (x as HTMLElement).style.getPropertyValue('font-kerning')).find((v) => v !== '');
        return own || inner || '';
      };
      expect(kerningOf(s!), 'Standard').toBe('none');
      expect(kerningOf(a!), 'Advanced: the browser default (kerning on)').not.toBe('none');
    } finally {
      r.dispose();
    }
  });
});
