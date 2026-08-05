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

/**
 * Differences we have characterised and chosen not to paper over.
 *
 * Listed rather than tolerated: the comparison still has to produce exactly
 * these and no others, so a divergence that gets fixed upstream, or spreads,
 * fails the run instead of blending into an allowance.
 */
interface KnownDivergence {
  case: string;
  element: string;
  field: keyof Rect;
  reason: string;
}

const KNOWN_DIVERGENCES: KnownDivergence[] = [
  {
    case: 'percent-without-parent-size',
    element: 'unsized',
    field: 'height',
    reason:
      'yoga-layout 3.2.1 resolves a main-axis percentage against an indefinite ' +
      'parent (150); the Yoga vendored in UI Toolkit 6000.0.40f1 treats it as 0. ' +
      'Not configurable: no Errata, useWebDefaults or flex-basis setting ' +
      "reproduces Unity's answer without breaking cases that currently match. " +
      'See docs/accuracy.md.',
  },
  {
    case: 'percent-without-parent-size',
    element: 'pct-in-unsized',
    field: 'height',
    reason: 'Follows from the parent above resolving to 150 rather than 0.',
  },
];

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
    // Coverage, not accuracy, and labelled as such because the two get quoted
    // interchangeably otherwise. The accuracy figure is 242/244 compared values
    // (docs/accuracy.md); this line only says how many cases have a baseline at
    // all, so that a green run is never mistaken for a verified one.
    console.info(
      `Unity ground-truth COVERAGE (not accuracy): ${present.length}/${measured.length} ` +
        'comparable cases have a baseline' +
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
      const known = KNOWN_DIVERGENCES.filter((k) => k.case === golden.name);

      const unexpected = mismatches.filter(
        (m) => !known.some((k) => k.element === m.element && k.field === m.field),
      );
      expect(
        unexpected,
        unexpected
          .map((m) => `${m.element}.${m.field}: ours ${m.ours}, Unity ${m.unity}`)
          .join('\n'),
      ).toEqual([]);

      // And the other direction: a known divergence that stopped happening is
      // news, not something to leave sitting in the list.
      const stale = known.filter(
        (k) => !mismatches.some((m) => m.element === k.element && m.field === k.field),
      );
      expect(
        stale,
        stale
          .map((k) => `${k.element}.${k.field} now matches; remove it from KNOWN_DIVERGENCES`)
          .join('\n'),
      ).toEqual([]);
    });
  }
});
