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

import { isInherited, loadLayoutEngine, parse, render, resolveStyles } from '../../src/index';
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
  for (const property of USS_PROPERTIES) {
    it(`isInherited("${property.name}") follows the table`, () => {
      expect(isInherited(property.name)).toBe(property.inherited);
    });
  }

  it('hands an inherited property to children through the cascade', () => {
    const doc = parse(
      '<ui:UXML xmlns:ui="UnityEngine.UIElements"><ui:VisualElement name="p"><ui:Label name="c" text="x" /></ui:VisualElement></ui:UXML>',
      '#p { text-shadow: 1px 1px red; -unity-text-generator: advanced; transition: opacity 1s; }',
    );
    const child = doc.root.children[0]!.children[0]!;
    const style = resolveStyles(doc).styles.get(child.id)!;
    expect(style.get('text-shadow')?.origin.kind).toBe('inherited');
    expect(style.get('-unity-text-generator')?.origin.kind).toBe('inherited');
    // Not inherited in Unity's table, so it stays on the parent.
    expect(style.has('transition')).toBe(false);
  });

  // What can change a box in Unity, typed from the reasoning in each row's
  // basis rather than read back from the registry.
  const UNITY_LAYOUT = [
    'align-content', 'align-items', 'align-self', 'display', 'flex', 'flex-basis', 'flex-direction',
    'flex-grow', 'flex-shrink', 'flex-wrap', 'justify-content', 'position', 'width', 'height',
    'min-width', 'min-height', 'max-width', 'max-height', 'top', 'right', 'bottom', 'left',
    'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'border-width', 'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
    'aspect-ratio', 'all', 'font-size', 'white-space', '-unity-font-style', 'letter-spacing',
    'word-spacing', '-unity-font', '-unity-font-definition', '-unity-paragraph-spacing',
    '-unity-text-generator', '-unity-text-auto-size',
  ];
  const NOT_IN_A_SETTLED_FRAME = [
    'cursor', 'transition', 'transition-delay', 'transition-duration', 'transition-property',
    'transition-timing-function', 'animation-play-state', '-unity-animation-clip',
  ];

  it('says which properties can move a box in Unity', () => {
    expect(USS_PROPERTIES.filter((p) => p.unity === 'layout').map((p) => p.name).sort()).toEqual(
      [...UNITY_LAYOUT].sort(),
    );
    expect(USS_PROPERTIES.filter((p) => p.unity === 'none').map((p) => p.name).sort()).toEqual(
      [...NOT_IN_A_SETTLED_FRAME].sort(),
    );
  });

  it('never lays out what Unity would not, and gives every judgement a reason', () => {
    expect(USS_PROPERTIES.filter((p) => p.handling === 'layout' && p.unity !== 'layout')).toEqual([]);
    expect(USS_PROPERTIES.filter((p) => p.basis.length === 0)).toEqual([]);
  });

  it('marks as measured the text judgements the 0.6.0 dumps settled, and only those', () => {
    // tests/layout/unity/<version>/probe-editor and tests/text-cohort/unity, 2026-10-15/16.
    for (const name of ['letter-spacing', 'word-spacing', '-unity-font-definition',
      '-unity-paragraph-spacing', '-unity-text-auto-size', '-unity-text-generator', 'text-overflow']) {
      expect(ussProperty(name)?.inferred, name).toBe(false);
    }
    // Only ever written through -unity-font-definition in the probes.
    expect(ussProperty('-unity-font')?.inferred).toBe(true);
    expect(ussProperty('aspect-ratio')?.inferred).toBe(false);
  });

  it('knows nothing about custom properties, which still inherit', () => {
    expect(ussProperty('--token')).toBeUndefined();
    expect(isInherited('--token')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The property sheet: every row rendered against what it claims
// ---------------------------------------------------------------------------

/** Read through the structured fields without depending on their exact type yet. */
type Structured = Warning;

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
  'letter-spacing': { value: '3px', context: 'align-self: flex-start; white-space: nowrap;' },
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
  // Bold widens the text; shrink-wrapped, the box shows it (a stretched no-wrap Label would not, C1).
  '-unity-font-style': { value: 'bold', context: 'align-self: flex-start;' },
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
  // Not 'advanced': that is the default and could never move a box.
  // 0.7.0: the runtime theme (the default) already measures with standard (probe-panel), so the
  // probe sets the other one.
  // g-clamp.json reg-gen/reg-gen-std: at 20px spacing both generators pass the 100px box on the
  // runtime panel and Unity clips both to it, so nothing moves; 5px keeps the text inside.
  '-unity-text-generator': { value: 'advanced', context: 'letter-spacing: 5px; align-self: flex-start; white-space: nowrap;' },
  '-unity-text-outline': { value: '1px red' },
  '-unity-text-outline-color': { value: 'red' },
  '-unity-text-outline-width': { value: '1px' },
  '-unity-text-overflow-position': { value: 'start' },
  visibility: { value: 'hidden' },
  // The scene's lines fit 100px once a line break starts a new line; 40px makes "Hello world" wrap.
  // A Label is no-wrap by default (g-clamp.json, C1), so the sample is the value that wraps.
  'white-space': { value: 'normal', context: 'width: 40px;' },
  width: { value: '37px' },
  'word-spacing': { value: '5px', context: 'align-self: flex-start; white-space: nowrap;' },
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
  // Spacing reaches the measurer since 0.6.0; a measurer blind to it would
  // report those properties as moving nothing.
  // The standard generator also spaces after the last character (text-spacing-standard.json);
  // the advanced one does not. One gap is enough for the layout to see the difference.
  // A line break starts a new line: the width is the widest line, as Unity measures it
  // (g-clamp.json reg-plain: "Hello world\nwide text" is two lines, 75px on the runtime panel).
  const widest = text.split('\n').reduce((a, b) => (b.length > a.length ? b : a));
  const gaps = widest.length - 1 + (context.textGenerator === 'standard' ? 1 : 0);
  const spacing = (gaps * (context.letterSpacing ?? 0) + (context.wordSpacing ?? 0)) * context.fontSize / 100;
  const width = widest.length * context.fontSize * 0.5 * (context.fontStyle.includes('bold') ? 2 : 1) + spacing;
  const wraps = context.whiteSpace !== 'nowrap' && context.whiteSpace !== 'pre' && availableWidth > 0;
  const lines = wraps ? Math.max(1, Math.ceil(width / availableWidth)) : 1;
  const breaks = text.split('\n').length - 1;
  return {
    width: wraps ? Math.min(width, availableWidth) : width,
    height: lines * context.fontSize * 1.2 + breaks * (context.paragraphSpacing ?? 0) * context.fontSize / 100,
  };
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
  '<ui:VisualElement style="width: 100px;"><ui:Label name="t" text="Hello world&#10;wide text" /></ui:VisualElement>' +
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

const propertySubject = (w: Structured) => (w.subject?.kind === 'property' ? w.subject : undefined);

describe('property sheet: each documented property does what the registry says', () => {
  it('has a sample for every row and nothing else', () => {
    expect(Object.keys(SAMPLES).sort()).toEqual(USS_PROPERTIES.map((p) => p.name).sort());
  });

  for (const property of USS_PROPERTIES) {
    it(`${property.name} (${property.handling})`, () => {
      // The second scene's warnings are counted too, but a declaration is
      // reported once per scene, so each scene contributes at most one.
      const outcome = tryDeclaration(property.name, SAMPLES[property.name]!);
      switch (property.handling) {
        case 'layout':
          expect(outcome.added, 'a property the layout reads raises no warning').toEqual([]);
          expect(outcome.movedBoxes, 'and moves a box').toBe(true);
          break;
        case 'paint': {
          expect(outcome.changedCss, 'it changes what is painted').toBe(true);
          expect(outcome.movedBoxes, 'and never moves a box').toBe(false);
          if (property.unity !== 'layout') {
            expect(outcome.added, 'a property the painter fully reads raises no warning').toEqual([]);
            break;
          }
          // Drawn, but what it does to layout in Unity is not reproduced.
          const partial = aboutProperty(outcome.added, property.name);
          expect(outcome.added).toEqual(partial);
          expect(partial, 'it says so, once per scene').toHaveLength(2);
          expect(partial.every((w) => w.reason === 'not-rendered')).toBe(true);
          expect(partial.map((w) => propertySubject(w)?.applied)).toEqual(['paint', 'paint']);
          expect(partial.map((w) => propertySubject(w)?.affectsLayout)).toEqual([true, true]);
          break;
        }
        case 'none': {
          expect(outcome.movedBoxes || outcome.changedCss, 'nothing reads it').toBe(false);
          const warnings = aboutProperty(outcome.added, property.name);
          expect(warnings, 'and it says so, once per scene').toHaveLength(2);
          expect(warnings.every((w) => w.kind === 'unsupported-property')).toBe(true);
          expect(warnings.every((w) => w.reason === 'not-rendered')).toBe(true);
          expect(warnings.map((w) => propertySubject(w)?.since)).toEqual([property.since, property.since]);
          const affects = property.unity === 'layout';
          expect(warnings.map((w) => propertySubject(w)?.affectsLayout), 'and whether Unity would move a box').toEqual([affects, affects]);
          expect(warnings.map((w) => propertySubject(w)?.applied)).toEqual([undefined, undefined]);
          // Only a property newer than the oldest table says so in its text.
          expect(warnings[0]!.message.includes('Unity 6.')).toBe(property.since !== '6000.0');
          break;
        }
      }
    });
  }

  for (const entry of NOT_USS) {
    it(`${entry.name} is reported as not USS`, () => {
      const outcome = tryDeclaration(entry.name, { value: entry.value });
      expect(outcome.movedBoxes || outcome.changedCss).toBe(false);
      const warnings = aboutProperty(outcome.added, entry.name);
      expect(warnings).toHaveLength(2);
      expect(warnings.every((w) => w.kind === 'unsupported-property' && w.reason === 'not-uss')).toBe(true);
      expect(propertySubject(warnings[0]!)?.replacements).toEqual(entry.replacements);
    });
  }

  it('says nothing about a custom property', () => {
    expect(tryDeclaration('--token', { value: '1' }).added).toEqual([]);
  });
});
