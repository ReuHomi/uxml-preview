/**
 * USS values: initial values, and turning declaration text into numbers.
 *
 * This is the first place in the pipeline that interprets a value. The model
 * and the resolver both keep declarations as the author wrote them, so `6px`
 * stays `6px` until something needs a number — which is here.
 */

/**
 * USS initial values for the properties layout depends on.
 *
 * The resolver deliberately does not fill defaults in, so this table is the
 * only statement of them. Two entries are worth staring at:
 *
 *   - `flex-direction` is `column`. CSS says `row`. Getting this wrong rotates
 *     every layout by ninety degrees, and it is the single most common way to
 *     mis-port a stylesheet.
 *   - `flex-shrink` is `1` here, while Yoga's own engine default is `0`. That
 *     disagreement is exactly why every supported property is written to the
 *     Yoga node explicitly rather than left at whatever the engine assumes.
 *     Unverified against a running editor; Phase 5 settles it.
 */
export const INITIAL: Readonly<Record<string, string>> = {
  'align-content': 'flex-start',
  'align-items': 'stretch',
  'align-self': 'auto',
  'flex-basis': 'auto',
  'flex-direction': 'column',
  'flex-grow': '0',
  'flex-shrink': '1',
  'flex-wrap': 'nowrap',
  'justify-content': 'flex-start',
  display: 'flex',
  position: 'relative',
  overflow: 'visible',

  bottom: 'auto',
  left: 'auto',
  right: 'auto',
  top: 'auto',

  height: 'auto',
  width: 'auto',
  'max-height': 'none',
  'max-width': 'none',
  'min-height': 'auto',
  'min-width': 'auto',

  'border-bottom-width': '0',
  'border-left-width': '0',
  'border-right-width': '0',
  'border-top-width': '0',
  'margin-bottom': '0',
  'margin-left': '0',
  'margin-right': '0',
  'margin-top': '0',
  'padding-bottom': '0',
  'padding-left': '0',
  'padding-right': '0',
  'padding-top': '0',

  'font-size': '12px',
};

export function initialValue(property: string): string | undefined {
  return INITIAL[property];
}

export type Length =
  | { kind: 'px'; value: number }
  | { kind: 'percent'; value: number }
  | { kind: 'auto' }
  | { kind: 'none' };

/** Units USS does not have. Reported rather than silently treated as pixels. */
const UNSUPPORTED_UNITS = ['em', 'rem', 'vh', 'vw', 'vmin', 'vmax', 'pt', 'cm', 'in'];

export interface LengthResult {
  length: Length | null;
  /** Set when the text names a unit USS does not support, or uses calc(). */
  problem?: string;
}

/**
 * Purpose:      `"6px"` / `"50%"` / `"auto"` / `"0"` -> a number with a unit.
 * Ensures:      never throws. Returns `length: null` with a `problem` for text
 *               it cannot make sense of, so the caller can warn and fall back
 *               rather than render something wrong.
 */
export function parseLength(text: string): LengthResult {
  const value = text.trim();
  if (value === '') return { length: null, problem: 'empty value' };
  if (value === 'auto') return { length: { kind: 'auto' } };
  if (value === 'none') return { length: { kind: 'none' } };
  if (value === 'initial') return { length: { kind: 'auto' } };

  if (value.startsWith('calc(')) {
    return { length: null, problem: 'calc() is not supported in USS' };
  }

  const match = /^(-?(?:\d+\.?\d*|\.\d+))([a-z%]*)$/i.exec(value);
  if (match === null) return { length: null, problem: `cannot read "${value}" as a length` };

  const number = Number(match[1]);
  const unit = match[2]!.toLowerCase();
  if (unit === '' || unit === 'px') return { length: { kind: 'px', value: number } };
  if (unit === '%') return { length: { kind: 'percent', value: number } };
  if (UNSUPPORTED_UNITS.includes(unit)) {
    return { length: null, problem: `"${unit}" is not a USS unit` };
  }
  return { length: null, problem: `unknown unit "${unit}"` };
}

/** Bare numbers such as `flex-grow: 1`. Returns null when it is not one. */
export function parseNumber(text: string): number | null {
  const value = text.trim();
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(value)) return null;
  return Number(value);
}

/** Seconds or milliseconds to milliseconds. */
export function parseDuration(text: string): number | null {
  const match = /^(-?(?:\d+\.?\d*|\.\d+))(ms|s)$/i.exec(text.trim());
  if (match === null) return null;
  const number = Number(match[1]);
  return match[2]!.toLowerCase() === 's' ? number * 1000 : number;
}
