/**
 * uxml-preview — public API surface.
 *
 * Phase 1: the document model is defined (src/model/types.ts). The functions
 * below are still signatures only; implementations land in Phases 2–4.
 * See docs/ROADMAP.md.
 */

export type {
  Span,
  SourceRef,
  NodeId,
  ElementName,
  Attribute,
  ElementSpans,
  ElementNode,
  Combinator,
  SimpleSelector,
  SelectorPart,
  Selector,
  Declaration,
  Rule,
  SheetItem,
  StyleSheet,
  WarningKind,
  Warning,
  UxmlDocument,
  StyleOrigin,
} from './model/types';

import type { NodeId, StyleSheet, UxmlDocument, Warning } from './model/types';
export { loadLayoutEngine, isLayoutEngineReady, liveNodeCount } from './layout/yoga';
export type { LayoutBox, MeasureText, TextContext, TextMetrics } from './layout/yoga';
export { createDefaultMeasureText } from './render/measure';
export { NODE_ATTRIBUTE, PART_ATTRIBUTE, PART_OWNER_ATTRIBUTE } from './render/paint';
export { supportedControlNames } from './controls/registry';
export { resolveStyles, explainProperty } from './style/resolve';
export type {
  Candidate,
  ComputedStyle,
  ComputedValue,
  ResolveOptions,
  ResolveResult,
} from './style/resolve';
export type { Specificity } from './style/specificity';
export { isInherited } from './style/properties';

import { parseUxml } from './parser/uxml';
import { parseUss } from './parser/uss';
import { serializeUxml } from './serializer/uxml';
import { serializeUss } from './serializer/uss';
import { resolveStyles } from './style/resolve';
import { layoutDocument } from './layout/yoga';
import type { LayoutBox, MeasureText } from './layout/yoga';
import { createDefaultMeasureText } from './render/measure';
import { paint } from './render/paint';

// ---------------------------------------------------------------------------
// Parsing / serialization
// ---------------------------------------------------------------------------

/**
 * Parse UXML and USS text into a document model.
 *
 * Never throws on unsupported input: unknown controls, properties and selectors
 * are kept verbatim so they survive `serialize`. Only malformed text produces a
 * warning here — whether something can be *rendered* is decided downstream.
 */
export interface ParseOptions {
  /**
   * Loads the text of an `@import`ed stylesheet. Return `null` when the path
   * cannot be resolved; the import is then reported as a warning and its rules
   * simply do not participate.
   *
   * USS import paths look like `project://database/Assets/UI/base.uss`, which
   * only the host application knows how to turn into file contents.
   */
  resolveImport?: (url: string) => string | null;
}

export function parse(uxml: string, uss?: string, options?: ParseOptions): UxmlDocument {
  const tree = parseUxml(uxml);
  const warnings: Warning[] = [...tree.warnings];
  const sheets: StyleSheet[] = [];

  if (uss !== undefined) {
    // Imports are followed breadth-first. `seen` guards against a cycle, which
    // would otherwise loop forever on a stylesheet that imports itself.
    const seen = new Set<string>();
    const queue: Array<{ text: string; origin: string | null }> = [
      { text: uss, origin: null },
    ];

    while (queue.length > 0) {
      const next = queue.shift()!;
      const index = sheets.length;
      const parsed = parseUss(next.text, next.origin, index);
      sheets.push(parsed.sheet);
      warnings.push(...parsed.warnings);

      for (const item of parsed.sheet.items) {
        if (item.kind !== 'import') continue;
        if (seen.has(item.url)) continue;
        seen.add(item.url);
        const text = options?.resolveImport?.(item.url) ?? null;
        if (text === null) {
          warnings.push({
            kind: 'import-unresolved',
            message:
              options?.resolveImport === undefined
                ? `@import "${item.url}" was not loaded: pass resolveImport to read it`
                : `@import "${item.url}" could not be resolved`,
            at: { in: 'uss', sheet: index, span: item.span },
          });
          continue;
        }
        queue.push({ text, origin: item.url });
      }
    }
  }

  return { source: uxml, root: tree.root, sheets, warnings };
}

/**
 * Serialize a document model back to UXML and USS text.
 *
 * Ensures: for a document with no edits, the output is byte-identical to the
 * input — untouched nodes are re-emitted by slicing `UxmlDocument.source`
 * rather than being regenerated. After an edit, only the edited region changes.
 */
export function serialize(doc: UxmlDocument): { uxml: string; uss: string } {
  const sheet = doc.sheets[0];
  return {
    uxml: serializeUxml(doc.source, doc.root),
    // Only the sheet passed to `parse` round-trips. `@import`ed sheets (Phase 3)
    // are separate files and are not this function's to write.
    uss: sheet === undefined ? '' : serializeUss(sheet),
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export interface RenderOptions {
  /**
   * Resolves Unity asset references to something a browser can load.
   *
   * USS background images look like `url("project://database/Assets/foo.png")`
   * or `resource("foo")`. Browsers cannot load these, so the host application
   * must map them to real URLs. Return `null` to draw a placeholder instead.
   */
  resolveAsset?: (path: string) => string | null;

  /** Panel size in pixels. Defaults to the container's client size. */
  size?: { width: number; height: number };

  /**
   * Measures a control's text.
   *
   * The default uses a canvas, whose metrics move with the platform and the
   * installed fonts. Anything that needs a reproducible result — golden tests
   * above all — should supply its own.
   */
  measureText?: MeasureText;

  /** Pseudo-classes to render as active on every element, e.g. `new Set(['hover'])`. */
  activeStates?: ReadonlySet<string>;

  /**
   * Pseudo-classes to render as active per element, keyed by USS selector.
   *
   * ```ts
   * render(doc, el, { states: { '#UseButton': ['hover'], '#DropButton': ['disabled'] } });
   * ```
   *
   * States are explicit input rather than real mouse events, so the same call
   * always draws the same picture — which is what makes a rendered screen
   * something you can compare against Unity, or against yesterday.
   *
   * Per element and not per document because real screens mix: one button
   * hovered while another is disabled is the normal case, not an edge one.
   */
  states?: Readonly<Record<string, readonly string[]>>;
}

export interface RenderResult {
  /**
   * Everything the renderer could not honour: unsupported controls, properties,
   * selectors and units, plus unresolved assets. Distinct from
   * `UxmlDocument.warnings`, which only covers malformed input.
   */
  warnings: readonly Warning[];
  /** Painted element per model node. Lets a host map a click back to the tree. */
  elements: ReadonlyMap<NodeId, HTMLElement>;
  /**
   * What Yoga computed, in panel coordinates, before any of it became CSS.
   *
   * Exposed because a layout bug has two possible homes — the Yoga mapping or
   * the painting — and CLAUDE.md's rule is to read both rather than guess.
   * Golden tests compare these numbers rather than pixels.
   */
  boxes: ReadonlyMap<NodeId, LayoutBox>;
  /**
   * Deps/Effects: frees the Yoga node tree (`freeRecursive`) and removes the
   * generated DOM from the container.
   *
   * Requires: must be called before re-rendering into the same container. Yoga
   * nodes are WASM handles and are not garbage collected.
   */
  dispose(): void;
}

/**
 * Purpose:      draw a document into a container element.
 * Deps/Effects: replaces the container's children and allocates Yoga nodes.
 *               Call `dispose()` on the result before rendering again.
 * Requires:     `await loadLayoutEngine()` once, first. Yoga is WebAssembly and
 *               cannot be loaded synchronously; keeping that await out here is
 *               what lets this function stay synchronous, which the playground
 *               and the golden tests both want.
 */
export function render(
  doc: UxmlDocument,
  container: HTMLElement,
  options?: RenderOptions,
): RenderResult {
  const ownerDocument = container.ownerDocument;
  const size = options?.size ?? {
    width: container.clientWidth,
    height: container.clientHeight,
  };

  const resolved = resolveStyles(doc, {
    ...(options?.activeStates === undefined ? {} : { activeStates: options.activeStates }),
    ...(options?.states === undefined ? {} : { states: options.states }),
  });
  const measureText = options?.measureText ?? createDefaultMeasureText(ownerDocument);

  const tree = layoutDocument(doc.root, resolved.styles, { size, measureText });

  // Yoga nodes are already allocated at this point, and `dispose` does not
  // exist until the result object below is built. Anything thrown in between
  // would strand the whole tree — and the playground runs this path on every
  // keystroke, so it would strand one per character typed.
  let painted;
  try {
    painted = paint(doc.root, tree.boxes, tree.parts, resolved.styles, container, {
      document: ownerDocument,
      resolveAsset: options?.resolveAsset,
    });
  } catch (error) {
    tree.dispose();
    throw error;
  }

  let disposed = false;
  return {
    warnings: [...resolved.warnings, ...tree.warnings, ...painted.warnings],
    elements: painted.elements,
    boxes: tree.boxes,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      tree.dispose();
      container.replaceChildren();
    },
  };
}
