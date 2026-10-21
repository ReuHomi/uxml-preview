/**
 * 0.7.0 — a GroupBox whose text is only spaces (human decision 2026-10-17, after R1).
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Source: tests/layout/unity/<version>/{probe-panel,probe-editor-070}/c-whitespace.json
 * (PanelDump / ProbeDump 0.7.0-r2), probe tests/layout/unity/probes-0.7.0/c-whitespace.uxml.
 * What the dumps show for the title Label of `text=" "`:
 *   - runtime panel: measured 0x0 on both versions, with any generator (g-plain, g-std,
 *     g-adv): the title is its padding only (8) and the GroupBox 18.
 *   - editor window: 6000.0.40f1 measures 0 with any generator; 6000.3.25f1 measures one
 *     line (15) with the advanced generator (its default, g-plain; and g-adv) and 0 with
 *     standard (g-std).
 * Decision: the runtime theme draws 0 and does not warn. The editor theme draws the
 * base version's value (6000.3.25f1) and, where the versions differ (advanced), raises
 * `version-dependent` naming both heights. Under standard the versions agree: 0, no warning.
 *
 * Text is measured with the default measurer, as a host that passes none would; the
 * boxes are held to the dump. Only heights and the title box are judged: the Labels
 * before the GroupBoxes are outside this decision, so y is not.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { createDefaultMeasureText, loadLayoutEngine, parse, render } from '../../src/index';
import type { ElementNode, RenderResult, Theme, Warning } from '../../src/index';
import { layoutDocument } from '../../src/layout/yoga';
import { resolveStyles } from '../../src/index';

const UNITY = join(process.cwd(), 'tests', 'layout', 'unity');
const PROBE = readFileSync(join(UNITY, 'probes-0.7.0', 'c-whitespace.uxml'), 'utf8');
const FOLDER: Record<Theme, string> = { runtime: 'probe-panel', editor: 'probe-editor-070' };
const TITLE = 'unity-group-box__label';
const GROUPS = ['g-plain', 'g-std', 'g-adv'] as const;

interface DumpElement { path: string; x: number; y: number; w: number; h: number; measured?: { w: number; h: number } }
const dump = (version: string, theme: Theme): DumpElement[] =>
  (JSON.parse(readFileSync(join(UNITY, version, FOLDER[theme], 'c-whitespace.json'), 'utf8').replace(/\bNaN\b/g, 'null')) as { elements: DumpElement[] }).elements;
const at = (els: DumpElement[], path: string): DumpElement => {
  const e = els.find((x) => x.path === path);
  if (e === undefined) throw new Error(`dump has no ${path}`);
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

const SIZE = { width: 800, height: 600 };
const draw = (theme: Theme): RenderResult =>
  render(parse(PROBE), document.createElement('div'), { theme, size: SIZE, measureText: createDefaultMeasureText() });
const versionWarnings = (r: RenderResult): Warning[] =>
  r.warnings.filter((w) => w.kind === 'version-dependent' || w.reason === 'version-dependent');

beforeAll(async () => {
  await loadLayoutEngine();
});

describe('GroupBox text=" " — what the dumps say', () => {
  it('runtime: 0 high on both versions with any generator; editor: only 6.3 with advanced is one line', () => {
    for (const version of ['6000.0.40f1', '6000.3.25f1']) {
      for (const g of GROUPS) expect(at(dump(version, 'runtime'), `col/${g}/Label[0]`).measured, `${version} runtime ${g}`).toEqual({ w: 0, h: 0 });
    }
    for (const g of GROUPS) expect(at(dump('6000.0.40f1', 'editor'), `col/${g}/Label[0]`).measured, `6000.0 editor ${g}`).toEqual({ w: 0, h: 0 });
    const e63 = dump('6000.3.25f1', 'editor');
    expect(at(e63, 'col/g-plain/Label[0]').measured).toEqual({ w: 0, h: 15 });
    expect(at(e63, 'col/g-adv/Label[0]').measured).toEqual({ w: 0, h: 15 });
    expect(at(e63, 'col/g-std/Label[0]').measured).toEqual({ w: 0, h: 0 });
  });
});

for (const theme of ['runtime', 'editor'] as const) {
  describe(`GroupBox text=" " — ${theme} theme`, () => {
    // The editor theme draws the base version (6000.3.25f1); the runtime dumps agree across versions.
    const unity = dump('6000.3.25f1', theme);

    it('the GroupBox is as high as Unity draws it', () => {
      const r = draw(theme);
      try {
        const root = r.document!.root;
        for (const g of GROUPS) {
          const b = r.boxes.get(nodeByName(root, g).id)!;
          const u = at(unity, `col/${g}`);
          expect([b.width, b.height], g).toEqual([u.w, u.h]);
        }
      } finally {
        r.dispose();
      }
    });

    it('the title part has Unity\'s box size', () => {
      const doc = parse(PROBE);
      const resolved = resolveStyles(doc, { theme });
      const tree = layoutDocument(doc.root, resolved.styles, resolved.partStyles, { theme, size: SIZE, measureText: createDefaultMeasureText() });
      try {
        for (const g of GROUPS) {
          const titles = (tree.parts.get(nodeByName(doc.root, g).id) ?? []).filter((p) => p.name === TITLE);
          expect(titles, g).toHaveLength(1);
          const u = at(unity, `col/${g}/Label[0]`);
          expect([titles[0]!.box.width, titles[0]!.box.height], `${g} title`).toEqual([u.w, u.h]);
        }
      } finally {
        tree.dispose();
      }
    });
  });
}

describe('GroupBox text=" " — warnings', () => {
  it('runtime: none', () => {
    const r = draw('runtime');
    try {
      expect(versionWarnings(r)).toEqual([]);
    } finally {
      r.dispose();
    }
  });

  it('editor: version-dependent for each GroupBox drawn with advanced, naming both versions and heights; none under standard', () => {
    const r = draw('editor');
    try {
      const root = r.document!.root;
      const ws = versionWarnings(r).filter((w) => w.subject?.kind === 'control' && w.subject.type === 'GroupBox');
      expect(ws.map((w) => w.node).sort()).toEqual([nodeByName(root, 'g-plain').id, nodeByName(root, 'g-adv').id].sort());
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
