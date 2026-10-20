/**
 * Default text measurement.
 *
 * Deliberately replaceable. Canvas metrics vary with the platform and the fonts
 * that happen to be installed, so a golden test that leans on them is measuring
 * the machine as much as the library. Callers that need reproducibility pass
 * their own `measureText`.
 */

import type { MeasureText } from '../layout/yoga';

export interface FaceInfo {
  pointSize: number;
  ascentLine: number;
  descentLine: number;
  lineHeight?: number;
}

// FaceInfo of "Inter - Regular SDF" / "Inter-Regular SDF" reported by Unity:
// tests/text-cohort/unity/<version>/cohort-default.json and cohort-inter.json
// (2026-10-16). Inter-Regular SDF is the editor default.
export const EDITOR_DEFAULT_FACE_INFO: FaceInfo = {
  pointSize: 90, ascentLine: 87.1875, descentLine: -21.73295, lineHeight: 108.9205,
};

export function textHeight(
  lines: number, fontSize: number, face: FaceInfo,
  paragraphBreaks = 0, paragraphSpacing = 0,
  generator: 'standard' | 'advanced' = 'advanced',
): number {
  if (generator === 'standard') {
    // Measured: tests/text-cohort/unity-runtime/; bundle A plan §29.
    // Standard paragraph spacing is unmeasured; retain Advanced's existing term.
    const span = face.ascentLine - face.descentLine;
    return Math.floor(fontSize * span / face.pointSize
      + (lines - 1) * fontSize * (face.lineHeight ?? span) / face.pointSize
      + paragraphBreaks * paragraphSpacing * fontSize / 100) + 1;
  }
  // Measured on 6.3 LTS, 2026-10-16 (tests/text-cohort/unity/).
  return Math.ceil(lines * fontSize * (face.ascentLine - face.descentLine) / face.pointSize
    + paragraphBreaks * paragraphSpacing * fontSize / 100);
}

export function fontList(family?: string): string {
  return family === undefined ? 'sans-serif' : `${JSON.stringify(family)}, sans-serif`;
}

// USS: Unity breaks between CJK characters, Hangul at spaces only: tests/text-cohort/unity/<version>/wrap-*.json, boundary-noto-*.json.
export const CJK_BREAK = /((?![\uFFA0-\uFFDC])[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\u3000-\u303F\u30FC\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFFEF\u{20000}-\u{3FFFF}])/u;

/**
 * Purpose:      measure text with a canvas when one is available.
 * Deps/Effects: creates one offscreen canvas and reuses it.
 * Ensures:      falls back to a fixed per-character estimate when no canvas
 *               exists, so headless callers still lay out rather than
 *               collapsing every label to zero.
 */
export function createDefaultMeasureText(doc?: Document): MeasureText {
  let context: CanvasRenderingContext2D | null = null;
  if (doc !== undefined) {
    const canvas = doc.createElement('canvas');
    context = canvas.getContext?.('2d') ?? null;
  }

  return (text, style, availableWidth) => {
    // Measured: tests/text-cohort/unity-runtime/; bundle A plan §29.
    // The canvas is shared: reset kerning for both generators, including font probes.
    if (context !== null) context.fontKerning = style.textGenerator === 'standard' ? 'none' : 'normal';
    const weight = style.fontStyle.includes('bold') ? 'bold' : 'normal';
    const italic = style.fontStyle.includes('italic') ? 'italic' : 'normal';
    const setFont = (size: number): void => {
      if (context !== null) context.font = `${italic} ${weight} ${size}px ${fontList(style.fontFamily)}`;
    };
    let face = style.faceInfo;
    if (face === undefined && style.fontFamily !== undefined && context !== null) {
      setFont(90);
      const metrics = context.measureText('Mg');
      if (Number.isFinite(metrics.fontBoundingBoxAscent) && Number.isFinite(metrics.fontBoundingBoxDescent)) {
        face = { pointSize: 90, ascentLine: metrics.fontBoundingBoxAscent, descentLine: -metrics.fontBoundingBoxDescent };
      }
    }
    setFont(style.fontSize);
    const widthOf = (value: string): number => {
      const characters = [...value].length;
      const spaces = [...value].filter((c) => c === ' ').length;
      // Unity probes, 2026-10-16: spacing is a percentage of font size;
      // advanced (6.3 editor default) excludes spaces from letter gaps.
      const gaps = Math.max(0, characters - 1 - (style.textGenerator === 'standard' ? 0 : spaces));
      const base = context === null ? characters * style.fontSize * 0.5 : context.measureText(value).width;
      return base + (gaps * (style.letterSpacing ?? 0) + spaces * (style.wordSpacing ?? 0)) * style.fontSize / 100;
    };

    // Leading spaces and space runs are measured in Unity 6.3 LTS (probe-editor/spaces.json);
    // Unity 6000.0 did not collapse them. Dropping trailing spaces under normal/nowrap is
    // NOT measured: it follows CSS, which is what the painter draws.
    // pre and pre-wrap keep spaces (probe-editor/spaces-prewrap.json).
    const paragraphs = text.split('\n').map((paragraph) =>
      style.whiteSpace === 'pre' || style.whiteSpace === 'pre-wrap' ? paragraph : paragraph.replace(/ +/g, ' ').trim());
    const wraps = style.whiteSpace !== 'nowrap' && style.whiteSpace !== 'pre' && availableWidth > 0;
    let lines = 0;
    let widest = 0;
    for (const paragraph of paragraphs) {
      let current = '';
      lines++;
      if (!wraps) {
        widest = Math.max(widest, widthOf(paragraph));
        continue;
      }
      const tokens = paragraph.split(/\s+/).filter((w) => w.length > 0).flatMap((word) =>
        word.split(CJK_BREAK).filter((part) => part.length > 0)
          .map((value, index) => ({ value, separator: index === 0 ? ' ' : '' })));
      for (const { value: word, separator } of tokens) {
        const candidate = current === '' ? word : `${current}${separator}${word}`;
        if (current !== '' && widthOf(candidate) > availableWidth) {
          widest = Math.max(widest, widthOf(current));
          lines++;
          current = word;
        } else {
          current = candidate;
        }
      }
      widest = Math.max(widest, widthOf(current));
    }
    return { width: widest, height: textHeight(lines, style.fontSize,
      face ?? EDITOR_DEFAULT_FACE_INFO, paragraphs.length - 1, style.paragraphSpacing ?? 0, style.textGenerator) };
  };
}
