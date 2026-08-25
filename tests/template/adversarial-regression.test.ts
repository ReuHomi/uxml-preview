// @vitest-environment node

import { beforeAll, describe, expect, it } from 'vitest';
import { expandTemplates, loadLayoutEngine, parse, resolveStyles } from '../../src/index';
import { layoutDocument } from '../../src/layout/yoga';

const host = (body: string): string =>
  `<ui:UXML xmlns:ui="UnityEngine.UIElements">${body}</ui:UXML>`;

function chain(last: number): { root: string; files: Map<string, string> } {
  const files = new Map<string, string>();
  for (let index = 0; index < last; index++) {
    files.set(
      `${index}.uxml`,
      host(`<ui:Template name="T${index + 1}" src="${index + 1}.uxml" /><ui:Instance template="T${index + 1}" />`),
    );
  }
  files.set(`${last}.uxml`, host('<ui:VisualElement name="leaf" />'));
  return {
    root: host('<ui:Template name="T0" src="0.uxml" /><ui:Instance template="T0" />'),
    files,
  };
}

beforeAll(async () => {
  await loadLayoutEngine();
});

describe('template adversarial regressions', () => {
  it('keeps control diagnostics and ScrollView parts inside expanded templates', () => {
    const source = host('<ui:Template name="Pane" src="pane.uxml" /><ui:Instance template="Pane" />');
    const pane = host(
      '<ui:Toggle name="toggle" />' +
        '<ui:ScrollView name="scroll" style="width: 200px; height: 80px;">' +
        '<ui:VisualElement style="height: 180px;" />' +
        '</ui:ScrollView>',
    );
    const expanded = expandTemplates(
      parse(source, undefined, { resolveImport: (url) => (url === 'pane.uxml' ? pane : null) }),
    );
    const resolved = resolveStyles(expanded.document);
    const tree = layoutDocument(expanded.document.root, resolved.styles, resolved.partStyles, {
      size: { width: 400, height: 300 },
      measureText: () => ({ width: 0, height: 0 }),
    });
    try {
      expect(tree.warnings.some((warning) => warning.kind === 'unsupported-control')).toBe(true);
      expect([...tree.parts.values()].flat()).not.toHaveLength(0);
    } finally {
      tree.dispose();
    }
  });

  it('passes each containing document as from during nested resolution', () => {
    const calls: Array<[string, string | null]> = [];
    const documents: Record<string, string> = {
      'sub/b.uxml': host('<ui:Template name="C" src="deep/c.uxml" /><ui:Instance template="C" />'),
      'deep/c.uxml': host('<ui:VisualElement name="leaf" />'),
    };
    const expanded = expandTemplates(
      parse(host('<ui:Template name="B" src="sub/b.uxml" /><ui:Instance template="B" />'), undefined, {
        resolveImport: (url, from) => {
          calls.push([url, from]);
          return documents[url] ?? null;
        },
      }),
    );
    expect(expanded.warnings).toHaveLength(0);
    expect(calls).toEqual([
      ['sub/b.uxml', null],
      ['deep/c.uxml', 'sub/b.uxml'],
    ]);
  });

  it('expands depth 32 and rejects depth 33 without calling it a cycle', () => {
    const pass = chain(31);
    const passed = expandTemplates(
      parse(pass.root, undefined, { resolveImport: (url) => pass.files.get(url) ?? null }),
    );
    expect(passed.warnings.map((warning) => warning.kind)).not.toContain('template-depth-exceeded');

    const fail = chain(32);
    const failed = expandTemplates(
      parse(fail.root, undefined, { resolveImport: (url) => fail.files.get(url) ?? null }),
    );
    expect(failed.warnings.map((warning) => warning.kind)).toContain('template-depth-exceeded');
    expect(failed.warnings.map((warning) => warning.kind)).not.toContain('template-cycle');
  });
});
