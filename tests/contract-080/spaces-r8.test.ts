/**
 * 0.8.0 — the two space assumptions of spaces.test.ts, measured (2026-11-18).
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Probes tests/layout/unity/probes-0.8.0/r8-trail and r8-wrap, every text different (CLAUDE.md rule 7), each
 * dumped alone (dump-solo.sh) on 6000.0.40f1 and 6000.3.25f1, runtime panel (probe-panel) and editor
 * (probe-editor-070). The box check against Unity's pixels is tests/text-cohort/measure-spaces.mjs (Inter);
 * this file pins the dump numbers and the rule with the canvas-free measurer (each character 0.5 × font size).
 *
 * (a) Standard drops a Label's trailing spaces — CONFIRMED. Every Standard row of r8-trail (nowrap and normal,
 *     default and written `-unity-text-generator: standard`) is as wide as its text without the trailing
 *     spaces: "end   " 26 at 14px (Inter "end" 25.04 → floor + 1), "tail     " 20, "x  y  " 24 ("x  y" 23.24).
 * (b) Standard `normal` text that breaks at a run of spaces — the earlier assumption (the run hangs and counts,
 *     as pre-wrap) is WRONG where the run does not fit. Unity's width is the line, plus the run and the start of
 *     the next word only up to the last glyph that fits: spaces after the line count only when a glyph after
 *     them fits too. Runtime panel (Label content 51 / 71 / 41 / 61 px): "alpha     beta" 39 = "alpha"
 *     (35.91 → 36) + padding 3, "glass         jar" 38 = "glass" 35 + 3 — the run alone would reach 48 / 62.
 *     Editor (57 / 77 / 47 / 67 px): "alpha     beta" 59 = "alpha     b" (55.2 → 56) + 3 — the glyph after the
 *     run fits, so the run counts. Both versions give the same numbers.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createDefaultMeasureText } from '../../src/index';

const UNITY = join(process.cwd(), 'tests', 'layout', 'unity');
const dump = (version: string, set: string, file: string) =>
  JSON.parse(readFileSync(join(UNITY, version, set, file), 'utf8').replace(/\bNaN\b/g, 'null')) as
    { elements: Array<{ name?: string; type: string; w: number; h: number; style: Record<string, string> }> };
const widths = (version: string, set: string, file: string, names: string[]) => {
  const d = dump(version, set, file);
  return names.map((n) => { const e = d.elements.find((x) => x.name === n)!; return [e.w, e.h, e.style['unityTextGenerator']]; });
};

it('the dumps say what is pinned below', () => {
  for (const version of ['6000.0.40f1', '6000.3.25f1']) {
    expect(widths(version, 'probe-panel', 'r8-wrap.json', ['b1', 'b2', 'b3', 'b4', 'b5']), version).toEqual([
      [39, 42, 'Standard'], [69, 42, 'Standard'], [36, 59, 'Standard'], [38, 42, 'Standard'], [32, 25, 'Standard']]);
    expect(widths(version, 'probe-editor-070', 'r8-wrap.json', ['b1', 'b2', 'b3', 'b4', 'b5']), version).toEqual([
      [59, 30, 'Standard'], [78, 30, 'Standard'], [49, 44, 'Standard'], [66, 30, 'Standard'], [28, 15, 'Standard']]);
    expect(widths(version, 'probe-panel', 'r8-trail.json', ['t-end3', 't-tail5', 't-inner', 't-both', 'n-end3']), version).toEqual([
      [29, 25, 'Standard'], [23, 25, 'Standard'], [27, 25, 'Standard'], [97, 25, 'Standard'], [33, 25, 'Standard']]);
  }
});

describe('Standard normal, a break at a run of spaces (canvas-free measurer: 7px a character at 14px)', () => {
  const measure = createDefaultMeasureText();
  const width = (text: string, available: number, whiteSpace = 'normal') =>
    measure(text, { fontSize: 14, fontStyle: 'normal', whiteSpace, textGenerator: 'standard' }, available).width;

  it('no glyph after the run fits: the width is the line alone (r8-wrap runtime b1, b4)', () => {
    // "alpha" 35; the run would reach 49 inside 51; "alpha     b" is 77.
    expect(width('alpha     beta', 51)).toBe(width('alpha', 0, 'nowrap') + 1);
    // "glass" 35; eight of its nine spaces would fit in 92; "glass         j" is 105.
    expect(width('glass         jar', 92)).toBe(width('glass', 0, 'nowrap') + 1);
  });

  it('a glyph after the run fits: the run and that glyph count (r8-wrap editor b1, b4)', () => {
    // "alpha     be" is 84 inside 85; "alpha     bet" is 91.
    expect(width('alpha     beta', 85)).toBe(width('alpha     be', 0, 'nowrap') + 1);
  });

  it('a single space between words is unchanged (R1-W): the line, its space and the start of the next word', () => {
    // "one two" 49; "one two t" 63 inside 64; "one two th" 70.
    expect(width('one two three', 64)).toBe(width('one two t', 0, 'nowrap') + 1);
  });

  it('trailing spaces of the whole text still count nowhere (r8-trail, r8-wrap b5)', () => {
    expect(width('mint  ', 200)).toBe(width('mint', 0, 'nowrap'));
  });
});
