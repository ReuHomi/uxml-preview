/**
 * Visual regression: does the USS-to-CSS mapping still produce what it did?
 *
 * Read the harness header before adding to this file. In short: **passing here
 * says nothing about Unity.** Colour, borders and corners cannot be checked
 * against a coordinate dump, and a pixel diff over text-bearing screens
 * measures font choice rather than the mapping (S1 plan §1). What this catches
 * is our own drift, which is the failure that actually happens between Unity
 * comparisons.
 *
 * Snapshots live in tests/render/snapshots/ and are written from current
 * output, so a new case goes green immediately. Adding one is only worth
 * something if you read the snapshot it produces.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { loadLayoutEngine } from '../../src/index';
import { VISUAL_CASES } from './visual-cases';
import { runVisualCase } from './visual-harness';
import type { CaseVisuals } from './visual-harness';

/**
 * Resolved from the working directory, not from `import.meta.url`.
 *
 * jsdom rewrites `import.meta.url` to an `http:` URL, so `fileURLToPath`
 * rejects it — the reason every other file using that pattern opts into the
 * node environment by pragma. This one cannot: `runVisualCase` paints into a
 * real DOM and needs jsdom. Every script that runs vitest does so from the
 * repository root.
 *
 * Do not name that pragma in full anywhere in this file's leading comments.
 * Vitest scans them for it and will switch this file to node, at which point
 * `document` disappears and every case here fails at the first paint.
 */
const SNAPSHOTS = join(process.cwd(), 'tests', 'render', 'snapshots');

/** Set GOLDEN_UPDATE=1 to rewrite the snapshots after an intended change. */
const UPDATING = process.env['GOLDEN_UPDATE'] === '1';

beforeAll(async () => {
  await loadLayoutEngine();
});

describe('visual regression: the CSS we emit is stable', () => {
  for (const visual of VISUAL_CASES) {
    it(`${visual.name} — ${visual.question}`, () => {
      const actual = runVisualCase(visual);
      const path = join(SNAPSHOTS, `${visual.name}.json`);

      if (UPDATING || !existsSync(path)) {
        console.info(
          `WROTE VISUAL SNAPSHOT ${visual.name} from current output — drift detection ` +
            'only, NOT evidence it matches Unity',
        );
        mkdirSync(SNAPSHOTS, { recursive: true });
        writeFileSync(path, `${JSON.stringify(actual, null, 2)}\n`, 'utf8');
        return;
      }
      expect(actual).toEqual(JSON.parse(readFileSync(path, 'utf8')) as CaseVisuals);
    });
  }
});

describe('the two rules that are invisible until something breaks', () => {
  it('never emits z-index, whatever the USS asked for', () => {
    const { elements, warnings } = runVisualCase({
      name: 'inline-z',
      question: '',
      uxml:
        '<ui:UXML xmlns:ui="UnityEngine.UIElements">' +
        '<ui:VisualElement name="a" style="z-index: 5;" /></ui:UXML>',
      uss: '#a { z-index: 9; }',
    });
    expect(elements['a']!['z-index']).toBeUndefined();
    expect(warnings.some((w) => w.includes('z-index'))).toBe(true);
  });

  it('emits border-box on every element, declared or not', () => {
    const { elements } = runVisualCase({
      name: 'inline-box',
      question: '',
      uxml:
        '<ui:UXML xmlns:ui="UnityEngine.UIElements">' +
        '<ui:VisualElement name="a"><ui:Label name="b" text="x" /></ui:VisualElement></ui:UXML>',
      uss: '',
    });
    expect(elements['a']!['box-sizing']).toBe('border-box');
    expect(elements['b']!['box-sizing']).toBe('border-box');
  });
});
