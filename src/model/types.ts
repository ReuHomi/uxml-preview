/**
 * uxml-preview — in-memory document model.
 *
 * Phase 1 deliverable: types only. The parser that fills these lands in Phase 2.
 * See docs/ROADMAP.md and the decision table in docs/progress.md.
 *
 * One rule governs this file:
 *
 *   The model holds what the file said, and nothing that can be computed from it.
 *
 * Computed styles, "can we render this control", line numbers, expanded
 * shorthands — all derived, all kept out. Stored derived data goes stale when
 * the document is edited, and stale data nobody notices is worse than no data.
 */

// ---------------------------------------------------------------------------
// Source positions
// ---------------------------------------------------------------------------

/**
 * A half-open range into a source string: `[start, end)`.
 *
 * Which string it indexes is implied by where the span is reached from — spans
 * under `UxmlDocument.root` index `UxmlDocument.source`, spans under a
 * `StyleSheet` index that sheet's own `source`. `SourceRef` makes it explicit
 * where that context is not available.
 */
export interface Span {
  start: number;
  end: number;
}

/** An explicit text location, for warnings and editor navigation. */
export type SourceRef =
  | { in: 'uxml'; span: Span }
  | { in: 'uss'; sheet: number; span: Span };

/**
 * Opaque handle to a node, stable for the lifetime of the document.
 *
 * Assigned by the parser and never reused. Style provenance and warnings both
 * point at nodes, and a positional path would shift those pointers whenever an
 * unrelated sibling is inserted.
 */
export type NodeId = number & { readonly __brand: 'NodeId' };

// ---------------------------------------------------------------------------
// UXML tree
// ---------------------------------------------------------------------------

/**
 * Element name exactly as written.
 *
 * `prefix` is kept because serialization must restore `<ui:Label>` verbatim.
 * `local` is kept separate because USS type selectors match the C# class name
 * (`Label`), not the qualified tag.
 */
export interface ElementName {
  /** Namespace prefix as written, or null for an unprefixed tag. */
  prefix: string | null;
  local: string;
}

export interface Attribute {
  name: string;
  /**
   * Value exactly as written, XML entities NOT decoded.
   *
   * Decoding is lossy in the direction we care about: `&amp;` and `&#38;` both
   * decode to `&`, so a decoded value cannot be written back as the author
   * typed it. Consumers decode when they need the text.
   */
  value: string;
  span: Span;
}

/**
 * Three spans rather than one, so that an edit stays local.
 *
 * With a single outer span, editing any descendant would force the whole
 * subtree to be regenerated — losing the author's indentation and attribute
 * formatting all the way up to the root. Splitting the tag lets the serializer
 * reuse whichever parts are untouched:
 *
 *   <ui:VisualElement class="row">      <- openTag
 *     <ui:Button text="Use" />          <- inner: children AND the gaps between them
 *   </ui:VisualElement>                 <- closeTag
 *
 * For a self-closing element, `inner` is empty and `closeTag` is null.
 */
export interface ElementSpans {
  openTag: Span;
  inner: Span;
  closeTag: Span | null;
}

export interface ElementNode {
  id: NodeId;
  name: ElementName;
  /** Source order. Round-trip must not reorder attributes. */
  attributes: Attribute[];
  children: ElementNode[];
  spans: ElementSpans;

  /**
   * The open tag no longer matches `spans.openTag` (name or attributes changed),
   * so it must be regenerated.
   *
   * Deliberately does not propagate upward: a dirty child leaves its parent's
   * tag reusable, which is the entire reason `ElementSpans` is split.
   */
  tagDirty: boolean;

  /**
   * The child list changed — insert, remove, or reorder.
   *
   * Separate from `tagDirty` because it invalidates something different: the
   * whitespace between children. While this is false the serializer can slice
   * those gaps out of `spans.inner` even when individual children are dirty,
   * so the author's indentation survives. Once true, separators must be
   * synthesized (copy a sibling's leading whitespace).
   */
  childrenDirty: boolean;
}

// ---------------------------------------------------------------------------
// USS
// ---------------------------------------------------------------------------

export type Combinator = 'descendant' | 'child';

/**
 * One simple selector.
 *
 * `unknown` is the escape hatch for syntax USS does not support (`:nth-child`,
 * `[attr]`, `::before`) and for anything the parser does not recognize. The
 * parser stores it and moves on; the resolver drops the whole rule and warns.
 * Keeping the text means the rule still round-trips intact.
 */
export type SimpleSelector =
  | { kind: 'universal' }
  /** C# class name — `Label`, `Button`, `VisualElement`. Case-sensitive. */
  | { kind: 'type'; name: string }
  | { kind: 'class'; name: string }
  /** `#foo` — matches the UXML `name` attribute, not an HTML id. */
  | { kind: 'name'; name: string }
  /** `hover`, `active`, `focus`, `disabled`, `checked`, `selected`, `root`, `inactive`. */
  | { kind: 'pseudo'; name: string }
  | { kind: 'unknown'; text: string };

/** A compound selector plus how it attaches to the part before it. */
export interface SelectorPart {
  /** Ignored on the first part of a selector. */
  combinator: Combinator;
  /** All must match the same element (`.a.b`). */
  simple: SimpleSelector[];
}

/** One selector out of a comma-separated group. */
export interface Selector {
  parts: SelectorPart[];
  span: Span;
}

export interface Declaration {
  /** Custom properties keep their `--` prefix; they are not special-cased. */
  property: string;
  /**
   * Value exactly as written — `6px 14px`, not four expanded longhands.
   *
   * Expanding here would force serialization to guess a form the author never
   * typed (`6px 14px 6px 14px`), which breaks round-trip. The resolver expands;
   * the model does not. Unrecognized value syntax survives for the same reason:
   * it is just text until someone asks what it means.
   */
  value: string;
  span: Span;
  dirty: boolean;
}

export interface Rule {
  /** Comma-separated group. */
  selectors: Selector[];
  declarations: Declaration[];
  /** The whole rule, selector through closing brace. */
  span: Span;
  selectorSpan: Span;
  selectorDirty: boolean;
  /** See `ElementNode.childrenDirty` — same reason, applied to declarations. */
  declarationsDirty: boolean;
}

/**
 * A top-level item, in source order.
 *
 * `unknown` covers `@media`, malformed input, and anything else the parser does
 * not model. It is preserved by span and never interpreted.
 */
export type SheetItem =
  | { kind: 'rule'; rule: Rule }
  | { kind: 'import'; url: string; span: Span }
  | { kind: 'unknown'; span: Span };

export interface StyleSheet {
  /** The text this sheet's spans index into. */
  source: string;
  /**
   * Where the text came from — a path for `@import`ed sheets, null for the one
   * passed directly to `parse()`. Used in warning messages only.
   */
  origin: string | null;
  items: SheetItem[];
}

// ---------------------------------------------------------------------------
// Warnings
// ---------------------------------------------------------------------------

export type WarningKind =
  | 'unsupported-control'
  | 'unsupported-property'
  | 'unsupported-selector'
  | 'unsupported-unit'
  | 'version-dependent'
  | 'asset-unresolved'
  | 'import-unresolved'
  | 'malformed';

/**
 * Never a thrown error. One unsupported property must not take down the render
 * (see CLAUDE.md rule 6).
 *
 * There is no line number: it is derivable from `at.span` by counting newlines,
 * and a stored one silently points at the wrong place after an edit.
 */
export interface Warning {
  kind: WarningKind;
  message: string;
  /** Text location, when the warning has one. */
  at?: SourceRef;
  /** Element the warning is about, when it has one. Lets the UI highlight it. */
  node?: NodeId;
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export interface UxmlDocument {
  /** The exact UXML text every tree span indexes into. */
  source: string;
  /**
   * The `<ui:UXML>` element itself. It is a container, not a rendered control,
   * but it is kept in the tree because it carries the namespace declarations
   * that serialization must restore.
   *
   * Anything outside it — the XML declaration, a leading comment, a trailing
   * newline — has no field of its own. It is `source` either side of the root's
   * span, so serialization slices it back. Storing it would be storing a copy.
   */
  root: ElementNode;
  /**
   * At most one in v0.1. `@import` (Phase 3) appends sheets, each carrying its
   * own `source`, which is why the source text lives on the sheet.
   */
  sheets: StyleSheet[];
  /** Parse-time only — malformed input. Support judgments happen downstream. */
  warnings: Warning[];
}

// ---------------------------------------------------------------------------
// Style provenance
// ---------------------------------------------------------------------------

/**
 * Where a computed value came from.
 *
 * Phase 8 needs this to answer "write to the inline style, or edit the rule?".
 * Every variant *except `builtin-theme`* points into the model, so the editor
 * can jump straight to the declaration's span and rewrite exactly that text.
 * `builtin-theme` is the one that does not, and it says so rather than
 * inventing a location — an editor must branch on it, not follow it.
 *
 * Note the inline variant indexes declarations parsed on demand from the
 * element's `style` attribute — those declarations are not stored on the node.
 * The attribute string is the single source; a parsed copy alongside it could
 * disagree with it.
 */
export type StyleOrigin =
  | { kind: 'inline'; node: NodeId; declIndex: number }
  | { kind: 'rule'; sheet: number; item: number; declIndex: number }
  | { kind: 'inherited'; from: NodeId; origin: StyleOrigin }
  /**
   * A control default this renderer supplies, standing in for Unity's theme
   * stylesheet. **There is no file and no span**: the declaration exists in this
   * library, not in the user's project.
   *
   * Its own variant rather than a `rule` with an invented path, because an
   * editor offering "jump to the declaration" must be able to tell that there
   * is nowhere to jump — pointing at a file that does not exist is worse than
   * saying the value is not editable.
   *
   * `unityVersion` records where the value was measured. Theme values move
   * between Unity versions, and when one stops matching this is the first thing
   * to check.
   */
  | { kind: 'builtin-theme'; selector: string; property: string; unityVersion: string }
  /** USS default, which is not always the CSS default — `flex-direction` is `column`. */
  | { kind: 'default' };

/**
 * Deliberately absent from this file:
 *
 * - computed style values — derived, recomputed on demand (Phase 3)
 * - "is this control supported" — a renderer concern that changes in Phase 7,
 *   while the file it was parsed from does not
 * - line/column numbers — derived from spans
 * - expanded shorthands — derived from declaration values
 */
