/**
 * The default path: no theme option draws the runtime theme (0.7.0 cleanup round, R2).
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * The review found only 8 tests that tell the default apart from the editor theme.
 * This one draws every case of the runtime golden set (tests/golden/unity-runtime/,
 * the 44 golden cases dumped on a real runtime panel) three ways — no theme option,
 * `theme: 'runtime'`, `theme: 'editor'` — and holds the first to the second.
 * The editor theme must come out different in every case: its text defaults alone
 * (12px #d2d2d2 against the runtime 14px #1b1b1b, probe-panel and probe-editor-070
 * c07-existing col/label) reach every element, so a case that drew the same on both
 * would not be telling the themes apart.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { loadLayoutEngine, parse, render } from '../../src/index';
import type { RenderOptions, UxmlDocument } from '../../src/index';
import { CASES } from './cases';
import { caseResolver, FIXED_MEASURE } from './harness';

const RUNTIME = join(process.cwd(), 'tests', 'golden', 'unity-runtime');
const PANEL = { width: 400, height: 300 };

beforeAll(async () => {
  await loadLayoutEngine();
});

/** Every box and every resolved value, in a form toEqual can compare. */
function drawn(doc: UxmlDocument, theme: RenderOptions['theme'] | undefined): unknown {
  const r = render(doc, document.createElement('div'), {
    size: PANEL,
    measureText: FIXED_MEASURE,
    ...(theme === undefined ? {} : { theme }),
  });
  try {
    return {
      boxes: [...r.boxes].map(([id, b]) => [id, b.left, b.top, b.width, b.height]),
      styles: [...(r.styles ?? new Map())].map(([id, m]) => [id, [...m].map(([p, v]) => [p, v.value])]),
    };
  } finally {
    r.dispose();
  }
}

describe('the default theme', () => {
  const cases = CASES.filter((c) => existsSync(join(RUNTIME, `${c.name}.json`)));

  it('covers the whole runtime golden set', () => {
    expect(cases).toHaveLength(44);
  });

  for (const golden of cases) {
    it(`${golden.name}: no theme option draws the runtime theme, not the editor theme`, () => {
      const doc = parse(golden.uxml, golden.uss, golden.files === undefined ? undefined : { resolveImport: caseResolver(golden.files) });
      const none = drawn(doc, undefined);
      expect(none).toEqual(drawn(doc, 'runtime'));
      expect(none).not.toEqual(drawn(doc, 'editor'));
    });
  }
});
