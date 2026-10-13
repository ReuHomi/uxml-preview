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

/** What a property can change in Unity: a box's size or position, only pixels, or nothing in a settled frame. */
export type UnityEffect = 'layout' | 'paint' | 'none';

export interface UssProperty {
  readonly name: string;
  readonly since: UssVersion;
  /** Unity's "Inherited" column. */
  readonly inherited: boolean;
  /** What THIS renderer does with it. Observed; see the header. */
  readonly handling: Handling;
  /**
   * What it can do IN UNITY — a different question from `handling`, and the
   * two must not be read for each other. Where they disagree (`unity: 'layout'`
   * with `handling` other than `'layout'`), this preview's coordinates can
   * differ from Unity's whenever the property is written.
   */
  readonly unity: UnityEffect;
  /** Why `unity` is what it is, in one line. */
  readonly basis: string;
  /** True when `basis` is reasoning rather than a Unity statement or a measurement. */
  readonly inferred: boolean;
}

/**
 * The reasons behind the `unity` column, shared by rows that rest on the same
 * argument. Keys ending in `Inferred` are reasoning, not documentation or
 * measurement, and are reported as such (`UssProperty.inferred`): each is a
 * candidate for a Unity dump before it is relied on.
 */
const BASIS = {
  yoga: 'A flexbox style input of Yoga, which UI Toolkit lays out with (CLAUDE.md rule 1); many are compared in the golden set',
  box: 'Margin, padding and border widths are part of the box Yoga sizes and places',
  aspectRatio: 'Yoga sizes a box from aspect-ratio, which Unity passes through from 6.3',
  all: 'Resets every property at once, layout properties included',
  textSize: 'Font size sets the measured size of an auto-sized text element',
  textMeasureInferred: 'Changes glyph metrics or spacing, which feed the text measurement that sizes an auto-sized text element',
  autoSizeInferred: 'Fits the text to the element box rather than the box to the text',
  renderingModeInferred: 'Chooses how glyphs are rasterised in the Editor, not how they are measured',
  ellipsisInferred: 'Truncates text inside a box that is already sized',
  textAlign: 'Places text inside its box; the box does not move (the Step 6 eye check saw it only by looking)',
  textEffectInferred: 'Draws around glyphs that are already placed',
  colour: 'Colour and corner rounding of a box that is already placed',
  visibility: 'Hidden elements keep their space; only display: none removes it',
  transform: 'Transforms apply after layout and do not move siblings (Unity Manual, USS transform)',
  background: 'Draws inside the box; a VisualElement is not sized by its background',
  overflowInferred: 'Clips descendants; with this Yoga version hidden never moved a box (property sheet), and Unity runs Yoga too',
  clipBoxInferred: 'Chooses the clipping rectangle, not any box',
  effectInferred: 'Post-processes pixels that are already drawn',
  cursor: 'Pointer appearance only; nothing is drawn or laid out',
  timeInferred: 'Changes values over time; a settled frame, which is what this preview draws, is unaffected',
} as const;

type BasisKey = keyof typeof BASIS;

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

type Row = readonly [
  name: string,
  since: UssVersion,
  inherited: boolean,
  handling: Handling,
  unity: UnityEffect,
  basis: BasisKey,
];

// Order and spelling follow the 6000.6 table.
const ROWS: readonly Row[] = [
  ['align-content', '6000.0', false, 'layout', 'layout', 'yoga'],
  ['align-items', '6000.0', false, 'layout', 'layout', 'yoga'],
  ['align-self', '6000.0', false, 'layout', 'layout', 'yoga'],
  ['all', '6000.0', false, 'none', 'layout', 'all'],
  ['animation-play-state', '6000.6', false, 'none', 'none', 'timeInferred'],
  ['aspect-ratio', '6000.3', false, 'none', 'layout', 'aspectRatio'],
  ['backdrop-filter', '6000.6', false, 'none', 'paint', 'effectInferred'],
  ['background-color', '6000.0', false, 'paint', 'paint', 'colour'],
  ['background-image', '6000.0', false, 'paint', 'paint', 'background'],
  ['background-position', '6000.0', false, 'paint', 'paint', 'background'],
  ['background-position-x', '6000.0', false, 'none', 'paint', 'background'],
  ['background-position-y', '6000.0', false, 'none', 'paint', 'background'],
  ['background-repeat', '6000.0', false, 'paint', 'paint', 'background'],
  ['background-size', '6000.0', false, 'paint', 'paint', 'background'],
  ['border-bottom-color', '6000.0', false, 'paint', 'paint', 'colour'],
  ['border-bottom-left-radius', '6000.0', false, 'paint', 'paint', 'colour'],
  ['border-bottom-right-radius', '6000.0', false, 'paint', 'paint', 'colour'],
  ['border-bottom-width', '6000.0', false, 'layout', 'layout', 'box'],
  ['border-color', '6000.0', false, 'paint', 'paint', 'colour'],
  ['border-left-color', '6000.0', false, 'paint', 'paint', 'colour'],
  ['border-left-width', '6000.0', false, 'layout', 'layout', 'box'],
  ['border-radius', '6000.0', false, 'paint', 'paint', 'colour'],
  ['border-right-color', '6000.0', false, 'paint', 'paint', 'colour'],
  ['border-right-width', '6000.0', false, 'layout', 'layout', 'box'],
  ['border-top-color', '6000.0', false, 'paint', 'paint', 'colour'],
  ['border-top-left-radius', '6000.0', false, 'paint', 'paint', 'colour'],
  ['border-top-right-radius', '6000.0', false, 'paint', 'paint', 'colour'],
  ['border-top-width', '6000.0', false, 'layout', 'layout', 'box'],
  ['border-width', '6000.0', false, 'layout', 'layout', 'box'],
  ['bottom', '6000.0', false, 'layout', 'layout', 'yoga'],
  ['color', '6000.0', true, 'paint', 'paint', 'colour'],
  ['cursor', '6000.0', false, 'paint', 'none', 'cursor'],
  ['display', '6000.0', false, 'layout', 'layout', 'yoga'],
  ['filter', '6000.3', false, 'none', 'paint', 'effectInferred'],
  ['flex', '6000.0', false, 'layout', 'layout', 'yoga'],
  ['flex-basis', '6000.0', false, 'layout', 'layout', 'yoga'],
  ['flex-direction', '6000.0', false, 'layout', 'layout', 'yoga'],
  ['flex-grow', '6000.0', false, 'layout', 'layout', 'yoga'],
  ['flex-shrink', '6000.0', false, 'layout', 'layout', 'yoga'],
  ['flex-wrap', '6000.0', false, 'layout', 'layout', 'yoga'],
  ['font-size', '6000.0', true, 'layout', 'layout', 'textSize'],
  ['height', '6000.0', false, 'layout', 'layout', 'yoga'],
  ['justify-content', '6000.0', false, 'layout', 'layout', 'yoga'],
  ['left', '6000.0', false, 'layout', 'layout', 'yoga'],
  ['letter-spacing', '6000.0', true, 'paint', 'layout', 'textMeasureInferred'],
  ['margin', '6000.0', false, 'layout', 'layout', 'box'],
  ['margin-bottom', '6000.0', false, 'layout', 'layout', 'box'],
  ['margin-left', '6000.0', false, 'layout', 'layout', 'box'],
  ['margin-right', '6000.0', false, 'layout', 'layout', 'box'],
  ['margin-top', '6000.0', false, 'layout', 'layout', 'box'],
  ['max-height', '6000.0', false, 'layout', 'layout', 'yoga'],
  ['max-width', '6000.0', false, 'layout', 'layout', 'yoga'],
  ['min-height', '6000.0', false, 'layout', 'layout', 'yoga'],
  ['min-width', '6000.0', false, 'layout', 'layout', 'yoga'],
  ['opacity', '6000.0', false, 'paint', 'paint', 'colour'],
  // Yoga is told about `hidden`, but at this Yoga version it never moves a box;
  // what shows is the clipping, which is the CSS mapping's.
  ['overflow', '6000.0', false, 'paint', 'paint', 'overflowInferred'],
  ['padding', '6000.0', false, 'layout', 'layout', 'box'],
  ['padding-bottom', '6000.0', false, 'layout', 'layout', 'box'],
  ['padding-left', '6000.0', false, 'layout', 'layout', 'box'],
  ['padding-right', '6000.0', false, 'layout', 'layout', 'box'],
  ['padding-top', '6000.0', false, 'layout', 'layout', 'box'],
  ['position', '6000.0', false, 'layout', 'layout', 'yoga'],
  ['right', '6000.0', false, 'layout', 'layout', 'yoga'],
  ['rotate', '6000.0', false, 'paint', 'paint', 'transform'],
  ['scale', '6000.0', false, 'paint', 'paint', 'transform'],
  ['text-overflow', '6000.0', false, 'paint', 'paint', 'ellipsisInferred'],
  ['text-shadow', '6000.0', true, 'none', 'paint', 'textEffectInferred'],
  ['top', '6000.0', false, 'layout', 'layout', 'yoga'],
  ['transform-origin', '6000.0', false, 'paint', 'paint', 'transform'],
  ['transition', '6000.0', false, 'none', 'none', 'timeInferred'],
  ['transition-delay', '6000.0', false, 'none', 'none', 'timeInferred'],
  ['transition-duration', '6000.0', false, 'none', 'none', 'timeInferred'],
  ['transition-property', '6000.0', false, 'none', 'none', 'timeInferred'],
  ['transition-timing-function', '6000.0', false, 'none', 'none', 'timeInferred'],
  ['translate', '6000.0', false, 'paint', 'paint', 'transform'],
  ['-unity-animation-clip', '6000.6', false, 'none', 'none', 'timeInferred'],
  ['-unity-background-image-tint-color', '6000.0', false, 'none', 'paint', 'background'],
  ['-unity-background-scale-mode', '6000.0', false, 'paint', 'paint', 'background'],
  ['-unity-editor-text-rendering-mode', '6000.0', true, 'none', 'paint', 'renderingModeInferred'],
  ['-unity-font', '6000.0', true, 'none', 'layout', 'textMeasureInferred'],
  ['-unity-font-definition', '6000.0', true, 'none', 'layout', 'textMeasureInferred'],
  ['-unity-font-style', '6000.0', true, 'layout', 'layout', 'textMeasureInferred'],
  ['-unity-material', '6000.3', true, 'none', 'paint', 'effectInferred'],
  ['-unity-overflow-clip-box', '6000.0', false, 'none', 'paint', 'clipBoxInferred'],
  ['-unity-paragraph-spacing', '6000.0', true, 'none', 'layout', 'textMeasureInferred'],
  ['-unity-slice-bottom', '6000.0', false, 'none', 'paint', 'background'],
  ['-unity-slice-left', '6000.0', false, 'none', 'paint', 'background'],
  ['-unity-slice-right', '6000.0', false, 'none', 'paint', 'background'],
  ['-unity-slice-scale', '6000.0', false, 'none', 'paint', 'background'],
  ['-unity-slice-top', '6000.0', false, 'none', 'paint', 'background'],
  ['-unity-slice-type', '6000.0', false, 'none', 'paint', 'background'],
  ['-unity-text-align', '6000.0', true, 'paint', 'paint', 'textAlign'],
  ['-unity-text-auto-size', '6000.3', true, 'none', 'paint', 'autoSizeInferred'],
  ['-unity-text-generator', '6000.0', true, 'none', 'layout', 'textMeasureInferred'],
  ['-unity-text-outline', '6000.0', false, 'none', 'paint', 'textEffectInferred'],
  ['-unity-text-outline-color', '6000.0', true, 'none', 'paint', 'textEffectInferred'],
  ['-unity-text-outline-width', '6000.0', true, 'none', 'paint', 'textEffectInferred'],
  ['-unity-text-overflow-position', '6000.0', false, 'none', 'paint', 'ellipsisInferred'],
  ['visibility', '6000.0', true, 'paint', 'paint', 'visibility'],
  ['white-space', '6000.0', true, 'layout', 'layout', 'textMeasureInferred'],
  ['width', '6000.0', false, 'layout', 'layout', 'yoga'],
  ['word-spacing', '6000.0', true, 'paint', 'layout', 'textMeasureInferred'],
];

export const USS_PROPERTIES: readonly UssProperty[] = ROWS.map(
  ([name, since, inherited, handling, unity, basis]) => ({
    name,
    since,
    inherited,
    handling,
    unity,
    basis: BASIS[basis],
    inferred: basis.endsWith('Inferred'),
  }),
);

const BY_NAME = new Map(USS_PROPERTIES.map((p) => [p.name, p]));

/** Undefined for anything Unity does not document, custom properties included. */
export function ussProperty(name: string): UssProperty | undefined {
  return BY_NAME.get(name);
}

/**
 * CSS names an author porting a stylesheet reaches for, and the USS
 * properties that do the same job.
 *
 * Chosen, not exhaustive. The first six are the renamed rows of CLAUDE.md's
 * "이름이 다른 속성" table and docs/uss-reference.md; the rest are CSS
 * shorthands or per-axis splits whose every part USS has under another name.
 * A CSS property with no USS counterpart (`z-index`, `box-shadow`, `gap`) is
 * deliberately absent — offering a replacement there would invent one.
 */
export const CSS_REPLACEMENTS: Readonly<Record<string, readonly string[]>> = {
  'font-family': ['-unity-font-definition'],
  'font-weight': ['-unity-font-style'],
  'font-style': ['-unity-font-style'],
  'text-align': ['-unity-text-align'],
  transform: ['translate', 'rotate', 'scale'],
  'border-image': ['-unity-slice-left', '-unity-slice-top', '-unity-slice-right', '-unity-slice-bottom'],
  'vertical-align': ['-unity-text-align'],
  font: ['font-size', '-unity-font-definition', '-unity-font-style'],
  inset: ['top', 'right', 'bottom', 'left'],
  'overflow-x': ['overflow'],
  'overflow-y': ['overflow'],
};

/** What this preview did instead, for the properties where "not drawn" says too little. */
const NOT_RENDERED_TEXT: Readonly<Record<string, string>> = {
  'aspect-ratio': 'not applied to layout by this preview',
  '-unity-font': 'font not loaded by this preview; the browser default is used',
  '-unity-font-definition': 'font not loaded by this preview; the browser default is used',
  transition: 'not animated by this preview',
  'transition-delay': 'not animated by this preview',
  'transition-duration': 'not animated by this preview',
  'transition-property': 'not animated by this preview',
  'transition-timing-function': 'not animated by this preview',
  'animation-play-state': 'not animated by this preview',
  '-unity-animation-clip': 'not animated by this preview',
};

/** `"6000.3"` -> `"Unity 6.3+"`. */
function versionLabel(version: UssVersion): string {
  return `Unity 6.${version.slice('6000.'.length)}+`;
}

export interface PropertyWarning {
  message: string;
  reason: 'not-uss' | 'not-rendered';
  subject: {
    kind: 'property';
    property: string;
    value: string;
    since?: string;
    replacements?: readonly string[];
    affectsLayout?: boolean;
    applied?: 'paint';
  };
}

/**
 * Purpose:      what a declaration warrants by its property name alone.
 * Ensures:      null for custom properties and for anything this renderer
 *               reads; a value-level problem is the reader's to report.
 *
 * Judged per declaration rather than per element, so a rule matching a
 * hundred elements — or matching none — says it once, and an inherited value
 * never says it again on every descendant.
 */
export function propertyWarning(property: string, value: string): PropertyWarning | null {
  if (property.startsWith('--')) return null;
  const known = ussProperty(property);
  if (known === undefined) {
    const replacements = CSS_REPLACEMENTS[property];
    return {
      message:
        `${property}: not a USS property; ignored` +
        (replacements === undefined ? '' : `; USS uses ${replacements.join(', ')}`),
      reason: 'not-uss',
      subject: { kind: 'property', property, value, ...(replacements === undefined ? {} : { replacements }) },
    };
  }
  const affectsLayout = known.unity === 'layout';
  const label = known.since === '6000.0' ? '' : ` (${versionLabel(known.since)})`;
  // Drawn, but what it does to layout in Unity is not reproduced: the picture
  // looks right while the boxes may not be. Said, because a consumer judging
  // coordinates (collapsed, overflowing) must know they are not Unity's here.
  if (known.handling === 'paint' && affectsLayout) {
    return {
      message: `${property}${label}: drawn, but left out of text measurement by this preview`,
      reason: 'not-rendered',
      subject: { kind: 'property', property, value, since: known.since, affectsLayout, applied: 'paint' },
    };
  }
  if (known.handling !== 'none') return null;
  return {
    message: `${property}${label}: ${NOT_RENDERED_TEXT[property] ?? 'not drawn by this preview'}`,
    reason: 'not-rendered',
    subject: { kind: 'property', property, value, since: known.since, affectsLayout },
  };
}

/**
 * The pseudo-class states a Unity element can be in — what `states` and
 * `activeStates` accept and what a USS state selector can match.
 *
 * From Unity's "USS selectors: Pseudo-classes" page (checked 2026-10-13):
 * https://docs.unity3d.com/Manual/UIE-USS-Selectors-Pseudo-Classes.html
 * `:root` is excluded because it names a place in the tree, not a state.
 * `:selected` is excluded because that page says USS does not support it
 * ("Use :checked instead"). Exported so consumers stop keeping their own copy.
 */
export const USS_STATES = ['hover', 'active', 'inactive', 'focus', 'disabled', 'enabled', 'checked'] as const;

export type UssState = (typeof USS_STATES)[number];
