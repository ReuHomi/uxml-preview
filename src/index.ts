/**
 * uxml-preview — public API surface.
 *
 * Phase 0: signatures only. Implementations land in Phases 2–4.
 * See docs/ROADMAP.md.
 */

// ---------------------------------------------------------------------------
// Warnings
// ---------------------------------------------------------------------------

export type WarningKind =
  | 'unsupported-control'
  | 'unsupported-property'
  | 'unsupported-selector'
  | 'unsupported-unit'
  | 'version-dependent'
  | 'asset-unresolved';

export interface Warning {
  kind: WarningKind;
  /** Human-readable message. */
  message: string;
  /** Source file the warning came from, if known. */
  source?: 'uxml' | 'uss';
  /** 1-based line number in the source, if known. */
  line?: number;
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

/**
 * Parsed in-memory representation of a UXML document plus its stylesheets.
 * Defined in Phase 1 (src/model/types.ts).
 */
export interface UxmlDocument {
  readonly warnings: readonly Warning[];
}

/** Parse UXML and USS text into a document model. */
export declare function parse(uxml: string, uss?: string): UxmlDocument;

/** Serialize a document model back to UXML and USS text. */
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
  warnings: readonly Warning[];
  /** Releases Yoga nodes and DOM. Must be called before re-rendering. */
  dispose(): void;
}

/** Render a document into a container element. */
export declare function render(
  doc: UxmlDocument,
  container: HTMLElement,
  options?: RenderOptions,
): RenderResult;
