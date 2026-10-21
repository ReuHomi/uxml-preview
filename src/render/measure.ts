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

/**
 * Purpose:      share the canvas-derived host face between measurement and painting.
 * Deps/Effects: probes current canvas font metrics on every call so asynchronously loaded
 *               fonts are reflected; sets the supplied context's font or creates a canvas.
 * Ensures:      missing canvas metrics retain the editor fallback.
 */
export function hostFontFace(doc: Document | undefined, family: string,
  fontStyle = 'normal', context?: CanvasRenderingContext2D | null): FaceInfo {
  if (doc === undefined) return EDITOR_DEFAULT_FACE_INFO;
  const canvas = context ?? doc.createElement('canvas').getContext?.('2d');
  if (canvas == null) return EDITOR_DEFAULT_FACE_INFO;
  const weight = fontStyle.includes('bold') ? 'bold' : 'normal';
  const italic = fontStyle.includes('italic') ? 'italic' : 'normal';
  canvas.font = `${italic} ${weight} 90px ${fontList(family)}`;
  const metrics = canvas.measureText('Mg');
  if (!Number.isFinite(metrics.fontBoundingBoxAscent) || !Number.isFinite(metrics.fontBoundingBoxDescent)) {
    return EDITOR_DEFAULT_FACE_INFO;
  }
  return { pointSize: 90, ascentLine: metrics.fontBoundingBoxAscent, descentLine: -metrics.fontBoundingBoxDescent };
}

// USS: Unity breaks between CJK characters, Hangul and Latin at spaces (a word longer than the line between
// characters): tests/text-cohort/unity/<version>/wrap-*.json, boundary-noto-*.json, tests/layout/unity/<version>/*/r1w-long.json.
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
      face = hostFontFace(doc, style.fontFamily, style.fontStyle, context);
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
    let widthBroken = false;
    // Measured: 6000.3.25f1/{probe-panel,probe-editor-070}/r1w-wrap.json,
    // r1w-wrap2.json; docs/design/0.7.0-bundle-A-plan.md §33.
    // Standard includes the fitting prefix beyond a word break; Advanced only
    // reports the drawn line. Oversized words break between characters in both.
    /**
     * Purpose:      retain Standard's fitting paragraph prefix at a width break.
     * Ensures:      increments the line count without consuming the remaining text.
     */
    const recordBreak = (line: string, rest: string): void => {
      widthBroken = true;
      let measured = widthOf(line);
      if (style.textGenerator === 'standard') {
        let prefix = line;
        for (const character of rest) {
          prefix += character;
          const width = widthOf(prefix);
          if (width > availableWidth) break;
          measured = width;
        }
      }
      widest = Math.max(widest, measured);
      lines++;
    };
    for (const paragraph of paragraphs) {
      let current = '';
      lines++;
      if (!wraps) {
        widest = Math.max(widest, widthOf(paragraph));
        continue;
      }
      // probe-editor/spaces-prewrap.json: preserved space runs hang at
      // a break, but count before the following word.
      const preserved = style.whiteSpace === 'pre-wrap';
      const tokens = preserved
        ? (paragraph.match(/ +|[^ ]+/g) ?? []).flatMap((run) =>
          run[0] === ' ' ? [run] : run.split(CJK_BREAK).filter(Boolean))
          .map((value) => ({ value, separator: '' }))
        : paragraph.split(/\s+/).filter(Boolean).flatMap((word) =>
          word.split(CJK_BREAK).filter(Boolean)
            .map((value, index) => ({ value, separator: index === 0 ? ' ' : '' })));
      let offset = 0;
      // Token offsets refer to the normalized paragraph, retaining the spaces
      // after a line for Standard's prefix measurement.
      const normalized = preserved ? paragraph : tokens.map(({ value, separator }, index) =>
        (index === 0 ? '' : separator) + value).join('');
      for (const [index, { value: word, separator }] of tokens.entries()) {
        const gap = index === 0 ? '' : separator;
        const start = offset + gap.length;
        const candidate = current === '' ? word : current + gap + word;
        if ((!preserved || word[0] !== ' ') && current !== '' && widthOf(candidate) > availableWidth) {
          const line = preserved ? current.trimEnd() : current;
          recordBreak(line, (preserved ? current.slice(line.length) : gap) + normalized.slice(start));
          current = '';
        }
        if (word[0] !== ' ' && widthOf(word) > availableWidth) {
          let characterOffset = start;
          for (const character of word) {
            if (current !== '' && widthOf(current + character) > availableWidth) {
              recordBreak(current, normalized.slice(characterOffset));
              current = '';
            }
            current += character;
            characterOffset += character.length;
          }
        } else current = current === '' ? word : current + gap + word;
        offset = start + word.length;
      }
      widest = Math.max(widest, widthOf(current));
    }
    if (widthBroken && style.textGenerator === 'standard') {
      widest = Math.min(availableWidth, Math.floor(widest) + 1);
    }
    return { width: widest, height: textHeight(lines, style.fontSize,
      face ?? EDITOR_DEFAULT_FACE_INFO, paragraphs.length - 1, style.paragraphSpacing ?? 0, style.textGenerator) };
  };
}
