/**
 * 0.7.0 bundle A, step A1 — the `theme` option, plumbing only.
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Decided 2026-10-17 (docs/design/0.7.0-bundle-A-plan.md): `RenderOptions.theme`
 * is `'runtime' | 'editor'`; `'editor'` is the dark editor theme, there is no
 * light one; `RenderResult.theme` says which theme was drawn. The default becomes
 * `'runtime'` in step A3. Until then it is `'editor'`, and nothing drawn today may
 * change: A1 only carries the choice through.
 *
 * DEFAULT_THEME is the one line step A3 replaces (the A3 brief allows exactly that).
 *
 * An unknown value (a JavaScript caller, or a host passing a setting through) is not
 * an error (CLAUDE.md absolute rule 6): one warning, kind `malformed` — the option
 * text itself is malformed, nothing in the document is — reason `invalid-value`, and
 * the default theme is drawn.
 */

import { beforeAll, describe, expect, it } from 'vitest';

import { loadLayoutEngine, parse, render, resolveStyles } from '../../src/index';
import type { RenderOptions, RenderResult, Theme, UxmlDocument } from '../../src/index';
import { layoutDocument } from '../../src/layout/yoga';

const DEFAULT_THEME: Theme = 'editor';

beforeAll(async () => {
  await loadLayoutEngine();
});

// Every place a theme can reach: a Button (theme margins), a Label, a disabled
// subtree, an overflowing ScrollView (theme scrollbar width).
const UXML = `<ui:UXML xmlns:ui="UnityEngine.UIElements">
  <ui:Button name="b" text="Use" />
  <ui:Label name="l" text="Label" />
  <ui:VisualElement name="off" enabled="false"><ui:Button name="b2" text="Drop" /></ui:VisualElement>
  <ui:ScrollView name="sv" style="width: 200px; height: 100px;">
    <ui:VisualElement style="height: 300px;" />
  </ui:ScrollView>
</ui:UXML>`;

const MEASURE: RenderOptions['measureText'] = (t, c) => ({ width: t.length * 7, height: c.fontSize + 3 });

function draw(options: Partial<RenderOptions>): { result: RenderResult; html: string; boxes: string } {
  const doc: UxmlDocument = parse(UXML);
  const container = document.createElement('div');
  const result = render(doc, container, { size: { width: 400, height: 300 }, measureText: MEASURE, ...options });
  const boxes = JSON.stringify([...result.boxes].map(([id, b]) => [id, b.left, b.top, b.width, b.height]));
  return { result, html: container.innerHTML, boxes };
}

describe('theme option (A1)', () => {
  it(`no option draws the default theme, ${DEFAULT_THEME}, and says so`, () => {
    const d = draw({});
    try {
      expect(d.result.theme).toBe(DEFAULT_THEME);
    } finally {
      d.result.dispose();
    }
  });

  it('an explicit default is the same drawing as no option', () => {
    const a = draw({});
    const b = draw({ theme: DEFAULT_THEME });
    try {
      expect(b.result.theme).toBe(DEFAULT_THEME);
      expect(b.html).toBe(a.html);
      expect(b.boxes).toBe(a.boxes);
      expect(b.result.warnings).toEqual(a.result.warnings);
    } finally {
      a.result.dispose();
      b.result.dispose();
    }
  });

  it.each(['editor', 'runtime'] as const)('theme %s is recorded on the result', (theme) => {
    const d = draw({ theme });
    try {
      expect(d.result.theme).toBe(theme);
      expect(d.result.warnings.filter((w) => w.kind === 'malformed')).toEqual([]);
    } finally {
      d.result.dispose();
    }
  });

  it('an unknown value warns once and draws the default theme', () => {
    const a = draw({});
    const d = draw({ theme: 'light' as unknown as Theme });
    try {
      expect(d.result.theme).toBe(DEFAULT_THEME);
      const ws = d.result.warnings.filter((w) => w.kind === 'malformed');
      expect(ws).toHaveLength(1);
      expect(ws[0]!.reason).toBe('invalid-value');
      expect(ws[0]!.message).toContain('light');
      expect(ws[0]!.message).toMatch(/theme/);
      expect(d.html).toBe(a.html);
      expect(d.boxes).toBe(a.boxes);
      expect(d.result.warnings.filter((w) => w.kind !== 'malformed')).toEqual(a.result.warnings);
    } finally {
      a.result.dispose();
      d.result.dispose();
    }
  });

  it('resolveStyles and layoutDocument take the theme too; the default is the same', () => {
    const doc = parse(UXML);
    const plain = resolveStyles(doc);
    const explicit = resolveStyles(doc, { theme: DEFAULT_THEME });
    const flat = (r: typeof plain) =>
      JSON.stringify([...r.styles].map(([id, s]) => [id, [...s].map(([p, v]) => [p, v.value])]));
    expect(flat(explicit)).toBe(flat(plain));

    const t1 = layoutDocument(doc.root, plain.styles, plain.partStyles, { size: { width: 400, height: 300 }, measureText: MEASURE! });
    const t2 = layoutDocument(doc.root, explicit.styles, explicit.partStyles, {
      size: { width: 400, height: 300 },
      measureText: MEASURE!,
      theme: DEFAULT_THEME,
    });
    try {
      const b = (t: typeof t1) => JSON.stringify([...t.boxes].map(([id, x]) => [id, x.left, x.top, x.width, x.height]));
      expect(b(t2)).toBe(b(t1));
    } finally {
      t1.dispose();
      t2.dispose();
    }
  });
});
