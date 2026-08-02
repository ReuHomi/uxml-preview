/**
 * Which controls this version can draw.
 *
 * The model does not carry this: whether a control is supported is a property
 * of the renderer, and it changes when controls are added, while the file that
 * was parsed does not. Adding `ScrollView` in Phase 7 means editing this table
 * and nothing in src/model or src/parser.
 */

import type { ElementNode } from '../model/types';

export interface ControlSpec {
  /** Renders the `text` attribute as its content. */
  hasText: boolean;
}

/**
 * v0.1 is three controls, deliberately. See CLAUDE.md — the scope boundary is
 * what keeps this phase finishable.
 */
const CONTROLS: Readonly<Record<string, ControlSpec>> = {
  VisualElement: { hasText: false },
  Label: { hasText: true },
  Button: { hasText: true },
};

/** The document container. Not a control, but it is the panel's root box. */
export const ROOT_LOCAL_NAME = 'UXML';

export function controlFor(node: ElementNode): ControlSpec | null {
  return CONTROLS[node.name.local] ?? null;
}

export function isRoot(node: ElementNode): boolean {
  return node.name.local === ROOT_LOCAL_NAME;
}

export function supportedControlNames(): string[] {
  return Object.keys(CONTROLS);
}
