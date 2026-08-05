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

export interface ControlSpec {
  /** Renders the `text` attribute as its own content. */
  hasText: boolean;
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
  VisualElement: { hasText: false, classes: [] },
  Label: { hasText: true, classes: ['unity-label'] },
  Button: { hasText: true, classes: ['unity-button'] },
  // Image draws a texture, not text. Its picture reaches this renderer through
  // `background-image` in USS, which `resolveAsset` can turn into something a
  // browser will load; a texture assigned from C# has no path to follow here.
  Image: { hasText: false, classes: ['unity-image'] },
};

/**
 * What an unrecognised control is drawn as: a box that lays its children out.
 *
 * `hasText: false` is deliberate. The controls most likely to land here —
 * `TextField`, `Toggle`, `Foldout` — put their label in a child `TextElement`
 * rather than drawing it themselves, so guessing `true` would paint text where
 * Unity paints a child and put every coordinate below it in the wrong place.
 */
const FALLBACK: ControlSpec = { hasText: false, classes: [] };

/** The document container. Not a control, but it is the panel's root box. */
export const ROOT_LOCAL_NAME = 'UXML';

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
