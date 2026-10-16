/**
 * 0.6.0 bundle 1 — value-level judgements, from Unity dumps.
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Every Unity fact below was measured on 6000.0.40f1 and 6000.3.25f1 on
 * 2026-10-15 with the probes in tests/layout/unity/probes-0.6.0/ (dumps beside
 * them, `probe-editor/`), each value alone in its own panel with a canary
 * element styled by a later rule:
 *
 *   hsl()            6000.0: no import warning, drawn black. 6000.3: "Unknown
 *                    function 'hsl'", the style updater throws
 *                    (ArgumentOutOfRangeException in ApplyGlobalKeyword) and the
 *                    rest of the panel stays unstyled — the canary is 0x0.
 *                    (Narrowed 2026-10-16 by order-*.json: a sibling BEFORE the
 *                    value keeps its style; that element and every later one lose
 *                    theirs. The effect is named unstyled-from-here.)
 *   cubic-bezier()   both: "Unknown function", same throw, panel unstyled.
 *   filter: blur()   6000.0 (filter is 6.3+): "Unknown property 'filter'" and
 *                    "Unknown function 'blur'", same throw. 6000.3: valid.
 *   inline 10em      both: "Unsupported unit" import error, and EVERY inline
 *                    style in that UXML file is dropped (inline-poison-em).
 *   opacity: 50%     both: "Expected (<number>)", resolved opacity is 50.
 *   color: inherit   both: "Expected (<color>)", resolved colour is transparent.
 *   linear-gradient  both: "Expected (<resource> | <url> | none)", and the
 *                    resolved background image is Unity's warning icon.
 *   space-evenly     both: applied — three 50px cells in a 300px row land at
 *                    x = 38, 125, 213. (The 6.3 property page lists only
 *                    space-around; the measurement wins.)
 *   :enabled         both: matches every enabled element with no states given;
 *                    an enabled="false" element does not match.
 *
 * Decisions D4/D5 (2026-10-16): draw what the author meant, not Unity's broken
 * panel, and say in the warning what Unity does instead —
 * `subject.unityEffect = { kind, versions }`, reason `invalid-value`.
 *
 * One deliberate deviation from D4, flagged in the 0.6.0 report: `filter` keeps
 * reason `not-rendered`. It is valid USS on 6.3 LTS, the reference version;
 * calling it invalid-value would make consumers file a correct 6.3 document as
 * a defect. It gets the same unityEffect with versions ['6000.0'].
 */

import { beforeAll, describe, expect, it } from 'vitest';

import { loadLayoutEngine, parse, render } from '../../src/index';
import type { ElementNode, NodeId, RenderResult, Warning } from '../../src/index';

beforeAll(async () => {
  await loadLayoutEngine();
});

const U = (body: string): string => `<ui:UXML xmlns:ui="UnityEngine.UIElements">${body}</ui:UXML>`;

function draw(body: string, uss?: string): RenderResult {
  return render(parse(U(body), uss), document.createElement('div'), {
    size: { width: 400, height: 300 },
    measureText: (text, ctx) => ({ width: text.length * 6, height: ctx.fontSize }),
  });
}

function aboutProperty(warnings: readonly Warning[], property: string): Warning[] {
  return warnings.filter((w) => w.subject?.kind === 'property' && w.subject.property === property);
}

function named(result: RenderResult, name: string): NodeId {
  let found: NodeId | undefined;
  const walk = (n: ElementNode): void => {
    if (n.attributes.some((a) => a.name === 'name' && a.value === name)) found = n.id;
    n.children.forEach(walk);
  };
  walk(result.document!.root);
  return found!;
}

function styleOf(result: RenderResult, name: string): CSSStyleDeclaration {
  return result.elements.get(named(result, name))!.style;
}

describe('values that make Unity stop styling from that element on', () => {
  it('hsl(): drawn as written; the warning says 6.3 stops styling from here', () => {
    const r = draw('<ui:VisualElement name="a" />', '#a { width: 10px; height: 10px; background-color: hsl(120, 100%, 50%); }');
    try {
      const ws = aboutProperty(r.warnings, 'background-color');
      expect(ws).toHaveLength(1);
      expect(ws[0]!.kind).toBe('unsupported-property');
      expect(ws[0]!.reason).toBe('invalid-value');
      expect(ws[0]!.subject).toMatchObject({
        kind: 'property',
        property: 'background-color',
        value: 'hsl(120, 100%, 50%)',
        unityEffect: { kind: 'unstyled-from-here', versions: ['6000.3'] },
      });
      expect(ws[0]!.message).toMatch(/Unity/);
      expect(styleOf(r, 'a').backgroundColor).toBe('rgb(0, 255, 0)');
    } finally {
      r.dispose();
    }
  });

  it('cubic-bezier(): one warning for the declaration, on both versions', () => {
    const r = draw('<ui:VisualElement name="a" />', '#a { transition-timing-function: cubic-bezier(0.1, 0.2, 0.3, 0.4); }');
    try {
      const ws = aboutProperty(r.warnings, 'transition-timing-function');
      expect(ws).toHaveLength(1);
      expect(ws[0]!.reason).toBe('invalid-value');
      expect(ws[0]!.subject).toMatchObject({ unityEffect: { kind: 'unstyled-from-here', versions: ['6000.0', '6000.3'] } });
    } finally {
      r.dispose();
    }
  });

  it('filter with a function: still not drawn, and 6000.0 stops styling from here', () => {
    const r = draw('<ui:VisualElement name="a" />', '#a { filter: blur(4px); }');
    try {
      const ws = aboutProperty(r.warnings, 'filter');
      expect(ws).toHaveLength(1);
      expect(ws[0]!.reason).toBe('not-rendered');
      expect(ws[0]!.subject).toMatchObject({ since: '6000.3', unityEffect: { kind: 'unstyled-from-here', versions: ['6000.0'] } });
    } finally {
      r.dispose();
    }
  });

  it("an unsupported unit inline drops the file's inline styles in Unity; here the others still apply", () => {
    const r = draw('<ui:VisualElement name="a" style="width: 10em; height: 5px;" /><ui:VisualElement name="b" style="width: 30px; height: 4px;" />');
    try {
      const ws = aboutProperty(r.warnings, 'width');
      expect(ws).toHaveLength(1);
      expect(ws[0]!.reason).toBe('invalid-value');
      expect(ws[0]!.subject).toMatchObject({ value: '10em', unityEffect: { kind: 'file-inline-dropped', versions: ['6000.0', '6000.3'] } });
      expect(r.boxes.get(named(r, 'b'))).toMatchObject({ width: 30, height: 4 });
      expect(r.boxes.get(named(r, 'a'))!.height).toBe(5);
    } finally {
      r.dispose();
    }
  });

  it('the same unit in a stylesheet is not claimed to drop anything (unmeasured)', () => {
    const r = draw('<ui:VisualElement name="a" />', '#a { width: 10em; }');
    try {
      const ws = aboutProperty(r.warnings, 'width');
      expect(ws).toHaveLength(1);
      expect(ws[0]!.subject).not.toHaveProperty('unityEffect');
    } finally {
      r.dispose();
    }
  });

  it('a valid colour gets no warning at all', () => {
    const r = draw('<ui:VisualElement name="a" />', '#a { background-color: rgb(0, 255, 0); }');
    try {
      expect(aboutProperty(r.warnings, 'background-color')).toEqual([]);
    } finally {
      r.dispose();
    }
  });
});

describe('values Unity reads differently from a browser', () => {
  it('opacity: 50% — Unity resolves 50, not 0.5', () => {
    const r = draw('<ui:VisualElement name="a" />', '#a { opacity: 50%; }');
    try {
      const ws = aboutProperty(r.warnings, 'opacity');
      expect(ws).toHaveLength(1);
      expect(ws[0]!.reason).toBe('invalid-value');
      expect(ws[0]!.subject).toMatchObject({ value: '50%' });
      expect(ws[0]!.subject).not.toHaveProperty('unityEffect');
    } finally {
      r.dispose();
    }
  });

  it('inherit — USS documents only initial; Unity resolved the colour to transparent', () => {
    const r = draw('<ui:VisualElement name="a" />', '#a { color: inherit; }');
    try {
      const ws = aboutProperty(r.warnings, 'color');
      expect(ws).toHaveLength(1);
      expect(ws[0]!.reason).toBe('invalid-value');
      expect(ws[0]!.subject).toMatchObject({ value: 'inherit' });
    } finally {
      r.dispose();
    }
  });

  it('initial is USS and stays silent', () => {
    const r = draw('<ui:VisualElement name="a" />', '#a { color: initial; }');
    try {
      expect(aboutProperty(r.warnings, 'color')).toEqual([]);
    } finally {
      r.dispose();
    }
  });

  it('linear-gradient — the warning says Unity shows its warning icon', () => {
    const r = draw('<ui:VisualElement name="a" />', '#a { background-image: linear-gradient(red, blue); }');
    try {
      const ws = aboutProperty(r.warnings, 'background-image');
      expect(ws).toHaveLength(1);
      expect(ws[0]!.reason).toBe('not-uss');
      expect(ws[0]!.message).toMatch(/icon/i);
    } finally {
      r.dispose();
    }
  });
});

describe('values Unity applies', () => {
  it('space-evenly: no warning, and the cells land where Unity put them', () => {
    const r = draw(
      '<ui:VisualElement name="row"><ui:VisualElement name="c1" class="cell" /><ui:VisualElement name="c2" class="cell" /><ui:VisualElement name="c3" class="cell" /></ui:VisualElement>',
      '#row { flex-direction: row; justify-content: space-evenly; width: 300px; height: 20px; }\n.cell { width: 50px; height: 10px; }',
    );
    try {
      expect(aboutProperty(r.warnings, 'justify-content')).toEqual([]);
      const xs = ['c1', 'c2', 'c3'].map((n) => r.boxes.get(named(r, n))!.left);
      [38, 125, 213].forEach((unity, i) => expect(Math.abs(xs[i]! - unity)).toBeLessThanOrEqual(0.5));
    } finally {
      r.dispose();
    }
  });

  it(':enabled applies to every enabled element without any states', () => {
    const r = draw(
      '<ui:VisualElement name="on" class="c" /><ui:VisualElement name="off" class="c" enabled="false" />',
      '.c { width: 10px; height: 10px; }\n.c:enabled { width: 77px; }',
    );
    try {
      expect(r.boxes.get(named(r, 'on'))!.width).toBe(77);
      expect(r.boxes.get(named(r, 'off'))!.width).toBe(10);
    } finally {
      r.dispose();
    }
  });
});
