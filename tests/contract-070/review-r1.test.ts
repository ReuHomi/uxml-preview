/**
 * 0.7.0 review fixes, first round (grok review 2026-10-20, human decision 2026-10-21):
 * S1, S3, Y1, and the missing warnings T2, T4, T5, T10.
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * S1 — a forced `disabled` is not also `:enabled`.
 *   Source: tests/layout/unity/<version>/probe-panel/e-disabled.json: an element forced disabled by the
 *   dumper (class force-disabled) carries the pseudo state Disabled alone (b-forced, ve-forced, l-forced).
 *   tests/layout/unity/<version>/probe-editor/v-enabled.json (probe probes-0.6.0/v-enabled.uxml): an
 *   element with Disabled does not take `.en:enabled { width: 77px }` (10px), every enabled one does (77px).
 *   So `states: { '#x': ['disabled'] }` must not leave `:enabled` matching; a later `:enabled` rule
 *   must not win over `:disabled`.
 * S3 — a state USS does not have is not applied. USS_STATES lists what Unity sets (CLAUDE.md, Unity
 *   "USS selectors: Pseudo-classes", 2026-10-13); `:selected` is not one, and the preview already warns
 *   that it never matches. Forcing it through `states` must not make a `:selected` rule apply.
 * Y1 — CLAUDE.md absolute rule 2: Yoga nodes are not garbage-collected. A measure function that throws
 *   during layout must not leave nodes behind; the error still reaches the caller.
 * T2 — rule 6, a value the preview does not apply is warned: a non-px `font-size` is measured as 12px
 *   (docs/uss-reference.md: font-size, px only) and nothing said so.
 * T4 — the editor theme's spacing warning ("drawn as advanced") must not fire when the author's
 *   `-unity-text-generator: standard` reaches the text by inheritance: the text is measured as standard.
 *   Written on the element itself it already does not fire; inheritance must be the same.
 * T5 — a `-unity-text-generator` value that is neither `standard` nor `advanced` is warned
 *   (invalid-value) and does not replace the theme's generator (runtime: standard, editor: advanced).
 * T10 — a host FaceInfo with a non-positive pointSize cannot be used (the height formula divides by it;
 *   it gave NaN). It is warned (invalid-value) and the text is measured as if no FaceInfo were given.
 */

import { beforeAll, describe, expect, it } from 'vitest';

import { liveNodeCount, loadLayoutEngine, parse, render } from '../../src/index';
import type { ElementNode, MeasureText, RenderResult, TextContext, Theme } from '../../src/index';

beforeAll(async () => {
  await loadLayoutEngine();
});

const doc = (body: string, uss?: string) => parse(`<ui:UXML xmlns:ui="UnityEngine.UIElements">${body}</ui:UXML>`, uss);
const fixed: MeasureText = (text, context) => ({ width: text.length * context.fontSize * 0.5, height: context.fontSize });

function byName(r: RenderResult, name: string): ElementNode {
  let found: ElementNode | undefined;
  const walk = (n: ElementNode): void => {
    if (n.attributes.some((a) => a.name === 'name' && a.value === name)) found = n;
    n.children.forEach(walk);
  };
  walk(r.document!.root);
  if (found === undefined) throw new Error(`no element named ${name}`);
  return found;
}
const box = (r: RenderResult, name: string) => r.boxes.get(byName(r, name).id)!;
const about = (r: RenderResult, property: string) =>
  r.warnings.filter((w) => w.subject?.kind === 'property' && w.subject.property === property);

describe('S1 — forced disabled is not enabled', () => {
  const USS = '.en { width: 10px; height: 10px; } .en:disabled { width: 20px; } .en:enabled { width: 77px; }';
  for (const theme of ['runtime', 'editor'] as const) {
    it(`${theme}: a later :enabled rule does not win on an element forced disabled`, () => {
      const r = render(doc('<ui:VisualElement name="f" class="en" /><ui:VisualElement name="plain" class="en" /><ui:VisualElement name="attr" class="en" enabled="false" />', USS),
        document.createElement('div'), { theme, size: { width: 400, height: 300 }, measureText: fixed, states: { '#f': ['disabled'] } });
      try {
        expect(box(r, 'plain').width, 'enabled: :enabled applies (v-enabled.json, 77px)').toBe(77);
        expect(box(r, 'attr').width, 'enabled="false": :disabled, not :enabled').toBe(20);
        expect(box(r, 'f').width, 'forced disabled: as enabled="false"').toBe(20);
      } finally {
        r.dispose();
      }
    });
  }
});

describe('S3 — a state USS does not have is not applied', () => {
  it(':selected forced through states changes nothing, and is still warned', () => {
    const USS = '.x { width: 10px; height: 10px; } .x:selected { width: 77px; }';
    const r = render(doc('<ui:VisualElement name="s" class="x" />', USS), document.createElement('div'),
      { size: { width: 400, height: 300 }, measureText: fixed, states: { '#s': ['selected'] } });
    try {
      expect(box(r, 's').width).toBe(10);
      expect(r.warnings.some((w) => w.message.includes('selected'))).toBe(true);
    } finally {
      r.dispose();
    }
  });
});

describe('Y1 — a measure that throws leaves no Yoga node', () => {
  it('render rethrows and frees the tree', () => {
    const before = liveNodeCount();
    const throwing: MeasureText = () => { throw new Error('measure failed'); };
    expect(() => render(doc('<ui:VisualElement><ui:Label text="x" /><ui:Button text="y" /><ui:Slider /></ui:VisualElement>'),
      document.createElement('div'), { size: { width: 400, height: 300 }, measureText: throwing })).toThrow('measure failed');
    expect(liveNodeCount()).toBe(before);
  });
});

describe('T2 — a font-size the preview does not measure is warned', () => {
  it('font-size: 200% is warned', () => {
    const r = render(doc('<ui:VisualElement style="font-size: 10px;"><ui:Label name="l" text="Hello" style="font-size: 200%;" /></ui:VisualElement>'),
      document.createElement('div'), { size: { width: 400, height: 300 }, measureText: fixed });
    try {
      expect(about(r, 'font-size').length).toBeGreaterThan(0);
    } finally {
      r.dispose();
    }
  });
});

describe('T4 — an inherited author generator counts as the author\'s', () => {
  const run = (uss: string) => {
    const seen: TextContext[] = [];
    const measure: MeasureText = (text, context, w) => { seen.push(context); return fixed(text, context, w); };
    const r = render(doc('<ui:VisualElement name="p"><ui:Label name="c" text="kid" /></ui:VisualElement>', uss),
      document.createElement('div'), { theme: 'editor', size: { width: 400, height: 300 }, measureText: measure });
    const warned = about(r, '-unity-text-generator').length;
    r.dispose();
    return { warned, generator: seen.at(-1)?.textGenerator };
  };
  it('inherited standard: measured standard, no "drawn as advanced" warning', () => {
    expect(run('#p { -unity-text-generator: standard; } #c { letter-spacing: 4px; }')).toEqual({ warned: 0, generator: 'standard' });
  });
  it('on the element itself: the same', () => {
    expect(run('#c { -unity-text-generator: standard; letter-spacing: 4px; }')).toEqual({ warned: 0, generator: 'standard' });
  });
  it('no author generator anywhere: still warned (Unity 6000.0 and 6.3 differ)', () => {
    expect(run('#c { letter-spacing: 4px; }').warned).toBe(1);
  });
});

describe('T5 — an unknown -unity-text-generator value', () => {
  for (const [theme, expected] of [['runtime', 'standard'], ['editor', 'advanced']] as Array<[Theme, string]>) {
    it(`${theme}: warned as invalid-value, and the theme's ${expected} stands`, () => {
      const seen: TextContext[] = [];
      const measure: MeasureText = (text, context, w) => { seen.push(context); return fixed(text, context, w); };
      const r = render(doc('<ui:Label name="l" text="bogus" />', 'Label { -unity-text-generator: bogus; }'),
        document.createElement('div'), { theme, size: { width: 400, height: 300 }, measureText: measure });
      try {
        expect(seen.at(-1)?.textGenerator).toBe(expected);
        expect(about(r, '-unity-text-generator').some((w) => w.reason === 'invalid-value')).toBe(true);
      } finally {
        r.dispose();
      }
    });
  }
});

describe('T10 — a FaceInfo with a non-positive pointSize', () => {
  const run = (faceInfo: { pointSize: number; ascentLine: number; descentLine: number; lineHeight?: number } | undefined) => {
    const seen: TextContext[] = [];
    const measure: MeasureText = (text, context, w) => { seen.push(context); return fixed(text, context, w); };
    const r = render(doc('<ui:Label name="l" text="Hello" style="-unity-font-definition: url(&quot;f.ttf&quot;);" />'),
      document.createElement('div'), {
        size: { width: 400, height: 300 }, measureText: measure,
        resolveFont: () => (faceInfo === undefined ? { family: 'F' } : { family: 'F', faceInfo }),
      });
    const out = { faceInfo: seen.at(-1)?.faceInfo, warned: r.warnings.filter((w) => w.reason === 'invalid-value').length };
    r.dispose();
    return out;
  };
  it('pointSize 0 is warned and not passed to the measurer', () => {
    const bad = run({ pointSize: 0, ascentLine: 80, descentLine: -20 });
    expect(bad.faceInfo).toBeUndefined();
    expect(bad.warned).toBeGreaterThan(0);
  });
  it('a usable FaceInfo is passed through, unwarned', () => {
    const good = run({ pointSize: 90, ascentLine: 80, descentLine: -20, lineHeight: 110 });
    expect(good.faceInfo?.pointSize).toBe(90);
    expect(good.warned).toBe(0);
  });
});
