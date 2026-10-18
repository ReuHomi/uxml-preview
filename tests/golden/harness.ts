/**
 * Running a golden case, deterministically.
 *
 * The measurement below is a fixed formula, not a canvas. A canvas would make
 * every recorded number depend on the machine's fonts, and an accuracy figure
 * that moves with the machine is not an accuracy figure.
 */

import { posix } from 'node:path';

import { EDITOR_DEFAULT_FACE_INFO, expandTemplates, parse, textHeight } from '../../src/index';
import { layoutDocument } from '../../src/layout/yoga';
import type { MeasureText } from '../../src/layout/yoga';
import type { Theme } from '../../src/index';
import type { ElementNode } from '../../src/model/types';
import { resolveStyles } from '../../src/style/resolve';
import { PANEL } from './cases';
import type { GoldenCase } from './cases';

const PROJECT_DATABASE = 'project://database/';
const CASE_ASSETS = 'Assets/GoldenCases/';

/**
 * Half an em per character; height by Unity's own rule.
 *
 * The width is wrong in absolute terms and deliberately so: it is stable, which
 * is what the regression snapshots need. Cases whose layout depends on it are
 * flagged `measuresText` and excluded from the Unity comparison.
 *
 * The height is not a stand-in any more (0.6.0, decision D3): it is the FaceInfo
 * formula the default measurer uses, with the editor default font Unity reports.
 * Until 0.6.0 it was the font size, which is why every Label height in the
 * mismatch tables was 3-5px short.
 */
export const FIXED_MEASURE: MeasureText = (text, context) => ({
  width: text.length * context.fontSize * 0.5,
  height: textHeight(text.split('\n').length, context.fontSize, context.faceInfo ?? EDITOR_DEFAULT_FACE_INFO),
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

/** How a case's `files` answer `resolveImport`, the way Unity's paths resolve. */
export function caseResolver(
  files: Readonly<Record<string, string>>,
): (url: string, from: string | null) => string | null {
  return (url, from) => {
    const projectPath = url.startsWith(PROJECT_DATABASE)
      ? url.slice(PROJECT_DATABASE.length)
      : url.startsWith('/')
        ? url.slice(1)
        : null;
    const path = projectPath?.startsWith(CASE_ASSETS)
      ? projectPath.slice(CASE_ASSETS.length)
      : projectPath !== null
        ? projectPath
      : from === null
        ? url
        : posix.join(posix.dirname(from), url);
    return files[path] ?? null;
  };
}

/**
 * Purpose:      lay a case out and return its geometry by element name.
 * Deps/Effects: allocates Yoga nodes and frees them before returning.
 * Requires:     `loadLayoutEngine()` must have resolved.
 */
export function runCase(
  golden: GoldenCase,
  panel: { width: number; height: number } = PANEL,
  // The editor theme: tests/golden/unity/ was dumped in an EditorWindow (UxmlLayoutDump).
  theme: Theme = 'editor',
): CaseGeometry {
  const parsed = parse(
    golden.uxml,
    golden.uss,
    golden.files === undefined ? undefined : { resolveImport: caseResolver(golden.files) },
  );
  const expansion = expandTemplates(parsed);
  const doc = expansion.document;
  const resolved = resolveStyles(doc, { theme });
  const tree = layoutDocument(doc.root, resolved.styles, resolved.partStyles, {
    theme,
    size: panel,
    measureText: FIXED_MEASURE,
  });

  /**
   * Collected in tree order first, keyed second.
   *
   * The key is a protocol shared with `tools/UxmlLayoutDump.cs`, and both sides
   * have to implement it identically or the comparison silently comes apart.
   * Assigning straight into an object looked equivalent right up until the
   * dumper started suffixing repeats: Unity would send `unity-dragger#2` and
   * this side would hold one unsuffixed entry, so every suffixed element read
   * as missing while an earlier one was quietly overwritten.
   */
  const collected: Array<{ name: string; box: { left: number; top: number; width: number; height: number } }> = [];

  const walk = (node: ElementNode): void => {
    const name = nameOf(node);
    const box = tree.boxes.get(node.id);
    if (name !== undefined && box !== undefined) collected.push({ name, box });

    // Parts a control built are keyed by Unity's own name, which is the same
    // key the dump uses. Without this the comparison cannot see them at all,
    // and a wrong hierarchy would show up only as displaced children with no
    // hint as to why.
    for (const part of tree.parts.get(node.id) ?? []) {
      // A Slider's dragger is placed by a paint-only translate (bundle D); Unity's dump is after it.
      const [tx = 0, ty = 0] = (part.style.get('translate')?.value ?? '').split(/\s+/).filter((v) => v !== '').map((v) => parseFloat(v));
      collected.push({ name: part.name, box: { ...part.box, left: part.box.left + tx, top: part.box.top + ty } });
    }

    for (const child of node.children) walk(child);
  };
  walk(doc.root);

  // Same rule as the dumper: a name that appears once keeps it, a name that
  // repeats gets #1..#n in tree order.
  const counts = new Map<string, number>();
  for (const { name } of collected) counts.set(name, (counts.get(name) ?? 0) + 1);
  const seen = new Map<string, number>();

  const elements: Record<string, Rect> = {};
  for (const { name, box } of collected) {
    let key = name;
    if ((counts.get(name) ?? 0) > 1) {
      const n = (seen.get(name) ?? 0) + 1;
      seen.set(name, n);
      key = `${name}#${n}`;
    }
    elements[key] = {
      x: round(box.left),
      y: round(box.top),
      width: round(box.width),
      height: round(box.height),
    };
  }

  const warnings = [...expansion.warnings, ...doc.warnings, ...resolved.warnings, ...tree.warnings].map(
    (w) => `${w.kind}: ${w.message}`,
  );

  tree.dispose();
  return { panel, elements, warnings };
}
