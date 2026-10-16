/**
 * 0.6.1 P1 — CJK line breaking in the default measurer.
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * 0.6.0 split lines at spaces only, so a Japanese or Chinese sentence (no
 * spaces) was always measured as one line while the browser painted several
 * (docs/design/0.7.0-cjk-text.md, result 2). Unity breaks between CJK
 * characters.
 *
 * Expected line counts and heights are read from the Unity dumps in
 * tests/text-cohort/unity/6000.3.25f1/wrap-{ja,zh}.json (Noto Sans JP 20px,
 * boxes 60/100/140/170/220px, 2026-10-16). Every character of those two
 * sentences is 1em wide in Unity (ja 16 characters = 320px, zh 20 = 400px), and
 * the measurer without a canvas gives every character 0.5em, so half the box
 * width holds the same characters per line as Unity's box.
 *
 * Not held here: zh at 60px, which Unity 6.3 draws in 8 lines and character
 * breaking gives 7 — consistent with kinsoku (no line starting with ，or 。),
 * which is not measured and not implemented (tests/text-cohort/spec.json "known").
 *
 * Hangul and Latin keep breaking at spaces only: the text cohort's Korean and
 * English boundary cases pass on that rule (tests/text-cohort/results.json).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createDefaultMeasureText, EDITOR_DEFAULT_FACE_INFO as EDITOR, textHeight } from '../../src/index';
import type { FaceInfo, TextContext } from '../../src/index';

const UNITY = join(process.cwd(), 'tests', 'text-cohort', 'unity', '6000.3.25f1');
const dump = (file: string) =>
  JSON.parse(readFileSync(join(UNITY, file), 'utf8').replace(/\bNaN\b/g, 'null')) as {
    elements: Array<{ name: string; type: string; w: number; h: number; text?: string; faceInfo?: FaceInfo }>;
  };

const measure = createDefaultMeasureText();
const ctx = (faceInfo?: FaceInfo): TextContext => ({
  fontSize: 20,
  fontStyle: 'normal',
  whiteSpace: 'normal',
  ...(faceInfo === undefined ? {} : { faceInfo }),
});

describe('CJK text breaks between characters (Unity 6000.3.25f1 wrap dumps)', () => {
  for (const file of ['wrap-ja.json', 'wrap-zh.json']) {
    const labels = dump(file).elements.filter((e) => e.type === 'Label');
    it(`${file}: five widths`, () => {
      expect(labels).toHaveLength(5);
      for (const e of labels) {
        if (e.name === 'noto-jp-zh-20-w60') continue; // kinsoku, see the header
        const ours = measure(e.text!, ctx(e.faceInfo), e.w / 2);
        expect(ours.height, e.name).toBe(e.h);
      }
    });
  }

  it('the zh sentence at 60px: 7 lines by character breaking (Unity 6.3: 8, known)', () => {
    const e = dump('wrap-zh.json').elements.find((x) => x.name === 'noto-jp-zh-20-w60')!;
    expect(e.h).toBe(textHeight(8, 20, e.faceInfo!));
    expect(measure(e.text!, ctx(e.faceInfo), 30).height).toBe(textHeight(7, 20, e.faceInfo!));
  });

  it('a box wider than the sentence keeps one line', () => {
    expect(measure('吾輩は猫である。名前はまだ無い。', ctx(), 1000).height).toBe(measure('吾輩は猫である。', ctx(), 1000).height);
  });
});

describe('Hangul and Latin still break at spaces only', () => {
  // 4 words; a box narrower than any word gives one line per word, never one per character.
  it('Korean', () => {
    expect(measure('다람쥐 헌 쳇바퀴에 타고파', ctx(), 5).height).toBe(textHeight(4, 20, EDITOR));
  });
  it('English', () => {
    expect(measure('Hamburgefonts Quick', ctx(), 5).height).toBe(textHeight(2, 20, EDITOR));
  });
  it('a Korean word wider than the box is not split', () => {
    expect(measure('쳇바퀴에', ctx(), 5).height).toBe(textHeight(1, 20, EDITOR));
  });
});
