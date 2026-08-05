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
        // Says so out loud. A snapshot is written from *our own output*, so a
        // new case goes green the moment it is added while having settled
        // nothing — the one way a golden set can grow without gaining value.
        // Whether the numbers are right is the accuracy half's question, and
        // that half needs a Unity dump this case may not have yet.
        console.info(
          `WROTE SNAPSHOT ${golden.name} from current output — regression baseline ` +
            'only, NOT evidence it matches Unity',
        );
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

/**
 * Parts Unity builds that this renderer deliberately does not.
 *
 * A scrollbar's internals are out of scope for S1 (the plan draws a static
 * screen; dragging, wheeling and scroll position are all out), but the dump
 * reports them because they are real elements with names. Without this list
 * every ScrollView case would fail with fourteen `MISSING` entries that say
 * nothing about whether the layout is right.
 *
 * A list rather than a filter on `unity-`, for the reason the divergence list
 * is a list: `unity-content-viewport` is also a Unity-made element, and it is
 * one we must reproduce exactly. A pattern would quietly excuse it too.
 *
 * Matched on the base name — the dumper suffixes repeats `#1`, `#2`, since the
 * horizontal and vertical scrollers hold identically named parts.
 */
const NOT_REPRODUCED = new Set([
  'unity-low-button',
  'unity-high-button',
  'unity-slider',
  'unity-drag-container',
  'unity-tracker',
  'unity-dragger-border',
  'unity-dragger',
]);

function baseName(key: string): string {
  const hash = key.indexOf('#');
  return hash === -1 ? key : key.slice(0, hash);
}

function compare(ours: CaseGeometry, unity: UnityDump): Mismatch[] {
  const out: Mismatch[] = [];
  for (const [element, expected] of Object.entries(unity.elements)) {
    if (NOT_REPRODUCED.has(baseName(element))) continue;
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
    const missing = measured.filter((c) => !existsSync(join(UNITY, `${c.name}.json`)));
    // Named, not just counted. A case with a regression snapshot and no Unity
    // dump looks finished from every other angle, so this is the only place it
    // is visible — and it stays visible until someone runs the dump.
    if (missing.length > 0) {
      console.info(
        `UNMEASURED against Unity (${missing.length}): ${missing.map((c) => c.name).join(', ')}` +
          ' — run tools/UxmlLayoutDump.cs',
      );
    }
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

  // The excuse list has to keep describing reality. A name Unity stopped
  // producing, or one this renderer started producing, is an entry that now
  // silently excuses nothing — or worse, excuses something real.
  it('only excuses parts Unity produces and we do not', () => {
    const inUnity = new Set<string>();
    for (const golden of measured) {
      const unity = readJson<UnityDump>(join(UNITY, `${golden.name}.json`));
      if (unity === null) continue;
      for (const key of Object.keys(unity.elements)) inUnity.add(baseName(key));
    }
    const stale = [...NOT_REPRODUCED].filter((n) => !inUnity.has(n));
    expect(stale, `no dump contains: ${stale.join(', ')}`).toEqual([]);

    const nowProduced = measured.flatMap((golden) =>
      Object.keys(runCase(golden).elements).filter((n) => NOT_REPRODUCED.has(baseName(n))),
    );
    expect(
      [...new Set(nowProduced)],
      'these are produced now and should be compared, not excused',
    ).toEqual([]);
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
