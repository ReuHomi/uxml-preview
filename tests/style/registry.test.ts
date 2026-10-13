/**
 * The property registry against Unity's reference tables, and against what the
 * renderer actually does.
 *
 * Two halves, kept apart on purpose. The first holds the data to Unity's
 * published counts and inheritance column ??facts from outside this repo. The
 * second renders every row and checks the claimed `handling` against what
 * moved: a row that says `paint` must change the painted CSS without moving a
 * box, a row that says `none` must change nothing and say so exactly once.
 *
 * The sample values below are deliberately NOT derived from the registry. If
 * the registry supplied both the input and the expectation, a wrong row would
 * test itself and pass.
 */

import { beforeAll, describe, expect, it } from 'vitest';

import { isInherited, loadLayoutEngine, parse, render } from '../../src/index';
import type { MeasureText, Warning } from '../../src/index';
import { USS_PROPERTIES, USS_PROPERTY_SOURCE, ussProperty } from '../../src/style/registry';

beforeAll(async () => {
  await loadLayoutEngine();
});

// ---------------------------------------------------------------------------
// The data against Unity's tables
// ---------------------------------------------------------------------------

describe('registry data', () => {
  it('has as many rows per version as Unity\'s reference tables', () => {
    const upTo = (version: string): number =>
      USS_PROPERTIES.filter((p) => p.since <= version).length;
    expect(upTo('6000.0')).toBe(USS_PROPERTY_SOURCE.counts['6000.0']);
    expect(upTo('6000.3')).toBe(USS_PROPERTY_SOURCE.counts['6000.3']);
    expect(upTo('6000.6')).toBe(USS_PROPERTY_SOURCE.counts['6000.6']);
    expect(USS_PROPERTY_SOURCE.counts).toEqual({ '6000.0': 95, '6000.3': 99, '6000.6': 102 });
  });

  it('has no duplicate names', () => {
    expect(new Set(USS_PROPERTIES.map((p) => p.name)).size).toBe(USS_PROPERTIES.length);
  });

  it('lists exactly the additions Unity documents for 6.3 and 6.6', () => {
    const added = (version: string): string[] =>
      USS_PROPERTIES.filter((p) => p.since === version).map((p) => p.name).sort();
    expect(added('6000.3')).toEqual(['-unity-material', '-unity-text-auto-size', 'aspect-ratio', 'filter']);
    expect(added('6000.6')).toEqual(['-unity-animation-clip', 'animation-play-state', 'backdrop-filter']);
  });

  // Unity's "Inherited: Yes" rows on 2026-10-13, typed from the table rather
  // than read back out of the registry.
  const INHERITED = [
    'color', 'font-size', 'letter-spacing', 'text-shadow', 'visibility', 'white-space',
    'word-spacing', '-unity-editor-text-rendering-mode', '-unity-font',
    '-unity-font-definition', '-unity-font-style', '-unity-material',
    '-unity-paragraph-spacing', '-unity-text-align', '-unity-text-auto-size',
    '-unity-text-generator', '-unity-text-outline-color', '-unity-text-outline-width',
  ];

  it('marks exactly Unity\'s 18 inherited properties', () => {
    expect(USS_PROPERTIES.filter((p) => p.inherited).map((p) => p.name).sort()).toEqual(
      [...INHERITED].sort(),
    );
  });

  // What the cascade does must follow the table, not a second list.
  const NOT_YET_DERIVED = new Set([
    'text-shadow',
    '-unity-editor-text-rendering-mode',
    '-unity-text-generator',
    '-unity-material',
    '-unity-text-auto-size',
  ]);
  for (const property of USS_PROPERTIES) {
    const name = `isInherited("${property.name}") follows the table`;
    if (NOT_YET_DERIVED.has(property.name)) {
      it.todo(name);
      continue;
    }
    it(name, () => {
      expect(isInherited(property.name)).toBe(property.inherited);
    });
  }

  it('knows nothing about custom properties, which still inherit', () => {
    expect(ussProperty('--token')).toBeUndefined();
    expect(isInherited('--token')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The property sheet: every row rendered against what it claims
// ---------------------------------------------------------------------------

/** Read through the structured fields without depending on their exact type yet. */
type Structured = Warning & {
  reason?: string;
  subject?: { kind: string; property?: string; replacements?: readonly string[]; since?: string };
};

interface Sample {
  value: string;
  /** Declarations applied in both the baseline and the sample, e.g. an image to position. */
  context?: string;
  /** Selector the declaration goes on, when `#t` itself is not where it shows. */
  target?: string;
}

/**
 * One value per documented property, chosen so the property visibly does
 * something in one of the two scenes below if the renderer reads it at all.
 */
const SAMPLES: Readonly<Record<string, Sample>> = {
  'align-content': { value: 'center', context: 'flex-wrap: wrap; height: 50px;' },
  'align-items': { value: 'center' },
  'align-self': { value: 'center' },
  all: { value: 'initial' },
  'animation-play-state': { value: 'paused' },
  'aspect-ratio': { value: '2' },
  'backdrop-filter': { value: 'blur(4px)' },
  'background-color': { value: 'red' },
  'background-image': { value: 'url("project://database/Assets/a.png")' },
  'background-position': { value: 'left top', context: 'background-image: url("a.png");' },
  'background-position-x': { value: 'left 4px', context: 'background-image: url("a.png");' },
  'background-position-y': { value: 'top 4px', context: 'background-image: url("a.png");' },
  'background-repeat': { value: 'repeat-x', context: 'background-image: url("a.png");' },
  'background-size': { value: '10px 10px', context: 'background-image: url("a.png");' },
  'border-bottom-color': { value: 'red' },
  'border-bottom-left-radius': { value: '4px' },
  'border-bottom-right-radius': { value: '4px' },
  'border-bottom-width': { value: '3px' },
  'border-color': { value: 'red' },
  'border-left-color': { value: 'red' },
  'border-left-width': { value: '3px' },
  'border-radius': { value: '4px' },
  'border-right-color': { value: 'red' },
  'border-right-width': { value: '3px', context: 'align-items: flex-end;' },
  'border-top-color': { value: 'red' },
  'border-top-left-radius': { value: '4px' },
  'border-top-right-radius': { value: '4px' },
  'border-top-width': { value: '3px' },
  'border-width': { value: '3px' },
  bottom: { value: '5px' },
  color: { value: 'red' },
  cursor: { value: 'text' },
  display: { value: 'none' },
  filter: { value: 'blur(2px)' },
  flex: { value: '1 0 10px' },
  'flex-basis': { value: '33px' },
  'flex-direction': { value: 'row' },
  'flex-grow': { value: '1' },
  'flex-shrink': { value: '0', target: '#t > *', context: 'height: 50px;' },
  'flex-wrap': { value: 'wrap', context: 'height: 50px;' },
  'font-size': { value: '20px' },
  height: { value: '37px' },
  'justify-content': { value: 'center' },
  left: { value: '5px' },
  'letter-spacing': { value: '3px' },
  margin: { value: '7px' },
  'margin-bottom': { value: '7px' },
  'margin-left': { value: '7px' },
  'margin-right': { value: '7px' },
  'margin-top': { value: '7px' },
  'max-height': { value: '50px' },
  'max-width': { value: '50px' },
  'min-height': { value: '150px' },
  'min-width': { value: '150px' },
  opacity: { value: '0.5' },
  overflow: { value: 'hidden' },
  padding: { value: '7px' },
  'padding-bottom': { value: '7px' },
  'padding-left': { value: '7px' },
  'padding-right': { value: '7px', context: 'align-items: flex-end;' },
  'padding-top': { value: '7px' },
  position: { value: 'absolute' },
  right: { value: '5px' },
  rotate: { value: '10deg' },
  scale: { value: '2 2' },
  'text-overflow': { value: 'ellipsis' },
  'text-shadow': { value: '2px 2px 1px red' },
  top: { value: '5px' },
  'transform-origin': { value: 'left top' },
  transition: { value: 'opacity 1s' },
  'transition-delay': { value: '1s' },
  'transition-duration': { value: '1s' },
  'transition-property': { value: 'opacity' },
  'transition-timing-function': { value: 'ease-in' },
  translate: { value: '5px 5px' },
  '-unity-animation-clip': { value: 'none' },
  '-unity-background-image-tint-color': { value: 'red' },
  '-unity-background-scale-mode': { value: 'scale-to-fit', context: 'background-image: url("a.png");' },
  '-unity-editor-text-rendering-mode': { value: 'bitmap' },
  '-unity-font': { value: 'resource("f")' },
  '-unity-font-definition': { value: 'resource("f")' },
  '-unity-font-style': { value: 'bold' },
  '-unity-material': { value: 'none' },
  '-unity-overflow-clip-box': { value: 'content-box' },
  '-unity-paragraph-spacing': { value: '5px' },
  '-unity-slice-bottom': { value: '4' },
  '-unity-slice-left': { value: '4' },
  '-unity-slice-right': { value: '4' },
  '-unity-slice-scale': { value: '2px' },
  '-unity-slice-top': { value: '4' },
  '-unity-slice-type': { value: 'tiled' },
  '-unity-text-align': { value: 'middle-center' },
  '-unity-text-auto-size': { value: 'best-fit 10px 20px' },
  '-unity-text-generator': { value: 'advanced' },
  '-unity-text-outline': { value: '1px red' },
  '-unity-text-outline-color': { value: 'red' },
  '-unity-text-outline-width': { value: '1px' },
  '-unity-text-overflow-position': { value: 'start' },
  visibility: { value: 'hidden' },
  'white-space': { value: 'nowrap' },
  width: { value: '37px' },
  'word-spacing': { value: '5px' },
};

/**
 * Names Unity does not document, each one a mistake an author porting CSS
 * actually makes. `replacements` is what CLAUDE.md's renamed-property table
 * says to write instead; absent where USS has nothing to offer.
 */
const NOT_USS: ReadonlyArray<{ name: string; value: string; replacements?: readonly string[] }> = [
  { name: 'font-family', value: 'Arial', replacements: ['-unity-font-definition'] },
  { name: 'font-weight', value: 'bold', replacements: ['-unity-font-style'] },
  { name: 'font-style', value: 'italic', replacements: ['-unity-font-style'] },
  { name: 'text-align', value: 'center', replacements: ['-unity-text-align'] },
  { name: 'transform', value: 'rotate(10deg)', replacements: ['translate', 'rotate', 'scale'] },
  { name: 'gap', value: '5px' },
  { name: 'row-gap', value: '5px' },
  { name: 'column-gap', value: '5px' },
  { name: 'overflow-wrap', value: 'anywhere' },
  { name: 'word-break', value: 'break-all' },
  { name: 'box-shadow', value: '1px 1px red' },
  { name: 'z-index', value: '3' },
  { name: 'line-height', value: '20px' },
  { name: 'colour', value: 'red' },
  { name: '-unity-foo', value: '1' },
  { name: 'border', value: '1px solid red' },
  { name: 'background', value: 'red' },
];

/** Text width depends on font size and weight, line count on wrapping. */
const measureText: MeasureText = (text, context, availableWidth) => {
  const width = text.length * context.fontSize * 0.5 * (context.fontStyle.includes('bold') ? 2 : 1);
  const wraps = context.whiteSpace !== 'nowrap' && context.whiteSpace !== 'pre' && availableWidth > 0;
  const lines = wraps ? Math.max(1, Math.ceil(width / availableWidth)) : 1;
  return { width: wraps ? Math.min(width, availableWidth) : width, height: lines * context.fontSize * 1.2 };
};

/** A box with children to lay out, and a sibling after it to push around. */
const BOX_SCENE =
  '<ui:VisualElement name="t">' +
  '<ui:VisualElement name="c1" style="width: 40px; height: 30px;" />' +
  '<ui:VisualElement name="c2" style="width: 40px; height: 30px;" />' +
  '</ui:VisualElement>' +
  '<ui:VisualElement name="after" style="height: 10px;" />';
const BOX_BASE = '#t { width: 100px; height: 100px; }';

/** A wrapping label, for everything that reaches the text. */
const TEXT_SCENE =
  '<ui:VisualElement style="width: 100px;"><ui:Label name="t" text="Hello world wide text" /></ui:VisualElement>' +
  '<ui:VisualElement name="after" style="height: 10px;" />';

interface Snapshot {
  boxes: string;
  css: string;
  warnings: Structured[];
}

function snapshot(scene: string, uss: string): Snapshot {
  const container = document.createElement('div');
  document.body.replaceChildren(container);
  const doc = parse(`<ui:UXML xmlns:ui="UnityEngine.UIElements">${scene}</ui:UXML>`, uss);
  const result = render(doc, container, {
    size: { width: 400, height: 300 },
    measureText,
    resolveAsset: () => 'data:image/png;base64,AAAA',
  });
  const out = {
    boxes: JSON.stringify([...result.boxes.entries()]),
    css: [...result.elements.values()].map((e) => e.getAttribute('style')).join('|'),
    warnings: [...doc.warnings, ...result.warnings] as Structured[],
  };
  result.dispose();
  return out;
}

interface Outcome {
  movedBoxes: boolean;
  changedCss: boolean;
  /** Warnings the declaration added over the baseline. */
  added: Structured[];
}

function tryDeclaration(property: string, sample: Sample): Outcome {
  const outcome: Outcome = { movedBoxes: false, changedCss: false, added: [] };
  for (const [scene, base] of [
    [BOX_SCENE, BOX_BASE],
    [TEXT_SCENE, ''],
  ] as const) {
    const context = sample.context === undefined ? '' : `#t { ${sample.context} }`;
    const before = snapshot(scene, `${base} ${context}`);
    const after = snapshot(
      scene,
      `${base} ${context} ${sample.target ?? '#t'} { ${property}: ${sample.value}; }`,
    );
    if (after.boxes !== before.boxes) outcome.movedBoxes = true;
    if (after.css !== before.css) outcome.changedCss = true;
    const seen = new Set(before.warnings.map((w) => `${w.kind}|${w.message}`));
    for (const w of after.warnings) {
      if (!seen.has(`${w.kind}|${w.message}`)) outcome.added.push(w);
    }
  }
  return outcome;
}

const aboutProperty = (warnings: readonly Structured[], property: string): Structured[] =>
  warnings.filter((w) => w.subject?.kind === 'property' && w.subject.property === property);

describe('property sheet: each documented property does what the registry says', () => {
  it('has a sample for every row and nothing else', () => {
    expect(Object.keys(SAMPLES).sort()).toEqual(USS_PROPERTIES.map((p) => p.name).sort());
  });

  // Rows whose expectation the renderer does not meet yet.
  const PENDING = new Set([
    ...USS_PROPERTIES.filter((p) => p.handling === 'none').map((p) => p.name),
    // Warned as version-dependent although the 6000.0 table already has them.
    'background-position',
    'background-repeat',
    'background-size',
  ]);

  for (const property of USS_PROPERTIES) {
    const name = `${property.name} (${property.handling})`;
    if (PENDING.has(property.name)) {
      it.todo(name);
      continue;
    }
    it(name, () => {
      // The second scene's warnings are counted too, but a declaration is
      // reported once per scene, so each scene contributes at most one.
      const outcome = tryDeclaration(property.name, SAMPLES[property.name]!);
      switch (property.handling) {
        case 'layout':
          expect(outcome.added, 'a property the layout reads raises no warning').toEqual([]);
          expect(outcome.movedBoxes, 'and moves a box').toBe(true);
          break;
        case 'paint':
          expect(outcome.added, 'a property the painter reads raises no warning').toEqual([]);
          expect(outcome.changedCss, 'it changes what is painted').toBe(true);
          expect(outcome.movedBoxes, 'and never moves a box').toBe(false);
          break;
        case 'none': {
          expect(outcome.movedBoxes || outcome.changedCss, 'nothing reads it').toBe(false);
          const warnings = aboutProperty(outcome.added, property.name);
          expect(warnings, 'and it says so, once per scene').toHaveLength(2);
          expect(warnings.every((w) => w.kind === 'unsupported-property')).toBe(true);
          expect(warnings.every((w) => w.reason === 'not-rendered')).toBe(true);
          expect(warnings.map((w) => w.subject?.since)).toEqual([property.since, property.since]);
          // Only a property newer than the oldest table says so in its text.
          expect(warnings[0]!.message.includes('Unity 6.')).toBe(property.since !== '6000.0');
          break;
        }
      }
    });
  }

  for (const entry of NOT_USS) {
    const name = `${entry.name} is reported as not USS`;
    // Not met yet: nothing reports an undocumented name as such.
    const pending = true;
    if (pending) {
      it.todo(name);
      continue;
    }
    it(name, () => {
      const outcome = tryDeclaration(entry.name, { value: entry.value });
      expect(outcome.movedBoxes || outcome.changedCss).toBe(false);
      const warnings = aboutProperty(outcome.added, entry.name);
      expect(warnings).toHaveLength(2);
      expect(warnings.every((w) => w.kind === 'unsupported-property' && w.reason === 'not-uss')).toBe(true);
      expect(warnings[0]!.subject?.replacements).toEqual(entry.replacements);
    });
  }

  it('says nothing about a custom property', () => {
    expect(tryDeclaration('--token', { value: '1' }).added).toEqual([]);
  });
});
