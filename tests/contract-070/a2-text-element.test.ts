/**
 * 0.7.0 A2 — Label and Button carry Unity's `unity-text-element`, and an author rule on
 * that class reaches every text element (human instruction 2026-10-17).
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Source: tests/layout/unity/<version>/{probe-panel,probe-editor-070}/a2-hook.json
 * (PanelDump / ProbeDump 0.7.0-r3), probe tests/layout/unity/probes-0.7.0/a2-hook.uxml
 * with a2-hook.uss: `.unity-text-element { margin-left: 7px; color: rgb(255, 0, 0); }`.
 * On both versions and both themes the rule lands on the Label, the Button, the
 * TextField's label and inner text, and the GroupBox title: margin-left 7, red, and the
 * boxes move by it (it beats the theme's own margins: runtime Label 2, Button 4).
 * Expected values: the 6000.3.25f1 dumps (6000.0.40f1 is identical here; first test).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { loadLayoutEngine, parse, resolveStyles } from '../../src/index';
import type { ElementNode, MeasureText, Theme } from '../../src/index';
import { layoutDocument } from '../../src/layout/yoga';

const UNITY = join(process.cwd(), 'tests', 'layout', 'unity');
const PROBES = join(UNITY, 'probes-0.7.0');
const FOLDER: Record<Theme, string> = { runtime: 'probe-panel', editor: 'probe-editor-070' };

interface DumpElement {
  path: string;
  name: string;
  classes: string[];
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
  measured?: { w: number; h: number };
  style: Record<string, string>;
}
interface Dump {
  metadata: { panel: { width: number; height: number } };
  elements: DumpElement[];
}
const readDump = (version: string, theme: Theme): Dump =>
  JSON.parse(readFileSync(join(UNITY, version, FOLDER[theme], 'a2-hook.json'), 'utf8').replace(/\bNaN\b/g, 'null')) as Dump;
const at = (dump: Dump, path: string): DumpElement => {
  const e = dump.elements.find((x) => x.path === path);
  if (e === undefined) throw new Error(`dump has no ${path}`);
  return e;
};

function unityMeasure(dump: Dump): MeasureText {
  const sizes = new Map<string, { width: number; height: number }>();
  for (const e of dump.elements) {
    if (e.measured !== undefined && e.text !== undefined) sizes.set(`${e.text}|${Number(e.style['fontSize'])}`, { width: e.measured.w, height: e.measured.h });
  }
  return (text, context) => {
    const hit = sizes.get(`${text}|${context.fontSize}`);
    if (hit === undefined) throw new Error(`no Unity measurement for ${JSON.stringify(text)} at ${context.fontSize}px`);
    return hit;
  };
}

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

const isRed = (value: string | undefined): boolean =>
  /^(rgb\(255,0,0\)|#f00|#ff0000|red|rgba\(255,0,0,1\))$/i.test((value ?? '').replace(/\s/g, ''));

function layout(theme: Theme) {
  const dump = readDump('6000.3.25f1', theme);
  const doc = parse(readFileSync(join(PROBES, 'a2-hook.uxml'), 'utf8'), readFileSync(join(PROBES, 'a2-hook.uss'), 'utf8'));
  const resolved = resolveStyles(doc, { theme });
  const tree = layoutDocument(doc.root, resolved.styles, resolved.partStyles, { theme, size: dump.metadata.panel, measureText: unityMeasure(dump) });
  return { dump, doc, resolved, tree };
}

beforeAll(async () => {
  await loadLayoutEngine();
});

describe('A2 — the dumps', () => {
  it('both versions agree, and every text element took the rule', () => {
    for (const theme of ['runtime', 'editor'] as const) {
      const a = readDump('6000.0.40f1', theme);
      const b = readDump('6000.3.25f1', theme);
      const texts = b.elements.filter((e) => e.classes.includes('unity-text-element'));
      expect(texts.map((e) => e.path)).toEqual([
        'col/h-label', 'col/h-button', 'col/h-field/Label[0]', 'col/h-field/unity-text-input/TextElement[0]', 'col/h-group/Label[0]',
      ]);
      for (const e of texts) {
        expect(e.style['marginLeft'], `${theme} ${e.path}`).toBe('7');
        expect(e.style['color'], `${theme} ${e.path}`).toBe('rgba(1,0,0,1)');
        const o = at(a, e.path);
        expect([o.x, o.y, o.w, o.h], `${theme} ${e.path}`).toEqual([e.x, e.y, e.w, e.h]);
      }
    }
  });
});

for (const theme of ['runtime', 'editor'] as const) {
  describe(`A2 — ${theme} theme: .unity-text-element from author USS`, () => {
    it('reaches the Label and the Button, which land where Unity puts them', () => {
      const { dump, doc, resolved, tree } = layout(theme);
      try {
        for (const name of ['h-label', 'h-button']) {
          const node = nodeByName(doc.root, name);
          const style = resolved.styles.get(node.id)!;
          expect(parseFloat(style.get('margin-left')!.value), name).toBe(7);
          expect(isRed(style.get('color')?.value), `${name} ${style.get('color')?.value}`).toBe(true);
          const b = tree.boxes.get(node.id)!;
          const u = at(dump, `col/${name}`);
          expect([b.left, b.top, b.width, b.height], name).toEqual([u.x, u.y, u.w, u.h]);
        }
      } finally {
        tree.dispose();
      }
    });

    it('still reaches the parts that already carried it (TextField label and text, GroupBox title)', () => {
      const { dump, doc, tree } = layout(theme);
      try {
        for (const [owner, part, path] of [
          ['h-field', 'unity-text-field__label', 'col/h-field/Label[0]'],
          ['h-field', 'unity-text-element--inner-input-field-component', 'col/h-field/unity-text-input/TextElement[0]'],
          ['h-group', 'unity-group-box__label', 'col/h-group/Label[0]'],
        ] as const) {
          const p = (tree.parts.get(nodeByName(doc.root, owner).id) ?? []).find((x) => x.name === part)!;
          expect(parseFloat(p.style.get('margin-left')!.value), part).toBe(7);
          expect(isRed(p.style.get('color')?.value), part).toBe(true);
          const u = at(dump, path);
          expect([p.box.left, p.box.top, p.box.width, p.box.height], part).toEqual([u.x, u.y, u.w, u.h]);
        }
      } finally {
        tree.dispose();
      }
    });
  });
}
