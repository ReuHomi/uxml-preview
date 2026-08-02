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
import type { LayoutBox } from '../layout/yoga';
import { controlFor } from '../controls/registry';
import { toCss } from './css-map';
import type { CssMapOptions } from './css-map';

export const NODE_ATTRIBUTE = 'data-uxml-node';

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
  styles: ReadonlyMap<NodeId, ComputedStyle>,
  container: HTMLElement,
  options: PaintOptions,
): PaintResult {
  const warnings: Warning[] = [];
  const elements = new Map<NodeId, HTMLElement>();

  function build(node: ElementNode, parentBox: LayoutBox | null): HTMLElement | null {
    const box = boxes.get(node.id);
    if (box === undefined) return null; // not laid out: unsupported control

    const el = options.document.createElement('div');
    el.setAttribute(NODE_ATTRIBUTE, String(node.id));

    const style = styles.get(node.id) ?? new Map();
    const css = toCss(style, node.id, options);
    warnings.push(...css.warnings);

    // Yoga reports panel coordinates; a nested absolute box wants its parent's
    // frame, so the parent's origin is subtracted back out.
    const left = parentBox === null ? 0 : box.left - parentBox.left;
    const top = parentBox === null ? 0 : box.top - parentBox.top;

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

    const control = controlFor(node);
    const text = node.attributes.find((a) => a.name === 'text')?.value;
    if (control?.hasText === true && text !== undefined && text.length > 0) {
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
      for (const child of node.children) {
        const childEl = build(child, box);
        // Appended in document order: later siblings paint on top, which is
        // how USS orders overlap.
        if (childEl !== null) el.appendChild(childEl);
      }
    }

    elements.set(node.id, el);
    return el;
  }

  container.replaceChildren();
  const rootEl = build(root, null);
  if (rootEl !== null) {
    rootEl.style.setProperty('position', 'relative');
    container.appendChild(rootEl);
  }

  return { warnings, elements };
}

/**
 * Attribute values are stored exactly as written so that serialization can put
 * them back, which means the five XML entities are still encoded here.
 */
function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}
