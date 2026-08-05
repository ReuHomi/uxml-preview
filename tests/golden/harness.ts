/**
 * Running a golden case, deterministically.
 *
 * The measurement below is a fixed formula, not a canvas. A canvas would make
 * every recorded number depend on the machine's fonts, and an accuracy figure
 * that moves with the machine is not an accuracy figure.
 */

import { parse } from '../../src/index';
import { layoutDocument } from '../../src/layout/yoga';
import type { MeasureText } from '../../src/layout/yoga';
import type { ElementNode } from '../../src/model/types';
import { resolveStyles } from '../../src/style/resolve';
import { PANEL } from './cases';
import type { GoldenCase } from './cases';

/**
 * Half an em per character, one line per text run.
 *
 * Wrong in absolute terms and deliberately so: it is stable, which is what the
 * regression snapshots need. Cases whose layout depends on it are flagged
 * `measuresText` and excluded from the Unity comparison, because matching
 * Unity there would mean matching its font metrics rather than its layout.
 */
export const FIXED_MEASURE: MeasureText = (text, context) => ({
  width: text.length * context.fontSize * 0.5,
  height: context.fontSize,
});

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CaseGeometry {
  panel: { width: number; height: number };
  /** Element `name` to its box in panel coordinates. */
  elements: Record<string, Rect>;
  warnings: string[];
}

function nameOf(node: ElementNode): string | undefined {
  return node.attributes.find((a) => a.name === 'name')?.value;
}

/** Rounded to a tenth of a pixel: enough to see a real shift, not float noise. */
function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Purpose:      lay a case out and return its geometry by element name.
 * Deps/Effects: allocates Yoga nodes and frees them before returning.
 * Requires:     `loadLayoutEngine()` must have resolved.
 */
export function runCase(
  golden: GoldenCase,
  panel: { width: number; height: number } = PANEL,
): CaseGeometry {
  const doc = parse(golden.uxml, golden.uss);
  const resolved = resolveStyles(doc);
  const tree = layoutDocument(doc.root, resolved.styles, {
    size: panel,
    measureText: FIXED_MEASURE,
  });

  const elements: Record<string, Rect> = {};
  const record = (name: string, box: { left: number; top: number; width: number; height: number }): void => {
    elements[name] = {
      x: round(box.left),
      y: round(box.top),
      width: round(box.width),
      height: round(box.height),
    };
  };

  const walk = (node: ElementNode): void => {
    const name = nameOf(node);
    const box = tree.boxes.get(node.id);
    if (name !== undefined && box !== undefined) record(name, box);

    // Parts a control built are keyed by Unity's own name, which is the same
    // key the dump uses. Without this the comparison cannot see them at all,
    // and a wrong hierarchy would show up only as displaced children with no
    // hint as to why.
    for (const part of tree.parts.get(node.id) ?? []) record(part.name, part.box);

    for (const child of node.children) walk(child);
  };
  walk(doc.root);

  const warnings = [...doc.warnings, ...resolved.warnings, ...tree.warnings].map(
    (w) => `${w.kind}: ${w.message}`,
  );

  tree.dispose();
  return { panel, elements, warnings };
}
