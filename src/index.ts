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

import type { StyleSheet, UxmlDocument, Warning } from './model/types';
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
