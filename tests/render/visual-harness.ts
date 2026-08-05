/**
 * Running a visual case: what CSS each element ends up carrying.
 *
 * **This is a regression harness and nothing more.** It records what this
 * renderer produces today so that a change to the USS-to-CSS mapping cannot
 * pass unnoticed. It is not evidence of agreement with Unity, and no number
 * from it may be quoted as accuracy — there is no Unity CSS to compare against,
 * because Unity does not produce CSS. The visual comparison against Unity is a
 * one-time eye check with committed screenshots (S1 plan §1, criterion 3).
 *
 * Geometry is deliberately excluded. Yoga's rectangles are compared against
 * Unity by tests/golden, and the Yoga-to-DOM step by border-offset.test.ts;
 * repeating them here would make this snapshot churn on layout changes and blur
 * what it is for.
 */

import { parse, render } from '../../src/index';
import type { ElementNode } from '../../src/model/types';
import { FIXED_MEASURE } from '../golden/harness';

export interface VisualCase {
  name: string;
  /** What the case is meant to settle. */
  question: string;
  uxml: string;
  uss: string;
  /**
   * Pseudo-classes to activate, keyed by USS selector.
   *
   * State styling has no Unity ground truth — a layout dump reports geometry,
   * and a hover colour is not geometry. So it is held here, as drift detection,
   * and judged against Unity by eye in S1 Step 6.
   */
  states?: Readonly<Record<string, readonly string[]>>;
}

export interface CaseVisuals {
  /** Element `name` to its painted CSS, geometry removed, keys sorted. */
  elements: Record<string, Record<string, string>>;
  warnings: string[];
}

export const PANEL = { width: 400, height: 300 };

/**
 * Set by the layout, not by the visual mapping. Excluded so this snapshot
 * answers one question rather than two.
 *
 * `margin` needs a prefix match, not an equality one: the painter writes the
 * shorthand, and reading the style back gives the four longhands instead. An
 * exclusion list that only held `margin` silently kept `margin-*: 0px` in every
 * snapshot — harmless while nothing sets a margin, and geometry leaking into a
 * visual baseline the moment something does.
 */
const GEOMETRY = new Set(['position', 'left', 'top', 'width', 'height']);

function isGeometry(property: string): boolean {
  return GEOMETRY.has(property) || property.startsWith('margin');
}

function nameOf(node: ElementNode): string | undefined {
  return node.attributes.find((a) => a.name === 'name')?.value;
}

function visualCss(el: HTMLElement): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < el.style.length; i++) {
    const property = el.style.item(i);
    if (isGeometry(property)) continue;
    out[property] = el.style.getPropertyValue(property);
  }
  // Sorted, so a reordering inside the mapping is not mistaken for a change.
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * Purpose:      paint a case and return the CSS it produced, by element name.
 * Deps/Effects: renders into a detached container and disposes it before
 *               returning, so no Yoga nodes outlive the call.
 * Requires:     `loadLayoutEngine()` resolved, and a DOM (jsdom is fine).
 */
export function runVisualCase(
  visual: VisualCase,
  resolveAsset?: (path: string) => string | null,
): CaseVisuals {
  const doc = parse(visual.uxml, visual.uss);
  const container = document.createElement('div');
  document.body.appendChild(container);

  const result = render(doc, container, {
    size: PANEL,
    measureText: FIXED_MEASURE,
    ...(resolveAsset === undefined ? {} : { resolveAsset }),
    ...(visual.states === undefined ? {} : { states: visual.states }),
  });

  const elements: Record<string, Record<string, string>> = {};
  const walk = (node: ElementNode): void => {
    const name = nameOf(node);
    const el = result.elements.get(node.id);
    if (name !== undefined && el !== undefined) elements[name] = visualCss(el);
    for (const child of node.children) walk(child);
  };
  walk(doc.root);

  const warnings = [...doc.warnings, ...result.warnings].map((w) => `${w.kind}: ${w.message}`);

  result.dispose();
  container.remove();
  return { elements, warnings };
}
