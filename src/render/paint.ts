import { CJK_BREAK, fontList } from './measure';
import type { Theme } from '../controls/theme';
import type { FaceInfo } from './measure';
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
import { isNonVisual, resolveControl } from '../controls/registry';
import { decodeEntities } from '../parser/entities';
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
  theme?: Theme;
  fonts?: ReadonlyMap<ComputedStyle, { family: string; faceInfo?: FaceInfo }>;
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

  // CSS adds letter spacing after spaces and the final character too. Keep
  // inline runs so wrapping still belongs to the browser, and cancel only the
  // gaps Unity's text measurer excludes (advanced is the editor default).
  function appendSpacedText(host: HTMLElement, text: string, style: ComputedStyle): void {
    const spacing = parseLength(style.get('letter-spacing')?.value ?? '').length;
    if (spacing?.kind !== 'px' || spacing.value === 0) {
      host.textContent = text;
      return;
    }
    const standard = style.get('-unity-text-generator')?.value === 'standard';
    const characters = [...text];
    const last = characters.pop();
    for (const run of characters.join('').match(/ +|[^ ]+/g) ?? []) {
      const span = options.document.createElement('span');
      span.textContent = run;
      if (!standard && run[0] === ' ') span.style.letterSpacing = '0px';
      host.appendChild(span);
    }
    if (last !== undefined) {
      const span = options.document.createElement('span');
      span.textContent = last;
      span.style.letterSpacing = '0px';
      host.appendChild(span);
    }
  }

  function appendText(host: HTMLElement, text: string, style: ComputedStyle): void {
    // Measured: tests/text-cohort/unity-runtime/; bundle A plan §29 — match measured glyph widths.
    if (style.get('-unity-text-generator')?.value === 'standard') host.style.fontKerning = 'none';
    appendSpacedText(host, text, style);
    if (options.theme !== 'runtime' || !CJK_BREAK.test(text)) return;
    // Unity probe-panel/kinsoku.json: runtime allows breaks on either side of
    // CJK punctuation. Explicit opportunities bypass browser kinsoku; keep-all
    // preserves the measurer's space-only breaks within Hangul and Latin.
    // These are painter-only CSS/DOM choices, not supported USS properties.
    host.style.wordBreak = 'keep-all';
    const insertBreaks = (parent: Node): void => {
      for (const child of Array.from(parent.childNodes)) {
        if (child.nodeType !== 3) {
          insertBreaks(child);
          continue;
        }
        const pieces = (child.textContent ?? '').split(CJK_BREAK);
        if (pieces.length === 1) continue;
        const fragment = options.document.createDocumentFragment();
        pieces.forEach((piece, index) => {
          if (index > 0) fragment.appendChild(options.document.createElement('wbr'));
          fragment.appendChild(options.document.createTextNode(piece));
        });
        parent.replaceChild(fragment, child);
      }
    };
    insertBreaks(host);
  }

  function paintText(el: HTMLElement, text: string, style: ComputedStyle,
    css: ReturnType<typeof toCss>): void {
    // Laid out as a measured leaf, so it has no painted children and can use
    // flex for the vertical half of -unity-text-align.
    el.style.setProperty('display', css.declarations['display'] ?? 'flex');
    if (css.declarations['align-items'] === undefined) {
      el.style.setProperty('align-items', 'flex-start');
    }
    if (css.declarations['justify-content'] === undefined) {
      el.style.setProperty('justify-content', 'flex-start');
    }
    const font = options.fonts?.get(style);
    if (font !== undefined) el.style.fontFamily = fontList(font.family);
    const gap = parseLength(style.get('-unity-paragraph-spacing')?.value ?? '').length;
    const decoded = text;
    const letterSpacing = parseLength(style.get('letter-spacing')?.value ?? '').length;
    if (gap?.kind === 'px' && decoded.includes('\n')) {
      const size = parseLength(style.get('font-size')?.value ?? '12px').length;
      const paragraphs = decoded.split('\n');
      const content = options.document.createElement('div');
      content.style.width = '100%';
      paragraphs.forEach((paragraph, index) => {
        const block = options.document.createElement('div');
        appendText(block, paragraph, style);
        block.style.minHeight = '1em';
        if (index < paragraphs.length - 1) block.style.marginBottom = `${gap.value * (size?.kind === 'px' ? size.value : 12) / 100}px`;
        content.appendChild(block);
        if (index < paragraphs.length - 1) {
          const separator = options.document.createElement('span');
          separator.textContent = '\n';
          separator.style.display = 'none';
          content.appendChild(separator);
        }
      });
      el.appendChild(content);
    } else if ((letterSpacing?.kind === 'px' && letterSpacing.value !== 0)
      || (options.theme === 'runtime' && CJK_BREAK.test(decoded))) {
      const content = options.document.createElement('span');
      content.style.minWidth = '0';
      appendText(content, decoded, style);
      el.appendChild(content);
    } else {
      appendText(el, decoded, style);
    }
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
    // Measured: f-states.json rb-child / te-child retain their file children.
    const childrenSizeText = ['TextElement', 'RepeatButton'].includes(node.name.local) &&
      node.children.some((child) => !isNonVisual(child));
    const drawsText = spec.hasText && text !== undefined && text.length > 0;
    if (drawsText) paintText(el, decodeEntities(text), style, css);
    if (!drawsText || childrenSizeText) {
      // Match Yoga's file-child host: owner when declared, otherwise the last
      // non-text part. All parts are appended before the file children.
      let host = el;
      let hostBox = box;
      let hostBorder = borderOrigin(node);

      let childHost = { el: host, box: hostBox, border: hostBorder };
      const builtParts: Array<{ el: HTMLDivElement; box: LayoutBox; border: { left: number; top: number } }> = [];
      for (const part of parts.get(node.id) ?? []) {
        const parent = part.parent === null || part.parent === undefined ? undefined : builtParts[part.parent];
        host = parent?.el ?? el;
        hostBox = parent?.box ?? box;
        hostBorder = parent?.border ?? borderOrigin(node);
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

        // tests/contract-070/e2-editor-checkbox.test.ts: box colours from docs/design/0.7.0-bundle-E-shots/unity-editor-c07-Toggle.png.
        if (options.theme === 'editor' && node.name.local === 'Toggle' && part.name === 'unity-checkmark') {
          partEl.style.setProperty('background-color', '#2a2a2a');
          partEl.style.setProperty('border-radius', '2px');
          partEl.style.setProperty('box-shadow', 'inset 0 1px 0 0 #0d0d0d, inset 1px 0 0 0 #212121, inset -1px 0 0 0 #212121, inset 0 -1px 0 0 #212121');
        }

        // e-toggle.json: Unity's built-in check/d_toggle_on textures are not
        // loadable assets here. Substitute a mark without an asset warning.
        if (node.name.local === 'Toggle' && part.name === 'unity-checkmark' &&
          node.attributes.some((a) => a.name === 'value' && a.value === 'true')) {
          const svg = options.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.setAttribute('viewBox', '0 0 24 24');
          svg.setAttribute('width', '100%');
          svg.setAttribute('height', '100%');
          svg.style.display = 'block';
          const path = options.document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('d', 'M5 12 L10 17 L19 6');
          path.setAttribute('fill', 'none');
          path.setAttribute('stroke', options.theme === 'editor' ? '#eeeeee' :
            part.style.get('-unity-background-image-tint-color')?.value ?? '#323232');
          path.setAttribute('stroke-width', '2.5');
          path.setAttribute('stroke-linecap', 'round');
          path.setAttribute('stroke-linejoin', 'round');
          svg.appendChild(path);
          partEl.appendChild(svg);
        }

        host.appendChild(partEl);
        builtParts.push({ el: partEl, box: part.box, border: partBorderOrigin(part) });
        if (part.text !== undefined) {
          paintText(partEl, part.text, part.style, partCss);
          // Unity evidence: 6000.3.25f1/{probe-panel,probe-editor-070}/
          // c07-TextField.json: multiline value newlines survive NoWrap.
          if (part.name === 'unity-text-element--inner-input-field-component') {
            partEl.style.whiteSpace = part.style.get('white-space')?.value === 'normal' ? 'pre-wrap' : 'pre';
          }
        } else {
          host = partEl;
          hostBox = part.box;
          hostBorder = partBorderOrigin(part);
          if (spec.fileChildrenHost !== 'owner') {
            childHost = { el: host, box: hostBox, border: hostBorder };
          }
        }
      }

      host = childHost.el; hostBox = childHost.box; hostBorder = childHost.border;
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
