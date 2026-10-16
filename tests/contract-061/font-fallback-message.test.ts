/**
 * 0.6.1 P3 — the font-fallback warning names width too, where width was
 * measured to differ.
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Measured (docs/design/0.7.0-cjk-text.md, result 3; 6000.0.40f1 and
 * 6000.3.25f1, Chrome 155 on one Windows PC): Han and Kana in the editor
 * default font — Unity's box is 6–87px narrower than this preview's (10–32px),
 * and the preview's width depends on the device's fallback font. Hangul in
 * Inter: width within 1px or 1% on 6.3 (tests/text-cohort/results.json), so
 * its message keeps to height. Only the message changes; no field does.
 */

import { beforeAll, describe, expect, it } from 'vitest';

import { loadLayoutEngine, parse, render } from '../../src/index';
import type { Warning } from '../../src/index';

beforeAll(async () => {
  await loadLayoutEngine();
});

const U = (body: string) => `<ui:UXML xmlns:ui="UnityEngine.UIElements">${body}</ui:UXML>`;

describe('font-fallback message', () => {
  it('Han and Kana: height and width; Hangul: height', () => {
    const r = render(parse(U('<ui:Label text="한글" /><ui:Label text="漢字" /><ui:Label text="かな" />')), document.createElement('div'), {
      size: { width: 400, height: 300 },
      measureText: (t, c) => ({ width: t.length * 6, height: c.fontSize }),
    });
    try {
      const ws = r.warnings.filter((w: Warning) => w.reason === 'font-fallback');
      expect(ws.map((w) => (w.subject?.kind === 'property' ? w.subject.missingGlyphs : undefined))).toEqual(['hangul', 'han', 'kana']);
      const [hangul, han, kana] = ws.map((w) => w.message);
      for (const m of [hangul, han, kana]) expect(m).toMatch(/1–4px taller/);
      for (const m of [han, kana]) {
        expect(m).toMatch(/width/i);
        expect(m).toMatch(/6–87px/);
        expect(m).toMatch(/fallback font/i);
      }
      expect(hangul).not.toMatch(/width/i);
      for (const w of ws) expect(w.subject).toEqual({ kind: 'property', property: '-unity-font-definition', value: '', affectsLayout: true, missingGlyphs: w.subject?.kind === 'property' ? w.subject.missingGlyphs : undefined });
    } finally {
      r.dispose();
    }
  });
});
