// @vitest-environment node

/**
 * The panel is scaled to fit the viewport, and the scaled panel is what takes
 * up layout space.
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Found 2026-10-16 while recording the 0.6.0 GIFs, measured in Chrome 155 on
 * the built playground: at 1920x1080 in a 718x618 viewport the panel was
 * scaled to 36% but drawn at x=1163 inside a viewport spanning 550..1268, so
 * about 105px of it was visible. #scaler kept its unscaled 1920px layout box
 * (a transform does not change layout), and centring a box larger than its
 * scroll container put it off to one side. Any panel larger than the viewport
 * — the 1280x720 preset included — was affected.
 *
 * The fix this pins: the box that takes layout space has the scaled size, so
 * centring works; the scale itself is computed by one pure function.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { fitPanel } from '../../playground/fit';

describe('fitPanel', () => {
  it('fit: the whole panel, with 24px of slack, never enlarged', () => {
    const f = fitPanel({ width: 1920, height: 1080 }, { width: 718, height: 618 }, 'fit');
    expect(f.scale).toBeCloseTo(Math.min(694 / 1920, 594 / 1080), 10);
    expect(f.width).toBeLessThanOrEqual(694);
    expect(f.height).toBeLessThanOrEqual(594);
    expect(f.width).toBeCloseTo(1920 * f.scale, 10);
    expect(f.height).toBeCloseTo(1080 * f.scale, 10);

    expect(fitPanel({ width: 640, height: 360 }, { width: 718, height: 618 }, 'fit').scale).toBe(1);
    expect(fitPanel({ width: 8192, height: 8192 }, { width: 100, height: 100 }, 'fit').scale).toBe(0.05);
  });

  it('a fixed zoom is used as given, and the box is the scaled size', () => {
    expect(fitPanel({ width: 1920, height: 1080 }, { width: 718, height: 618 }, 1)).toEqual({ scale: 1, width: 1920, height: 1080 });
    expect(fitPanel({ width: 1920, height: 1080 }, { width: 718, height: 618 }, 0.5)).toEqual({ scale: 0.5, width: 960, height: 540 });
  });
});

describe('the page', () => {
  const read = (f: string) => readFileSync(join(process.cwd(), 'playground', f), 'utf8');

  it('main.ts sizes the layout box from fitPanel', () => {
    const main = read('main.ts');
    expect(main).toContain('fitPanel(');
  });

  it('a box larger than the viewport is not centred off-screen (safe alignment)', () => {
    expect(read('index.html')).toMatch(/place-items:\s*safe center/);
  });
});
