/**
 * Painting. Runs in jsdom because this is the part that needs a DOM.
 *
 * The two rules worth guarding here are negative ones: no z-index is ever
 * emitted, and box-sizing is always border-box. Both are invisible until
 * something overlaps or has padding, at which point the preview quietly stops
 * matching Unity.
 */

import { describe, it, expect, beforeAll } from 'vitest';

import { parse, render, loadLayoutEngine, liveNodeCount, NODE_ATTRIBUTE, PART_ATTRIBUTE } from '../../src/index';
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

function draw(
  body: string,
  uss = '',
  resolveAsset?: (p: string, form: 'url' | 'resource') => string | null,
) {
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

  it('reports a border width it cannot use instead of emitting nonsense', () => {
    // Appending "px" to a percentage produced `50%px`, which CSSOM drops in
    // silence; Yoga ignores the same declaration. Two layers losing it quietly
    // is what rule 6 exists to prevent.
    const { doc, result } = draw(
      '<ui:VisualElement name="a" />',
      '#a { border-top-width: 50%; width: 40px; height: 40px; }',
    );
    const el = result.elements.get(named(doc.root, 'a').id)!;
    expect(el.style.borderTopWidth).toBe('');
    expect(el.getAttribute('style')).not.toContain('%px');
    expect(result.warnings.some((w) => w.message.includes('border-top-width'))).toBe(true);
    result.dispose();
  });

  it('survives a numeric entity outside the Unicode range', () => {
    // String.fromCodePoint throws a RangeError on these. One bad character in
    // one attribute must not take down the render.
    const { doc, result } = draw('<ui:Label name="a" text="A &#xFFFFFF; B" />');
    expect(result.elements.get(named(doc.root, 'a').id)!.textContent).toBe('A &#xFFFFFF; B');
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

  // url() and resource() resolve differently — a path vs. Unity's Resources
  // folder convention — so the hook must be told which one it is seeing.
  // Quote and whitespace variants must not change what gets reported.
  it.each([
    ['url("project://database/Assets/x.png")', 'url', 'project://database/Assets/x.png'],
    ["url('project://database/Assets/x.png')", 'url', 'project://database/Assets/x.png'],
    ['url(project://database/Assets/x.png)', 'url', 'project://database/Assets/x.png'],
    ['resource("Sprites/x")', 'resource', 'Sprites/x'],
    ["resource( 'Sprites/x' )", 'resource', 'Sprites/x'],
    ['resource(Sprites/x)', 'resource', 'Sprites/x'],
  ] as const)('reports form %s for %s', (declaration, expectedForm, expectedPath) => {
    const calls: Array<{ path: string; form: string }> = [];
    const { result } = draw(
      '<ui:VisualElement name="a" />',
      `#a { background-image: ${declaration}; }`,
      (path, form) => {
        calls.push({ path, form });
        return 'data:,ok';
      },
    );
    expect(calls).toEqual([{ path: expectedPath, form: expectedForm }]);
    result.dispose();
  });
});

describe('inline style asset URLs are entity-decoded', () => {
  // A `<Style src>` path is already decoded before it reaches a host hook
  // (src/index.ts). An inline `style="…"` attribute's declarations are parsed
  // straight from the raw XML source (src/style/resolve.ts's
  // `inlineDeclarations`), so a `background-image` written there still carries
  // XML entities when it reaches `resolveAsset` — unlike the same URL written
  // in a .uss file, which was never XML and has none to begin with. This is
  // the asymmetry issue #2 names.
  //
  // The two real-corpus cases below are copied byte-for-byte (entities and
  // all) from ReuHomi/vscode-uxml-preview's examples/external corpus at
  // commit dbda387 — not constructed from the issue's illustrative example.

  it('decodes &apos;/&amp; from an inline style (observed in MessageBox-template.uxml)', () => {
    // examples/external/ui-toolkit-demos/Assets/Resources/UI/MessageBox/
    // MessageBox-template.uxml, the "Icon" element's style attribute.
    const calls: string[] = [];
    const { result } = draw(
      '<ui:VisualElement name="a" style="background-image: url(&apos;project://database/Assets/Sprites/Kenney/exclamation.png?fileID=21300000&amp;guid=280c9c4d95465894f891a7b62764c2af&amp;type=3#exclamation&apos;); width: 50px; height: 50px;" />',
      '',
      (path) => {
        calls.push(path);
        return 'data:,ok';
      },
    );
    expect(calls).toEqual([
      'project://database/Assets/Sprites/Kenney/exclamation.png?fileID=21300000&guid=280c9c4d95465894f891a7b62764c2af&type=3#exclamation',
    ]);
    result.dispose();
  });

  it('decodes &apos;/&amp; from an inline style (observed in MyGameUI.uxml)', () => {
    // examples/external/ui-toolkit-demos/Assets/Resources/UI/Game/MyGameUI.uxml,
    // the arrow icon's style attribute.
    const calls: string[] = [];
    const { result } = draw(
      '<ui:VisualElement style="background-color: rgba(0, 0, 0, 0); background-image: url(&apos;project://database/Assets/Sprites/Kenney/arrowUp.png?fileID=21300000&amp;guid=8306f1437a3a7784f9f6fd0ae0167d61&amp;type=3#arrowUp&apos;); width: 50px; height: 50px;" name="a" />',
      '',
      (path) => {
        calls.push(path);
        return 'data:,ok';
      },
    );
    expect(calls).toEqual([
      'project://database/Assets/Sprites/Kenney/arrowUp.png?fileID=21300000&guid=8306f1437a3a7784f9f6fd0ae0167d61&type=3#arrowUp',
    ]);
    result.dispose();
  });

  // Not observed in the external corpus (every real sample used &apos;); this
  // is the representative form decodeEntities also supports.
  it('decodes &quot;-quoted url() from an inline style (representative, not observed in the corpus)', () => {
    const calls: string[] = [];
    const { result } = draw(
      '<ui:VisualElement name="a" style="background-image: url(&quot;project://database/Assets/x.png&quot;);" />',
      '',
      (path) => {
        calls.push(path);
        return 'data:,ok';
      },
    );
    expect(calls).toEqual(['project://database/Assets/x.png']);
    result.dispose();
  });

  it('leaves a plain inline URL with no entities unchanged (regression)', () => {
    const calls: string[] = [];
    const { result } = draw(
      '<ui:VisualElement name="a" style="background-image: url(&apos;project://database/Assets/plain.png&apos;);" />',
      '',
      (path) => {
        calls.push(path);
        return 'data:,ok';
      },
    );
    expect(calls).toEqual(['project://database/Assets/plain.png']);
    result.dispose();
  });

  // The completion condition: the same asset URL, one written inline and one
  // written in USS, must reach resolveAsset as the same string. The USS side
  // needs no entities — a .uss file is not XML — so the inline side's decoded
  // output is checked against it rather than against an independently chosen
  // "correct" answer.
  it('inline style and an equivalent USS declaration reach resolveAsset with the same string', () => {
    const calls: string[] = [];
    const uxml =
      '<ui:VisualElement name="a" style="background-image: url(&apos;project://database/Assets/x.png?fileID=1&amp;guid=abc&apos;);" />' +
      '<ui:VisualElement name="b" />';
    const uss = "#b { background-image: url('project://database/Assets/x.png?fileID=1&guid=abc'); }";
    const { result } = draw(uxml, uss, (path) => {
      calls.push(path);
      return 'data:,ok';
    });
    expect(calls).toHaveLength(2);
    expect(calls[0]).toBe(calls[1]);
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

/**
 * S1 Step 1's completion check, at the layer a user actually sees: a control
 * this version has no renderer for must not remove anything from the screen.
 */
describe('controls with no renderer', () => {
  it('paints a Button that sits inside a ScrollView', () => {
    const { doc, result } = draw(
      '<ui:ScrollView name="s"><ui:Button name="b" text="Use" /></ui:ScrollView>',
    );
    const scrollView = result.elements.get(named(doc.root, 's').id);
    const button = result.elements.get(named(doc.root, 'b').id);
    expect(scrollView).toBeDefined();
    expect(button).toBeDefined();
    expect(scrollView!.contains(button!)).toBe(true);
    expect(button!.textContent).toBe('Use');
    result.dispose();
  });

  it('keeps provenance, so an editor can still trace the DOM back to the tree', () => {
    const { doc, result } = draw('<ui:Foldout name="f"><ui:Slider name="s" /></ui:Foldout>');
    for (const name of ['f', 's']) {
      const node = named(doc.root, name);
      const el = result.elements.get(node.id)!;
      expect(el.getAttribute(NODE_ATTRIBUTE)).toBe(String(node.id));
    }
    result.dispose();
  });

  it('draws them as plain boxes: styles still apply, text does not', () => {
    const { doc, result } = draw(
      '<ui:TextField name="t" text="typed" />',
      '#t { background-color: rgb(1, 2, 3); }',
    );
    const el = result.elements.get(named(doc.root, 't').id)!;
    expect(el.style.backgroundColor).toBe('rgb(1, 2, 3)');
    // Unity draws a TextField's text through a child element, so a fallback box
    // that painted it itself would put the text in the wrong place.
    expect(el.textContent).toBe('');
    result.dispose();
  });
});

/**
 * Unity's Button derives from TextElement: it draws its own text and holds no
 * child Label. Building `<button><span>` here would look right on screen and be
 * wrong the moment anything inside is measured or positioned (S1 plan §3.3).
 */
describe('Button', () => {
  it('draws its own text, with no child element to hold it', () => {
    const { doc, result } = draw('<ui:Button name="b" text="Use" />');
    const el = result.elements.get(named(doc.root, 'b').id)!;
    expect(el.textContent).toBe('Use');
    expect(el.children.length).toBe(0);
    result.dispose();
  });

  it('is measured as a leaf, so its box is its own', () => {
    const { doc, result } = draw('<ui:Button name="b" text="Use" />', '#b { font-size: 10px; }');
    const box = result.boxes.get(named(doc.root, 'b').id)!;
    // The stub measures half an em per character: 3 chars at 10px.
    expect(box.height).toBe(10);
    expect(result.elements.get(named(doc.root, 'b').id)!.children.length).toBe(0);
  });
});

/**
 * Parts a control builds for itself.
 *
 * Unity's ScrollView is one tag that becomes four elements, and a child of a
 * ScrollView is not a child of the ScrollView. The coordinates are checked
 * against Unity by tests/golden; what is checked here is the thing a dump
 * cannot see — that these exist in the DOM, nest in the right order, and are
 * distinguishable from elements the user actually wrote.
 */
describe('control parts', () => {
  it('nests the file\'s children inside the innermost part', () => {
    const { doc, result } = draw(
      '<ui:ScrollView name="s"><ui:VisualElement name="c" /></ui:ScrollView>',
      '#s { width: 100px; height: 60px; }',
    );
    const scrollView = result.elements.get(named(doc.root, 's').id)!;
    const child = result.elements.get(named(doc.root, 'c').id)!;

    const chain = ['unity-content-and-vertical-scroll-container', 'unity-content-viewport', 'unity-content-container'];
    let host: Element = scrollView;
    for (const name of chain) {
      const next = host.firstElementChild!;
      expect(next.getAttribute(PART_ATTRIBUTE)).toBe(name);
      host = next;
    }
    // The child hangs off the innermost part, not off the ScrollView.
    expect(child.parentElement).toBe(host);
    expect(child.parentElement).not.toBe(scrollView);
    result.dispose();
  });

  // A part has no node in the document, so an editor must be able to tell that
  // there is nothing here to edit. Borrowing the owner's id would answer "which
  // node is this?" with something that belongs to a different element.
  it('marks a part as a part, and never as a node', () => {
    const { doc, result } = draw('<ui:ScrollView name="s" />', '#s { width: 100px; height: 60px; }');
    const part = result.elements.get(named(doc.root, 's').id)!.firstElementChild!;
    expect(part.getAttribute(PART_ATTRIBUTE)).toBe('unity-content-and-vertical-scroll-container');
    expect(part.hasAttribute(NODE_ATTRIBUTE)).toBe(false);
    expect(part.getAttribute('data-uxml-part-owner')).toBe(String(named(doc.root, 's').id));
    result.dispose();
  });

  it('frees the part nodes too', () => {
    const before = liveNodeCount();
    const { result } = draw('<ui:ScrollView name="s"><ui:Label text="x" /></ui:ScrollView>');
    expect(liveNodeCount()).toBeGreaterThan(before + 3);
    result.dispose();
    expect(liveNodeCount()).toBe(before);
  });

  it('does not report ScrollView as unsupported any more', () => {
    const { result } = draw('<ui:ScrollView name="s" />');
    expect(result.warnings.filter((w) => w.kind === 'unsupported-control')).toHaveLength(0);
    result.dispose();
  });
});
