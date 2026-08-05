/**
 * The visual case set.
 *
 * Companion to tests/golden/cases.ts, but for what a coordinate cannot show:
 * colour, borders, corner radii, visibility, text styling, transforms, and the
 * warnings the USS-to-CSS mapping is required to raise instead of guessing.
 * Every property covered here is grounded in src/render/css-map.ts — nothing
 * is included on the strength of what CSS itself supports, because css-map.ts
 * is the only thing that decides what this renderer actually emits.
 *
 * As with the golden set, geometry-only questions do not belong here:
 * visual-harness.ts strips position/left/top/width/height/margin from every
 * snapshot, so a case whose only interesting output is a rectangle would
 * record nothing.
 *
 * Names must stay unique within this file and must not collide with the two
 * inline cases in visual.test.ts (`inline-z`, `inline-box`). Cases whose name
 * starts with `asset-` are run with a resolver that always returns null —
 * see visual.test.ts — so that prefix is reserved for background-image
 * resolution failures.
 */

import type { VisualCase } from './visual-harness';

const wrap = (body: string): string =>
  `<ui:UXML xmlns:ui="UnityEngine.UIElements">\n${body}\n</ui:UXML>\n`;

export const VISUAL_CASES: VisualCase[] = [
  // --- colour ---------------------------------------------------------------
  {
    name: 'visual-colors',
    question: 'Do background-color and (text) color pass straight through to CSS?',
    uxml: wrap(
      '  <ui:VisualElement name="visual-colors-box">\n' +
        '    <ui:Label name="visual-colors-label" text="Hi" />\n' +
        '  </ui:VisualElement>',
    ),
    uss:
      '#visual-colors-box {\n  background-color: rgb(30, 30, 30);\n}\n' +
      '#visual-colors-label {\n  color: rgb(255, 0, 0);\n}\n',
  },

  // --- border ----------------------------------------------------------------
  {
    name: 'visual-borders',
    question: 'Do the four border sides keep independent widths and colours?',
    uxml: wrap('  <ui:VisualElement name="visual-borders-box" />'),
    uss:
      '#visual-borders-box {\n' +
      '  border-top-width: 1px;\n  border-top-color: rgb(255, 0, 0);\n' +
      '  border-right-width: 2px;\n  border-right-color: rgb(0, 128, 0);\n' +
      '  border-bottom-width: 3px;\n  border-bottom-color: rgb(0, 0, 255);\n' +
      '  border-left-width: 4px;\n  border-left-color: rgb(255, 255, 0);\n' +
      '}\n',
  },
  {
    name: 'visual-corner-radii',
    question: 'Do all four corner radii map independently?',
    uxml: wrap('  <ui:VisualElement name="visual-corner-radii-box" />'),
    uss:
      '#visual-corner-radii-box {\n' +
      '  border-top-left-radius: 5px;\n' +
      '  border-top-right-radius: 10px;\n' +
      '  border-bottom-right-radius: 15px;\n' +
      '  border-bottom-left-radius: 20px;\n' +
      '}\n',
  },
  {
    name: 'visual-border-width-percent',
    question: 'Does a non-pixel border width (50%) warn instead of being emitted as CSS?',
    uxml: wrap('  <ui:VisualElement name="visual-border-width-percent-box" />'),
    uss: '#visual-border-width-percent-box {\n  border-top-width: 50%;\n}\n',
  },

  // --- visibility --------------------------------------------------------
  {
    name: 'visual-opacity-visibility-display',
    question: 'Do opacity, visibility: hidden and display: none each pass through unchanged?',
    uxml: wrap(
      '  <ui:VisualElement name="visual-ovd-opacity" />\n' +
        '  <ui:VisualElement name="visual-ovd-hidden" />\n' +
        '  <ui:VisualElement name="visual-ovd-none" />',
    ),
    uss:
      '#visual-ovd-opacity {\n  opacity: 0.5;\n}\n' +
      '#visual-ovd-hidden {\n  visibility: hidden;\n}\n' +
      '#visual-ovd-none {\n  display: none;\n}\n',
  },

  // --- text styling ---------------------------------------------------------
  {
    name: 'visual-font-style',
    question: 'Does each -unity-font-style value map to the right font-weight/font-style pair?',
    uxml: wrap(
      '  <ui:Label name="visual-font-style-normal" text="A" />\n' +
        '  <ui:Label name="visual-font-style-bold" text="B" />\n' +
        '  <ui:Label name="visual-font-style-italic" text="C" />\n' +
        '  <ui:Label name="visual-font-style-bold-italic" text="D" />',
    ),
    uss:
      '#visual-font-style-normal {\n  -unity-font-style: normal;\n}\n' +
      '#visual-font-style-bold {\n  -unity-font-style: bold;\n}\n' +
      '#visual-font-style-italic {\n  -unity-font-style: italic;\n}\n' +
      '#visual-font-style-bold-italic {\n  -unity-font-style: bold-and-italic;\n}\n',
  },
  {
    name: 'visual-text-align',
    question:
      'Does each -unity-text-align band (one per vertical group) map to the right ' +
      'align-items/justify-content pair?',
    uxml: wrap(
      '  <ui:Label name="visual-text-align-upper-left" text="A" />\n' +
        '  <ui:Label name="visual-text-align-middle-center" text="B" />\n' +
        '  <ui:Label name="visual-text-align-lower-right" text="C" />',
    ),
    uss:
      '#visual-text-align-upper-left {\n  -unity-text-align: upper-left;\n}\n' +
      '#visual-text-align-middle-center {\n  -unity-text-align: middle-center;\n}\n' +
      '#visual-text-align-lower-right {\n  -unity-text-align: lower-right;\n}\n',
  },

  // --- transform ---------------------------------------------------------
  {
    name: 'visual-transform',
    question: 'Do translate, rotate and scale combine into a single CSS transform?',
    uxml: wrap('  <ui:VisualElement name="visual-transform-box" />'),
    uss:
      '#visual-transform-box {\n' +
      '  translate: 10px 20px;\n' +
      '  rotate: 45deg;\n' +
      '  scale: 1.2 0.8;\n' +
      '}\n',
  },

  // --- warnings, not emitted as CSS ----------------------------------------
  {
    name: 'visual-warnings-not-in-uss',
    question:
      'Do CSS-only properties (box-shadow, outline, text-transform, border-style) warn ' +
      'instead of being emitted?',
    uxml: wrap('  <ui:VisualElement name="visual-warnings-not-in-uss-box" />'),
    uss:
      '#visual-warnings-not-in-uss-box {\n' +
      '  box-shadow: 0 0 4px rgb(0, 0, 0);\n' +
      '  outline: 2px solid rgb(0, 0, 0);\n' +
      '  text-transform: uppercase;\n' +
      '  border-style: dashed;\n' +
      '}\n',
  },
  {
    name: 'visual-warnings-version-dependent',
    question: 'Do gap, aspect-ratio and word-break warn as version-dependent rather than emit silently?',
    uxml: wrap('  <ui:VisualElement name="visual-warnings-version-dependent-box" />'),
    uss:
      '#visual-warnings-version-dependent-box {\n' +
      '  gap: 10px;\n' +
      '  aspect-ratio: 1;\n' +
      '  word-break: break-all;\n' +
      '}\n',
  },

  // --- assets ---------------------------------------------------------------
  {
    name: 'asset-background-unresolved',
    question:
      'Does an unresolved background-image draw a placeholder and warn, rather than ' +
      'silently drawing nothing?',
    uxml: wrap('  <ui:VisualElement name="asset-background-unresolved-box" />'),
    uss:
      '#asset-background-unresolved-box {\n' +
      '  background-image: url("project://database/Assets/missing.png");\n' +
      '}\n',
    asset: { resolvesTo: null },
  },

  // --- -unity-background-scale-mode ----------------------------------------
  //
  // Expected values come from Unity's `ScaleMode`, not from reading our own
  // output: fill the box ignoring aspect, cover and crop, or fit inside. CSS
  // has a keyword for each, so the mapping is forced once the semantics are.
  //
  // **None of this is verified against Unity.** A layout dump reports
  // rectangles, and which part of a texture lands inside a rectangle is not a
  // rectangle. Judged by eye in Step 6; until then these detect our own drift
  // and nothing more.
  ...(
    [
      ['stretch', 'stretch-to-fill', 'fills the box, ignoring aspect ratio'],
      ['crop', 'scale-and-crop', 'covers the box and crops the overflow'],
      ['fit', 'scale-to-fit', 'fits inside the box, leaving empty space'],
    ] as const
  ).map(([short, mode, effect]) => ({
    name: `asset-scale-mode-${short}`,
    question: `Does -unity-background-scale-mode: ${mode} map to the CSS that ${effect}?`,
    uxml: wrap(`  <ui:VisualElement name="asset-scale-mode-${short}-box" />`),
    uss:
      `#asset-scale-mode-${short}-box {\n` +
      '  width: 100px;\n  height: 50px;\n' +
      '  background-image: url("project://database/Assets/icon.png");\n' +
      `  -unity-background-scale-mode: ${mode};\n` +
      '}\n',
    asset: { resolvesTo: 'data:,icon' },
  })),
  {
    name: 'asset-scale-mode-default',
    // The value that applies to every background image nobody wrote a mode for,
    // so getting it wrong is quiet and widespread.
    question: 'What scale mode applies when none is declared?',
    uxml: wrap('  <ui:VisualElement name="asset-scale-mode-default-box" />'),
    uss:
      '#asset-scale-mode-default-box {\n  width: 100px;\n  height: 50px;\n' +
      '  background-image: url("project://database/Assets/icon.png");\n}\n',
    asset: { resolvesTo: 'data:,icon' },
  },
  {
    name: 'asset-scale-mode-invalid',
    question: 'Does a scale mode that is not a USS value warn rather than pass through?',
    uxml: wrap('  <ui:VisualElement name="asset-scale-mode-invalid-box" />'),
    uss:
      '#asset-scale-mode-invalid-box {\n' +
      '  background-image: url("project://database/Assets/icon.png");\n' +
      '  -unity-background-scale-mode: cover;\n}\n',
    asset: { resolvesTo: 'data:,icon' },
  },
  {
    name: 'asset-background-size-wins',
    // `background-size` is the CSS spelling and version-dependent in USS, but an
    // author who wrote it meant it — it should not be silently overruled by the
    // mode we derive.
    question: 'Does an explicit background-size beat the derived scale mode?',
    uxml: wrap('  <ui:VisualElement name="asset-background-size-wins-box" />'),
    uss:
      '#asset-background-size-wins-box {\n' +
      '  background-image: url("project://database/Assets/icon.png");\n' +
      '  -unity-background-scale-mode: scale-to-fit;\n' +
      '  background-size: 50% 50%;\n}\n',
    asset: { resolvesTo: 'data:,icon' },
  },

  // --- Image ----------------------------------------------------------------
  {
    name: 'image-control',
    question:
      'Does <ui:Image> render as a box with the unity-image class, taking its ' +
      'picture from background-image?',
    uxml: wrap('  <ui:Image name="image-control-icon" />'),
    uss:
      '.unity-image {\n  width: 40px;\n  height: 40px;\n}\n' +
      '#image-control-icon {\n' +
      '  background-image: url("project://database/Assets/icon.png");\n}\n',
    asset: { resolvesTo: 'data:,icon' },
  },

  // --- pseudo-class states --------------------------------------------------
  //
  // Drift detection only, and it will stay that way. A Unity layout dump reports
  // geometry, and a hover colour is not geometry, so there is no ground truth to
  // compare these against — the judgement happens by eye in S1 Step 6, with
  // per-state screenshots. Nothing here should ever be described as verified.
  {
    name: 'visual-states-per-element',
    question:
      'Do three buttons in one render take three different states, and does each ' +
      'pick up the styling for its own?',
    uxml: wrap(
      '  <ui:Button name="visual-states-normal" text="Normal" />\n' +
        '  <ui:Button name="visual-states-hover" text="Hover" />\n' +
        '  <ui:Button name="visual-states-disabled" text="Drop" />',
    ),
    uss:
      'Button {\n  background-color: rgb(60, 60, 60);\n  color: rgb(230, 230, 230);\n}\n' +
      'Button:hover {\n  background-color: rgb(90, 110, 160);\n}\n' +
      'Button:disabled {\n  background-color: rgb(40, 40, 40);\n  color: rgb(120, 120, 120);\n}\n',
    states: {
      '#visual-states-hover': ['hover'],
      '#visual-states-disabled': ['disabled'],
    },
  },
  {
    name: 'visual-nested-disabled',
    // Deliberately shows a value we are not sure of. `enabled="false"` puts the
    // whole subtree into `:disabled`, so the theme's `opacity: 0.5` lands on
    // both the panel and the button inside it and CSS multiplies them to a
    // quarter. Unity almost certainly dims once. Nothing was changed to hide
    // that — the snapshot records it so the day it is measured, the difference
    // is a failing test rather than a discovery.
    question:
      'What does a disabled button inside a disabled panel end up at? (Unity: unmeasured)',
    uxml: wrap(
      '  <ui:VisualElement name="visual-nested-outer" enabled="false">\n' +
        '    <ui:Button name="visual-nested-inner" text="In" />\n' +
        '  </ui:VisualElement>',
    ),
    uss:
      '#visual-nested-outer {\n  width: 120px;\n  height: 60px;\n' +
      '  background-color: rgb(60, 60, 60);\n}\n' +
      '#visual-nested-inner {\n  width: 80px;\n  height: 30px;\n' +
      '  background-color: rgb(90, 110, 160);\n}\n',
  },
];
