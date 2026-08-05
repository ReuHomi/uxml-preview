// @vitest-environment node

/**
 * Layout through Yoga.
 *
 * These are the cases that decide whether the preview is worth anything: the
 * column default, border-box sizing, absolute positioning, and whether the
 * WASM nodes are actually freed. Text is measured by an injected stub so the
 * numbers do not move with the platform's fonts.
 */

import { describe, it, expect, beforeAll } from 'vitest';

import { parse, resolveStyles } from '../../src/index';
import { layoutDocument, liveNodeCount, loadLayoutEngine } from '../../src/layout/yoga';
import type { LayoutBox, MeasureText } from '../../src/layout/yoga';
import type { ElementNode, UxmlDocument } from '../../src/model/types';

beforeAll(async () => {
  await loadLayoutEngine();
});

/** Deterministic stand-in: every glyph is half an em wide, one line tall. */
const measureText: MeasureText = (text, context) => ({
  width: text.length * context.fontSize * 0.5,
  height: context.fontSize,
});

const SIZE = { width: 200, height: 100 };

function build(body: string, uss = ''): { doc: UxmlDocument; tree: ReturnType<typeof layoutDocument> } {
  const doc = parse(`<ui:UXML xmlns:ui="UnityEngine.UIElements">${body}</ui:UXML>`, uss);
  const { styles } = resolveStyles(doc);
  return { doc, tree: layoutDocument(doc.root, styles, { size: SIZE, measureText }) };
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

function box(
  body: string,
  uss: string,
  name: string,
): LayoutBox {
  const { doc, tree } = build(body, uss);
  const result = tree.boxes.get(named(doc.root, name).id)!;
  tree.dispose();
  return result;
}

const TWO =
  '<ui:VisualElement name="a" /><ui:VisualElement name="b" />';

describe('flex-direction', () => {
  it('defaults to column, not row', () => {
    // The single most common way to mis-port a stylesheet. If this ever reads
    // left: 100, every layout in the library is rotated ninety degrees.
    const a = box(TWO, '#a, #b { width: 50px; height: 20px; }', 'a');
    const b = box(TWO, '#a, #b { width: 50px; height: 20px; }', 'b');
    expect(a.top).toBe(0);
    expect(b.top).toBe(20);
    expect(b.left).toBe(0);
  });

  it('stacks horizontally when row is asked for', () => {
    const uss = ':root { flex-direction: row; } #a, #b { width: 50px; height: 20px; }';
    expect(box(TWO, uss, 'b').left).toBe(50);
    expect(box(TWO, uss, 'b').top).toBe(0);
  });

  it('reverses when told to', () => {
    const uss = ':root { flex-direction: column-reverse; } #a, #b { height: 20px; }';
    expect(box(TWO, uss, 'a').top).toBe(80);
  });
});

describe('box model', () => {
  const one = '<ui:VisualElement name="a" />';

  it('keeps width inclusive of padding and border', () => {
    const b = box(one, '#a { width: 100px; padding: 10px; border-width: 5px; height: 40px; }', 'a');
    expect(b.width).toBe(100);
  });

  it('does not collapse margins between siblings', () => {
    const uss = '#a, #b { height: 20px; margin-bottom: 10px; margin-top: 10px; }';
    // CSS would collapse the 10px pair into one. USS does not.
    expect(box(TWO, uss, 'b').top).toBe(50);
  });

  it('leaves a percentage unresolved when the parent has no size', () => {
    const nested =
      '<ui:VisualElement name="p"><ui:VisualElement name="c" /></ui:VisualElement>';
    const uss = '#c { width: 50%; height: 10px; }';
    // The parent stretches to the panel width here, so the percentage does
    // resolve. The point is that it is the parent's resolved width that decides.
    expect(box(nested, uss, 'c').width).toBe(100);
  });
});

describe('position', () => {
  const overlay =
    '<ui:VisualElement name="under" /><ui:VisualElement name="over" />';

  it('places an absolute element at its offsets', () => {
    const uss =
      '#over { position: absolute; left: 30px; top: 40px; width: 10px; height: 10px; }';
    const b = box(overlay, uss, 'over');
    expect(b.left).toBe(30);
    expect(b.top).toBe(40);
  });

  it('takes an absolute element out of the flow', () => {
    const uss =
      '#under { height: 20px; } #over { position: absolute; top: 0; height: 20px; }';
    expect(box(overlay, uss, 'under').top).toBe(0);
  });

  it('nests absolute inside absolute', () => {
    const nested =
      '<ui:VisualElement name="p"><ui:VisualElement name="c" /></ui:VisualElement>';
    const uss =
      '#p { position: absolute; left: 10px; top: 10px; width: 50px; height: 50px; }' +
      '#c { position: absolute; left: 5px; top: 5px; width: 10px; height: 10px; }';
    const b = box(nested, uss, 'c');
    expect(b.left).toBe(15);
    expect(b.top).toBe(15);
  });

  it('warns that fixed is not a USS position', () => {
    const { tree } = build('<ui:VisualElement name="a" />', '#a { position: fixed; }');
    expect(tree.warnings.some((w) => w.message.includes('position: fixed'))).toBe(true);
    tree.dispose();
  });
});

describe('flex sizing', () => {
  it('shares free space by flex-grow', () => {
    const uss = '#a { flex-grow: 1; } #b { flex-grow: 3; }';
    expect(box(TWO, uss, 'a').height).toBe(25);
    expect(box(TWO, uss, 'b').height).toBe(75);
  });

  it('stretches children across the cross axis by default', () => {
    expect(box(TWO, '#a { height: 10px; }', 'a').width).toBe(200);
  });

  it('honours align-items other than stretch', () => {
    const uss = ':root { align-items: center; } #a { width: 40px; height: 10px; }';
    expect(box(TWO, uss, 'a').left).toBe(80);
  });

  it('honours justify-content', () => {
    const uss = ':root { justify-content: flex-end; } #a, #b { height: 20px; }';
    expect(box(TWO, uss, 'b').top).toBe(80);
  });
});

describe('text', () => {
  it('takes its main-axis size from the measurement', () => {
    const b = box('<ui:Label name="a" text="abcd" />', '#a { font-size: 10px; }', 'a');
    expect(b.height).toBe(10);
    // Not 20: the default align-items is stretch, so the cross axis is filled
    // regardless of what the text measures. The measurement only shows through
    // on the cross axis once stretching is turned off, as below.
    expect(b.width).toBe(200);
  });

  it('takes its cross-axis size from the measurement when not stretched', () => {
    const b = box(
      '<ui:Label name="a" text="abcd" />',
      '#a { font-size: 10px; align-self: flex-start; }',
      'a',
    );
    expect(b.width).toBe(20);
  });

  it('uses the inherited font size', () => {
    const nested = '<ui:VisualElement name="p"><ui:Label name="c" text="ab" /></ui:VisualElement>';
    expect(box(nested, '#p { font-size: 20px; }', 'c').height).toBe(20);
  });

  it('warns when a text control also has children', () => {
    const { tree } = build('<ui:Label name="a" text="x"><ui:Label text="y" /></ui:Label>');
    expect(tree.warnings.some((w) => w.message.includes('children are not drawn'))).toBe(true);
    tree.dispose();
  });
});

describe('display', () => {
  it('removes a none element from the flow', () => {
    const uss = '#a { display: none; height: 20px; } #b { height: 20px; }';
    expect(box(TWO, uss, 'b').top).toBe(0);
  });
});

/**
 * The fallback is the default path, not an error path (S1 plan §5.3). A control
 * this version has no renderer for is drawn as a plain VisualElement, because a
 * screen that silently loses a subtree is worse than one drawn approximately.
 */
describe('controls with no renderer', () => {
  it('are laid out as plain boxes, and reported once each', () => {
    const { doc, tree } = build('<ui:ScrollView name="s"><ui:Label name="l" text="x" /></ui:ScrollView>');
    expect(tree.boxes.has(named(doc.root, 's').id)).toBe(true);
    expect(tree.warnings.filter((w) => w.kind === 'unsupported-control')).toHaveLength(1);
    tree.dispose();
  });

  it('do not take their children down with them', () => {
    const { doc, tree } = build(
      '<ui:ScrollView name="s"><ui:Button name="b" text="ok" /></ui:ScrollView>',
      '#s { width: 80px; height: 40px; } #b { height: 10px; }',
    );
    const button = tree.boxes.get(named(doc.root, 'b').id)!;
    expect(button).toBeDefined();
    expect(button.height).toBe(10);
    // Laid out *through* the fallback: stretched by the ScrollView's cross axis,
    // which only happens if the fallback is a real parent in the Yoga tree.
    // 80 less Unity's default Button margin of 3px a side (src/controls/theme.ts).
    expect(button.width).toBe(74);
    tree.dispose();
  });

  it('nest, so an unknown control inside an unknown control still draws', () => {
    const { doc, tree } = build(
      '<ui:Foldout name="f"><ui:Slider name="s"><ui:Label name="l" text="x" /></ui:Slider></ui:Foldout>',
    );
    for (const name of ['f', 's', 'l']) {
      expect(tree.boxes.has(named(doc.root, name).id)).toBe(true);
    }
    expect(tree.warnings.filter((w) => w.kind === 'unsupported-control')).toHaveLength(2);
    tree.dispose();
  });

  it('say that a text attribute they carry is not drawn', () => {
    const { tree } = build('<ui:Foldout name="f" text="Stats" />');
    const warning = tree.warnings.find((w) => w.kind === 'unsupported-control')!;
    expect(warning.message).toContain('text attribute is not drawn');
    tree.dispose();
  });

  // Everything deriving from BaseField calls its caption `label`, so a warning
  // that only looked at `text` would let a Toggle's caption vanish in silence.
  it('say the same about a label attribute', () => {
    const { tree } = build('<ui:Toggle name="t" label="Enabled" />');
    const warning = tree.warnings.find((w) => w.kind === 'unsupported-control')!;
    expect(warning.message).toContain('label attribute is not drawn');
    tree.dispose();
  });

  it('name both when a control carries both', () => {
    const { tree } = build('<ui:TextField name="t" label="Name" text="typed" />');
    const warning = tree.warnings.find((w) => w.kind === 'unsupported-control')!;
    expect(warning.message).toContain('text and label attributes are not drawn');
    tree.dispose();
  });

  it('stay quiet about an empty caption', () => {
    const { tree } = build('<ui:Toggle name="t" label="" />');
    const warning = tree.warnings.find((w) => w.kind === 'unsupported-control')!;
    expect(warning.message).not.toContain('not drawn');
    tree.dispose();
  });

  it('do not report the document element, which is the panel box', () => {
    const { tree } = build('<ui:VisualElement name="a" />');
    expect(tree.warnings.filter((w) => w.kind === 'unsupported-control')).toHaveLength(0);
    tree.dispose();
  });

  it('do not report Image, which has a renderer of its own', () => {
    const { doc, tree } = build('<ui:Image name="i" />', '#i { width: 40px; height: 40px; }');
    expect(tree.warnings.filter((w) => w.kind === 'unsupported-control')).toHaveLength(0);
    // A box, not a text control: an Image draws a texture and has no caption.
    expect(tree.boxes.get(named(doc.root, 'i').id)!.width).toBe(40);
    tree.dispose();
  });
});

describe('node ownership', () => {
  it('frees every Yoga node on dispose', () => {
    const before = liveNodeCount();
    const { tree } = build('<ui:VisualElement><ui:Label text="x" /></ui:VisualElement>');
    expect(liveNodeCount()).toBeGreaterThan(before);
    tree.dispose();
    expect(liveNodeCount()).toBe(before);
  });

  it('survives repeated render and dispose without leaking', () => {
    const before = liveNodeCount();
    for (let i = 0; i < 20; i++) {
      const { tree } = build(TWO, '#a { height: 10px; }');
      tree.dispose();
    }
    expect(liveNodeCount()).toBe(before);
  });

  it('ignores a second dispose', () => {
    const before = liveNodeCount();
    const { tree } = build(TWO);
    tree.dispose();
    tree.dispose();
    expect(liveNodeCount()).toBe(before);
  });
});
