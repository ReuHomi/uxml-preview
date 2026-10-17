/**
 * 0.7.0 — a Label or Button whose text is only spaces (human decision 2026-10-17:
 * the GroupBox title rule, whitespace-title.test.ts, applies to them too).
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Source: tests/layout/unity/<version>/{probe-panel,probe-editor-070}/c-whitespace.json
 * (PanelDump / ProbeDump 0.7.0-r2), probe tests/layout/unity/probes-0.7.0/c-whitespace.uxml:
 *   Label ws-plain (no generator), ws-std (standard), ws-adv (advanced); Button b-space.
 *   - runtime panel: text " " measures 0x0 on both versions with any generator. Labels
 *     are their padding (8 high), the Button 22.
 *   - editor window: 6000.0.40f1 measures 0 with any generator (Labels 0, Button 4);
 *     6000.3.25f1 measures one line (15) with advanced, its default (ws-plain, ws-adv,
 *     b-space: Button 19), and 0 with standard (ws-std).
 * Rule, as for the title: the runtime theme draws 0 without a warning; the editor theme
 * draws 6000.3.25f1's value and warns version-dependent where the versions differ (any
 * generator but standard); under standard both versions are 0 and nothing is warned.
 *
 * Text goes through the default measurer, as a host that passes none would. Every named
 * element's box is held to the 6.3 dump, so the GroupBoxes below the Labels now land too.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { createDefaultMeasureText, loadLayoutEngine, parse, render } from '../../src/index';
import type { ElementNode, RenderResult, Theme, Warning } from '../../src/index';

const UNITY = join(process.cwd(), 'tests', 'layout', 'unity');
const PROBE = readFileSync(join(UNITY, 'probes-0.7.0', 'c-whitespace.uxml'), 'utf8');
const FOLDER: Record<Theme, string> = { runtime: 'probe-panel', editor: 'probe-editor-070' };
const NAMED = ['col', 'ws-plain', 'ws-std', 'ws-adv', 'g-plain', 'g-std', 'g-adv', 'b-space'] as const;

interface DumpElement { path: string; name: string; x: number; y: number; w: number; h: number; measured?: { w: number; h: number } }
const dump = (version: string, theme: Theme): DumpElement[] =>
  (JSON.parse(readFileSync(join(UNITY, version, FOLDER[theme], 'c-whitespace.json'), 'utf8').replace(/\bNaN\b/g, 'null')) as { elements: DumpElement[] }).elements;
const byName = (els: DumpElement[], name: string): DumpElement => {
  const e = els.find((x) => x.name === name);
  if (e === undefined) throw new Error(`dump has no ${name}`);
  return e;
};

function nodeByName(root: ElementNode, name: string): ElementNode {
  let found: ElementNode | undefined;
  const walk = (n: ElementNode): void => {
    if (n.attributes.some((a) => a.name === 'name' && a.value === name)) found = n;
    n.children.forEach(walk);
  };
  walk(root);
  if (found === undefined) throw new Error(`no element named ${name}`);
  return found;
}

const draw = (theme: Theme): RenderResult =>
  render(parse(PROBE), document.createElement('div'), { theme, size: { width: 800, height: 600 }, measureText: createDefaultMeasureText() });
const versionWarnings = (r: RenderResult): Warning[] =>
  r.warnings.filter((w) => w.kind === 'version-dependent' || w.reason === 'version-dependent');

beforeAll(async () => {
  await loadLayoutEngine();
});

describe('text " " in a Label or Button — what the dumps say', () => {
  it('runtime: 0 on both versions with any generator; editor: one line only on 6.3 without standard', () => {
    for (const version of ['6000.0.40f1', '6000.3.25f1']) {
      for (const n of ['ws-plain', 'ws-std', 'ws-adv', 'b-space']) expect(byName(dump(version, 'runtime'), n).measured, `${version} runtime ${n}`).toEqual({ w: 0, h: 0 });
      expect(byName(dump(version, 'runtime'), 'ws-plain').h).toBe(8);
      expect(byName(dump(version, 'runtime'), 'b-space').h).toBe(22);
    }
    const e0 = dump('6000.0.40f1', 'editor');
    for (const n of ['ws-plain', 'ws-std', 'ws-adv', 'b-space']) expect(byName(e0, n).measured, `6000.0 editor ${n}`).toEqual({ w: 0, h: 0 });
    expect(byName(e0, 'b-space').h).toBe(4);
    const e3 = dump('6000.3.25f1', 'editor');
    expect(byName(e3, 'ws-plain').measured).toEqual({ w: 0, h: 15 });
    expect(byName(e3, 'ws-adv').measured).toEqual({ w: 0, h: 15 });
    expect(byName(e3, 'ws-std').measured).toEqual({ w: 0, h: 0 });
    expect(byName(e3, 'b-space').h).toBe(19);
  });
});

for (const theme of ['runtime', 'editor'] as const) {
  describe(`text " " in a Label or Button — ${theme} theme`, () => {
    it('every named element lands where Unity 6000.3.25f1 puts it', () => {
      const unity = dump('6000.3.25f1', theme);
      const r = draw(theme);
      try {
        const root = r.document!.root;
        for (const n of NAMED) {
          const b = r.boxes.get(nodeByName(root, n).id)!;
          const u = byName(unity, n);
          expect([b.left, b.top, b.width, b.height], n).toEqual([u.x, u.y, u.w, u.h]);
        }
      } finally {
        r.dispose();
      }
    });
  });
}

describe('text " " in a Label or Button — warnings', () => {
  it('runtime: none', () => {
    const r = draw('runtime');
    try {
      expect(versionWarnings(r)).toEqual([]);
    } finally {
      r.dispose();
    }
  });

  it('editor: one version-dependent warning for each Label and Button not under standard, naming both versions and heights', () => {
    const r = draw('editor');
    try {
      const root = r.document!.root;
      const ws = versionWarnings(r).filter((w) => w.subject?.kind === 'control' && (w.subject.type === 'Label' || w.subject.type === 'Button'));
      expect(ws.map((w) => w.node).sort()).toEqual(['ws-plain', 'ws-adv', 'b-space'].map((n) => nodeByName(root, n).id).sort());
      for (const w of ws) {
        expect(w.kind).toBe('version-dependent');
        expect(w.reason).toBe('version-dependent');
        expect(w.message).toMatch(/6000\.0\.40f1/);
        expect(w.message).toMatch(/6000\.3\.25f1/);
        expect(w.message).toMatch(/\b0\s?px/);
        expect(w.message).toMatch(/\b15\s?px/);
      }
    } finally {
      r.dispose();
    }
  });
});
