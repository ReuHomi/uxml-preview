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

// Measured FontAsset probe, tests/text-cohort/unity/<version>/, 2026-10-16:
// Inter-Regular SDF is the editor default.
export const EDITOR_DEFAULT_FACE_INFO: FaceInfo = {
  pointSize: 90, ascentLine: 87.1875, descentLine: -21.73295, lineHeight: 108.9205,
};

export function textHeight(
  lines: number, fontSize: number, face: FaceInfo,
  paragraphBreaks = 0, paragraphSpacing = 0,
): number {
  // Measured on 6.3 LTS, 2026-10-16 (tests/text-cohort/unity/).
  return Math.ceil(lines * fontSize * (face.ascentLine - face.descentLine) / face.pointSize
    + paragraphBreaks * paragraphSpacing * fontSize / 100);
}

export function fontList(family?: string): string {
  return family === undefined ? 'sans-serif' : `${JSON.stringify(family)}, sans-serif`;
}

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

    const paragraphs = text.split('\n');
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
      for (const word of paragraph.split(/\s+/).filter((w) => w.length > 0)) {
        const candidate = current === '' ? word : `${current} ${word}`;
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
      face ?? EDITOR_DEFAULT_FACE_INFO, paragraphs.length - 1, style.paragraphSpacing ?? 0) };
  };
}
