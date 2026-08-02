/**
 * Selector matching.
 *
 * Matching runs right to left and backtracks across descendant combinators,
 * which is what makes `.a .b .c` correct when `.a` appears at several depths.
 *
 * Case-sensitive throughout: USS does not fold case, so `label` does not match
 * a `Label`.
 */

import type { ElementNode, Selector, SelectorPart, SimpleSelector } from '../model/types';

export interface MatchContext {
  /** Parent of every node, built once per document. */
  parentOf: (node: ElementNode) => ElementNode | null;
  /**
   * The element `:root` refers to.
   *
   * USS `:root` is not the CSS one: it names whichever element the stylesheet
   * was applied to, and does not match that element's children. A preview has
   * no UIDocument to attach to, so the `<ui:UXML>` element stands in — which
   * keeps the usual custom-property token pattern working, since values
   * declared there inherit down the whole tree.
   */
  root: ElementNode;
  /** Pseudo-classes currently active, e.g. `hover`. Empty in a static render. */
  activeStates: ReadonlySet<string>;
}

function classList(node: ElementNode): string[] {
  const raw = node.attributes.find((a) => a.name === 'class')?.value;
  return raw === undefined ? [] : raw.split(/\s+/).filter((c) => c.length > 0);
}

function elementName(node: ElementNode): string | undefined {
  return node.attributes.find((a) => a.name === 'name')?.value;
}

function matchesSimple(
  simple: SimpleSelector,
  node: ElementNode,
  ctx: MatchContext,
): boolean {
  switch (simple.kind) {
    case 'universal':
      return true;
    case 'type':
      // Type selectors name the C# class, so the namespace prefix is not part
      // of the comparison.
      return node.name.local === simple.name;
    case 'class':
      return classList(node).includes(simple.name);
    case 'name':
      return elementName(node) === simple.name;
    case 'pseudo':
      return simple.name === 'root' ? node === ctx.root : ctx.activeStates.has(simple.name);
    case 'unknown':
      // Unreachable in practice: a rule holding one of these is dropped before
      // matching is attempted. Answering false keeps that true either way.
      return false;
  }
}

function matchesCompound(part: SelectorPart, node: ElementNode, ctx: MatchContext): boolean {
  return part.simple.every((s) => matchesSimple(s, node, ctx));
}

function matchFrom(
  parts: readonly SelectorPart[],
  index: number,
  node: ElementNode,
  ctx: MatchContext,
): boolean {
  if (!matchesCompound(parts[index]!, node, ctx)) return false;
  if (index === 0) return true;

  const parent = ctx.parentOf(node);
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

export function matchesSelector(
  selector: Selector,
  node: ElementNode,
  ctx: MatchContext,
): boolean {
  if (selector.parts.length === 0) return false;
  return matchFrom(selector.parts, selector.parts.length - 1, node, ctx);
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

export function buildParentMap(root: ElementNode): Map<ElementNode, ElementNode | null> {
  const map = new Map<ElementNode, ElementNode | null>([[root, null]]);
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
