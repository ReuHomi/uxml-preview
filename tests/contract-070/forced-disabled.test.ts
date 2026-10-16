/**
 * 0.7.0 bundle A, step A2 — a disabled state forced through `states`.
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Found while reviewing the A2 snapshots (2026-10-17): moving the dim from
 * `:disabled` to `.unity-disabled` (measured, nested-disabled.json) made
 * `states: { '#b': ['disabled'] }` stop dimming #b, which 0.6.x dimmed at 0.5
 * (tests/render/snapshots/visual-states-per-element.json).
 *
 * [Inferred, not measured] In Unity an element is disabled only through
 * SetEnabled(false) on itself or an ancestor, and SetEnabled(false) on an element
 * gives that element `unity-disabled` (nested-disabled.json: the class sits exactly
 * where enabled="false" was written). Forcing `disabled` on an element through
 * `states` is the preview's way of asking for that element disabled itself, so it
 * gets `unity-disabled` and opacity 0.5. The forced state does not descend (it
 * never has: resolve.ts adds forced states to the matched element only), so a
 * child stays at 1. Both themes carry the same rule.
 */

import { beforeAll, describe, expect, it } from 'vitest';

import { loadLayoutEngine, parse, render } from '../../src/index';
import type { ElementNode, NodeId, RenderResult } from '../../src/index';

beforeAll(async () => {
  await loadLayoutEngine();
});

const UXML = `<ui:UXML xmlns:ui="UnityEngine.UIElements">
  <ui:VisualElement name="p"><ui:Button name="b" text="Drop" /></ui:VisualElement>
  <ui:Button name="other" text="Use" />
</ui:UXML>`;

function opacity(r: RenderResult, name: string): number {
  let id: NodeId | undefined;
  const walk = (n: ElementNode): void => {
    if (n.attributes.some((a) => a.name === 'name' && a.value === name)) id = n.id;
    n.children.forEach(walk);
  };
  walk(r.document!.root);
  return Number(r.styles!.get(id!)?.get('opacity')?.value ?? '1');
}

describe('forced disabled state', () => {
  for (const theme of ['editor', 'runtime'] as const) {
    it(`${theme}: dims the element it is forced on, once, and nothing else`, () => {
      const r = render(parse(UXML), document.createElement('div'), {
        theme,
        size: { width: 400, height: 300 },
        measureText: (t, c) => ({ width: t.length * 6, height: c.fontSize }),
        states: { '#p': ['disabled'] },
      });
      try {
        expect(opacity(r, 'p')).toBe(0.5);
        expect(opacity(r, 'b')).toBe(1);
        expect(opacity(r, 'other')).toBe(1);
      } finally {
        r.dispose();
      }
    });
  }
});
