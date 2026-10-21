/**
 * 0.7.0 bundle A follow-up — when a theme earns a warning.
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Decision (2026-10-17, reversing the A2 judgement): a warning says the preview
 * draws something differently from Unity. Applying a measured theme value is not
 * a difference, so it is not warned. `version-dependent` is raised only where the
 * dumps show a value that differs between Unity versions.
 *
 * The version differences, from the dumps (every drawn control in c07-existing,
 * c07-states, nested-disabled, c07-TextElement; 6000.0.40f1 against 6000.3.25f1):
 *   - editor theme, a Button with no text: 4px high on 6000.0.40f1, 19px on
 *     6000.3.25f1 (probe-editor-070/c07-existing.json col/button-empty h). The
 *     preview's editor theme is 6000.0.40f1's, so it draws 4.
 *   - editor theme, the default text generator: Standard on 6000.0.40f1, Advanced on
 *     6000.3.25f1 (probe-editor-070/*.json unityTextGenerator). It decides how
 *     letter- and word-spacing fall beside spaces (0.6.0 text-spacing dumps). The
 *     preview draws Advanced, so text with spacing and no -unity-text-generator is
 *     version-dependent there.
 *   - runtime theme: none. Every box and resolved style is the same on both versions
 *     (theme-values.test.ts, first test), the empty Button 22px included. The runtime
 *     default generator is Standard on both (probe-panel/*.json unityTextGenerator), so
 *     the runtime theme measures with Standard and nothing is version-dependent.
 *   - ScrollView parts: the same on both versions and both themes (golden and
 *     golden-panel, 1012/1012), so no version warning either.
 */

import { beforeAll, describe, expect, it } from 'vitest';

import { loadLayoutEngine, parse, render } from '../../src/index';
import type { RenderResult, TextContext, Theme, Warning } from '../../src/index';

beforeAll(async () => {
  await loadLayoutEngine();
});

const U = (body: string) => `<ui:UXML xmlns:ui="UnityEngine.UIElements">${body}</ui:UXML>`;

function draw(theme: Theme, body: string, uss = '', seen: TextContext[] = []): RenderResult {
  return render(parse(U(body), uss), document.createElement('div'), {
    theme,
    size: { width: 400, height: 300 },
    measureText: (t, c) => {
      seen.push(c);
      return { width: t.length * 6, height: c.fontSize };
    },
  });
}

const versionWarnings = (r: RenderResult): Warning[] => r.warnings.filter((w) => w.kind === 'version-dependent' || w.reason === 'version-dependent');

describe('theme warnings', () => {
  for (const theme of ['runtime', 'editor'] as const) {
    it(`${theme}: a Label, a Button with text and a scrolling ScrollView raise no warning at all`, () => {
      const r = draw(
        theme,
        '<ui:Label text="Label" /><ui:Button text="Use" /><ui:ScrollView style="height: 40px;"><ui:VisualElement style="height: 200px;" /></ui:ScrollView>',
      );
      try {
        expect(r.warnings).toEqual([]);
      } finally {
        r.dispose();
      }
    });
  }

  it('editor: a Button with no text is version-dependent, once per Button, naming both heights', () => {
    const r = draw('editor', '<ui:Button name="a" /><ui:Button name="b" text="" /><ui:Button name="c" text="x" />');
    try {
      const ws = versionWarnings(r);
      expect(ws).toHaveLength(2);
      for (const w of ws) {
        expect(w.kind).toBe('version-dependent');
        expect(w.reason).toBe('version-dependent');
        expect(w.subject).toEqual({ kind: 'control', type: 'Button' });
        expect(w.message).toMatch(/6000\.0\.40f1/);
        expect(w.message).toMatch(/6000\.3\.25f1/);
        expect(w.message).toMatch(/\b4\s?px/);
        expect(w.message).toMatch(/\b19\s?px/);
      }
    } finally {
      r.dispose();
    }
  });

  it('runtime: a Button with no text is not version-dependent', () => {
    const r = draw('runtime', '<ui:Button />');
    try {
      expect(versionWarnings(r)).toEqual([]);
    } finally {
      r.dispose();
    }
  });

  it('editor: spacing without -unity-text-generator is version-dependent; naming the generator settles it', () => {
    const a = draw('editor', '<ui:Label name="s" text="a b" />', '#s { letter-spacing: 3px; }');
    const b = draw('editor', '<ui:Label name="s" text="a b" />', '#s { word-spacing: 3px; }');
    const c = draw('editor', '<ui:Label name="s" text="a b" />', '#s { letter-spacing: 3px; -unity-text-generator: advanced; }');
    const d = draw('editor', '<ui:Label name="s" text="a b" />');
    try {
      for (const r of [a, b]) {
        const ws = versionWarnings(r);
        expect(ws).toHaveLength(1);
        expect(ws[0]!.reason).toBe('version-dependent');
        expect(ws[0]!.subject).toMatchObject({ kind: 'property', property: '-unity-text-generator' });
        expect(ws[0]!.message).toMatch(/6000\.0\.40f1/);
        expect(ws[0]!.message).toMatch(/6000\.3\.25f1/);
        expect(ws[0]!.message).toMatch(/standard/i);
        expect(ws[0]!.message).toMatch(/advanced/i);
      }
      expect(versionWarnings(c)).toEqual([]);
      expect(versionWarnings(d)).toEqual([]);
    } finally {
      for (const r of [a, b, c, d]) r.dispose();
    }
  });

  it('runtime: spacing raises nothing, and text is measured with the standard generator', () => {
    const seen: TextContext[] = [];
    const r = draw('runtime', '<ui:Label name="s" text="a b" />', '#s { letter-spacing: 3px; }', seen);
    try {
      expect(versionWarnings(r)).toEqual([]);
      expect(seen.length).toBeGreaterThan(0);
      for (const c of seen) expect(c.textGenerator).toBe('standard');
    } finally {
      r.dispose();
    }
  });

  it('editor: text is still measured with the advanced generator (6000.3.25f1, the base version)', () => {
    const seen: TextContext[] = [];
    const r = draw('editor', '<ui:Label name="s" text="a b" />', '', seen);
    try {
      for (const c of seen) expect(c.textGenerator).toBe('advanced');
    } finally {
      r.dispose();
    }
  });
});
