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
  StyleOrigin,
  UxmlDocument,
  Warning,
} from '../model/types';
import { implicitClassesOf } from '../controls/registry';
import { THEME_UNITY_VERSION, THEME_USS } from '../controls/theme';
import { parseUss } from '../parser/uss';
import { attributeValueStart, parseDeclarationList } from '../parser/uss';
import { expandShorthand, isInherited } from './properties';
import { buildParentMap, matchesSelector, unsupportedFragment } from './selector';
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
  /** Pseudo-classes to treat as active, e.g. `new Set(['hover'])`. */
  activeStates?: ReadonlySet<string>;
}

export interface ResolveResult {
  styles: ReadonlyMap<NodeId, ComputedStyle>;
  warnings: readonly Warning[];
}

/** One declaration that competed, winner or not. */
export interface Candidate {
  property: string;
  value: string;
  origin: StyleOrigin;
  specificity: Specificity;
  /** Position in cascade order; higher wins a specificity tie. */
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
  const ctx: MatchContext = {
    parentOf: (node) => parents.get(node) ?? null,
    root: doc.root,
    activeStates: options?.activeStates ?? new Set<string>(),
    implicitClassesOf,
  };

  const warnings: Warning[] = [];
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
    specificity: Specificity,
  ): void => {
    out.push({ property, value, origin, specificity, order: order++, winner: false });
  };

  for (const flat of prepared.usable) {
    // A rule contributes once however many of its selectors match, and it does
    // so at the specificity of the *most specific* one that matched — not the
    // first in source order. `.a, #b { }` against an element carrying both has
    // to score (1,0,0), or a later `.c` rule wins a tie it should have lost.
    let specificity: Specificity | null = null;
    for (const selector of flat.rule.selectors) {
      if (!matchesSelector(selector, node, prepared.ctx)) continue;
      const candidate = specificityOf(selector);
      if (specificity === null || compareSpecificity(candidate, specificity) > 0) {
        specificity = candidate;
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
            : { kind: 'rule', sheet: flat.sheet, item: flat.item, declIndex };
        push(property, value, origin, specificity);
      }
    });
  }

  inlineDeclarations(doc, node).forEach((decl, declIndex) => {
    for (const [property, value] of expandShorthand(decl.property, decl.value)) {
      push(property, value, { kind: 'inline', node: node.id, declIndex }, INLINE_SPECIFICITY);
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
