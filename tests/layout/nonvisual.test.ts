/**
 * Elements that carry data for Unity rather than pixels: `<Bindings>` (with
 * its `<ui:DataBinding>` children) and a MultiColumnListView's `<ui:Columns>`.
 *
 * The expectations are Unity's, not ours. tests/layout/unity/ holds layout
 * dumps of the two probe documents beside them, taken with
 * tools/UxmlLayoutDump.cs on 6000.0.40f1 and 6000.3.25f1 (2026-10-13). Both
 * versions agree: neither element appears anywhere in the visual hierarchy,
 * and a sibling laid out with `space-around` lands where it would if the
 * element were not written at all. Before this, the preview drew each as a
 * zero-height box that shifted those siblings.
 *
 * `<ui:Column name="…">` is the subtle one. The Column is not an element, but
 * its name is: Unity builds a header column carrying it (MultiColumnHeaderColumn
 * in the dump). So a Column's name still counts toward duplicate names.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { expandTemplates, loadLayoutEngine, parse, render } from '../../src/index';
import type { ElementNode, Warning } from '../../src/index';

// jsdom hands import.meta.url an http: URL, and rendering needs jsdom; vitest
// runs from the repository root.
const HERE = join(process.cwd(), 'tests', 'layout', 'unity');
const VERSIONS = ['6000.0.40f1', '6000.3.25f1'] as const;

interface Dump {
  metadata: { unityVersion: string };
  panel: { width: number; height: number };
  elements: Record<string, { x: number; y: number; width: number; height: number }>;
  observations: Array<{ type: string; name: string }>;
}

function dump(name: string, version: string): Dump {
  // The dumper writes a bare NaN for an undefined flex-basis, which is not JSON.
  const text = readFileSync(join(HERE, `${name}.${version}.json`), 'utf8').replace(/:NaN/g, ':null');
  return JSON.parse(text) as Dump;
}

beforeAll(async () => {
  await loadLayoutEngine();
});

function ours(name: string) {
  const doc = parse(readFileSync(join(HERE, `${name}.uxml`), 'utf8'));
  const container = document.createElement('div');
  const result = render(doc, container, {
    size: { width: 400, height: 300 },
    measureText: (text, context) => ({ width: text.length * context.fontSize * 0.5, height: context.fontSize }),
  });
  const byName = new Map<string, ElementNode>();
  const index = (node: ElementNode): void => {
    const n = node.attributes.find((a) => a.name === 'name')?.value;
    if (n !== undefined) byName.set(n, node);
    node.children.forEach(index);
  };
  index(doc.root);
  const box = (n: string) => result.boxes.get(byName.get(n)!.id);
  const out = { doc, box, warnings: [...result.warnings] as Warning[], boxCount: result.boxes.size };
  result.dispose();
  return out;
}

describe.each(VERSIONS)('non-visual elements against Unity %s', (version) => {
  it('the dump is the version it claims to be', () => {
    expect(dump('nonvisual-bindings', version).metadata.unityVersion).toBe(version);
    expect(dump('nonvisual-columns', version).metadata.unityVersion).toBe(version);
  });

  it('<Bindings> is not in the hierarchy and moves no sibling', () => {
    const unity = dump('nonvisual-bindings', version);
    expect(unity.observations.filter((o) => /Binding/.test(o.type))).toEqual([]);
    const preview = ours('nonvisual-bindings');
    for (const name of ['nv-root', 'nv-a', 'nv-b']) {
      const { x, y, width, height } = unity.elements[name]!;
      expect(preview.box(name), name).toEqual({ left: x, top: y, width, height });
    }
    // The label's width is font metrics; where it sits is not.
    expect(preview.box('nv-label')).toMatchObject({
      left: unity.elements['nv-label']!.x,
      top: unity.elements['nv-label']!.y,
    });
  });

  it('<ui:Columns> is not in the hierarchy, but each Column name is', () => {
    const unity = dump('nonvisual-columns', version);
    expect(unity.observations.filter((o) => /\.Columns?$/.test(o.type))).toEqual([]);
    expect(Object.keys(unity.elements)).toEqual(expect.arrayContaining(['nv-col-a', 'nv-col-b']));
    const preview = ours('nonvisual-columns');
    for (const name of ['nv-mclv', 'nv-after']) {
      const { x, y, width, height } = unity.elements[name]!;
      expect(preview.box(name), name).toEqual({ left: x, top: y, width, height });
    }
  });
});

describe('what the preview says about them', () => {
  it('lays none of them out and reports none as an unsupported control', () => {
    const bindings = ours('nonvisual-bindings');
    expect(bindings.box('nv-label')).toBeDefined();
    const kinds = bindings.warnings.map((w) => w.subject?.kind === 'control' && w.subject.type);
    expect(kinds).not.toContain('DataBinding');
    const columns = ours('nonvisual-columns');
    expect(columns.box('nv-col-a')).toBeUndefined();
    expect(columns.warnings.filter((w) => w.kind === 'unsupported-control').map((w) => w.subject)).toEqual([
      { kind: 'control', type: 'MultiColumnListView' },
    ]);
  });

  it('says once per document that bindings are not evaluated', () => {
    const notices = ours('nonvisual-bindings').warnings.filter(
      (w) => w.subject?.kind === 'control' && w.subject.type === 'Bindings',
    );
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ kind: 'unsupported-control', reason: 'not-rendered' });
    // A notice about bindings, not the fallback-box report it replaces.
    expect(notices[0]!.message).not.toContain('plain VisualElement');

    // The probe's second <Bindings> sits in a text-drawing Label that layout
    // never descends into, so it cannot tell "once" from "once each".
    const twice = parse(
      '<ui:UXML xmlns:ui="UnityEngine.UIElements">' +
        '<ui:VisualElement><Bindings><ui:DataBinding property="a" /></Bindings></ui:VisualElement>' +
        '<ui:VisualElement><Bindings><ui:DataBinding property="b" /></Bindings></ui:VisualElement>' +
        '</ui:UXML>',
    );
    const result = render(twice, document.createElement('div'), {
      size: { width: 100, height: 100 },
      measureText: () => ({ width: 0, height: 0 }),
    });
    const bindingNotices = result.warnings.filter(
      (w) => w.subject?.kind === 'control' && w.subject.type === 'Bindings',
    );
    result.dispose();
    expect(bindingNotices).toHaveLength(1);
  });

  it('a Label holding <Bindings> still has no children to lose', () => {
    const warnings = ours('nonvisual-bindings').warnings;
    expect(warnings.filter((w) => w.message.includes('children are not drawn'))).toEqual([]);
  });

  it('a Column name repeated by two instances is a repeated name, as in Unity', () => {
    const table = readFileSync(join(HERE, 'nonvisual-columns.uxml'), 'utf8');
    const doc = parse(
      '<ui:UXML xmlns:ui="UnityEngine.UIElements"><ui:Template name="T" src="t.uxml" />' +
        '<ui:Instance template="T" /><ui:Instance template="T" /></ui:UXML>',
      undefined,
      { resolveImport: (url) => (url === 't.uxml' ? table : null) },
    );
    const names = expandTemplates(doc)
      .warnings.filter((w) => w.kind === 'duplicate-name-in-tree')
      .map((w) => (w.subject?.kind === 'name' ? w.subject.name : ''));
    expect(names).toEqual(expect.arrayContaining(['nv-col-a', 'nv-col-b']));
  });
});
