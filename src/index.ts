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

import type { UxmlDocument, Warning } from './model/types';

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
export declare function parse(uxml: string, uss?: string): UxmlDocument;

/**
 * Serialize a document model back to UXML and USS text.
 *
 * Ensures: for a document with no edits, the output is byte-identical to the
 * input — untouched nodes are re-emitted by slicing `UxmlDocument.source`
 * rather than being regenerated. After an edit, only the edited region changes.
 */
export declare function serialize(doc: UxmlDocument): { uxml: string; uss: string };

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
}

export interface RenderResult {
  /**
   * Everything the renderer could not honour: unsupported controls, properties,
   * selectors and units, plus unresolved assets. Distinct from
   * `UxmlDocument.warnings`, which only covers malformed input.
   */
  warnings: readonly Warning[];
  /**
   * Deps/Effects: frees the Yoga node tree (`freeRecursive`) and removes the
   * generated DOM from the container.
   *
   * Requires: must be called before re-rendering into the same container. Yoga
   * nodes are WASM handles and are not garbage collected.
   */
  dispose(): void;
}

/** Render a document into a container element. */
export declare function render(
  doc: UxmlDocument,
  container: HTMLElement,
  options?: RenderOptions,
): RenderResult;
