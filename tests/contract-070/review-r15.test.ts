/**
 * 0.7.0 review fix T3, round 1.5 (grok review 2026-10-20, human decision 2026-10-21).
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * A host that names a font family and gives no FaceInfo leaves the measurer with the canvas's
 * ascent and descent and no lineHeight (measure.ts createDefaultMeasureText). The Standard generator
 * advances every later line by lineHeight (plan §29, tests/text-cohort/unity-runtime/), so such text
 * cannot have its second and later lines placed as Unity places them. Rule 6: say so. The measuring
 * does not change (human decision): the warning only. Advanced text uses no lineHeight and is not
 * warned; a FaceInfo silences it.
 *
 * Not a browser test: this is a warning, decided in layout before any glyph is drawn.
 */

import { beforeAll, describe, expect, it } from 'vitest';

import { loadLayoutEngine, parse, render } from '../../src/index';
import type { FaceInfo, MeasureText, Theme } from '../../src/index';

beforeAll(async () => {
  await loadLayoutEngine();
});

const fixed: MeasureText = (text, context) => ({ width: text.length * context.fontSize * 0.5, height: context.fontSize });
const FACE: FaceInfo = { pointSize: 90, ascentLine: 87.1875, descentLine: -21.73295, lineHeight: 108.9205 };

function fontWarnings(theme: Theme, faceInfo: FaceInfo | undefined, uss = ''): number {
  const doc = parse('<ui:UXML xmlns:ui="UnityEngine.UIElements"><ui:Label text="One&#10;Two" style="-unity-font-definition: url(&quot;f.ttf&quot;);" /></ui:UXML>', uss || undefined);
  const r = render(doc, document.createElement('div'), {
    theme, size: { width: 400, height: 300 }, measureText: fixed,
    resolveFont: () => (faceInfo === undefined ? { family: 'F' } : { family: 'F', faceInfo }),
  });
  const n = r.warnings.filter((w) => w.subject?.kind === 'property' && w.subject.property === '-unity-font-definition').length;
  r.dispose();
  return n;
}

describe('T3 — a host font without FaceInfo under the Standard generator', () => {
  it('runtime (standard): warned', () => {
    expect(fontWarnings('runtime', undefined)).toBeGreaterThan(0);
  });
  it('editor with an author standard generator: warned', () => {
    expect(fontWarnings('editor', undefined, 'Label { -unity-text-generator: standard; }')).toBeGreaterThan(0);
  });
  it('editor (advanced): not warned', () => {
    expect(fontWarnings('editor', undefined)).toBe(0);
  });
  it('with a FaceInfo: not warned', () => {
    expect(fontWarnings('runtime', FACE)).toBe(0);
  });
});
