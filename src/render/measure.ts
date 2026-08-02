/**
 * Default text measurement.
 *
 * Deliberately replaceable. Canvas metrics vary with the platform and the fonts
 * that happen to be installed, so a golden test that leans on them is measuring
 * the machine as much as the library. Callers that need reproducibility pass
 * their own `measureText`.
 */

import type { MeasureText } from '../layout/yoga';

/** Rough ratio of line box height to font size for a single line of text. */
const LINE_HEIGHT_RATIO = 1.2;

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
    const lineHeight = style.fontSize * LINE_HEIGHT_RATIO;

    const widthOf = (value: string): number => {
      if (context === null) {
        // No canvas. Half an em per character is wrong, but it is wrong the
        // same way every time, which keeps a headless layout usable.
        return value.length * style.fontSize * 0.5;
      }
      const weight = style.fontStyle.includes('bold') ? 'bold' : 'normal';
      const italic = style.fontStyle.includes('italic') ? 'italic' : 'normal';
      context.font = `${italic} ${weight} ${style.fontSize}px sans-serif`;
      return context.measureText(value).width;
    };

    const wraps = style.whiteSpace !== 'nowrap' && style.whiteSpace !== 'pre';
    if (!wraps || availableWidth <= 0) {
      return { width: widthOf(text), height: lineHeight };
    }

    const words = text.split(/\s+/).filter((w) => w.length > 0);
    let lines = 1;
    let current = 0;
    let widest = 0;
    for (const word of words) {
      const wordWidth = widthOf(word);
      const spaceWidth = current === 0 ? 0 : widthOf(' ');
      if (current > 0 && current + spaceWidth + wordWidth > availableWidth) {
        widest = Math.max(widest, current);
        lines++;
        current = wordWidth;
      } else {
        current += spaceWidth + wordWidth;
      }
    }
    widest = Math.max(widest, current);
    return { width: widest, height: lines * lineHeight };
  };
}
