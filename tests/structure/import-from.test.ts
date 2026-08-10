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

  // Pins current behaviour rather than an ideal one. `seen` (index.ts) exists
  // to stop an import cycle from looping forever, and as a side effect a
  // sheet imported by two different parents is only ever fetched once — so
  // the hook is only called once, with the first parent's `from`. The second
  // parent's import is silently deduplicated without ever calling the hook.
  // This pins the actual behaviour, not the ideal one — changing it means
  // re-fetching and re-parsing the same sheet text per importer, which risks
  // duplicate rules in the cascade, a render-affecting change this task rules
  // out. The same dedup key is also what issue #4 is about: 'shared.uss' here
  // is an absolute-looking key with no relative ambiguity, so it doesn't hit
  // that collision, but a relative filename reused under two different
  // parents would.
  it('calls the hook once for a sheet imported by two different parents, keyed on the first', () => {
    const { calls, resolveImport } = recordingResolver({
      'a.uss': '@import "shared.uss";',
      'b.uss': '@import "shared.uss";',
      'shared.uss': '.shared { color: red; }',
    });
    parse(
      '<ui:UXML xmlns:ui="UnityEngine.UIElements">' +
        '<Style src="a.uss" /><Style src="b.uss" />' +
        '</ui:UXML>',
      undefined,
      { resolveImport },
    );
    const sharedCalls = calls.filter((c) => c.url === 'shared.uss');
    expect(sharedCalls).toEqual([{ url: 'shared.uss', from: 'a.uss' }]);
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
