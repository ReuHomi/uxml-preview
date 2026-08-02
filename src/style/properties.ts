/**
 * Which properties inherit, and how shorthands split.
 *
 * Shorthand expansion belongs to the cascade rather than to rendering: once a
 * sheet contains both `padding` and `padding-top`, deciding which one wins is a
 * cascade question, and it cannot be answered without splitting the shorthand
 * first.
 */

/**
 * Properties a child picks up from its parent when it declares nothing itself.
 *
 * Version-dependent. UI Toolkit has widened this list across releases, so treat
 * it as the one place to correct rather than something to rediscover in the
 * renderer. Anything absent here simply does not inherit.
 */
const INHERITED = new Set([
  'color',
  'font-size',
  'letter-spacing',
  'word-spacing',
  'visibility',
  'white-space',
  '-unity-font',
  '-unity-font-definition',
  '-unity-font-style',
  '-unity-paragraph-spacing',
  '-unity-text-align',
  '-unity-text-outline-color',
  '-unity-text-outline-width',
]);

export function isInherited(property: string): boolean {
  // Custom properties inherit, which is what makes the design-token pattern
  // work: declare them once at the root and read them anywhere below.
  return property.startsWith('--') || INHERITED.has(property);
}

/** Split a value on top-level whitespace, keeping `rgb(1, 2, 3)` in one piece. */
export function splitValue(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < value.length; i++) {
    const c = value[i]!;
    if (c === '(') depth++;
    else if (c === ')') depth = Math.max(0, depth - 1);
    const space = depth === 0 && /\s/.test(c);
    if (space) {
      if (start >= 0) {
        parts.push(value.slice(start, i));
        start = -1;
      }
    } else if (start < 0) {
      start = i;
    }
  }
  if (start >= 0) parts.push(value.slice(start));
  return parts;
}

/** top, right, bottom, left from the CSS 1-to-4 value pattern. */
function box(values: string[]): [string, string, string, string] | null {
  const [a, b, c, d] = values;
  if (a === undefined) return null;
  if (b === undefined) return [a, a, a, a];
  if (c === undefined) return [a, b, a, b];
  if (d === undefined) return [a, b, c, b];
  return [a, b, c, d];
}

const BOX_SHORTHANDS: Record<string, [string, string, string, string]> = {
  margin: ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'],
  padding: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
  'border-width': [
    'border-top-width',
    'border-right-width',
    'border-bottom-width',
    'border-left-width',
  ],
  'border-color': [
    'border-top-color',
    'border-right-color',
    'border-bottom-color',
    'border-left-color',
  ],
  // Radii run clockwise from the top-left corner, not top/right/bottom/left.
  'border-radius': [
    'border-top-left-radius',
    'border-top-right-radius',
    'border-bottom-right-radius',
    'border-bottom-left-radius',
  ],
};

function isNumber(value: string): boolean {
  return /^-?(\d+\.?\d*|\.\d+)$/.test(value);
}

function expandFlex(values: string[]): Array<[string, string]> {
  const [a, b, c] = values;
  if (a === undefined) return [];
  if (a === 'none') return [['flex-grow', '0'], ['flex-shrink', '0'], ['flex-basis', 'auto']];
  if (a === 'auto') return [['flex-grow', '1'], ['flex-shrink', '1'], ['flex-basis', 'auto']];

  if (b === undefined) {
    return isNumber(a)
      ? [['flex-grow', a], ['flex-shrink', '1'], ['flex-basis', '0']]
      : [['flex-grow', '1'], ['flex-shrink', '1'], ['flex-basis', a]];
  }
  if (c === undefined) {
    return isNumber(b)
      ? [['flex-grow', a], ['flex-shrink', b], ['flex-basis', '0']]
      : [['flex-grow', a], ['flex-shrink', '1'], ['flex-basis', b]];
  }
  return [['flex-grow', a], ['flex-shrink', b], ['flex-basis', c]];
}

/**
 * Purpose:      one declaration -> the longhand declarations it stands for.
 * Ensures:      returns `[[property, value]]` unchanged for anything it does
 *               not split, so callers never need to special-case shorthands.
 *
 * `transition` is left whole on purpose: it is a comma-separated list whose
 * longhands are lists too, and nothing before Phase 4 reads it.
 */
export function expandShorthand(property: string, value: string): Array<[string, string]> {
  if (property === 'flex') return expandFlex(splitValue(value));

  const targets = BOX_SHORTHANDS[property];
  if (targets === undefined) return [[property, value]];

  const values = box(splitValue(value));
  if (values === null) return [[property, value]];
  return targets.map((name, i) => [name, values[i]!] as [string, string]);
}
