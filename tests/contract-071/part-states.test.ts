import { beforeAll, describe, expect, it } from 'vitest';

import { loadLayoutEngine, parse, render } from '../../src/index';
import type { RenderResult } from '../../src/index';

beforeAll(async () => {
  await loadLayoutEngine();
});

const UXML = (body: string): string => `<ui:UXML xmlns:ui="UnityEngine.UIElements">${body}</ui:UXML>`;
const RED = /^(#ff0000|red|rgb\(255,\s*0,\s*0\))$/i;
const BLUE = /^(#0000ff|blue|rgb\(0,\s*0,\s*255\))$/i;
const GREEN = /^(#008000|green|rgb\(0,\s*128,\s*0\))$/i;

const measureText = (text: string, context: { fontSize: number }): { width: number; height: number } => ({
  width: text.length * context.fontSize * 0.55,
  height: context.fontSize * 1.2,
});

function renderDocument(uxml: string, uss: string, activeStates: ReadonlySet<string> = new Set()): {
  view: RenderResult;
  container: HTMLElement;
} {
  const doc = parse(uxml, uss);
  const container = document.createElement('div');
  document.body.append(container);
  const view = render(doc, container, {
    theme: 'runtime',
    size: { width: 400, height: 200 },
    activeStates,
    measureText,
  });
  return { view, container };
}

function part(container: HTMLElement, name: string): HTMLElement {
  const element = container.querySelector<HTMLElement>(`[data-uxml-part="${name}"]`);
  if (element === null) throw new Error(`missing part ${name}`);
  return element;
}

describe('control part states and engine classes', () => {
  it('passes hover from a TextField owner to its input part', () => {
    const uxml = UXML('<ui:TextField class="field" value="x" />');
    const uss = '.field .unity-text-field__input:hover { background-color: rgb(255, 0, 0); }';

    const plain = renderDocument(uxml, uss);
    expect(part(plain.container, 'unity-text-input').style.backgroundColor).not.toMatch(RED);
    plain.view.dispose();
    plain.container.remove();

    const hovered = renderDocument(uxml, uss, new Set(['hover']));
    expect(part(hovered.container, 'unity-text-input').style.backgroundColor).toMatch(RED);
    hovered.view.dispose();
    hovered.container.remove();
  });

  it('passes focus from a TextField owner to its input part', () => {
    const uxml = UXML('<ui:TextField class="field" value="x" />');
    const uss = '.field .unity-text-field__input:focus { background-color: rgb(0, 0, 255); }';
    const { view, container } = renderDocument(uxml, uss, new Set(['focus']));

    expect(part(container, 'unity-text-input').style.backgroundColor).toMatch(BLUE);
    view.dispose();
    container.remove();
  });

  it('applies author rules to a Toggle input part', () => {
    const uxml = UXML('<ui:Toggle class="check" value="true" />');
    const uss = '.check .unity-toggle__input { background-color: rgb(0, 128, 0); }';
    const { view, container } = renderDocument(uxml, uss);

    expect(part(container, 'unity-toggle__input').style.backgroundColor).toMatch(GREEN);
    view.dispose();
    container.remove();
  });

  it('applies author rules to a child Label through its unity-label class', () => {
    const uxml = UXML('<ui:Button class="with-icon"><ui:Label text="Save" /></ui:Button>');
    const uss = '.with-icon > .unity-label { color: rgb(255, 0, 0); }';
    const { view, container } = renderDocument(uxml, uss);

    const label = [...view.elements.values()].find((element) =>
      element.children.length === 0 && element.textContent === 'Save');
    expect(label).toBeDefined();
    expect(label!.style.color).toMatch(RED);
    view.dispose();
    container.remove();
  });
});
