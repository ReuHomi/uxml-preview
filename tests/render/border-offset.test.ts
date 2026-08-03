/**
 * Where a child lands when its parent has a border.
 *
 * Yoga reports a child's position from the parent's *border box* origin, but a
 * CSS absolutely-positioned child is placed against its parent's *padding box*
 * — the inside edge of the border. Handing Yoga's number straight to CSS makes
 * the browser add the border width a second time.
 *
 * The golden suite cannot see this. It compares Yoga coordinates, and those are
 * correct; what is wrong is the translation into CSS, and no case in
 * tests/render had a bordered parent.
 */

import { describe, it, expect, beforeAll } from 'vitest';

import { parse, render, loadLayoutEngine } from '../../src/index';
import type { MeasureText } from '../../src/index';
import type { ElementNode } from '../../src/model/types';

beforeAll(async () => {
  await loadLayoutEngine();
});

const measureText: MeasureText = (text, context) => ({
  width: text.length * context.fontSize * 0.5,
  height: context.fontSize,
});

function named(node: ElementNode, name: string): ElementNode {
  if (node.attributes.some((a) => a.name === 'name' && a.value === name)) return node;
  for (const child of node.children) {
    const hit = tryNamed(child, name);
    if (hit !== null) return hit;
  }
  throw new Error(`no element named ${name}`);
}
function tryNamed(node: ElementNode, name: string): ElementNode | null {
  if (node.attributes.some((a) => a.name === 'name' && a.value === name)) return node;
  for (const child of node.children) {
    const hit = tryNamed(child, name);
    if (hit !== null) return hit;
  }
  return null;
}

function draw(body: string, uss: string) {
  const doc = parse(`<ui:UXML xmlns:ui="UnityEngine.UIElements">${body}</ui:UXML>`, uss);
  const container = document.createElement('div');
  document.body.replaceChildren(container);
  const result = render(doc, container, {
    size: { width: 300, height: 200 },
    measureText,
  });
  return { doc, result };
}

const NESTED =
  '<ui:VisualElement name="parent"><ui:VisualElement name="child" /></ui:VisualElement>';

describe('a bordered parent', () => {
  const uss =
    '#parent {\n' +
    '  width: 200px; height: 150px; padding: 5px;\n' +
    '  border-top-width: 10px; border-right-width: 10px;\n' +
    '  border-bottom-width: 10px; border-left-width: 10px;\n' +
    '}\n' +
    '#child { width: 20px; height: 20px; }\n';

  it('places the child at border + padding in Yoga coordinates', () => {
    const { doc, result } = draw(NESTED, uss);
    const box = result.boxes.get(named(doc.root, 'child').id)!;
    // 10px border + 5px padding, measured from the parent's outer edge.
    expect(box.left).toBe(15);
    expect(box.top).toBe(15);
    result.dispose();
  });

  it('offsets the CSS position by the border, not by the whole box', () => {
    const { doc, result } = draw(NESTED, uss);
    const el = result.elements.get(named(doc.root, 'child').id)!;
    // The browser measures `left` from the padding box, which already starts
    // 10px in. Emitting 15px here would draw the child at 25px.
    expect(el.style.left).toBe('5px');
    expect(el.style.top).toBe('5px');
    result.dispose();
  });

  it('applies the same correction under the root element', () => {
    const rootBordered =
      ':root {\n  border-top-width: 12px; border-left-width: 12px;\n' +
      '  border-right-width: 12px; border-bottom-width: 12px;\n}\n' +
      '#child { width: 20px; height: 20px; }\n';
    const { doc, result } = draw('<ui:VisualElement name="child" />', rootBordered);
    expect(result.boxes.get(named(doc.root, 'child').id)!.left).toBe(12);
    expect(result.elements.get(named(doc.root, 'child').id)!.style.left).toBe('0px');
    result.dispose();
  });

  it('leaves an unbordered parent alone', () => {
    const { doc, result } = draw(NESTED, '#parent { padding: 5px; } #child { height: 20px; }');
    expect(result.elements.get(named(doc.root, 'child').id)!.style.left).toBe('5px');
    result.dispose();
  });
});

/**
 * The contract between the two layers, as an invariant rather than a case.
 *
 * The golden suite compares Yoga's coordinates against Unity and says nothing
 * about what the DOM does with them; the render tests check the DOM without a
 * reference to compare it to. The border bug lived in the gap between those two
 * for as long as it did because no test crossed it.
 *
 * Walking the painted tree and re-deriving each element's panel position from
 * its CSS closes that gap generally: whatever the painter does to a coordinate,
 * accumulating it back has to land on the number Yoga produced.
 */
function panelPosition(el: HTMLElement, rootEl: HTMLElement): { left: number; top: number } {
  const px = (value: string): number => (value === '' ? 0 : Number.parseFloat(value));
  let left = px(el.style.left);
  let top = px(el.style.top);

  for (let parent = el.parentElement; parent !== null; parent = parent.parentElement) {
    // A child's offsets are measured from the parent's padding box, so the
    // parent's border is part of the distance to the panel origin.
    left += px(parent.style.borderLeftWidth);
    top += px(parent.style.borderTopWidth);
    if (parent === rootEl) break;
    left += px(parent.style.left);
    top += px(parent.style.top);
  }
  return { left, top };
}

describe('CSS reproduces the Yoga geometry', () => {
  const cases: Array<[string, string, string]> = [
    [
      'bordered and padded ancestors',
      '<ui:VisualElement name="a"><ui:VisualElement name="b">' +
        '<ui:VisualElement name="c" /></ui:VisualElement></ui:VisualElement>',
      '#a { padding: 7px; border-top-width: 3px; border-left-width: 3px;' +
        ' border-right-width: 3px; border-bottom-width: 3px; }\n' +
        '#b { padding: 11px; border-top-width: 5px; border-left-width: 5px;' +
        ' border-right-width: 5px; border-bottom-width: 5px; }\n' +
        '#c { width: 20px; height: 20px; }\n',
    ],
    [
      'absolute inside a bordered parent',
      '<ui:VisualElement name="a"><ui:VisualElement name="b" /></ui:VisualElement>',
      '#a { width: 150px; height: 150px; border-top-width: 9px; border-left-width: 9px;' +
        ' border-right-width: 9px; border-bottom-width: 9px; }\n' +
        '#b { position: absolute; left: 12px; top: 30px; width: 20px; height: 20px; }\n',
    ],
    [
      'a bordered root',
      '<ui:VisualElement name="a"><ui:Label name="b" text="x" /></ui:VisualElement>',
      ':root { border-top-width: 6px; border-left-width: 6px;' +
        ' border-right-width: 6px; border-bottom-width: 6px; padding: 4px; }\n' +
        '#a { margin-top: 13px; }\n',
    ],
    [
      'margins and flex offsets',
      '<ui:VisualElement name="a" /><ui:VisualElement name="b" /><ui:VisualElement name="c" />',
      ':root { flex-direction: row; padding: 8px; }\n' +
        '#a, #b, #c { width: 40px; height: 40px; margin-left: 6px; margin-top: 9px; }\n',
    ],
  ];

  for (const [label, body, uss] of cases) {
    it(`agrees on every element — ${label}`, () => {
      const { doc, result } = draw(body, uss);
      const rootEl = result.elements.get(doc.root.id)!;

      for (const [id, box] of result.boxes) {
        const el = result.elements.get(id);
        if (el === undefined) continue;
        const derived = panelPosition(el, rootEl);
        expect(derived.left, `element ${id} left`).toBeCloseTo(box.left, 5);
        expect(derived.top, `element ${id} top`).toBeCloseTo(box.top, 5);
      }
      result.dispose();
    });
  }
});
