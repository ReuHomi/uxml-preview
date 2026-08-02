/**
 * Painting. Runs in jsdom because this is the part that needs a DOM.
 *
 * The two rules worth guarding here are negative ones: no z-index is ever
 * emitted, and box-sizing is always border-box. Both are invisible until
 * something overlaps or has padding, at which point the preview quietly stops
 * matching Unity.
 */

import { describe, it, expect, beforeAll } from 'vitest';

import { parse, render, loadLayoutEngine, liveNodeCount, NODE_ATTRIBUTE } from '../../src/index';
import type { MeasureText } from '../../src/index';
import type { ElementNode } from '../../src/model/types';

beforeAll(async () => {
  await loadLayoutEngine();
});

const measureText: MeasureText = (text, context) => ({
  width: text.length * context.fontSize * 0.5,
  height: context.fontSize,
});

function host(): HTMLElement {
  const el = document.createElement('div');
  document.body.replaceChildren(el);
  return el;
}

function draw(body: string, uss = '', resolveAsset?: (p: string) => string | null) {
  const doc = parse(`<ui:UXML xmlns:ui="UnityEngine.UIElements">${body}</ui:UXML>`, uss);
  const container = host();
  const result = render(doc, container, {
    size: { width: 200, height: 100 },
    measureText,
    ...(resolveAsset === undefined ? {} : { resolveAsset }),
  });
  return { doc, container, result };
}

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

describe('the painted DOM', () => {
  it('mirrors the element tree rather than flattening it', () => {
    const { container, result } = draw(
      '<ui:VisualElement name="p"><ui:VisualElement name="c" /></ui:VisualElement>',
    );
    const root = container.firstElementChild!;
    const p = root.firstElementChild!;
    expect(p.firstElementChild).not.toBeNull();
    result.dispose();
  });

  it('positions a nested box relative to its parent', () => {
    const { doc, result } = draw(
      '<ui:VisualElement name="p"><ui:VisualElement name="c" /></ui:VisualElement>',
      '#p { position: absolute; left: 10px; top: 10px; width: 50px; height: 50px; }' +
        '#c { position: absolute; left: 5px; top: 5px; width: 10px; height: 10px; }',
    );
    const c = result.elements.get(named(doc.root, 'c').id)!;
    // Yoga computed panel coordinates of 15,15; nested in a parent at 10,10 the
    // CSS offset must be the difference, not the absolute figure.
    expect(c.style.left).toBe('5px');
    expect(c.style.top).toBe('5px');
    result.dispose();
  });

  it('tags every element with its node id', () => {
    const { doc, result } = draw('<ui:VisualElement name="a" />');
    const el = result.elements.get(named(doc.root, 'a').id)!;
    expect(el.getAttribute(NODE_ATTRIBUTE)).toBe(String(named(doc.root, 'a').id));
    result.dispose();
  });
});

describe('overlap', () => {
  it('never emits z-index', () => {
    const { container, result } = draw(
      '<ui:VisualElement name="a" /><ui:VisualElement name="b" />',
      '#a, #b { position: absolute; left: 0; top: 0; width: 10px; height: 10px; }',
    );
    expect(container.innerHTML).not.toContain('z-index');
    result.dispose();
  });

  it('orders siblings so the later one paints on top', () => {
    const { doc, result } = draw(
      '<ui:VisualElement name="under" /><ui:VisualElement name="over" />',
    );
    const under = result.elements.get(named(doc.root, 'under').id)!;
    const over = result.elements.get(named(doc.root, 'over').id)!;
    // Same parent, and `over` comes second in the DOM, which is what decides
    // stacking once z-index is off the table.
    expect(under.parentElement).toBe(over.parentElement);
    expect(
      under.compareDocumentPosition(over) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    result.dispose();
  });
});

describe('box model', () => {
  it('always sets border-box', () => {
    const { doc, result } = draw('<ui:VisualElement name="a" />');
    expect(result.elements.get(named(doc.root, 'a').id)!.style.boxSizing).toBe('border-box');
    result.dispose();
  });

  it('keeps the CSS width equal to the USS width with padding and border', () => {
    const { doc, result } = draw(
      '<ui:VisualElement name="a" />',
      '#a { width: 100px; height: 40px; padding: 10px; border-width: 5px; }',
    );
    const el = result.elements.get(named(doc.root, 'a').id)!;
    expect(el.style.width).toBe('100px');
    expect(el.style.paddingTop).toBe('10px');
    expect(el.style.borderTopWidth).toBe('5px');
    expect(el.style.borderTopStyle).toBe('solid');
    result.dispose();
  });
});

describe('visual properties', () => {
  it('passes colours through', () => {
    const { doc, result } = draw(
      '<ui:VisualElement name="a" />',
      '#a { background-color: rgb(1, 2, 3); }',
    );
    expect(result.elements.get(named(doc.root, 'a').id)!.style.backgroundColor).toBe(
      'rgb(1, 2, 3)',
    );
    result.dispose();
  });

  it('maps -unity-font-style to weight and slant', () => {
    const { doc, result } = draw(
      '<ui:Label name="a" text="x" />',
      '#a { -unity-font-style: bold-and-italic; }',
    );
    const el = result.elements.get(named(doc.root, 'a').id)!;
    expect(el.style.fontWeight).toBe('bold');
    expect(el.style.fontStyle).toBe('italic');
    result.dispose();
  });

  it('splits -unity-text-align into both axes', () => {
    const { doc, result } = draw(
      '<ui:Label name="a" text="x" />',
      '#a { -unity-text-align: middle-center; }',
    );
    const el = result.elements.get(named(doc.root, 'a').id)!;
    expect(el.style.alignItems).toBe('center');
    expect(el.style.justifyContent).toBe('center');
    result.dispose();
  });

  it('warns about a property USS does not have', () => {
    const { result } = draw('<ui:VisualElement name="a" />', '#a { box-shadow: 0 0 4px red; }');
    expect(result.warnings.some((w) => w.message.includes('box-shadow'))).toBe(true);
    result.dispose();
  });
});

describe('text', () => {
  it('writes the text attribute as content', () => {
    const { doc, result } = draw('<ui:Button name="a" text="Use" />');
    expect(result.elements.get(named(doc.root, 'a').id)!.textContent).toBe('Use');
    result.dispose();
  });

  it('decodes entities for display while the model keeps them encoded', () => {
    const { doc, result } = draw('<ui:Label name="a" text="A &amp; B" />');
    expect(result.elements.get(named(doc.root, 'a').id)!.textContent).toBe('A & B');
    expect(named(doc.root, 'a').attributes.find((x) => x.name === 'text')!.value).toBe(
      'A &amp; B',
    );
    result.dispose();
  });
});

describe('assets', () => {
  const uss = '#a { background-image: url("project://database/Assets/x.png"); }';

  it('uses the resolver when it returns a url', () => {
    const { doc, result } = draw('<ui:VisualElement name="a" />', uss, () => 'data:,ok');
    expect(result.elements.get(named(doc.root, 'a').id)!.style.backgroundImage).toContain(
      'data:,ok',
    );
    result.dispose();
  });

  it('draws a placeholder and warns when it cannot', () => {
    const { doc, result } = draw('<ui:VisualElement name="a" />', uss, () => null);
    const el = result.elements.get(named(doc.root, 'a').id)!;
    expect(el.style.backgroundImage).toContain('repeating-linear-gradient');
    expect(result.warnings.some((w) => w.kind === 'asset-unresolved')).toBe(true);
    result.dispose();
  });
});

describe('lifecycle', () => {
  it('clears the container and frees Yoga nodes on dispose', () => {
    const before = liveNodeCount();
    const { container, result } = draw('<ui:VisualElement><ui:Label text="x" /></ui:VisualElement>');
    expect(container.children.length).toBe(1);
    result.dispose();
    expect(container.children.length).toBe(0);
    expect(liveNodeCount()).toBe(before);
  });

  it('does not leak across repeated renders', () => {
    const before = liveNodeCount();
    for (let i = 0; i < 15; i++) {
      const { result } = draw('<ui:VisualElement name="a" /><ui:Label text="y" />');
      result.dispose();
    }
    expect(liveNodeCount()).toBe(before);
  });
});
