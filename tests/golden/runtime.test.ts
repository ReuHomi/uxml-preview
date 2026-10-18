// @vitest-environment node

/**
 * The runtime theme against Unity's runtime panel (0.7.0 bundle A, A3).
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Expected values: tests/golden/unity-runtime/ (PanelDump on a real runtime panel,
 * 6.3, held to UxmlLayoutDump by panel-dump.test.ts). Same comparison as the editor
 * figure in golden.test.ts: the coordinate cases (not measuresText, not
 * measuresResources), 0.5px, Unity's scroller parts not reproduced.
 *
 * Written before the default flips: whatever is left must be one of the editor set's
 * known divergences (same case, element and field) — text measurement at the
 * inventory footer, the 1px rows, the wrapped container, Yoga's percent against an
 * unsized parent. Anything else is a theme value this preview gets wrong.
 * Prediction (bundle A plan, section 11): 655/676 or better; baseline before A2 609.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { loadLayoutEngine } from '../../src/layout/yoga';
import { CASES } from './cases';
import { runCase } from './harness';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const RUNTIME = join(HERE, 'unity-runtime');
const TOLERANCE_PX = 0.5;
const NOT_REPRODUCED = ['unity-low-button', 'unity-high-button', 'unity-slider', 'unity-drag-container', 'unity-tracker', 'unity-dragger-border', 'unity-dragger'];

/** The editor set's known divergences (golden.test.ts KNOWN_DIVERGENCES), by key. */
const EXPLAINED = new Set([
  'percent-without-parent-size/unsized/height',
  'percent-without-parent-size/pct-in-unsized/height',
  ...['DetailPanel/width', 'ItemName/width', 'ItemDesc/width', 'ActionBar/x', 'ActionBar/width', 'UseButton/x', 'UseButton/width', 'DropButton/x', 'DropButton/width', 'TitleLabel/y', 'CloseButton/y', 'unity-content-container/height'].map((k) => `inventory/${k}`),
  // Bundle G: the settings footer's text widths, as golden.test.ts lists them.
  ...['settings', 'settings-ko'].flatMap((name) =>
    ['apply/width', 'cancel/x', 'cancel/width', 'minus/x', 'plus/x', 'plus/width'].map((k) => `${name}/${k}`)),
]);

beforeAll(async () => {
  await loadLayoutEngine();
});

interface Dump {
  panel: { width: number; height: number };
  elements: Record<string, { x: number; y: number; width: number; height: number }>;
}

function compareAll(): { matching: number; compared: number; unexplained: string[]; mismatches: string[] } {
  let matching = 0;
  let compared = 0;
  const unexplained: string[] = [];
  const mismatches: string[] = [];
  for (const golden of CASES.filter((c) => c.measuresText !== true && c.measuresResources !== true)) {
    const file = join(RUNTIME, `${golden.name}.json`);
    if (!existsSync(file)) continue;
    const unity = JSON.parse(readFileSync(file, 'utf8')) as Dump;
    const ours = runCase(golden, unity.panel, 'runtime');
    for (const [key, want] of Object.entries(unity.elements)) {
      const base = key.includes('#') ? key.slice(0, key.indexOf('#')) : key;
      // As golden.test.ts: excused only where we do not build the name (a Slider's own parts are compared).
      if (NOT_REPRODUCED.includes(base) && ours.elements[key] === undefined) continue;
      for (const field of ['x', 'y', 'width', 'height'] as const) {
        compared++;
        const got = ours.elements[key]?.[field];
        if (got !== undefined && Math.abs(got - want[field]) <= TOLERANCE_PX) {
          matching++;
          continue;
        }
        const line = `${golden.name}/${key}/${field}: ours ${got}, Unity ${want[field]}`;
        mismatches.push(line);
        if (!EXPLAINED.has(`${golden.name}/${key}/${field}`)) unexplained.push(line);
      }
    }
  }
  return { matching, compared, unexplained, mismatches };
}

describe('accuracy: the runtime theme against a real runtime panel', () => {
  it('leaves only differences the editor set already explains', () => {
    const r = compareAll();
    console.info(`runtime theme vs Unity 6.3 runtime panel: ${r.matching}/${r.compared}\n  ${r.mismatches.join('\n  ')}`);
    // 676 until bundle G added the settings screen: two cases, 472 values (Slider parts included).
    expect(r.compared).toBe(1148);
    expect(r.unexplained, r.unexplained.join('\n')).toEqual([]);
  });
});
