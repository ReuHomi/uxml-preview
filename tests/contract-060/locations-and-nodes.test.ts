/**
 * 0.6.0 bundle 1 — a USS warning says which file it is in, and a declaration
 * warning says which elements the declaration reached.
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Where the expected values come from:
 *
 *   - `at.url` / `at.from`: the two arguments resolveImport received for the
 *     sheet the span indexes — the same strings a consumer passed through its
 *     own hook, so it can map them back without the expanded document. `at.sheet`
 *     counts sheets of the expanded document, which a consumer holding only the
 *     entry model cannot resolve (found by vscode-uxml-preview 0.3.1). For a
 *     sheet nobody resolved — the `uss` argument of parse() — both are null.
 *     The resolveImport calls below were observed on 2026-10-16: a template's
 *     <Style src> arrives as ("t.uss", "Parts/T.uxml"), its @import as
 *     ("u.uss", "t.uss").
 *   - `nodes`: 0.5.1's diff run (tests/regression/warning-diff.test.ts) merged
 *     776 warnings, and 515 of them pointed at no element. Decision 2026-10-16:
 *     a declaration warning lists every element of the render tree the
 *     declaration's rule matched, in document order; a rule that matched
 *     nothing lists none. `node` keeps its 0.5.1 meaning (the first one).
 */

import { beforeAll, describe, expect, it } from 'vitest';

import { loadLayoutEngine, parse, render } from '../../src/index';
import type { ElementNode, NodeId, RenderResult, UxmlDocument, Warning } from '../../src/index';

beforeAll(async () => {
  await loadLayoutEngine();
});

const U = (body: string): string => `<ui:UXML xmlns:ui="UnityEngine.UIElements">${body}</ui:UXML>`;

function draw(doc: UxmlDocument): RenderResult {
  return render(doc, document.createElement('div'), {
    size: { width: 400, height: 300 },
    measureText: (text, ctx) => ({ width: text.length * 6, height: ctx.fontSize }),
  });
}

function idsNamed(root: ElementNode, name: string): NodeId[] {
  const out: NodeId[] = [];
  const walk = (n: ElementNode): void => {
    if (n.attributes.some((a) => a.name === 'name' && a.value === name)) out.push(n.id);
    n.children.forEach(walk);
  };
  walk(root);
  return out;
}

const ussAt = (w: Warning | undefined) => (w?.at?.in === 'uss' ? w.at : undefined);

describe('at.url and at.from on every USS location', () => {
  it('parse(): the uss argument, a <Style src> sheet, and a sheet it @imports', () => {
    const files: Record<string, string> = {
      'a.uss': '@import "b.uss";\n@import "missing.uss";\n.p { width: 1px; ',
      'b.uss': '.q { color: red',
    };
    const doc = parse(U('<Style src="a.uss" /><ui:VisualElement />'), '.r { height: 2px; ', {
      resolveImport: (u) => files[u] ?? null,
    });
    const malformedIn = (url: string | null) =>
      doc.warnings.find((w) => w.kind === 'malformed' && ussAt(w)?.url === url);

    expect(ussAt(malformedIn('a.uss'))).toMatchObject({ url: 'a.uss', from: null });
    expect(ussAt(malformedIn('b.uss'))).toMatchObject({ url: 'b.uss', from: 'a.uss' });
    expect(ussAt(malformedIn(null))).toMatchObject({ url: null, from: null });

    // The unresolved @import is located in the sheet that wrote it.
    const unresolved = doc.warnings.find((w) => w.kind === 'import-unresolved');
    expect(ussAt(unresolved)).toMatchObject({ url: 'a.uss', from: null });
  });

  it('template sheets: the strings resolveImport received, through @import too', () => {
    const files: Record<string, string> = {
      'Parts/T.uxml': U('<Style src="t.uss" /><ui:VisualElement name="tv" class="tc" />'),
      't.uss': '@import "u.uss";\n.tc { box-shadow: 1px 1px red; }',
      'u.uss': '.tc { color: red',
    };
    const resolve = (url: string): string | null => files[url] ?? null;
    const doc = parse(U('<ui:Template name="T" src="Parts/T.uxml" /><ui:Instance template="T" name="i1" />'), undefined, {
      resolveImport: resolve,
    });
    const result = draw(doc);
    try {
      const shadow = result.warnings.find((w) => w.subject?.kind === 'property' && w.subject.property === 'box-shadow');
      expect(ussAt(shadow)).toMatchObject({ url: 't.uss', from: 'Parts/T.uxml' });
      const malformed = result.warnings.find((w) => w.kind === 'malformed');
      expect(ussAt(malformed)).toMatchObject({ url: 'u.uss', from: 't.uss' });
    } finally {
      result.dispose();
    }
  });

  it('value-level warnings located through a declaration carry them too', () => {
    const doc = parse(U('<Style src="v.uss" /><ui:VisualElement name="a" />'), undefined, {
      resolveImport: (u) => (u === 'v.uss' ? '#a { width: 3em; }' : null),
    });
    const result = draw(doc);
    try {
      const em = result.warnings.find((w) => w.subject?.kind === 'property' && w.subject.property === 'width');
      expect(ussAt(em)).toMatchObject({ url: 'v.uss', from: null });
    } finally {
      result.dispose();
    }
  });
});

describe('nodes: the elements a declaration reached', () => {
  it('a rule-level property warning lists every matched element; an unmatched rule lists none', () => {
    const doc = parse(
      U('<ui:VisualElement name="a" class="x" /><ui:VisualElement name="m" /><ui:VisualElement name="b" class="x" />'),
      '.x { box-shadow: 1px 1px red; }\n.nothing { box-shadow: 2px 2px red; }',
    );
    const result = draw(doc);
    try {
      const root = result.document!.root;
      const [a] = idsNamed(root, 'a');
      const [b] = idsNamed(root, 'b');
      const shadows = result.warnings.filter((w) => w.subject?.kind === 'property' && w.subject.property === 'box-shadow');
      expect(shadows).toHaveLength(2);
      const onX = shadows.find((w) => w.subject?.kind === 'property' && w.subject.value === '1px 1px red')!;
      const onNothing = shadows.find((w) => w.subject?.kind === 'property' && w.subject.value === '2px 2px red')!;
      expect(onX.nodes).toEqual([a, b]);
      expect(onNothing.nodes).toEqual([]);
    } finally {
      result.dispose();
    }
  });

  it('a value-level warning merged once per declaration keeps every element it was raised on', () => {
    const doc = parse(
      U('<ui:VisualElement name="a" class="x" /><ui:VisualElement name="b" class="x" />'),
      '.x { width: 1em; }',
    );
    const result = draw(doc);
    try {
      const root = result.document!.root;
      const [a] = idsNamed(root, 'a');
      const [b] = idsNamed(root, 'b');
      const em = result.warnings.filter((w) => w.subject?.kind === 'property' && w.subject.property === 'width');
      expect(em).toHaveLength(1);
      expect(em[0]!.node).toBe(a);
      expect(em[0]!.nodes).toEqual([a, b]);
    } finally {
      result.dispose();
    }
  });

  it('a template sheet rule reaches the clone in every instance', () => {
    const files: Record<string, string> = {
      'T.uxml': U('<Style src="t.uss" /><ui:VisualElement name="tv" class="tc" />'),
      't.uss': '.tc { box-shadow: 1px 1px red; }',
    };
    const doc = parse(U('<ui:Template name="T" src="T.uxml" /><ui:Instance template="T" /><ui:Instance template="T" />'), undefined, {
      resolveImport: (u) => files[u] ?? null,
    });
    const result = draw(doc);
    try {
      const clones = idsNamed(result.document!.root, 'tv');
      expect(clones).toHaveLength(2);
      const shadow = result.warnings.filter((w) => w.subject?.kind === 'property' && w.subject.property === 'box-shadow');
      expect(shadow).toHaveLength(1);
      expect(shadow[0]!.nodes).toEqual(clones);
    } finally {
      result.dispose();
    }
  });
});
