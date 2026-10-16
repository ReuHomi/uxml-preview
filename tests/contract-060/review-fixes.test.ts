/**
 * 0.6.0 adversarial review (Grok, 2026-10-16) — findings reproduced against Unity
 * before anything was changed.
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Every expected number is read from a Unity dump in this test, not typed from
 * the implementation:
 *
 *   - #3 line heights: tests/layout/unity/<version>/probe-editor/lines.json —
 *     Labels of 1-4 explicit lines at 10/12/14/20/32px, padding 0, the editor
 *     default font, on 6000.0.40f1 and 6000.3.25f1 (2026-10-16). Inter 10px,
 *     three lines, is 37 on both.
 *   - #5 order-{hsl,cubic,filter}.json and filter-canary.json: a sibling BEFORE
 *     the element with the bad value keeps its style; that element and every
 *     element after it lose theirs. So the effect is "unstyled from here", not
 *     the whole panel. Exceptions: style-updater-exceptions.log.txt beside them.
 *   - #4 tests/text-cohort/results.json and tests/text-cohort/unity/: Inter has
 *     no Hangul; Unity draws Korean with a fallback font and the Label is 1-4px
 *     taller than this preview's (10px: 14 vs 13; 32px: 43 vs 39).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { createDefaultMeasureText, loadLayoutEngine, parse, render } from '../../src/index';
import type { RenderOptions, RenderResult, Warning } from '../../src/index';

beforeAll(async () => {
  await loadLayoutEngine();
});

const UNITY = join(process.cwd(), 'tests', 'layout', 'unity');
const dump = (version: string, file: string) =>
  JSON.parse(readFileSync(join(UNITY, version, 'probe-editor', file), 'utf8').replace(/\bNaN\b/g, 'null')) as {
    elements: Array<{ name: string; type: string; h: number; text?: string }>;
  };

describe('#3 explicit line breaks: the default measurer against Unity, cell by cell', () => {
  const measure = createDefaultMeasureText();
  for (const version of ['6000.0.40f1', '6000.3.25f1']) {
    it(`lines.json on ${version}: 20 Labels, 1-4 lines x 5 sizes`, () => {
      const labels = dump(version, 'lines.json').elements.filter((e) => e.type === 'Label');
      expect(labels).toHaveLength(20);
      for (const e of labels) {
        const [lines, size] = e.name.slice(1).split('-').map(Number) as [number, number];
        const text = Array.from({ length: lines }, (_, i) => `line${i + 1}`).join('\n');
        const ours = measure(text, { fontSize: size, fontStyle: 'normal', whiteSpace: 'pre' }, 0).height;
        expect(ours, `${e.name}`).toBe(e.h);
      }
      expect(labels.find((e) => e.name === 'l3-10')!.h).toBe(37);
    });
  }
});

describe('#5 a value Unity cannot apply stops styling from that element on', () => {
  const U = (body: string) => `<ui:UXML xmlns:ui="UnityEngine.UIElements">${body}</ui:UXML>`;
  const cases: ReadonlyArray<readonly [string, string, string, readonly string[], string]> = [
    ['hsl', 'background-color', 'background-color: hsl(120, 100%, 50%);', ['6000.3'], 'order-hsl.json'],
    ['cubic', 'transition-timing-function', 'transition-timing-function: cubic-bezier(0.1, 0.2, 0.3, 0.4);', ['6000.0', '6000.3'], 'order-cubic.json'],
    ['filter', 'filter', 'filter: blur(4px);', ['6000.0'], 'order-filter.json'],
  ];
  for (const [label, property, declaration, versions, file] of cases) {
    it(`${label}: unityEffect is unstyled-from-here on ${versions.join(', ')}, as the dumps show`, () => {
      for (const version of ['6000.0.40f1', '6000.3.25f1']) {
        const byName = new Map(dump(version, file).elements.map((e) => [e.name, e]));
        const broken = versions.includes(version.slice(0, 6));
        expect(byName.get('before')!.h, `${version} before`).toBe(10);
        expect(byName.get('target')!.h, `${version} target`).toBe(broken ? 0 : 10);
        expect(byName.get('canary')!.h, `${version} canary`).toBe(broken ? 0 : 7);
      }
      const r = render(parse(U('<ui:VisualElement name="a" />'), `#a { ${declaration} }`), document.createElement('div'), {
        size: { width: 400, height: 300 },
      });
      try {
        const ws = r.warnings.filter((w) => w.subject?.kind === 'property' && w.subject.property === property);
        expect(ws).toHaveLength(1);
        expect(ws[0]!.subject).toMatchObject({ unityEffect: { kind: 'unstyled-from-here', versions } });
      } finally {
        r.dispose();
      }
    });
  }
});

describe('#4 text the default font has no glyphs for', () => {
  const U = (body: string) => `<ui:UXML xmlns:ui="UnityEngine.UIElements">${body}</ui:UXML>`;
  function draw(body: string, uss?: string, extra: Partial<RenderOptions> = {}): RenderResult {
    return render(parse(U(body), uss), document.createElement('div'), {
      size: { width: 400, height: 300 },
      measureText: (t, c) => ({ width: t.length * 6, height: c.fontSize }),
      ...extra,
    });
  }
  const fallback = (ws: readonly Warning[]) =>
    ws.filter((w) => w.subject?.kind === 'property' && w.subject.property === '-unity-font-definition' && w.subject.missingGlyphs !== undefined);

  it('the measured basis: Inter on Hangul is taller in Unity than here, on 6.3', () => {
    const results = JSON.parse(readFileSync(join(process.cwd(), 'tests', 'text-cohort', 'results.json'), 'utf8')) as {
      rows: Array<{ version: string; name: string; unity: { h: number }; preview: { h: number } }>;
    };
    const ko = results.rows.filter((r) => r.version === '6000.3.25f1' && /^inter-(ko|mix)-\d+$/.test(r.name));
    expect(ko).toHaveLength(8);
    for (const r of ko) expect(r.unity.h).toBeGreaterThan(r.preview.h);
  });

  it('Hangul, Han and Kana in a Label drawn with the default font: one warning per element', () => {
    const r = draw('<ui:Label name="ko" text="한글 Label" /><ui:Label name="zh" text="漢字" /><ui:Label name="ja" text="かな" /><ui:Label name="en" text="Latin only" />');
    try {
      const ws = fallback(r.warnings);
      expect(ws.map((w) => (w.subject?.kind === 'property' ? w.subject.missingGlyphs : undefined))).toEqual(['hangul', 'han', 'kana']);
      for (const w of ws) {
        expect(w.kind).toBe('unsupported-property');
        expect(w.reason).toBe('not-rendered');
        expect(w.subject).toMatchObject({ affectsLayout: true });
        expect(w.node).toBeDefined();
        expect(w.message).toMatch(/fallback/i);
      }
    } finally {
      r.dispose();
    }
  });

  it('Button text counts too; a font the author set (resolved or not) does not get this warning', () => {
    const r = draw(
      '<ui:Button name="b" text="확인" /><ui:Label name="j" text="한글" /><ui:Label name="k" text="한글" />',
      '#j { -unity-font-definition: url("project://database/Assets/Fonts/Jua-Regular.ttf"); }\n#k { -unity-font-definition: resource("Fonts/Other"); }',
      { resolveFont: (path) => (path.endsWith('Jua-Regular.ttf') ? 'Jua' : null) },
    );
    try {
      expect(fallback(r.warnings)).toHaveLength(1);
    } finally {
      r.dispose();
    }
  });
});

describe('#1 (found while pinning it) repeated spaces: Unity 6.3 collapses them, as the browser paints', () => {
  // tests/layout/unity/<version>/probe-editor/spaces.json, 20px, padding 0:
  //   6000.3.25f1  "a b c" 47, "a  b  c" 47, "a     b     c" 47, "   abc" 35, pre "a  b  c" 58
  //   6000.0.40f1  "a b c" 47, "a  b  c" 58, "a     b     c" 92, "   abc" 52, pre "a  b  c" 58
  // 6.3 LTS is the reference; 6000.0 never collapsed. The measurer follows 6.3,
  // which is also what CSS paints, so the box and the glyphs agree.
  const measure = createDefaultMeasureText();
  const width = (text: string, whiteSpace: string) => measure(text, { fontSize: 20, fontStyle: 'normal', whiteSpace }, 0).width;

  it('the dumps say what is pinned below', () => {
    const w63 = new Map(dump('6000.3.25f1', 'spaces.json').elements.map((e) => [e.name, (e as unknown as { w: number }).w]));
    expect([w63.get('one'), w63.get('two'), w63.get('five'), w63.get('normal-two')]).toEqual([47, 47, 47, 47]);
    expect(w63.get('pre-two')).toBeGreaterThan(w63.get('two')!);
    expect(w63.get('lead')).toBeLessThan(w63.get('one')!);
  });

  for (const ws of ['nowrap', 'normal']) {
    it(`white-space: ${ws} — runs of spaces measure as one, leading spaces as none`, () => {
      expect(width('a  b  c', ws)).toBe(width('a b c', ws));
      expect(width('a     b     c', ws)).toBe(width('a b c', ws));
      expect(width('   abc', ws)).toBe(width('abc', ws));
    });
  }

  it('white-space: pre keeps them', () => {
    expect(width('a  b  c', 'pre')).toBeGreaterThan(width('a b c', 'pre'));
  });
});
