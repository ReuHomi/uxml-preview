/**
 * Which controls have a renderer of their own, and what everything else falls
 * back to.
 *
 * The model does not carry this: whether a control has a renderer is a property
 * of this layer, and it changes when controls are added, while the file that was
 * parsed does not. Adding `ScrollView` means editing this table and nothing in
 * src/model or src/parser.
 *
 * `resolveControl` never returns null, and that is the point. An unrecognised
 * tag is drawn as a plain box rather than dropped — losing a whole subtree to
 * one unknown control is a defect, not a scope limit (S1 plan §6). Returning a
 * spec unconditionally makes the fallback the path a caller gets by default:
 * there is no miss to forget to handle.
 */

import type { ElementNode } from '../model/types';

/**
 * An element a control builds for itself, which the file never mentions.
 *
 * Unity's ScrollView is one tag that becomes four elements, and the three it
 * adds are what decide where everything inside lands — a child of a ScrollView
 * is not a child of the ScrollView. Reproducing the box without them puts every
 * descendant in the wrong place, so they are modelled rather than approximated.
 *
 * `name` is Unity's own, and it is the key the layout dump joins on: these are
 * observed in `tests/golden/unity/scrollview-*.json`, not invented.
 */
export interface ControlPart {
  /** Unity's name, e.g. `unity-content-viewport`. */
  name: string;
  /**
   * USS this part always carries, because the control fixes it.
   *
   * Written as USS rather than as CSS or Yoga calls so it goes through the same
   * cascade output, Yoga mapping and CSS mapping as everything else. A second
   * styling path for parts would be a second set of USS bugs.
   */
  style: Readonly<Record<string, string>>;
}

export interface ControlSpec {
  /** Renders the `text` attribute as its own content. */
  hasText: boolean;
  /**
   * Elements the control inserts between itself and the file's children,
   * outermost first. The file's children go inside the last one.
   */
  parts: readonly ControlPart[];
  /**
   * USS classes Unity's own constructor puts on this control, which the theme
   * stylesheet then targets. Not in the `class` attribute and not in the model:
   * the file says `<ui:Button />` and Unity adds the rest.
   */
  classes: readonly string[];
}

export interface ResolvedControl {
  spec: ControlSpec;
  /**
   * No renderer of its own; drawn as a plain `VisualElement`. Callers report
   * this once per element so the preview says what it did (CLAUDE.md rule 6).
   */
  fallback: boolean;
}

/**
 * Controls with a renderer of their own.
 *
 * `Label` and `Button` derive from `TextElement` in Unity, which is why they
 * draw text themselves instead of holding a child that does. Nothing else may
 * be added here without a golden case (S1 plan §5.2).
 */
const CONTROLS: Readonly<Record<string, ControlSpec>> = {
  // VisualElement is the base class and carries no class of its own.
  VisualElement: { hasText: false, classes: [], parts: [] },
  Label: { hasText: true, classes: ['unity-label'], parts: [] },
  Button: { hasText: true, classes: ['unity-button'], parts: [] },
  // Image draws a texture, not text. Its picture reaches this renderer through
  // `background-image` in USS, which `resolveAsset` can turn into something a
  // browser will load; a texture assigned from C# has no path to follow here.
  Image: { hasText: false, classes: ['unity-image'], parts: [] },
  /**
   * Four elements from one tag. The names below are observed in
   * `tests/golden/unity/scrollview-*.json`, not taken from documentation — the
   * middle one, `unity-content-and-vertical-scroll-container`, is not in
   * Unity's manual diagram at all and was found by dumping.
   *
   * The styles are inference, unlike the names: they are how this renderer
   * reproduces the measured geometry, and the three `scrollview-*` golden cases
   * are what decides whether the inference is right.
   */
  ScrollView: {
    hasText: false,
    classes: ['unity-scroll-view'],
    parts: [
      // Fills the ScrollView's content box, and lays the viewport out beside
      // the vertical scrollbar — hence row.
      {
        name: 'unity-content-and-vertical-scroll-container',
        style: { 'flex-grow': '1', 'flex-direction': 'row' },
      },
      // What actually clips. Takes whatever width the scrollbar leaves.
      { name: 'unity-content-viewport', style: { 'flex-grow': '1', overflow: 'hidden' } },
      // `flex-shrink: 0` is the whole reason a ScrollView is not one box:
      // this grows to the content's height instead of being squeezed into the
      // viewport's, so children keep their sizes and the viewport crops them.
      // Without it three 60px children in a 100px view come out 33/34/33.
      { name: 'unity-content-container', style: { 'flex-shrink': '0' } },
    ],
  },
};

/**
 * What an unrecognised control is drawn as: a box that lays its children out.
 *
 * `hasText: false` is deliberate. The controls most likely to land here —
 * `TextField`, `Toggle`, `Foldout` — put their label in a child `TextElement`
 * rather than drawing it themselves, so guessing `true` would paint text where
 * Unity paints a child and put every coordinate below it in the wrong place.
 */
const FALLBACK: ControlSpec = { hasText: false, classes: [], parts: [] };

/** The document container. Not a control, but it is the panel's root box. */
export const ROOT_LOCAL_NAME = 'UXML';

/**
 * Elements that carry instructions rather than pixels.
 *
 * `<Style src="…">` is how a UXML names its stylesheet, and UI Builder writes
 * one into the file the moment you attach a USS — so it is the normal shape of
 * a real document, not an optional flourish. It is not a control: drawing it as
 * a fallback box would add a phantom element to the layout and report it as an
 * unsupported control, which points at the wrong problem entirely.
 */
const NON_VISUAL = new Set(['Style']);

export function isNonVisual(node: ElementNode): boolean {
  return NON_VISUAL.has(node.name.local);
}

/**
 * Purpose:      the spec to draw `node` with, always.
 * Ensures:      never null. `fallback` is true only for elements a caller
 *               should report; the root is excluded because it is the panel
 *               box rather than a control that failed to resolve.
 */
export function resolveControl(node: ElementNode): ResolvedControl {
  const spec = CONTROLS[node.name.local];
  if (spec !== undefined) return { spec, fallback: false };
  if (isRoot(node)) return { spec: FALLBACK, fallback: false };
  return { spec: FALLBACK, fallback: true };
}

export function isRoot(node: ElementNode): boolean {
  return node.name.local === ROOT_LOCAL_NAME;
}

/**
 * Purpose:      the USS classes Unity would have added to this element.
 * Ensures:      empty for anything with no renderer of its own — a fallback box
 *               must not pick up theme styling meant for a control we do not
 *               actually draw.
 */
export function implicitClassesOf(node: ElementNode): readonly string[] {
  return resolveControl(node).spec.classes;
}

/** Controls with a renderer of their own. Everything else still draws. */
export function supportedControlNames(): string[] {
  return Object.keys(CONTROLS);
}
