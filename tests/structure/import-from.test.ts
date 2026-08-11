// @vitest-environment node

/**
 * `resolveImport`'s second argument: `from`, the URL of the stylesheet that
 * contains the import being resolved (`null` for a `<Style src>` reference,
 * which is not contained in any stylesheet).
 *
 * Without it, a relative `@import` inside an imported sheet is unresolvable
 * in principle — the host has no base to resolve it against, and the
 * previous single-argument hook gave it no way to ask. Issue #1.
 */

import { describe, it, expect } from 'vitest';

import { parse } from '../../src/index';
import { explainProperty } from '../../src/style/resolve';

/** Records every `(url, from)` pair the hook was called with, in call order. */
function recordingResolver(sheets: Record<string, string>) {
  const calls: Array<{ url: string; from: string | null }> = [];
  const resolveImport = (url: string, from: string | null): string | null => {
    calls.push({ url, from });
    return sheets[url] ?? null;
  };
  return { calls, resolveImport };
}

describe('resolveImport: from', () => {
  it('is null for a <Style src> reference — not contained in any stylesheet', () => {
    const { calls, resolveImport } = recordingResolver({ 'a.uss': '.a { color: red; }' });
    parse(
      '<ui:UXML xmlns:ui="UnityEngine.UIElements"><Style src="a.uss" /></ui:UXML>',
      undefined,
      { resolveImport },
    );
    expect(calls).toEqual([{ url: 'a.uss', from: null }]);
  });

  it('is the containing sheet\'s URL for a one-level @import', () => {
    const { calls, resolveImport } = recordingResolver({
      'a.uss': '@import "b.uss";',
      'b.uss': '.b { color: blue; }',
    });
    parse(
      '<ui:UXML xmlns:ui="UnityEngine.UIElements"><Style src="a.uss" /></ui:UXML>',
      undefined,
      { resolveImport },
    );
    expect(calls).toEqual([
      { url: 'a.uss', from: null },
      { url: 'b.uss', from: 'a.uss' },
    ]);
  });

  // The definition of this task: naively passing the original sheet down
  // through every level would give c a from of "a", off by one hop, and a
  // shallow (one-level) case cannot tell that apart from the correct answer.
  it('is the immediate parent, not the original sheet, for two-level nesting', () => {
    const { calls, resolveImport } = recordingResolver({
      'a.uss': '@import "b.uss";',
      'b.uss': '@import "c.uss";',
      'c.uss': '.c { color: green; }',
    });
    parse(
      '<ui:UXML xmlns:ui="UnityEngine.UIElements"><Style src="a.uss" /></ui:UXML>',
      undefined,
      { resolveImport },
    );
    expect(calls).toEqual([
      { url: 'a.uss', from: null },
      { url: 'b.uss', from: 'a.uss' },
      { url: 'c.uss', from: 'b.uss' }, // not 'a.uss'
    ]);
  });

  it('resolves the same relative URL once per parent', () => {
    const { calls, resolveImport } = recordingResolver({
      'a.uss': '@import "shared.uss";',
      'b.uss': '@import "shared.uss";',
      'shared.uss': '.shared { color: red; }',
    });
    const parsed = parse(
      '<ui:UXML xmlns:ui="UnityEngine.UIElements">' +
        '<Style src="a.uss" /><Style src="b.uss" />' +
        '</ui:UXML>',
      undefined,
      { resolveImport },
    );
    expect(calls.filter((c) => c.url === 'shared.uss')).toEqual([
      { url: 'shared.uss', from: 'a.uss' },
      { url: 'shared.uss', from: 'b.uss' },
    ]);
    expect(parsed.warnings).toHaveLength(0);
  });

  it('still resolves the same relative URL only once for one parent', () => {
    const { calls, resolveImport } = recordingResolver({
      'a.uss': '@import "shared.uss";\n@import "shared.uss";',
      'shared.uss': '.shared { color: red; }',
    });
    parse(
      '<ui:UXML xmlns:ui="UnityEngine.UIElements"><Style src="a.uss" /></ui:UXML>',
      undefined,
      { resolveImport },
    );
    expect(calls.filter((c) => c.url === 'shared.uss')).toEqual([
      { url: 'shared.uss', from: 'a.uss' },
    ]);
  });

  it('does not retry one unresolved relative URL from the same parent', () => {
    const { calls, resolveImport } = recordingResolver({
      'a.uss': '@import "missing.uss";\n@import "missing.uss";',
    });
    parse(
      '<ui:UXML xmlns:ui="UnityEngine.UIElements"><Style src="a.uss" /></ui:UXML>',
      undefined,
      { resolveImport },
    );
    expect(calls.filter((c) => c.url === 'missing.uss')).toEqual([
      { url: 'missing.uss', from: 'a.uss' },
    ]);
  });

  it.each([
    'project://database/Assets/UI/shared.uss',
    'project://database/Packages/com.example/shared.uss',
    '/Assets/UI/shared.uss',
    '/Packages/com.example/shared.uss',
  ])('loads and applies one rooted URL only once across different parents: %s', (absolute) => {
    const { calls, resolveImport } = recordingResolver({
      'a.uss': `@import "${absolute}";`,
      'b.uss': `@import "${absolute}";`,
      [absolute]: '.shared { color: red; }',
    });
    const parsed = parse(
      '<ui:UXML xmlns:ui="UnityEngine.UIElements">' +
        '<Style src="a.uss" /><Style src="b.uss" />' +
        '<ui:VisualElement name="target" class="shared" />' +
        '</ui:UXML>',
      undefined,
      { resolveImport },
    );
    expect(calls.filter((c) => c.url === absolute)).toEqual([
      { url: absolute, from: 'a.uss' },
    ]);
    expect(parsed.sheets.filter((sheet) => sheet.origin === absolute)).toHaveLength(1);
    const target = parsed.root.children.find((child) =>
      child.attributes.some((attribute) => attribute.name === 'name' && attribute.value === 'target'),
    )!;
    expect(explainProperty(parsed, target, 'color').map((candidate) => candidate.value)).toEqual([
      'red',
    ]);
  });

  it('still resolves a bare Packages URL once per parent', () => {
    const relative = 'Packages/com.example/shared.uss';
    const { calls, resolveImport } = recordingResolver({
      'a.uss': `@import "${relative}";`,
      'b.uss': `@import "${relative}";`,
      [relative]: '.shared { color: red; }',
    });
    parse(
      '<ui:UXML xmlns:ui="UnityEngine.UIElements">' +
        '<Style src="a.uss" /><Style src="b.uss" />' +
        '</ui:UXML>',
      undefined,
      { resolveImport },
    );
    expect(calls.filter((c) => c.url === relative)).toEqual([
      { url: relative, from: 'a.uss' },
      { url: relative, from: 'b.uss' },
    ]);
  });

  it('still terminates a relative import cycle', () => {
    const { calls, resolveImport } = recordingResolver({
      'a.uss': '@import "b.uss";',
      'b.uss': '@import "a.uss";',
    });
    parse(
      '<ui:UXML xmlns:ui="UnityEngine.UIElements"><Style src="a.uss" /></ui:UXML>',
      undefined,
      { resolveImport },
    );
    expect(calls).toEqual([
      { url: 'a.uss', from: null },
      { url: 'b.uss', from: 'a.uss' },
      { url: 'a.uss', from: 'b.uss' },
    ]);
  });

  // `from` must be the exact string the previous call received as `url` —
  // not renormalized, resolved to absolute, or otherwise reconstructed. A
  // relative-looking segment is deliberately included: a "helpful"
  // implementation tempted to clean it up would fail this.
  it('passes the prior url through as from, unmodified', () => {
    const { calls, resolveImport } = recordingResolver({
      './nested/../A.uss': '@import "b.uss";',
      'b.uss': '.b { color: blue; }',
    });
    parse(
      '<ui:UXML xmlns:ui="UnityEngine.UIElements"><Style src="./nested/../A.uss" /></ui:UXML>',
      undefined,
      { resolveImport },
    );
    const bCall = calls.find((c) => c.url === 'b.uss');
    expect(bCall?.from).toBe('./nested/../A.uss');
  });

  it('still works with an existing one-argument callback (regression)', () => {
    const oneArg = (url: string): string | null =>
      url === 'a.uss' ? '.a { color: red; }' : null;
    const parsed = parse(
      '<ui:UXML xmlns:ui="UnityEngine.UIElements"><Style src="a.uss" /></ui:UXML>',
      undefined,
      { resolveImport: oneArg },
    );
    expect(parsed.sheets).toHaveLength(1);
    expect(parsed.warnings).toHaveLength(0);
  });
});
