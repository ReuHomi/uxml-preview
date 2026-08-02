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
  };

  const warnings: Warning[] = [];
  const usable: FlatRule[] = [];
  let reportedRoot = false;

  for (const flat of cascadeOrder(doc)) {
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
    const matched = flat.rule.selectors.find((s) => matchesSelector(s, node, prepared.ctx));
    // A rule contributes once even when several of its selectors match, and it
    // does so at the specificity of the one that matched.
    if (matched === undefined) continue;
    const specificity = specificityOf(matched);
    flat.rule.declarations.forEach((decl, declIndex) => {
      for (const [property, value] of expandShorthand(decl.property, decl.value)) {
        push(property, value, { kind: 'rule', sheet: flat.sheet, item: flat.item, declIndex }, specificity);
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

  const visit = (node: ElementNode, inherited: ReadonlyMap<string, ComputedValue>): void => {
    const own = pickWinners(collectCandidates(doc, node, prepared));

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
