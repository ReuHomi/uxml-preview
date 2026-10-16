/**
 * 0.6.0 bundle 2 — text height, spacing and fonts, from Unity dumps.
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Every number comes from Unity, never from this renderer:
 *
 *   - FaceInfo (pointSize, ascentLine, descentLine, lineHeight) was read from
 *     the FontAsset each font is drawn with, by the probe dumper, on 6000.0.40f1
 *     and 6000.3.25f1 (tests/text-cohort/unity/). Inter is the editor default,
 *     `Inter-Regular SDF`; the others are FontAssets Unity built from the font
 *     file. The ratio is not fitted: 1.2102 for Inter comes from FaceInfo.
 *   - Heights: Label ladders in tests/layout/unity/<version>/probe-editor
 *     (text-ladder, text-spacing) and tests/text-cohort/unity/.
 *     Formula, decision D3: ceil(lines × fontSize × (ascent − descent) / pointSize
 *     + paragraph breaks × paragraph-spacing × fontSize / 100). It matches 6.3
 *     LTS exactly. 6000.0 differs in two measured ways, recorded in the text
 *     cohort table rather than here: it rounds an exact integer up by one (Jua
 *     and DungGeunMo at 10px are 11 tall), and it advances lines by FaceInfo
 *     lineHeight (Jua two lines at 10px: 23, 6.3: 20).
 *   - Spacing: letter-spacing and word-spacing are not CSS px. Unity widens text
 *     by value × fontSize / 100 per gap (text-spacing, both versions). The
 *     standard generator spaces every gap between characters; the advanced
 *     generator (the 6.3 editor default) skips the gaps next to a space.
 *     Paragraph spacing adds value × fontSize / 100 per line break.
 *   - -unity-text-auto-size changes the box (text-autosize, 6.3): an auto-sized
 *     Label grew from 32x15 to 99x49. The registry's paint verdict was wrong;
 *     this preview still does not implement it (decision D6).
 */

import { beforeAll, describe, expect, it } from 'vitest';

import {
  createDefaultMeasureText,
  EDITOR_DEFAULT_FACE_INFO,
  loadLayoutEngine,
  parse,
  render,
  textHeight,
} from '../../src/index';
import type { FaceInfo, MeasureText, RenderOptions, RenderResult, TextContext, Warning } from '../../src/index';

beforeAll(async () => {
  await loadLayoutEngine();
});

const FACE: Record<string, FaceInfo> = {
  inter: { pointSize: 90, ascentLine: 87.1875, descentLine: -21.73295, lineHeight: 108.9205 },
  pretendard: { pointSize: 90, ascentLine: 85.64941, descentLine: -21.70898, lineHeight: 107.3584 },
  jua: { pointSize: 90, ascentLine: 72, descentLine: -18, lineHeight: 112.5 },
  dunggeunmo: { pointSize: 90, ascentLine: 73.125, descentLine: -16.875, lineHeight: 90 },
  wantedBold: { pointSize: 90, ascentLine: 85.69336, descentLine: -21.70898, lineHeight: 107.4023 },
};

describe('line height from FaceInfo (D3)', () => {
  it('the editor default is Inter-Regular SDF as Unity reports it', () => {
    expect(EDITOR_DEFAULT_FACE_INFO).toMatchObject({ pointSize: 90, ascentLine: 87.1875, descentLine: -21.73295 });
  });

  const ladder = [8, 10, 12, 14, 16, 20, 24, 32, 48];
  it('Inter ladder, one line: Unity 6000.0 and 6.3 agree', () => {
    expect(ladder.map((fs) => textHeight(1, fs, FACE.inter!))).toEqual([10, 13, 15, 17, 20, 25, 30, 39, 59]);
  });
  it('Pretendard ladder, one line', () => {
    expect(ladder.map((fs) => textHeight(1, fs, FACE.pretendard!))).toEqual([10, 12, 15, 17, 20, 24, 29, 39, 58]);
  });
  it('ratio-1 fonts on 6.3: exactly the font size', () => {
    for (const face of [FACE.jua!, FACE.dunggeunmo!]) {
      expect([10, 14, 20, 32].map((fs) => textHeight(1, fs, face))).toEqual([10, 14, 20, 32]);
    }
  });
  it('two lines: Inter 12 → 30, 20 → 49; Jua on 6.3 → 2 × font size', () => {
    expect(textHeight(2, 12, FACE.inter!)).toBe(30);
    expect(textHeight(2, 20, FACE.inter!)).toBe(49);
    expect([10, 14, 20, 32].map((fs) => textHeight(2, fs, FACE.jua!))).toEqual([20, 28, 40, 64]);
  });
  it('paragraph spacing 10 adds 10 × font size / 100 per break: Inter 12 → 31, 20 → 51', () => {
    expect(textHeight(2, 12, FACE.inter!, 1, 10)).toBe(31);
    expect(textHeight(2, 20, FACE.inter!, 1, 10)).toBe(51);
  });
  it('a bold face uses its own FaceInfo (Wanted Sans Bold 20 → 24)', () => {
    expect(textHeight(1, 20, FACE.wantedBold!)).toBe(24);
  });
});

describe('the default measurer', () => {
  const measure = createDefaultMeasureText();
  const ctx = (extra: Partial<TextContext>): TextContext => ({
    fontSize: 12,
    fontStyle: 'normal',
    whiteSpace: 'nowrap',
    ...extra,
  });

  it('uses the editor default FaceInfo when no font is given', () => {
    expect(measure('Hamburgefonts', ctx({}), 0).height).toBe(15);
    expect(measure('Hamburgefonts', ctx({ fontSize: 20 }), 0).height).toBe(25);
  });
  it('uses the FaceInfo it is given', () => {
    expect(measure('Hamburgefonts', ctx({ fontSize: 20, faceInfo: FACE.pretendard! }), 0).height).toBe(24);
  });
  it('adds paragraph spacing per line break', () => {
    expect(measure('P1\nP2', ctx({ whiteSpace: 'pre', paragraphSpacing: 10 }), 0).height).toBe(31);
  });

  // Unity's widening of "Hello World Foo" (15 characters, 2 spaces), from the
  // text-spacing dumps: [fontSize, letter, word, standard Δ (6000.0), advanced Δ (6000.3)].
  const UNITY_DELTAS: ReadonlyArray<readonly [number, number, number, number, number]> = [
    [12, 1, 0, 1, 1], [12, 2, 0, 3, 2], [12, 5, 0, 8, 7], [12, 0, 5, 1, 1], [12, 0, 10, 2, 2], [12, 2, 5, 4, 4],
    [20, 1, 0, 3, 2], [20, 2, 0, 6, 5], [20, 5, 0, 14, 12], [20, 0, 5, 2, 2], [20, 0, 10, 4, 4], [20, 2, 5, 8, 7],
  ];
  for (const [fs, ls, ws, standard, advanced] of UNITY_DELTAS) {
    it(`letter ${ls} word ${ws} at ${fs}px widens like Unity within 1px, per generator`, () => {
      const base = measure('Hello World Foo', ctx({ fontSize: fs }), 0).width;
      const spaced = (gen: 'standard' | 'advanced') =>
        measure('Hello World Foo', ctx({ fontSize: fs, letterSpacing: ls, wordSpacing: ws, textGenerator: gen }), 0).width - base;
      expect(Math.abs(spaced('standard') - standard)).toBeLessThanOrEqual(1);
      expect(Math.abs(spaced('advanced') - advanced)).toBeLessThanOrEqual(1);
    });
  }
});

const U = (body: string): string => `<ui:UXML xmlns:ui="UnityEngine.UIElements">${body}</ui:UXML>`;

function draw(body: string, uss: string | undefined, options: Partial<RenderOptions> = {}): RenderResult {
  return render(parse(U(body), uss), document.createElement('div'), { size: { width: 400, height: 300 }, ...options });
}

function aboutProperty(ws: readonly Warning[], property: string): Warning[] {
  return ws.filter((w) => w.subject?.kind === 'property' && w.subject.property === property);
}

describe('what reaches the measurer and the painter', () => {
  it('spacing and generator reach TextContext as written; the painter draws value × fontSize / 100', () => {
    const seen: TextContext[] = [];
    const spy: MeasureText = (text, c) => {
      seen.push(c);
      return { width: text.length * 6, height: c.fontSize };
    };
    const r = draw(
      '<ui:Label name="a" text="Hello World Foo" />',
      '#a { font-size: 20px; letter-spacing: 5px; word-spacing: 10px; -unity-paragraph-spacing: 10px; -unity-text-generator: standard; }',
      { measureText: spy },
    );
    try {
      expect(seen[0]).toMatchObject({ fontSize: 20, letterSpacing: 5, wordSpacing: 10, paragraphSpacing: 10, textGenerator: 'standard' });
      const label = [...r.elements.values()].find((e) => e.textContent === 'Hello World Foo')!;
      expect(label.style.letterSpacing).toBe('1px');
      expect(label.style.wordSpacing).toBe('2px');
      for (const p of ['letter-spacing', 'word-spacing', '-unity-paragraph-spacing']) {
        expect(aboutProperty(r.warnings, p)).toEqual([]);
      }
    } finally {
      r.dispose();
    }
  });

  it('without a -unity-text-generator the measurer is told advanced, the 6.3 editor default', () => {
    const seen: TextContext[] = [];
    const r = draw('<ui:Label text="x" />', undefined, {
      theme: 'editor', // 0.7.0: the runtime theme's default is standard (probe-panel); this is the editor's
      measureText: (t, c) => {
        seen.push(c);
        return { width: 6, height: c.fontSize };
      },
    });
    r.dispose();
    expect(seen[0]?.textGenerator).toBe('advanced');
  });
});

describe('fonts: the resolveFont hook (same shape as resolveAsset)', () => {
  const JUA_URL = 'project://database/Assets/Fonts/Jua-Regular.ttf';
  const uss = `#r { -unity-font-definition: url("${JUA_URL}"); font-size: 20px; }`;
  const body = '<ui:VisualElement name="r"><ui:Label name="a" text="Hello" /><ui:VisualElement><ui:Label name="b" text="World" /></ui:VisualElement></ui:VisualElement>';

  function run(resolveFont: RenderOptions['resolveFont']) {
    const seen: TextContext[] = [];
    const calls: Array<[string, string]> = [];
    const r = draw(body, uss, {
      ...(resolveFont === undefined
        ? {}
        : {
            resolveFont: (path, form) => {
              calls.push([path, form]);
              return resolveFont(path, form);
            },
          }),
      measureText: (t, c) => {
        seen.push(c);
        return { width: t.length * 6, height: c.fontSize };
      },
    });
    return { r, seen, calls };
  }

  it('no hook: the 0.5.1 not-rendered warning stays and nothing is resolved', () => {
    const { r, seen } = run(undefined);
    try {
      const ws = aboutProperty(r.warnings, '-unity-font-definition');
      expect(ws).toHaveLength(1);
      expect(ws[0]!.reason).toBe('not-rendered');
      expect(seen.every((c) => c.fontFamily === undefined)).toBe(true);
    } finally {
      r.dispose();
    }
  });

  it('a family name: called with path and form, inherited by both labels, measured and painted with it', () => {
    const { r, seen, calls } = run(() => 'Jua');
    try {
      expect(calls[0]).toEqual([JUA_URL, 'url']);
      expect(aboutProperty(r.warnings, '-unity-font-definition')).toEqual([]);
      expect(seen).toHaveLength(2);
      for (const c of seen) expect(c.fontFamily).toBe('Jua');
      for (const text of ['Hello', 'World']) {
        const el = [...r.elements.values()].find((e) => e.textContent === text)!;
        expect(el.style.fontFamily).toMatch(/Jua/);
      }
    } finally {
      r.dispose();
    }
  });

  it('a family with FaceInfo: the measurer gets the FaceInfo', () => {
    const { r, seen } = run(() => ({ family: 'Jua', faceInfo: FACE.jua! }));
    try {
      for (const c of seen) expect(c.faceInfo).toEqual(FACE.jua);
    } finally {
      r.dispose();
    }
  });

  it('null: asset-unresolved with role font, naming the path', () => {
    const { r } = run(() => null);
    try {
      const ws = r.warnings.filter((w) => w.kind === 'asset-unresolved');
      expect(ws).toHaveLength(1);
      expect(ws[0]!.subject).toEqual({ kind: 'asset', path: JUA_URL, form: 'url', role: 'font' });
      expect(ws[0]!.message).toContain(JUA_URL);
    } finally {
      r.dispose();
    }
  });

  it('resource() and -unity-font go through the same hook', () => {
    const calls: Array<[string, string]> = [];
    const r = draw('<ui:Label name="a" text="x" /><ui:Label name="b" text="y" />', '#a { -unity-font-definition: resource("Fonts/Jua SDF"); }\n#b { -unity-font: url("project://database/Assets/Fonts/Jua-Regular.ttf"); }', {
      resolveFont: (path, form) => {
        calls.push([path, form]);
        return 'Jua';
      },
      measureText: (t, c) => ({ width: 6, height: c.fontSize }),
    });
    r.dispose();
    expect(calls).toContainEqual(['Fonts/Jua SDF', 'resource']);
    expect(calls).toContainEqual(['project://database/Assets/Fonts/Jua-Regular.ttf', 'url']);
  });
});

describe('registry verdicts settled by the dumps', () => {
  it('-unity-text-auto-size is layout in Unity, not drawn here (D6)', () => {
    const r = draw('<ui:Label name="a" text="x" />', '#a { -unity-text-auto-size: best-fit 8px 40px; }', {
      measureText: (t, c) => ({ width: 6, height: c.fontSize }),
    });
    try {
      const ws = aboutProperty(r.warnings, '-unity-text-auto-size');
      expect(ws).toHaveLength(1);
      expect(ws[0]!.reason).toBe('not-rendered');
      expect(ws[0]!.subject).toMatchObject({ affectsLayout: true });
    } finally {
      r.dispose();
    }
  });
});
