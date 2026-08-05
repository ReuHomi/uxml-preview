/**
 * Selector matching.
 *
 * Matching runs right to left and backtracks across descendant combinators,
 * which is what makes `.a .b .c` correct when `.a` appears at several depths.
 *
 * Case-sensitive throughout: USS does not fold case, so `label` does not match
 * a `Label`.
 *
 * Nothing here knows what a target *is*. It was written against the document's
 * elements, and then control parts — which are not in any document — had to be
 * matchable too. Rather than teach this module about both, the caller supplies
 * the five questions a selector can ask. That keeps one matcher rather than
 * two, which matters more than it sounds: two matchers means two answers to
 * "does this rule apply", and eventually they disagree.
 */

import type { Selector, SelectorPart, SimpleSelector } from '../model/types';

/**
 * How to interrogate whatever is being matched.
 *
 * Deps: every function here is read during matching, including for ancestors —
 * `.panel:hover .item` asks the ancestor for its states, not the element's.
 */
export interface MatchContext<T> {
  /**
   * The style parent, which is not always the layout parent.
   *
   * Measured, and it decides the shape of this whole design: a slot inside a
   * ScrollView sits physically inside `unity-content-container`, yet
   * `#Grid > .slot` reaches it in Unity. So an element from the file keeps its
   * file parent here, and the parts a control builds are transparent to it.
   * See `child-combinator-through-parts` and the 2026-08-06 decision rows.
   */
  parentOf: (target: T) => T | null;
  /**
   * The element `:root` refers to.
   *
   * USS `:root` is not the CSS one: it names whichever element the stylesheet
   * was applied to, and does not match that element's children. A preview has
   * no UIDocument to attach to, so the `<ui:UXML>` element stands in — which
   * keeps the usual custom-property token pattern working, since values
   * declared there inherit down the whole tree.
   */
  isRoot: (target: T) => boolean;
  /** Pseudo-classes active on this target, e.g. `hover`. */
  statesOf: (target: T) => ReadonlySet<string>;
  /** What a type selector compares against — the C# class name, not a tag. */
  typeNameOf: (target: T) => string;
  /** What `#name` compares against. */
  idOf: (target: T) => string | undefined;
  /** Written classes plus any the control adds, e.g. `unity-button`. */
  classesOf: (target: T) => readonly string[];
}

function matchesSimple<T>(
  simple: SimpleSelector,
  target: T,
  ctx: MatchContext<T>,
): boolean {
  switch (simple.kind) {
    case 'universal':
      return true;
    case 'type':
      // Type selectors name the C# class, so the namespace prefix is not part
      // of the comparison.
      return ctx.typeNameOf(target) === simple.name;
    case 'class':
      return ctx.classesOf(target).includes(simple.name);
    case 'name':
      return ctx.idOf(target) === simple.name;
    case 'pseudo':
      return simple.name === 'root'
        ? ctx.isRoot(target)
        : ctx.statesOf(target).has(simple.name);
    case 'unknown':
      // Unreachable in practice: a rule holding one of these is dropped before
      // matching is attempted. Answering false keeps that true either way.
      return false;
  }
}

function matchesCompound<T>(part: SelectorPart, target: T, ctx: MatchContext<T>): boolean {
  return part.simple.every((s) => matchesSimple(s, target, ctx));
}

function matchFrom<T>(
  parts: readonly SelectorPart[],
  index: number,
  target: T,
  ctx: MatchContext<T>,
): boolean {
  if (!matchesCompound(parts[index]!, target, ctx)) return false;
  if (index === 0) return true;

  const parent = ctx.parentOf(target);
  if (parts[index]!.combinator === 'child') {
    return parent !== null && matchFrom(parts, index - 1, parent, ctx);
  }

  // Descendant: any ancestor may satisfy the rest, so try each one. Without
  // this backtracking `.a .b .a .b` would fail on a tree where it should match.
  for (let a = parent; a !== null; a = ctx.parentOf(a)) {
    if (matchFrom(parts, index - 1, a, ctx)) return true;
  }
  return false;
}

export function matchesSelector<T>(
  selector: Selector,
  target: T,
  ctx: MatchContext<T>,
): boolean {
  if (selector.parts.length === 0) return false;
  return matchFrom(selector.parts, selector.parts.length - 1, target, ctx);
}

/**
 * Purpose:      the state pseudo-classes a selector depends on, in source order.
 * Ensures:      `:root` is excluded — it names a position in the tree, not a
 *               state, and cannot be switched on or off.
 *
 * Used for provenance: a value from `.unity-button:hover` is only true while
 * hovering, and an editor that does not know this rewrites the wrong rule.
 */
export function statesRequiredBy(selector: Selector): string[] {
  const out: string[] = [];
  for (const part of selector.parts) {
    for (const simple of part.simple) {
      if (simple.kind === 'pseudo' && simple.name !== 'root' && !out.includes(simple.name)) {
        out.push(simple.name);
      }
    }
  }
  return out;
}

/**
 * Purpose:      names and classes in a selector that belong to Unity, not the author.
 * Ensures:      returns the `unity-` prefixed fragments only.
 *
 * An author writing `#unity-text-input` or `.unity-scroll-view__content-container`
 * is aiming at a part a control builds. If nothing matches, that is not an
 * unused rule — it is a rule that cannot work, and saying nothing about it is
 * the silent loss CLAUDE.md rule 6 exists to prevent.
 */
export function unityFragmentsIn(selectors: readonly Selector[]): string[] {
  const out: string[] = [];
  for (const selector of selectors) {
    for (const part of selector.parts) {
      for (const simple of part.simple) {
        if (simple.kind !== 'name' && simple.kind !== 'class') continue;
        if (!simple.name.startsWith('unity-')) continue;
        const text = simple.kind === 'name' ? `#${simple.name}` : `.${simple.name}`;
        if (!out.includes(text)) out.push(text);
      }
    }
  }
  return out;
}

/** The first unsupported fragment in a selector group, if any. */
export function unsupportedFragment(selectors: readonly Selector[]): string | null {
  for (const selector of selectors) {
    for (const part of selector.parts) {
      for (const simple of part.simple) {
        if (simple.kind === 'unknown') return simple.text;
      }
    }
  }
  return null;
}

export function buildParentMap<T extends { children: readonly T[] }>(
  root: T,
): Map<T, T | null> {
  const map = new Map<T, T | null>([[root, null]]);
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    for (const child of node.children) {
      map.set(child, node);
      stack.push(child);
    }
  }
  return map;
}
