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
import { parseUxml } from './parser/uxml';
import { parseUss } from './parser/uss';
import { serializeUxml } from './serializer/uxml';
import { serializeUss } from './serializer/uss';

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
export function parse(uxml: string, uss?: string): UxmlDocument {
  const tree = parseUxml(uxml);
  if (uss === undefined) {
    return { source: uxml, root: tree.root, sheets: [], warnings: tree.warnings };
  }
  const sheet = parseUss(uss, null, 0);
  return {
    source: uxml,
    root: tree.root,
    sheets: [sheet.sheet],
    warnings: [...tree.warnings, ...sheet.warnings],
  };
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
