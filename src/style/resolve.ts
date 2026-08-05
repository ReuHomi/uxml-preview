/**
 * The cascade: what style actually applies to each element.
 *
 * Output lives here, not on the model. Storing computed values back on nodes
 * would mean invalidating them whenever a rule changes, and a missed
 * invalidation shows the user a value that is no longer true. Recomputing is
 * cheap and cannot go stale.
 *
 * Precedence, highest first:
 *   1. the element's own `style` attribute
 *   2. matching rules, by specificity, ties going to the later rule
 *   3. inheritance from the parent, for the properties that inherit
 *   4. the USS default, which this module does not fill in
 *
 * Anything absent from the result is at its default. Not writing defaults keeps
 * the map small and keeps the default table in one place — the renderer, which
 * is what needs to know that `flex-direction` starts at `column`.
 */

import type {
  Declaration,
  ElementNode,
  NodeId,
  Rule,
  Selector,
  StyleOrigin,
  UxmlDocument,
  Warning,
} from '../model/types';
import { implicitClassesOf } from '../controls/registry';
import { THEME_UNITY_VERSION, THEME_USS } from '../controls/theme';
import { parseUss } from '../parser/uss';
import { attributeValueStart, parseDeclarationList } from '../parser/uss';
import { expandShorthand, isInherited } from './properties';
import {
  buildParentMap,
  matchesSelector,
  statesRequiredBy,
  unsupportedFragment,
} from './selector';
import type { MatchContext } from './selector';
import { compareSpecificity, specificityOf } from './specificity';
import type { Specificity } from './specificity';

export interface ComputedValue {
  /** `var()` already substituted. Otherwise exactly as the author wrote it. */
  value: string;
  origin: StyleOrigin;
}

export type ComputedStyle = ReadonlyMap<string, ComputedValue>;

export interface ResolveOptions {
  /**
   * Pseudo-classes to treat as active on every element, e.g. `new Set(['hover'])`.
   *
   * Blunt, and kept for the case where that is what you want. Per-element
   * control is `states`.
   */
  activeStates?: ReadonlySet<string>;
  /**
   * Pseudo-classes to activate per element, keyed by USS selector.
   *
   * ```ts
   * { '#UseButton': ['hover'], '#DropButton': ['disabled'] }
   * ```
   *
   * States are explicit input, never mouse events: a render that depends on
   * where the pointer is cannot be compared to anything twice.
   *
   * Keys are matched against the tree **without** any state applied, so a key
   * cannot switch itself on, and `:hover` in a key is meaningless.
   */
  states?: Readonly<Record<string, readonly string[]>>;
}

export interface ResolveResult {
  styles: ReadonlyMap<NodeId, ComputedStyle>;
  warnings: readonly Warning[];
}

/**
 * Where a declaration sits in the cascade's outermost comparison.
 *
 * Unity's control defaults are not "a stylesheet that loaded first" — they are
 * a lower origin, the way a browser's user-agent sheet is, so **an author rule
 * beats them regardless of specificity**. Measured, not reasoned: the
 * `states-disabled` case writes `Button { margin: 0 }` (a type selector, 0,0,1)
 * against the theme's `.unity-button` (a class, 0,1,0), and Unity puts the
 * button at x=0. Specificity alone would have put it at x=3.
 *
 * This is the axis the cascade was missing. Without it the theme wins ties it
 * should lose, and every value added to `theme.ts` spreads the error.
 */
export const enum Rank {
  BuiltinTheme = 0,
  Author = 1,
}

/** One declaration that competed, winner or not. */
export interface Candidate {
  property: string;
  value: string;
  origin: StyleOrigin;
  /** Compared before specificity. A built-in default never beats author USS. */
  rank: Rank;
  specificity: Specificity;
  /** Position in cascade order; higher wins a specificity tie within a rank. */
  order: number;
  winner: boolean;
}

/** Inline styles outrank every selector, so they are given an unreachable score. */
const INLINE_SPECIFICITY: Specificity = [Number.MAX_SAFE_INTEGER, 0, 0];

interface FlatRule {
  rule: Rule;
  sheet: number;
  item: number;
  /** From the built-in control defaults rather than from the user's files. */
  builtin?: boolean;
}

/**
 * Unity's control defaults, parsed once.
 *
 * Parsed rather than hand-built so it goes through the same selector and
 * specificity code as author USS. A theme rule that scored differently from an
 * identical rule in a user's file would be a second cascade, and the bug it
 * produced would be unreproducible from the stylesheet the user can see.
 */
const THEME_RULES: FlatRule[] = parseUss(THEME_USS, null, -1).sheet.items.flatMap(
  (item, index) =>
    item.kind === 'rule' ? [{ rule: item.rule, sheet: -1, item: index, builtin: true }] : [],
);

/** The selector text a theme rule was written with, for provenance. */
function themeSelectorText(rule: Rule): string {
  return THEME_USS.slice(rule.selectorSpan.start, rule.selectorSpan.end).trim();
}

/**
 * Purpose:      which pseudo-classes are active on each element.
 * Deps/Effects: appends a warning for any `states` key that is not a usable
 *               selector; the key is then ignored rather than throwing.
 * Ensures:      keys are matched with no states active, so a key can never
 *               switch itself on and the result cannot depend on its own output.
 *
 * The keys go through the ordinary USS selector parser — wrapped in an empty
 * rule — so `#a`, `.b .c` and `Button.primary` mean exactly what they mean in a
 * stylesheet. A second, hand-written selector syntax here would be one more
 * thing that can disagree with the first.
 */
function buildStateMap(
  doc: UxmlDocument,
  base: MatchContext,
  options: ResolveOptions | undefined,
  warnings: Warning[],
): Map<ElementNode, ReadonlySet<string>> {
  const global = options?.activeStates ?? new Set<string>();
  const entries = Object.entries(options?.states ?? {});

  const parsed: Array<{ selectors: readonly Selector[]; states: readonly string[] }> = [];
  for (const [key, states] of entries) {
    const rule = parseUss(`${key} {}`, null, -1).sheet.items.find((i) => i.kind === 'rule');
    const bad = rule === undefined ? key : unsupportedFragment(rule.rule.selectors);
    if (rule === undefined || bad !== null) {
      warnings.push({
        kind: 'unsupported-selector',
        message: `states key "${key}" is not a usable USS selector; it is ignored`,
      });
      continue;
    }
    parsed.push({ selectors: rule.rule.selectors, states });
  }

  const map = new Map<ElementNode, ReadonlySet<string>>();

  /**
   * `enabled="false"` in the file is a state the document declares about itself,
   * so it applies without anyone passing `states`. Measured: `states-disabled`
   * writes it and Unity comes back 120 wide, having matched `:disabled`.
   *
   * It descends, because Unity's `SetEnabled(false)` disables the subtree. That
   * part is documented rather than measured, so `disabled-inherits` exists to
   * judge it — if Unity says otherwise, this inheritance is what comes out.
   */
  const disabledHere = (node: ElementNode): boolean =>
    node.attributes.some((a) => a.name === 'enabled' && a.value === 'false');

  const visit = (node: ElementNode, inheritedDisabled: boolean): void => {
    const disabled = inheritedDisabled || disabledHere(node);
    const set = new Set(global);
    if (disabled) set.add('disabled');
    for (const entry of parsed) {
      if (entry.selectors.some((s) => matchesSelector(s, node, base))) {
        for (const state of entry.states) set.add(state);
      }
    }
    map.set(node, set);
    for (const child of node.children) visit(child, disabled);
  };
  visit(doc.root, false);
  return map;
}

interface Prepared {
  ctx: MatchContext;
  usable: FlatRule[];
  warnings: Warning[];
}

/**
 * Rules in cascade order, with imported sheets spliced in where the `@import`
 * appears. An imported rule therefore loses a tie to a rule written after the
 * import, which is the order the author sees on the page.
 */
function cascadeOrder(doc: UxmlDocument): FlatRule[] {
  const out: FlatRule[] = [];
  const byOrigin = new Map<string, number>();
  doc.sheets.forEach((sheet, index) => {
    if (sheet.origin !== null && !byOrigin.has(sheet.origin)) byOrigin.set(sheet.origin, index);
  });

  // Control defaults go first, so an author rule of equal specificity wins on
  // order. That is the whole reason Unity's own theme is overridable.
  out.push(...THEME_RULES);

  const visited = new Set<number>();
  const walk = (index: number): void => {
    if (visited.has(index)) return;
    visited.add(index);
    const sheet = doc.sheets[index];
    if (sheet === undefined) return;
    sheet.items.forEach((item, i) => {
      if (item.kind === 'rule') {
        out.push({ rule: item.rule, sheet: index, item: i });
      } else if (item.kind === 'import') {
        const target = byOrigin.get(item.url);
        if (target !== undefined) walk(target);
      }
    });
  };
  walk(0);
  return out;
}

function hasRootPseudo(rule: Rule): boolean {
  return rule.selectors.some((s) =>
    s.parts.some((p) => p.simple.some((x) => x.kind === 'pseudo' && x.name === 'root')),
  );
}

/**
 * Purpose:      shared setup for both entry points below.
 * Ensures:      rules holding syntax USS does not have are excluded here, once,
 *               so neither caller can accidentally match against one.
 */
function prepare(doc: UxmlDocument, options?: ResolveOptions): Prepared {
  const parents = buildParentMap(doc.root);
  const warnings: Warning[] = [];

  const NO_STATES: ReadonlySet<string> = new Set();
  const shared = {
    parentOf: (node: ElementNode) => parents.get(node) ?? null,
    root: doc.root,
    implicitClassesOf,
  };

  // Two contexts, and the order matters. `base` has no states at all and is what
  // the `states` keys are matched against; `ctx` carries the result and is what
  // the stylesheet is matched against. Using one context for both would let a
  // key like `Button:hover` turn itself on.
  const base: MatchContext = { ...shared, statesOf: () => NO_STATES };
  const stateMap = buildStateMap(doc, base, options, warnings);
  const ctx: MatchContext = { ...shared, statesOf: (node) => stateMap.get(node) ?? NO_STATES };

  const usable: FlatRule[] = [];
  let reportedRoot = false;

  for (const flat of cascadeOrder(doc)) {
    // Built-in rules skip the checks below: they are ours, they cannot contain
    // syntax we do not support, and they are reported when they actually apply
    // to something rather than merely because they exist.
    if (flat.builtin === true) {
      usable.push(flat);
      continue;
    }

    const bad = unsupportedFragment(flat.rule.selectors);
    if (bad !== null) {
      // Reported once per rule rather than once per element it might have hit.
      warnings.push({
        kind: 'unsupported-selector',
        message: `"${bad}" is not supported in USS; the whole rule is ignored`,
        at: { in: 'uss', sheet: flat.sheet, span: flat.rule.selectorSpan },
      });
      continue;
    }
    if (!reportedRoot && hasRootPseudo(flat.rule)) {
      reportedRoot = true;
      warnings.push({
        kind: 'version-dependent',
        message:
          ':root in USS names the element the stylesheet was applied to, not the ' +
          'document root as in CSS. This preview matches it against the <ui:UXML> ' +
          'element; verify against your Unity version.',
        at: { in: 'uss', sheet: flat.sheet, span: flat.rule.selectorSpan },
      });
    }
    usable.push(flat);
  }

  return { ctx, usable, warnings };
}

/** Declarations from the element's own `style` attribute, with absolute spans. */
function inlineDeclarations(doc: UxmlDocument, node: ElementNode): Declaration[] {
  const attr = node.attributes.find((a) => a.name === 'style');
  if (attr === undefined) return [];
  const start = attributeValueStart(attr);
  if (start === null) return [];
  return parseDeclarationList(doc.source, start, start + attr.value.length);
}

/**
 * Purpose:      every declaration reaching one element, in cascade order.
 * Ensures:      the single place declarations are gathered. `resolveStyles` and
 *               `explainProperty` both go through it, which is what makes the
 *               winner they report necessarily the same one.
 */
function collectCandidates(
  doc: UxmlDocument,
  node: ElementNode,
  prepared: Prepared,
): Candidate[] {
  const out: Candidate[] = [];
  let order = 0;

  const push = (
    property: string,
    value: string,
    origin: StyleOrigin,
    rank: Rank,
    specificity: Specificity,
  ): void => {
    out.push({ property, value, origin, rank, specificity, order: order++, winner: false });
  };

  for (const flat of prepared.usable) {
    // A rule contributes once however many of its selectors match, and it does
    // so at the specificity of the *most specific* one that matched — not the
    // first in source order. `.a, #b { }` against an element carrying both has
    // to score (1,0,0), or a later `.c` rule wins a tie it should have lost.
    let specificity: Specificity | null = null;
    let states: readonly string[] = [];
    for (const selector of flat.rule.selectors) {
      if (!matchesSelector(selector, node, prepared.ctx)) continue;
      const candidate = specificityOf(selector);
      if (specificity === null || compareSpecificity(candidate, specificity) > 0) {
        specificity = candidate;
        // Taken from the selector that won, not from the group: `.a, .b:hover`
        // reaching an element through `.a` is not conditional on anything.
        states = statesRequiredBy(selector);
      }
    }
    if (specificity === null) continue;
    flat.rule.declarations.forEach((decl, declIndex) => {
      for (const [property, value] of expandShorthand(decl.property, decl.value)) {
        // A theme declaration has no file and no span, so it gets an origin that
        // says so. Writing `{ kind: 'rule', sheet: -1 }` here would hand an
        // editor a location it could follow to nowhere.
        const origin: StyleOrigin =
          flat.builtin === true
            ? {
                kind: 'builtin-theme',
                selector: themeSelectorText(flat.rule),
                property,
                unityVersion: THEME_UNITY_VERSION,
              }
            : {
                kind: 'rule',
                sheet: flat.sheet,
                item: flat.item,
                declIndex,
                // Omitted rather than set to [] when unconditional, so the
                // common case stays the shape it has always been.
                ...(states.length > 0 ? { states } : {}),
              };
        push(property, value, origin, flat.builtin === true ? Rank.BuiltinTheme : Rank.Author, specificity);
      }
    });
  }

  inlineDeclarations(doc, node).forEach((decl, declIndex) => {
    for (const [property, value] of expandShorthand(decl.property, decl.value)) {
      push(property, value, { kind: 'inline', node: node.id, declIndex }, Rank.Author, INLINE_SPECIFICITY);
    }
  });

  return out;
}

/** Marks and returns the winning candidate per property. */
function pickWinners(candidates: Candidate[]): Map<string, Candidate> {
  const best = new Map<string, Candidate>();
  for (const candidate of candidates) {
    const current = best.get(candidate.property);
    if (current === undefined) {
      best.set(candidate.property, candidate);
      continue;
    }
    // Rank outranks specificity, which outranks source order. Getting these in
    // the wrong sequence is how a control default came to beat an author rule.
    if (candidate.rank !== current.rank) {
      if (candidate.rank > current.rank) best.set(candidate.property, candidate);
      continue;
    }
    const bySpecificity = compareSpecificity(candidate.specificity, current.specificity);
    if (bySpecificity > 0 || (bySpecificity === 0 && candidate.order > current.order)) {
      best.set(candidate.property, candidate);
    }
  }
  for (const candidate of best.values()) candidate.winner = true;
  return best;
}

const VAR_PATTERN = /var\(\s*(--[^,)\s]+)\s*(?:,([^)]*))?\)/;

/**
 * Purpose:      substitute `var(--x)` against the custom properties in scope.
 * Ensures:      returns null when a reference cannot be satisfied and no usable
 *               fallback was given. CSS drops such a declaration rather than
 *               treating it as empty, and so do we.
 */
function substituteVars(
  value: string,
  lookup: ReadonlyMap<string, string>,
  seen: ReadonlySet<string> = new Set(),
): string | null {
  let out = value;
  for (let guard = 0; guard < 32; guard++) {
    const match = VAR_PATTERN.exec(out);
    if (match === null) return out;

    const name = match[1]!;
    const fallback = match[2]?.trim();
    if (seen.has(name)) return null;

    const nested = new Set([...seen, name]);
    const referenced = lookup.get(name);
    const replacement =
      referenced !== undefined
        ? substituteVars(referenced, lookup, nested)
        : fallback !== undefined && fallback.length > 0
          ? substituteVars(fallback, lookup, nested)
          : null;
    if (replacement === null) return null;

    out = out.slice(0, match.index) + replacement + out.slice(match.index + match[0].length);
  }
  return null;
}

/**
 * Purpose:      compute the style of every element in the document.
 * Deps/Effects: reads `doc` only; nothing on the model is mutated.
 * Ensures:      a property absent from a node's map is at its USS default.
 */
export function resolveStyles(doc: UxmlDocument, options?: ResolveOptions): ResolveResult {
  const prepared = prepare(doc, options);
  const warnings: Warning[] = [...prepared.warnings];
  const styles = new Map<NodeId, ComputedStyle>();

  // Reported once, and only if a control default actually reached an element.
  // Announcing the theme on a document with no Button would be a warning about
  // something that did not happen.
  let themeApplied = false;

  const visit = (node: ElementNode, inherited: ReadonlyMap<string, ComputedValue>): void => {
    const candidates = collectCandidates(doc, node, prepared);
    if (!themeApplied && candidates.some((c) => c.origin.kind === 'builtin-theme')) {
      themeApplied = true;
    }
    const own = pickWinners(candidates);

    // Custom properties are resolved first: an ordinary value may reference one,
    // and a custom property may itself reference another.
    const customs = new Map<string, string>();
    for (const [property, entry] of inherited) {
      if (property.startsWith('--')) customs.set(property, entry.value);
    }
    for (const [property, entry] of own) {
      if (property.startsWith('--')) customs.set(property, entry.value);
    }

    const computed = new Map<string, ComputedValue>();
    for (const [property, entry] of inherited) computed.set(property, entry);

    for (const [property, candidate] of own) {
      const substituted = substituteVars(candidate.value, customs);
      if (substituted === null) {
        warnings.push({
          kind: 'unsupported-property',
          message: `${property}: var() reference could not be resolved; declaration dropped`,
          node: node.id,
        });
        continue;
      }
      computed.set(property, { value: substituted, origin: candidate.origin });
    }

    styles.set(node.id, computed);

    // A direct declaration always beats an inherited one, so children are handed
    // this element's final values rather than a merge of anything else.
    const forChildren = new Map<string, ComputedValue>();
    for (const [property, entry] of computed) {
      if (!isInherited(property)) continue;
      forChildren.set(property, {
        value: entry.value,
        origin: { kind: 'inherited', from: node.id, origin: entry.origin },
      });
    }
    for (const child of node.children) visit(child, forChildren);
  };

  visit(doc.root, new Map());

  if (themeApplied) {
    warnings.push({
      kind: 'version-dependent',
      message:
        `Unity's control defaults were applied, as measured on ${THEME_UNITY_VERSION} ` +
        '(Unity ships these as a theme stylesheet). Other versions may use different ' +
        'values; see src/controls/theme.ts.',
    });
  }

  return { styles, warnings };
}

/**
 * Purpose:      every declaration that competed for one property on one element.
 * Ensures:      the entry marked `winner` is the one `resolveStyles` chose;
 *               both call `collectCandidates` and `pickWinners`.
 *
 * This is what an editor asks before offering "change the inline style, or edit
 * the rule?". Nothing precomputes it: a stored candidate list would go stale the
 * moment a rule changed, and a stale answer here rewrites the wrong file.
 */
export function explainProperty(
  doc: UxmlDocument,
  node: ElementNode,
  property: string,
  options?: ResolveOptions,
): Candidate[] {
  const prepared = prepare(doc, options);
  const candidates = collectCandidates(doc, node, prepared).filter(
    (c) => c.property === property,
  );
  pickWinners(candidates);
  return candidates;
}
