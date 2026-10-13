/**
 * Every USS property Unity documents, and what this renderer does with it.
 *
 * Transcribed from Unity's USS property reference, not reasoned from CSS. The
 * renderer's first failure mode is assuming a CSS name or default carries over,
 * and a hand-kept list per concern (inherited, unsupported, version-dependent)
 * had already drifted three ways: `text-shadow` missing from inheritance,
 * `filter` reported as non-USS after 6.3 added it, `gap` reported as
 * version-dependent although no version has it.
 *
 * Source (checked 2026-10-13, see `USS_PROPERTY_SOURCE`):
 *   https://docs.unity.com/en-us/engine/6000.0/manual/uitoolkits/uielements/uie-uss/properties/reference  (95 rows)
 *   https://docs.unity.com/en-us/engine/6000.3/manual/uitoolkits/uielements/uie-uss/properties/reference  (99 rows)
 *   https://docs.unity.com/en-us/engine/6000.6/manual/uitoolkits/uielements/uie-uss/properties/reference (102 rows)
 *
 * `since` and `inherited` are Unity's facts and come from those tables alone.
 * `handling` is this renderer's fact, observed rather than declared: `layout`
 * means it can move a box (src/layout/yoga.ts), `paint` means it changes what
 * is drawn and never where (src/render/css-map.ts), `none` means nothing
 * reads it. A row's handling may only change together with the code —
 * tests/style/registry.test.ts renders every row and fails when the two
 * disagree.
 */

/** The first Unity release whose reference table lists the property. */
export type UssVersion = '6000.0' | '6000.3' | '6000.6';

export type Handling = 'layout' | 'paint' | 'none';

export interface UssProperty {
  readonly name: string;
  readonly since: UssVersion;
  /** Unity's "Inherited" column. */
  readonly inherited: boolean;
  readonly handling: Handling;
}

export const USS_PROPERTY_SOURCE = {
  checked: '2026-10-13',
  tables: {
    '6000.0': 'https://docs.unity.com/en-us/engine/6000.0/manual/uitoolkits/uielements/uie-uss/properties/reference',
    '6000.3': 'https://docs.unity.com/en-us/engine/6000.3/manual/uitoolkits/uielements/uie-uss/properties/reference',
    '6000.6': 'https://docs.unity.com/en-us/engine/6000.6/manual/uitoolkits/uielements/uie-uss/properties/reference',
  },
  /** Row count of each table on the date above. A test holds the data to these. */
  counts: { '6000.0': 95, '6000.3': 99, '6000.6': 102 },
} as const;

type Row = readonly [name: string, since: UssVersion, inherited: boolean, handling: Handling];

// Order and spelling follow the 6000.6 table.
const ROWS: readonly Row[] = [
  ['align-content', '6000.0', false, 'layout'],
  ['align-items', '6000.0', false, 'layout'],
  ['align-self', '6000.0', false, 'layout'],
  ['all', '6000.0', false, 'none'],
  ['animation-play-state', '6000.6', false, 'none'],
  ['aspect-ratio', '6000.3', false, 'none'],
  ['backdrop-filter', '6000.6', false, 'none'],
  ['background-color', '6000.0', false, 'paint'],
  ['background-image', '6000.0', false, 'paint'],
  ['background-position', '6000.0', false, 'paint'],
  ['background-position-x', '6000.0', false, 'none'],
  ['background-position-y', '6000.0', false, 'none'],
  ['background-repeat', '6000.0', false, 'paint'],
  ['background-size', '6000.0', false, 'paint'],
  ['border-bottom-color', '6000.0', false, 'paint'],
  ['border-bottom-left-radius', '6000.0', false, 'paint'],
  ['border-bottom-right-radius', '6000.0', false, 'paint'],
  ['border-bottom-width', '6000.0', false, 'layout'],
  ['border-color', '6000.0', false, 'paint'],
  ['border-left-color', '6000.0', false, 'paint'],
  ['border-left-width', '6000.0', false, 'layout'],
  ['border-radius', '6000.0', false, 'paint'],
  ['border-right-color', '6000.0', false, 'paint'],
  ['border-right-width', '6000.0', false, 'layout'],
  ['border-top-color', '6000.0', false, 'paint'],
  ['border-top-left-radius', '6000.0', false, 'paint'],
  ['border-top-right-radius', '6000.0', false, 'paint'],
  ['border-top-width', '6000.0', false, 'layout'],
  ['border-width', '6000.0', false, 'layout'],
  ['bottom', '6000.0', false, 'layout'],
  ['color', '6000.0', true, 'paint'],
  ['cursor', '6000.0', false, 'paint'],
  ['display', '6000.0', false, 'layout'],
  ['filter', '6000.3', false, 'none'],
  ['flex', '6000.0', false, 'layout'],
  ['flex-basis', '6000.0', false, 'layout'],
  ['flex-direction', '6000.0', false, 'layout'],
  ['flex-grow', '6000.0', false, 'layout'],
  ['flex-shrink', '6000.0', false, 'layout'],
  ['flex-wrap', '6000.0', false, 'layout'],
  ['font-size', '6000.0', true, 'layout'],
  ['height', '6000.0', false, 'layout'],
  ['justify-content', '6000.0', false, 'layout'],
  ['left', '6000.0', false, 'layout'],
  ['letter-spacing', '6000.0', true, 'paint'],
  ['margin', '6000.0', false, 'layout'],
  ['margin-bottom', '6000.0', false, 'layout'],
  ['margin-left', '6000.0', false, 'layout'],
  ['margin-right', '6000.0', false, 'layout'],
  ['margin-top', '6000.0', false, 'layout'],
  ['max-height', '6000.0', false, 'layout'],
  ['max-width', '6000.0', false, 'layout'],
  ['min-height', '6000.0', false, 'layout'],
  ['min-width', '6000.0', false, 'layout'],
  ['opacity', '6000.0', false, 'paint'],
  // Yoga is told about `hidden`, but at this Yoga version it never moves a box;
  // what shows is the clipping, which is the CSS mapping's.
  ['overflow', '6000.0', false, 'paint'],
  ['padding', '6000.0', false, 'layout'],
  ['padding-bottom', '6000.0', false, 'layout'],
  ['padding-left', '6000.0', false, 'layout'],
  ['padding-right', '6000.0', false, 'layout'],
  ['padding-top', '6000.0', false, 'layout'],
  ['position', '6000.0', false, 'layout'],
  ['right', '6000.0', false, 'layout'],
  ['rotate', '6000.0', false, 'paint'],
  ['scale', '6000.0', false, 'paint'],
  ['text-overflow', '6000.0', false, 'paint'],
  ['text-shadow', '6000.0', true, 'none'],
  ['top', '6000.0', false, 'layout'],
  ['transform-origin', '6000.0', false, 'paint'],
  ['transition', '6000.0', false, 'none'],
  ['transition-delay', '6000.0', false, 'none'],
  ['transition-duration', '6000.0', false, 'none'],
  ['transition-property', '6000.0', false, 'none'],
  ['transition-timing-function', '6000.0', false, 'none'],
  ['translate', '6000.0', false, 'paint'],
  ['-unity-animation-clip', '6000.6', false, 'none'],
  ['-unity-background-image-tint-color', '6000.0', false, 'none'],
  ['-unity-background-scale-mode', '6000.0', false, 'paint'],
  ['-unity-editor-text-rendering-mode', '6000.0', true, 'none'],
  ['-unity-font', '6000.0', true, 'none'],
  ['-unity-font-definition', '6000.0', true, 'none'],
  ['-unity-font-style', '6000.0', true, 'layout'],
  ['-unity-material', '6000.3', true, 'none'],
  ['-unity-overflow-clip-box', '6000.0', false, 'none'],
  ['-unity-paragraph-spacing', '6000.0', true, 'none'],
  ['-unity-slice-bottom', '6000.0', false, 'none'],
  ['-unity-slice-left', '6000.0', false, 'none'],
  ['-unity-slice-right', '6000.0', false, 'none'],
  ['-unity-slice-scale', '6000.0', false, 'none'],
  ['-unity-slice-top', '6000.0', false, 'none'],
  ['-unity-slice-type', '6000.0', false, 'none'],
  ['-unity-text-align', '6000.0', true, 'paint'],
  ['-unity-text-auto-size', '6000.3', true, 'none'],
  ['-unity-text-generator', '6000.0', true, 'none'],
  ['-unity-text-outline', '6000.0', false, 'none'],
  ['-unity-text-outline-color', '6000.0', true, 'none'],
  ['-unity-text-outline-width', '6000.0', true, 'none'],
  ['-unity-text-overflow-position', '6000.0', false, 'none'],
  ['visibility', '6000.0', true, 'paint'],
  ['white-space', '6000.0', true, 'layout'],
  ['width', '6000.0', false, 'layout'],
  ['word-spacing', '6000.0', true, 'paint'],
];

export const USS_PROPERTIES: readonly UssProperty[] = ROWS.map(([name, since, inherited, handling]) => ({
  name,
  since,
  inherited,
  handling,
}));

const BY_NAME = new Map(USS_PROPERTIES.map((p) => [p.name, p]));

/** Undefined for anything Unity does not document, custom properties included. */
export function ussProperty(name: string): UssProperty | undefined {
  return BY_NAME.get(name);
}
