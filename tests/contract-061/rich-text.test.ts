/**
 * 0.6.1 P2 — rich text tags the preview draws as plain characters.
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Measured first (2026-10-16, 6000.0.40f1 and 6000.3.25f1, editor theme, Inter
 * 20px): tests/layout/unity/<version>/probe-editor/rich-text.json, probe
 * tests/layout/unity/probes-0.6.1/rich-text.uxml. Every expectation below is
 * asserted against that dump in the first test, then held for the preview.
 *
 *   - With no `enable-rich-text` attribute Unity interprets tags: `<b>Hello</b>
 *     World` is as wide as "Hello World" give or take the bold face, exactly as
 *     with `enable-rich-text="true"`.
 *   - `enable-rich-text="false"` draws the tags as characters: its width equals
 *     `<noparse>`'s, which is Unity's own literal rendering.
 *   - `<size>`, `<voffset>` and `<br>` change the box height; every tag changes
 *     the width this preview gets (it draws the tag text). So the warning says
 *     `affectsLayout: true`.
 *   - A tag Unity does not know (`<ruby>`) is drawn as characters in both modes,
 *     the same as here: no warning. `a < b > c` is not a tag.
 *
 * Warning shape (user instruction: an incomplete preview, so uxml-author's exit-3
 * condition `not-rendered` + `affectsLayout` must hold): kind
 * `unsupported-property` — the only kind whose subject carries `affectsLayout`,
 * and the one `font-fallback` already uses for a text condition — reason
 * `not-rendered`, subject property `enable-rich-text` with the attribute as
 * written ('' when absent, as `font-fallback` writes ''). One per element.
 *
 * Tag names: Unity Manual 6000.3 "Supported rich text tags" (UIE-supported-tags),
 * 35 names, checked 2026-10-16. Only b, i, color, size, voffset, br and noparse
 * are measured.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { loadLayoutEngine, parse, render } from '../../src/index';
import type { RenderResult, Warning } from '../../src/index';

beforeAll(async () => {
  await loadLayoutEngine();
});

const UNITY = join(process.cwd(), 'tests', 'layout', 'unity');
const box = (version: string) => {
  const json = JSON.parse(readFileSync(join(UNITY, version, 'probe-editor', 'rich-text.json'), 'utf8').replace(/\bNaN\b/g, 'null')) as {
    elements: Array<{ name: string; w: number; h: number }>;
  };
  return (name: string) => json.elements.find((e) => e.name === name)!;
};

const U = (body: string) => `<ui:UXML xmlns:ui="UnityEngine.UIElements">${body}</ui:UXML>`;
function draw(body: string): RenderResult {
  return render(parse(U(body)), document.createElement('div'), {
    size: { width: 800, height: 600 },
    measureText: (t, c) => ({ width: t.length * 6, height: c.fontSize }),
  });
}
const rich = (ws: readonly Warning[]) =>
  ws.filter((w) => w.subject?.kind === 'property' && w.subject.property === 'enable-rich-text');
const nameOf = (r: RenderResult, w: Warning): string | undefined => {
  let found: string | undefined;
  const walk = (n: RenderResult['document']['root']) => {
    if (n.id === w.node) found = n.attributes.find((a) => a.name === 'name')?.value;
    n.children.forEach(walk);
  };
  walk(r.document.root);
  return found;
};

describe('the measured basis', () => {
  for (const version of ['6000.0.40f1', '6000.3.25f1']) {
    it(`rich-text.json on ${version}`, () => {
      const u = box(version);
      const plain = u('plain');
      // Interpreted by default, the same as "true".
      expect(Math.abs(u('b-def').w - plain.w)).toBeLessThanOrEqual(2);
      expect(u('b-true')).toMatchObject({ w: u('b-def').w, h: u('b-def').h });
      for (const tag of ['i', 'color', 'voffset']) expect(Math.abs(u(`${tag}-def`).w - plain.w), tag).toBeLessThanOrEqual(1);
      // "false" draws the tags: as wide as <noparse>, far wider than the text.
      expect(u('b-false').w).toBe(u('b-noparse').w);
      for (const tag of ['b', 'i', 'color', 'size', 'voffset']) expect(u(`${tag}-false`).w, tag).toBeGreaterThan(plain.w + 50);
      // Height changes.
      expect(u('size-def').h).toBeGreaterThan(plain.h);
      expect(u('voffset-def').h).toBeGreaterThan(plain.h);
      expect(u('br-def').h).toBeGreaterThan(plain.h);
      // An unknown tag is characters either way.
      expect(u('unknown-def').w).toBe(u('unknown-false').w);
      expect(u('unknown-def').w).toBeGreaterThan(plain.w + 50);
      // Buttons interpret it too.
      expect(Math.abs(u('btn-b-def').w - u('btn-plain').w)).toBeLessThanOrEqual(2);
    });
  }
});

describe('the preview warns where Unity interprets tags', () => {
  const T = (tags: string) => tags.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  it('warns on interpreted tags, one per element, with the exit-3 shape', () => {
    const r = draw(
      `<ui:Label name="b-def" text="${T('<b>Hello</b> World')}" />` +
        `<ui:Label name="b-true" enable-rich-text="true" text="${T('<b>Hello</b> World')}" />` +
        `<ui:Label name="size-def" text="${T('<size=40>Hello</size> <i>World</i>')}" />` +
        `<ui:Label name="color-def" text="${T('<color=#ff0000>Hello</color> World')}" />` +
        `<ui:Label name="voffset-def" text="${T('<voffset=10>Hello</voffset> World')}" />` +
        `<ui:Label name="br-def" text="${T('Hello<br>World')}" />` +
        `<ui:Label name="b-noparse" text="${T('<noparse><b>Hello</b></noparse> World')}" />` +
        `<ui:Button name="btn-b-def" text="${T('<b>Hello</b> World')}" />`,
    );
    try {
      const ws = rich(r.warnings);
      expect(ws.map((w) => nameOf(r, w))).toEqual(['b-def', 'b-true', 'size-def', 'color-def', 'voffset-def', 'br-def', 'b-noparse', 'btn-b-def']);
      for (const w of ws) {
        expect(w.kind).toBe('unsupported-property');
        expect(w.reason).toBe('not-rendered');
        expect(w.subject).toMatchObject({ kind: 'property', property: 'enable-rich-text', affectsLayout: true });
        expect(w.message).toMatch(/rich text/i);
      }
      expect(ws.map((w) => (w.subject?.kind === 'property' ? w.subject.value : undefined))).toEqual(['', 'true', '', '', '', '', '', '']);
    } finally {
      r.dispose();
    }
  });

  it('every tag name in the Unity Manual list is recognised, with or without a value or a closing slash', () => {
    const names = ['a', 'align', 'allcaps', 'alpha', 'b', 'br', 'color', 'cspace', 'font', 'font-weight', 'gradient', 'i',
      'indent', 'line-height', 'line-indent', 'lowercase', 'margin', 'mark', 'mspace', 'nobr', 'noparse', 'pos', 's', 'size',
      'smallcaps', 'space', 'sprite', 'style', 'sub', 'sup', 'u', 'uppercase', 'voffset', 'width', 'link'];
    expect(names).toHaveLength(35);
    const forms = (n: string) => [`<${n}>x`, `x</${n}>`, `<${n}=1>x`];
    const r = draw(names.flatMap(forms).map((t, i) => `<ui:Label name="t${i}" text="${T(t)}" />`).join(''));
    try {
      expect(rich(r.warnings)).toHaveLength(names.length * 3);
    } finally {
      r.dispose();
    }
  });

  it('does not warn where Unity draws the characters too', () => {
    const r = draw(
      `<ui:Label name="b-false" enable-rich-text="false" text="${T('<b>Hello</b> World')}" />` +
        `<ui:Label name="b-False" enable-rich-text="False" text="${T('<size=40>Hello</size>')}" />` +
        `<ui:Label name="unknown-def" text="${T('<ruby>Hello</ruby> World')}" />` +
        `<ui:Label name="lt-def" text="${T('a < b > c')}" />` +
        `<ui:Label name="plain" text="Hello World" />` +
        `<ui:Label name="bold-word" text="${T('<bold>x</bold> <colour=red>y')}" />`,
    );
    try {
      expect(rich(r.warnings).map((w) => nameOf(r, w))).toEqual([]);
    } finally {
      r.dispose();
    }
  });

  it('meets uxml-author\'s exit-3 condition (src/check.js classify: not-rendered + affectsLayout)', () => {
    const exit3 = (w: Warning) =>
      w.reason === 'not-rendered' && w.subject?.kind === 'property' && w.subject.affectsLayout === true;
    const r = draw(`<ui:Label text="${T('<b>Hello</b>')}" />`);
    try {
      expect(rich(r.warnings).filter(exit3)).toHaveLength(1);
    } finally {
      r.dispose();
    }
  });
});
