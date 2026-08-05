/**
 * Painting: Yoga rectangles to DOM.
 *
 * The DOM mirrors the element tree rather than being flattened. Nesting buys
 * two things for free that a flat list would have to reimplement: `overflow:
 * hidden` clips descendants, and painting order follows document order, so a
 * later sibling covers an earlier one — which is exactly how USS decides
 * overlap, and why no z-index is ever emitted.
 *
 * Each element carries `data-uxml-node`, so a click can be traced back to a
 * model node. Phase 8 needs that, and retrofitting it would mean rewriting
 * this file.
 */

import type { ElementNode, NodeId, Warning } from '../model/types';
import type { ComputedStyle } from '../style/resolve';
import type { LayoutBox, LayoutPart } from '../layout/yoga';
import { resolveControl } from '../controls/registry';
import { toCss } from './css-map';
import type { CssMapOptions } from './css-map';
import { INITIAL, parseLength } from './values';

export const NODE_ATTRIBUTE = 'data-uxml-node';

/**
 * Marks an element a control built rather than one the file asked for, and
 * carries Unity's name for it.
 *
 * Deliberately not `data-uxml-node`: these have no node. An editor that traced
 * a click back through the node attribute would get an id that belongs to
 * something else, and would then offer to edit the wrong element. Here it finds
 * a different attribute and can say "this part is not yours to change".
 */
export const PART_ATTRIBUTE = 'data-uxml-part';

/** The element whose control built a part. Lets a click land on its owner. */
export const PART_OWNER_ATTRIBUTE = 'data-uxml-part-owner';

export interface PaintResult {
  warnings: Warning[];
  /** Painted element per model node, for hit-testing and for tests. */
  elements: Map<NodeId, HTMLElement>;
}

export interface PaintOptions extends CssMapOptions {
  document: Document;
}

/**
 * Purpose:      build the DOM for one laid-out document under `container`.
 * Deps/Effects: replaces the container's children. The caller owns disposal.
 * Requires:     `boxes` must come from a layout of this same tree.
 */
export function paint(
  root: ElementNode,
  boxes: ReadonlyMap<NodeId, LayoutBox>,
  parts: ReadonlyMap<NodeId, readonly LayoutPart[]>,
  styles: ReadonlyMap<NodeId, ComputedStyle>,
  container: HTMLElement,
  options: PaintOptions,
): PaintResult {
  const warnings: Warning[] = [];
  const elements = new Map<NodeId, HTMLElement>();

  /**
   * The parent's left and top border widths, in pixels.
   *
   * Yoga measures a child from the parent's *border box* origin. CSS measures an
   * absolutely-positioned child from its parent's *padding box* — inside the
   * border — so the border has to come back out of the number, or the browser
   * counts it twice and every descendant of a bordered element sits too far in.
   */
  function borderOrigin(node: ElementNode): { left: number; top: number } {
    const style = styles.get(node.id);
    const read = (property: string): number => {
      const text = style?.get(property)?.value ?? INITIAL[property] ?? '0';
      const { length } = parseLength(text);
      return length !== null && length.kind === 'px' ? length.value : 0;
    };
    return { left: read('border-left-width'), top: read('border-top-width') };
  }

  /** Same correction as `borderOrigin`, for a part, whose style is not in `styles`. */
  function partBorderOrigin(part: LayoutPart): { left: number; top: number } {
    const read = (property: string): number => {
      const text = part.style.get(property)?.value ?? INITIAL[property] ?? '0';
      const { length } = parseLength(text);
      return length !== null && length.kind === 'px' ? length.value : 0;
    };
    return { left: read('border-left-width'), top: read('border-top-width') };
  }

  function build(
    node: ElementNode,
    parentBox: LayoutBox | null,
    parentBorder: { left: number; top: number },
  ): HTMLElement | null {
    const box = boxes.get(node.id);
    // Not laid out. Every element gets a box now, including controls with no
    // renderer of their own, so this means a descendant of a text-drawing
    // control — Yoga measures those as leaves and never reaches their children.
    if (box === undefined) return null;

    const el = options.document.createElement('div');
    el.setAttribute(NODE_ATTRIBUTE, String(node.id));

    const style = styles.get(node.id) ?? new Map();
    const css = toCss(style, node.id, options);
    warnings.push(...css.warnings);

    // Yoga reports panel coordinates; a nested absolute box wants its parent's
    // frame, so the parent's origin — and its border, see borderOrigin — is
    // subtracted back out.
    const left = parentBox === null ? 0 : box.left - parentBox.left - parentBorder.left;
    const top = parentBox === null ? 0 : box.top - parentBox.top - parentBorder.top;

    const declarations: Record<string, string> = {
      position: 'absolute',
      left: `${left}px`,
      top: `${top}px`,
      width: `${box.width}px`,
      height: `${box.height}px`,
      margin: '0',
      ...css.declarations,
    };
    for (const [property, value] of Object.entries(declarations)) {
      el.style.setProperty(property, value);
    }

    const { spec } = resolveControl(node);
    const text = node.attributes.find((a) => a.name === 'text')?.value;
    if (spec.hasText && text !== undefined && text.length > 0) {
      // Laid out as a measured leaf, so it has no painted children and can use
      // flex for the vertical half of -unity-text-align.
      el.style.setProperty('display', css.declarations['display'] ?? 'flex');
      if (css.declarations['align-items'] === undefined) {
        el.style.setProperty('align-items', 'flex-start');
      }
      if (css.declarations['justify-content'] === undefined) {
        el.style.setProperty('justify-content', 'flex-start');
      }
      el.textContent = decodeEntities(text);
    } else {
      // The control's own parts nest between this element and the file's
      // children, so `host` walks inward and the children are appended to the
      // innermost one — matching the tree Unity actually builds.
      let host = el;
      let hostBox = box;
      let hostBorder = borderOrigin(node);

      for (const part of parts.get(node.id) ?? []) {
        const partEl = options.document.createElement('div');
        partEl.setAttribute(PART_ATTRIBUTE, part.name);
        partEl.setAttribute(PART_OWNER_ATTRIBUTE, String(node.id));

        const partCss = toCss(part.style, node.id, options);
        warnings.push(...partCss.warnings);
        const partDeclarations: Record<string, string> = {
          position: 'absolute',
          left: `${part.box.left - hostBox.left - hostBorder.left}px`,
          top: `${part.box.top - hostBox.top - hostBorder.top}px`,
          width: `${part.box.width}px`,
          height: `${part.box.height}px`,
          margin: '0',
          ...partCss.declarations,
        };
        for (const [property, value] of Object.entries(partDeclarations)) {
          partEl.style.setProperty(property, value);
        }

        host.appendChild(partEl);
        host = partEl;
        hostBox = part.box;
        hostBorder = partBorderOrigin(part);
      }

      for (const child of node.children) {
        const childEl = build(child, hostBox, hostBorder);
        // Appended in document order: later siblings paint on top, which is
        // how USS orders overlap.
        if (childEl !== null) host.appendChild(childEl);
      }
    }

    elements.set(node.id, el);
    return el;
  }

  container.replaceChildren();
  const rootEl = build(root, null, { left: 0, top: 0 });
  if (rootEl !== null) {
    rootEl.style.setProperty('position', 'relative');
    container.appendChild(rootEl);
  }

  return { warnings, elements };
}

/**
 * Attribute values are stored exactly as written so that serialization can put
 * them back, which means the five XML entities are still encoded here.
 *
 * Ensures: never throws. A numeric reference outside the Unicode range makes
 * `String.fromCodePoint` raise a RangeError, and one bad character in one
 * attribute must not take down the render (CLAUDE.md rule 6). Unreadable
 * references are left as written, which is also what round-trips.
 */
function decodeEntities(text: string): string {
  const codePoint = (value: number, original: string): string => {
    if (!Number.isInteger(value) || value < 0 || value > 0x10ffff) return original;
    // Surrogate halves are not standalone characters.
    if (value >= 0xd800 && value <= 0xdfff) return original;
    return String.fromCodePoint(value);
  };

  return text
    .replace(/&#x([0-9a-f]+);/gi, (match, hex: string) => codePoint(parseInt(hex, 16), match))
    .replace(/&#(\d+);/g, (match, dec: string) => codePoint(Number(dec), match))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}
