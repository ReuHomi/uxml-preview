import type { RenderResult } from '../index';
import type { ElementNode, NodeId, StyleOrigin } from '../model/types';

export type Visibility =
  | { kind: 'shown' }
  | { kind: 'hidden'; by: NodeId; origin: StyleOrigin }
  | { kind: 'emptied' }
  | { kind: 'collapsed'; explicitZero: boolean };

/**
 * Purpose:      classify layout absence using the uxml-author 0.2.1 rules.
 * Deps/Effects: pure; reads the expanded tree and computed styles from render.
 * Ensures:      every box has a verdict; opacity and visibility do not affect it.
 */
export function classifyVisibility(result: RenderResult): ReadonlyMap<NodeId, Visibility> {
  const nodes = new Map<NodeId, ElementNode>();
  const parents = new Map<NodeId, NodeId>();
  const index = (node: ElementNode): void => {
    nodes.set(node.id, node);
    for (const child of node.children) {
      parents.set(child.id, node.id);
      index(child);
    }
  };
  if (result.document !== undefined) index(result.document.root);
  const verdicts = new Map<NodeId, Visibility>();
  const classify = (id: NodeId): Visibility => {
    const cached = verdicts.get(id);
    if (cached !== undefined) return cached;
    let verdict: Visibility | undefined;
    for (let current: NodeId | undefined = id; current !== undefined; current = parents.get(current)) {
      const display = result.styles?.get(current)?.get('display');
      if (display?.value === 'none') {
        verdict = { kind: 'hidden', by: current, origin: display.origin };
        break;
      }
    }
    if (verdict === undefined) {
      const box = result.boxes.get(id)!;
      if (box.width === 0 || box.height === 0) {
        const style = result.styles?.get(id);
        const explicitZero = ['width', 'height'].some((property) =>
          /^-?0+(\.0+)?(px|%)?$/.test(style?.get(property)?.value ?? ''));
        const children = nodes.get(id)?.children.filter((child) => result.boxes.has(child.id)) ?? [];
        verdict = !explicitZero && children.length > 0 && children.every((child) => {
          const kind = classify(child.id).kind;
          return kind === 'hidden' || kind === 'emptied';
        }) ? { kind: 'emptied' } : { kind: 'collapsed', explicitZero };
      } else verdict = { kind: 'shown' };
    }
    verdicts.set(id, verdict);
    return verdict;
  };
  for (const id of result.boxes.keys()) classify(id);
  return verdicts;
}
