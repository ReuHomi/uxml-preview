// @vitest-environment node

/**
 * Golden tests, in two halves that answer different questions.
 *
 *   Regression — did our own output change? Compares against snapshots in
 *   tests/golden/snapshots/. No Unity, no browser, runs on every commit.
 *
 *   Accuracy — do we match Unity? Compares against tests/golden/unity/, which
 *   only exists once someone runs tools/UxmlLayoutDump.cs. Missing ground truth
 *   is reported as unmeasured and skipped: a build cannot fail for lacking a
 *   file no machine can generate, and an unmeasured case must never read as a
 *   passing one.
 *
 * Geometry is compared, not pixels. Unity draws text with its own font asset
 * and the browser does not, so a pixel diff over a case set with any text in it
 * measures font choice more than layout.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadLayoutEngine } from '../../src/layout/yoga';
import { CASES } from './cases';
import { runCase } from './harness';
import type { CaseGeometry, Rect } from './harness';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const SNAPSHOTS = join(HERE, 'snapshots');
const UNITY = join(HERE, 'unity');

/** Sub-pixel wobble from Yoga's point rounding is not a mismatch. */
const TOLERANCE_PX = 0.5;

/** Set GOLDEN_UPDATE=1 to rewrite the snapshots after an intended change. */
const UPDATING = process.env['GOLDEN_UPDATE'] === '1';

beforeAll(async () => {
  await loadLayoutEngine();
  if (UPDATING) mkdirSync(SNAPSHOTS, { recursive: true });
});

function snapshotPath(name: string): string {
  return join(SNAPSHOTS, `${name}.json`);
}

function readJson<T>(path: string): T | null {
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : null;
}

describe('regression: our own output is stable', () => {
  for (const golden of CASES) {
    it(`${golden.name} — ${golden.question}`, () => {
      const actual = runCase(golden);
      const path = snapshotPath(golden.name);

      if (UPDATING || !existsSync(path)) {
        mkdirSync(SNAPSHOTS, { recursive: true });
        writeFileSync(path, `${JSON.stringify(actual, null, 2)}\n`, 'utf8');
        return;
      }
      expect(actual).toEqual(readJson<CaseGeometry>(path));
    });
  }
});

interface UnityDump {
  panel: { width: number; height: number };
  elements: Record<string, Rect>;
}

interface Mismatch {
  element: string;
  field: keyof Rect;
  ours: number;
  unity: number;
}

function compare(ours: CaseGeometry, unity: UnityDump): Mismatch[] {
  const out: Mismatch[] = [];
  for (const [element, expected] of Object.entries(unity.elements)) {
    const actual = ours.elements[element];
    if (actual === undefined) {
      out.push({ element, field: 'x', ours: NaN, unity: expected.x });
      continue;
    }
    for (const field of ['x', 'y', 'width', 'height'] as const) {
      if (Math.abs(actual[field] - expected[field]) > TOLERANCE_PX) {
        out.push({ element, field, ours: actual[field], unity: expected[field] });
      }
    }
  }
  return out;
}

describe('accuracy: we match Unity', () => {
  const measured = CASES.filter((c) => c.measuresText !== true);

  it('reports how much ground truth exists', () => {
    const present = measured.filter((c) => existsSync(join(UNITY, `${c.name}.json`)));
    // Not an assertion about correctness — a statement of coverage, so that a
    // green run never gets mistaken for a verified one.
    console.info(
      `Unity ground truth: ${present.length}/${measured.length} comparable cases` +
        (present.length === 0
          ? ' — run tools/UxmlLayoutDump.cs to produce it (see docs/accuracy.md)'
          : ''),
    );
    expect(present.length).toBeGreaterThanOrEqual(0);
  });

  for (const golden of measured) {
    const path = join(UNITY, `${golden.name}.json`);
    const unity = readJson<UnityDump>(path);

    it.skipIf(unity === null)(`${golden.name} — ${golden.question}`, () => {
      // Laid out at Unity's own panel size, so a percentage or a stretch is
      // compared against the same containing block rather than a guess at it.
      const ours = runCase(golden, unity!.panel);
      const mismatches = compare(ours, unity!);
      expect(
        mismatches,
        mismatches
          .map((m) => `${m.element}.${m.field}: ours ${m.ours}, Unity ${m.unity}`)
          .join('\n'),
      ).toEqual([]);
    });
  }
});
