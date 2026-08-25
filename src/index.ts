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
  WarningKindMap,
  Warning,
  UxmlDocument,
  StyleOrigin,
} from './model/types';

import type { ElementNode, NodeId, StyleSheet, UxmlDocument, Warning } from './model/types';
import {
  expandTemplates,
  registerTemplateParser,
  rememberTemplateResolver,
} from './template/expand';
export { collectDependencies, expandTemplates } from './template/expand';
export type { TemplateExpansion, TemplateResolver } from './template/expand';

registerTemplateParser((source, resolver) =>
  resolver === undefined ? parse(source) : parse(source, undefined, { resolveImport: resolver }),
);
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
export { KNOWN_DIVERGENCES } from './known-divergences';
export type { KnownDivergence } from './known-divergences';

import { decodeEntities } from './parser/entities';
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
   * Loads the text of a stylesheet the document refers to. Return `null` when
   * the path cannot be resolved; it is then reported as a warning and its rules
   * simply do not participate.
   *
   * Used for both ways a document can name a stylesheet — `@import` inside USS,
   * and `<Style src="…">` inside UXML. Both quote paths like
   * `project://database/Assets/UI/base.uss`, which only the host application
   * knows how to turn into file contents, and there is no reason for a host to
   * implement that lookup twice.
   *
   * `from` is the URL of the stylesheet containing this import — exactly the
   * string this hook received as `url` when that containing sheet was itself
   * resolved, unmodified. `null` for a `<Style src="…">` reference, which is
   * not contained in any stylesheet. A relative `@import` cannot be resolved
   * without this: `a.uss` importing `"b.uss"` means a path relative to `a.uss`,
   * not to the UXML document, and there is no other way for the host to learn
   * `a.uss`'s own URL at the point it resolves `b.uss`.
   *
   * Non-breaking: this is an added argument, not a replacement one, so an
   * existing one-argument callback keeps working unchanged.
   *
   * Relative imports are deduplicated by `(url, from)`, so two parent sheets
   * may resolve the same spelling to different files. Root-fixed URLs —
   * `project://…` or a path beginning with `/` — are deduplicated by URL alone.
   */
  resolveImport?: (url: string, from: string | null) => string | null;
}

/**
 * Purpose:      the stylesheets a UXML document names via `<Style src="…">`.
 * Ensures:      document order is preserved, so a later sheet wins a tie.
 *
 * UI Builder writes one of these into the file whenever a stylesheet is
 * attached, which makes it the ordinary shape of a real document rather than an
 * optional extra. Ignoring it silently was the reason a real project's UXML
 * rendered unstyled with nothing said about why.
 */
function styleReferences(
  node: ElementNode,
  out: Array<{ url: string; scope: NodeId }> = [],
): Array<{ url: string; scope: NodeId }> {
  for (const child of node.children) {
    if (child.name.local === 'Style') {
      const src = child.attributes.find((a) => a.name === 'src')?.value;
      // Decoded here, not stored decoded: the model keeps the raw text so the
      // file round-trips, and the host needs the value the text stands for.
      if (src !== undefined && src.length > 0) {
        out.push({ url: decodeEntities(src), scope: node.id });
      }
    }
    styleReferences(child, out);
  }
  return out;
}

// Unity 6000.0.40f1: absolute-import-assets, absolute-import-project,
// absolute-import-package-project, and absolute-import-rooted-packages all
// load one global sheet across different parents.
function isRootedImport(url: string): boolean {
  return url.startsWith('project://') || url.startsWith('/');
}

export function parse(uxml: string, uss?: string, options?: ParseOptions): UxmlDocument {
  const tree = parseUxml(uxml);
  const warnings: Warning[] = [...tree.warnings];
  const sheets: StyleSheet[] = [];
  const styleRoots: Array<{ sheet: number; scope: NodeId }> = [];

  // The document's own `<Style src="…">` sheets come first, then anything the
  // caller passed directly — so a host that supplies both keeps the last word.
  const referenced: Array<{ text: string; origin: string; scope: NodeId }> = [];
  for (const { url, scope } of styleReferences(tree.root)) {
    // Not contained in any stylesheet — this is the document naming its own
    // stylesheet directly, not an @import.
    const text = options?.resolveImport?.(url, null) ?? null;
    if (text === null) {
      warnings.push({
        kind: 'import-unresolved',
        message:
          options?.resolveImport === undefined
            ? `<Style src="${url}"> was not loaded: pass resolveImport to read it, ` +
              'or pass the stylesheet text directly. Until then this document renders unstyled.'
            : `<Style src="${url}"> could not be resolved`,
        node: tree.root.id,
      });
      continue;
    }
    referenced.push({ text, origin: url, scope });
  }

  if (uss !== undefined || referenced.length > 0) {
    // Imports are followed breadth-first. Repeating the same resolution request
    // is a cycle; the same relative spelling from a different parent is not.
    const seenImports = new Map<string, number | null>();
    const queue: Array<{ text: string; origin: string | null; sheet: number }> = [];
    let nextSheet = 0;
    for (const reference of referenced) {
      const sheet = nextSheet++;
      queue.push({ text: reference.text, origin: reference.origin, sheet });
      styleRoots.push({ sheet, scope: reference.scope });
    }
    if (uss !== undefined) {
      const sheet = nextSheet++;
      queue.push({ text: uss, origin: null, sheet });
      styleRoots.push({ sheet, scope: tree.root.id });
    }

    while (queue.length > 0) {
      const next = queue.shift()!;
      const index = next.sheet;
      const parsed = parseUss(next.text, next.origin, index);
      sheets.push(parsed.sheet);
      warnings.push(...parsed.warnings);

      for (const item of parsed.sheet.items) {
        if (item.kind !== 'import') continue;
        const importKey = isRootedImport(item.url)
          ? item.url
          : JSON.stringify([item.url, next.origin]);
        if (seenImports.has(importKey)) {
          const seenSheet = seenImports.get(importKey);
          if (seenSheet !== null && seenSheet !== undefined) item.resolvedSheet = seenSheet;
          continue;
        }
        seenImports.set(importKey, null);
        // `next.origin` is the exact string this sheet was itself resolved
        // with as `url` (or null if it was the top-level `uss` argument, or
        // came from `<Style src>` — neither is contained in a stylesheet) —
        // never reconstructed, so it stays byte-identical for the host.
        const text = options?.resolveImport?.(item.url, next.origin) ?? null;
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
        const sheet = nextSheet++;
        seenImports.set(importKey, sheet);
        item.resolvedSheet = sheet;
        queue.push({ text, origin: item.url, sheet });
      }
    }
  }

  const document = { source: uxml, root: tree.root, sheets, styleRoots, warnings };
  rememberTemplateResolver(document, options?.resolveImport);
  return document;
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
   *
   * `form` says which of the two `path` came from — `'url'` is a path
   * (project-relative or absolute), `'resource'` is a Unity Resources-folder
   * name (no extension, resolved by Unity's own lookup rules). They are not
   * interchangeable: a host that ignores `form` and resolves both as file
   * paths will resolve `resource("foo")` against whatever happens to sit at
   * that path — the wrong image, silently, if one exists there at all.
   */
  resolveAsset?: (path: string, form: 'url' | 'resource') => string | null;

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
   * `UxmlDocument.warnings`, which covers malformed input and unresolved
   * `<Style src="…">` / `@import` references rather than render-time support.
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

  const expanded = expandTemplates(doc);
  const renderDocument = expanded.document;
  const resolved = resolveStyles(renderDocument, {
    ...(options?.activeStates === undefined ? {} : { activeStates: options.activeStates }),
    ...(options?.states === undefined ? {} : { states: options.states }),
  });
  const measureText = options?.measureText ?? createDefaultMeasureText(ownerDocument);

  const tree = layoutDocument(renderDocument.root, resolved.styles, resolved.partStyles, {
    size,
    measureText,
  });

  // Yoga nodes are already allocated at this point, and `dispose` does not
  // exist until the result object below is built. Anything thrown in between
  // would strand the whole tree — and the playground runs this path on every
  // keystroke, so it would strand one per character typed.
  let painted;
  try {
    painted = paint(renderDocument.root, tree.boxes, tree.parts, resolved.styles, container, {
      document: ownerDocument,
      resolveAsset: options?.resolveAsset,
    });
  } catch (error) {
    tree.dispose();
    throw error;
  }

  let disposed = false;
  return {
    warnings: [...expanded.warnings, ...resolved.warnings, ...tree.warnings, ...painted.warnings],
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
