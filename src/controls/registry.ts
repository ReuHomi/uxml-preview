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
import { decodeEntities } from '../parser/entities';

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
  /** Unity name, or class identity for the unnamed GroupBox title. */
  name: string;
  /** Text parts are measured leaves; a leading Label is a sibling of the wrapper chain. */
  kind?: 'leading-text' | 'text';
  /** Attribute text is decoded only for the derived rendering, never in the AST. */
  textAttribute?: 'text' | 'label' | 'value';
  typeName?: string;
  unnamed?: boolean;
  classes?: readonly string[];
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
   * outermost first. File children go inside the last wrapper; leading text
   * parts are siblings before them and exist only for non-empty owner text.
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
  // Measured: probe-editor-070/c07-GroupBox.json (6000.0.40f1) and
  // probe-panel/c07-GroupBox.json (6000.3.25f1): unnamed leading Label.
  GroupBox: {
    hasText: false, classes: ['unity-group-box'],
    parts: [{ name: 'unity-group-box__label', kind: 'leading-text',
      classes: ['unity-text-element', 'unity-label', 'unity-group-box__label'], style: {} }],
  },
  TextField: { hasText: false, classes: ['unity-base-field', 'unity-base-text-field', 'unity-text-field'], parts: [] },
  Box: { hasText: false, classes: ['unity-box'], parts: [] },
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
 * `Toggle`, `Foldout` — put their label in a child `TextElement`
 * rather than drawing it themselves, so guessing `true` would paint text where
 * Unity paints a child and put every coordinate below it in the wrong place.
 */
const FALLBACK: ControlSpec = { hasText: false, classes: [], parts: [] };

/** The document container. Not a control, but it is the panel's root box. */
export const ROOT_LOCAL_NAME = 'UXML';

/**
 * Elements that carry instructions rather than pixels: never laid out, never
 * drawn, and their own `name` never counts as an element's name.
 *
 * - `<Style src="…">` names a stylesheet. UI Builder writes one the moment a
 *   USS is attached, so it is the normal shape of a real document.
 * - `<ui:Template>` and `<AttributeOverrides>` are consumed by template
 *   expansion (template/expand.ts) and never reach the render tree.
 * - `<Bindings>` (holding `<ui:DataBinding>`) and a MultiColumnListView's
 *   `<ui:Columns>` are data for Unity. **Measured**, on 6000.0.40f1 and
 *   6000.3.25f1: neither appears in the visual hierarchy, and a
 *   `space-around` sibling lands as if they were not written
 *   (tests/layout/nonvisual.test.ts). Drawing them as fallback boxes moved
 *   those siblings.
 *
 * Their children are skipped with them. A `<ui:Column>`'s own name still
 * counts, because Unity gives it to the header column it builds.
 */
const NON_VISUAL = new Set(['Style', 'Template', 'AttributeOverrides', 'Bindings', 'Columns']);

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
  if (node.derived?.kind === 'template-container') return { spec: FALLBACK, fallback: false };
  const spec = CONTROLS[node.name.local];
  if (spec !== undefined) return { spec: node.name.local === 'TextField' ? textFieldSpec(node, spec) : spec, fallback: false };
  if (isRoot(node)) return { spec: FALLBACK, fallback: false };
  return { spec: FALLBACK, fallback: true };
}

export function isRoot(node: ElementNode): boolean {
  return node.name.local === ROOT_LOCAL_NAME;
}

/**
 * Purpose:      the USS classes Unity would have added to this element.
 * Ensures:      control classes and own disabled class remain outside the model.
 */
export function implicitClassesOf(node: ElementNode): readonly string[] {
  const classes = resolveControl(node).spec.classes;
  // Unity nested-disabled.json, both panel/editor probes: inherited disabled
  // state does not add this class, so opacity is applied only at explicit sites.
  return node.attributes.some((a) => a.name === 'enabled' && a.value === 'false')
    ? [...classes, 'unity-disabled'] : classes;
}

/** Controls with a renderer of their own. Everything else still draws. */
export function supportedControlNames(): string[] {
  return Object.keys(CONTROLS);
}

// Unity evidence: 6000.3.25f1/{probe-panel,probe-editor-070}/c07-TextField.json
// and c-textfield.json: physical parts are derived, never written into the AST.
function textFieldSpec(node: ElementNode, base: ControlSpec): ControlSpec {
  const attr = (name: string): string => node.attributes.find((a) => a.name === name)?.value ?? '';
  const labelled = attr('label') !== '';
  const multiline = attr('multiline') === 'true';
  const placeholder = attr('value') === '' && attr('placeholder-text') !== '';
  return {
    ...base,
    classes: labelled ? base.classes : [...base.classes, 'unity-base-field--no-label'],
    parts: [
      ...(labelled ? [{ name: 'unity-text-field__label', kind: 'leading-text' as const,
        textAttribute: 'label' as const, typeName: 'Label', unnamed: true,
        classes: ['unity-text-element', 'unity-label', 'unity-base-field__label',
          'unity-base-text-field__label', 'unity-text-field__label'], style: {} }] : []),
      { name: 'unity-text-input', typeName: 'TextInput',
        classes: ['unity-base-text-field__input', 'unity-base-field__input', 'unity-text-field__input',
          multiline ? 'unity-base-text-field__input--multiline' : 'unity-base-text-field__input--single-line',
          ...(placeholder ? ['unity-base-text-field__input--placeholder'] : [])], style: {} },
      ...(multiline ? [{ name: 'unity-base-text-field__multiline-container', unnamed: true,
        classes: ['unity-base-text-field__multiline-container'], style: {} }] : []),
      { name: 'unity-text-element--inner-input-field-component', kind: 'text',
        textAttribute: 'value', typeName: 'TextElement', unnamed: true,
        classes: ['unity-text-element', 'unity-text-element__selectable',
          'unity-text-element--inner-input-field-component'], style: {} },
    ],
  };
}

/** Ensures: password values are masked before measurement or DOM painting. */
export function partTextOf(node: ElementNode, part: ControlPart): string | undefined {
  if (part.kind === undefined) return undefined;
  const attr = (name: string): string => decodeEntities(node.attributes.find((a) => a.name === name)?.value ?? '');
  const text = attr(part.textAttribute ?? 'text');
  if (part.textAttribute !== 'value') return text;
  if (text === '') return attr('placeholder-text');
  return attr('password') === 'true' ? (attr('mask-character') || '*').charAt(0).repeat(text.length) : text;
}
