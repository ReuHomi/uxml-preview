/**
 * 0.6.0 bundle 1 follow-up — one written declaration, one warning, every element.
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Found on 2026-10-16 while judging a surviving mutation: a border width in a
 * unit USS lacks is judged twice, once by the layout (it sizes the box) and
 * once by the painter (it draws the border), with two different messages, so
 * the per-declaration merge never saw them as one. 0.5.1 did the same; no
 * test covered it. The expectation is the contract 0.5.1 already promised —
 * "one warning per written declaration, not one per element it reached" — plus
 * 0.6.0's `nodes`.
 */

import { beforeAll, describe, expect, it } from 'vitest';

import { loadLayoutEngine, parse, render } from '../../src/index';
import type { RenderResult, Warning } from '../../src/index';

beforeAll(async () => {
  await loadLayoutEngine();
});

const THREE = '<ui:VisualElement class="x" /><ui:VisualElement class="x" /><ui:VisualElement class="x" />';

function draw(body: string, uss?: string): RenderResult {
  return render(parse(`<ui:UXML xmlns:ui="UnityEngine.UIElements">${body}</ui:UXML>`, uss), document.createElement('div'), {
    size: { width: 400, height: 300 },
    measureText: (text, ctx) => ({ width: text.length * 6, height: ctx.fontSize }),
  });
}

const about = (ws: readonly Warning[], property: string): Warning[] =>
  ws.filter((w) => w.subject?.kind === 'property' && w.subject.property === property);

describe('a value the layout and the painter both read is reported once', () => {
  it('border-top-width: 5em on a rule matching three elements', () => {
    const r = draw(THREE, '.x { border-top-width: 5em; }');
    try {
      const elements = [...r.boxes.keys()].filter((id) => id !== r.document!.root.id);
      expect(elements).toHaveLength(3);
      const ws = about(r.warnings, 'border-top-width');
      expect(ws).toHaveLength(1);
      expect(ws[0]!.nodes).toEqual(elements);
      expect(ws[0]!.node).toBe(elements[0]);
      expect(ws[0]!.at?.in).toBe('uss');
    } finally {
      r.dispose();
    }
  });

  it('the same in each element\'s inline style: one warning per element, still not two', () => {
    const r = draw('<ui:VisualElement style="border-left-width: 2em;" /><ui:VisualElement style="border-left-width: 2em;" />');
    try {
      const ws = about(r.warnings, 'border-left-width');
      expect(ws).toHaveLength(2);
      expect(new Set(ws.map((w) => w.node)).size).toBe(2);
    } finally {
      r.dispose();
    }
  });
});
