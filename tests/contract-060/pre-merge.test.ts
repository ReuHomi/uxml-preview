/**
 * Last fixes before the 0.6.0 merge (user round C, 2026-10-16).
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * C1 — `-unity-text-generator` is measured and painted (tests/layout/unity/
 * <version>/probe-editor/text-spacing-standard.json and -advanced.json;
 * tests/contract-060/text-and-fonts.test.ts), yet the registry said
 * `handling: 'none'`, so writing it raised `not-rendered` with
 * `affectsLayout: true` — exactly uxml-author's exit-3 condition
 * (src/check.js `classify`: reason not-rendered + affectsLayout).
 *
 * C2 — an unknown property name. The suspicion that `colour: red` raised
 * nothing came from a probe that grepped for lines starting with "W" while
 * vitest prefixes its first console line with colour codes; reproduced
 * correctly, 0.5.1 and 0.6.0 both report `not-uss` (0.5.0 said nothing). This
 * pins it, together with the custom-property exemption.
 */

import { beforeAll, describe, expect, it } from 'vitest';

import { loadLayoutEngine, parse, render } from '../../src/index';
import type { Warning } from '../../src/index';

beforeAll(async () => {
  await loadLayoutEngine();
});

const U = (body: string) => `<ui:UXML xmlns:ui="UnityEngine.UIElements">${body}</ui:UXML>`;

function warningsOf(uxml: string, uss?: string): Warning[] {
  const doc = parse(U(uxml), uss);
  const r = render(doc, document.createElement('div'), { size: { width: 400, height: 300 } });
  try {
    return [...doc.warnings, ...r.warnings];
  } finally {
    r.dispose();
  }
}

// Transcribed from uxml-author master, src/check.js `classify`.
const exit3 = (w: Warning) =>
  w.reason === 'not-rendered' && w.subject?.kind === 'property' && w.subject.affectsLayout === true;
const about = (property: string) => (w: Warning) => w.subject?.kind === 'property' && w.subject.property === property;

describe('C1 -unity-text-generator is laid out, not a layout gap', () => {
  for (const value of ['standard', 'advanced']) {
    it(`-unity-text-generator: ${value} raises no warning, so nothing meets the exit-3 condition`, () => {
      const ws = warningsOf('<ui:Label name="t" text="Hello World" />', `#t { -unity-text-generator: ${value}; letter-spacing: 5px; }`);
      expect(ws.filter(about('-unity-text-generator'))).toEqual([]);
      expect(ws.filter(exit3)).toEqual([]);
    });
  }

  it('inline too', () => {
    const ws = warningsOf('<ui:Label text="a b" style="-unity-text-generator: standard;" />');
    expect(ws.filter(about('-unity-text-generator'))).toEqual([]);
  });
});

describe('C2 an unknown property name is the author\'s defect', () => {
  for (const [where, uxml, uss] of [
    ['rule', '<ui:VisualElement name="a" />', '#a { colour: red; }'],
    ['inline', '<ui:VisualElement style="colour: red;" />', undefined],
  ] as const) {
    it(`${where}: colour is reported once as not-uss`, () => {
      const ws = warningsOf(uxml, uss).filter(about('colour'));
      expect(ws).toHaveLength(1);
      expect(ws[0]!.kind).toBe('unsupported-property');
      expect(ws[0]!.reason).toBe('not-uss');
    });
  }

  it('custom properties (--name) are never reported, declared or read', () => {
    const ws = warningsOf(
      '<ui:VisualElement name="a" style="--inline-token: 4px; width: var(--inline-token);" />',
      ':root { --accent: rgb(110, 168, 254); } #a { --size: 10px; background-color: var(--accent); height: var(--size); }',
    );
    expect(ws.filter((w) => w.subject?.kind === 'property' && w.subject.property.startsWith('--'))).toEqual([]);
  });
});
