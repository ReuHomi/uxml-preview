/**
 * 0.7.0 — the painted DOM has Unity's parent relations (human decision 2026-10-18, after E).
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Why. The Slider-children mutation that moved a file child to another DOM parent survived
 * every box test (slider-children.test.ts checks boxes only). Boxes come from Yoga; the DOM
 * is built separately by the painter, and nothing compared the two trees.
 *
 * Expected values: Unity's tree. For every dump in tests/layout/unity/6000.3.25f1/
 * {probe-panel,probe-editor-070}/ whose probe is in tests/layout/unity/probes-0.7.0/,
 * every control in CONTROLS (the renderer registry, so a newly drawn control joins) is
 * painted, and every element Unity built inside it that the preview also built — a part
 * (matched as in classes.test.ts: Unity's name, or the class the preview names it by) or a
 * named file element — must sit in the DOM under the element that stands for its Unity
 * parent (the dump path minus its last step). Elements the preview does not build
 * (Unity's scrollers, a known difference; a fallback's internals) are not judged.
 * 6000.0.40f1 has the same paths (classes.test.ts compares both versions).
 *
 * And the layout's own part tree: each part's DOM parent is the part its `parent` index
 * names, or the control when it has none.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { loadLayoutEngine, parse, render, resolveStyles, PART_ATTRIBUTE } from '../../src/index';
import type { ElementNode, Theme } from '../../src/index';
import { supportedControlNames } from '../../src/controls/registry';
import { layoutDocument } from '../../src/layout/yoga';

const CONTROLS = supportedControlNames();
const UNITY = join(process.cwd(), 'tests', 'layout', 'unity');
const PROBES = join(UNITY, 'probes-0.7.0');
const FOLDER: Record<Theme, string> = { runtime: 'probe-panel', editor: 'probe-editor-070' };
const VERSION = '6000.3.25f1';

interface DumpElement { path: string; name: string; type: string; classes: string[] }

beforeAll(async () => {
  await loadLayoutEngine();
});

function named(root: ElementNode): Map<string, ElementNode> {
  const out = new Map<string, ElementNode>();
  const walk = (n: ElementNode): void => {
    const name = n.attributes.find((a) => a.name === 'name')?.value;
    if (name !== undefined && name !== '') out.set(name, n);
    n.children.forEach(walk);
  };
  walk(root);
  return out;
}

const parentPath = (path: string): string => path.slice(0, path.lastIndexOf('/'));

const cases: Array<[Theme, string]> = [];
for (const theme of ['runtime', 'editor'] as const) {
  for (const f of readdirSync(join(UNITY, VERSION, FOLDER[theme])).filter((x) => x.endsWith('.json')).sort()) {
    const probe = f.slice(0, -'.json'.length);
    if (existsSync(join(PROBES, `${probe}.uxml`))) cases.push([theme, probe]);
  }
}

describe('painted parents — the DOM keeps Unity\'s tree', () => {
  let judged = 0;
  const judgedFileChildren = new Set<string>();

  for (const [theme, probe] of cases) {
    it(`${theme} ${probe}`, () => {
      const els = (JSON.parse(readFileSync(join(UNITY, VERSION, FOLDER[theme], `${probe}.json`), 'utf8').replace(/\bNaN\b/g, 'null')) as { elements: DumpElement[] }).elements;
      const ussPath = join(PROBES, `${probe}.uss`);
      const doc = parse(readFileSync(join(PROBES, `${probe}.uxml`), 'utf8'), existsSync(ussPath) ? readFileSync(ussPath, 'utf8') : undefined);
      const nodes = named(doc.root);
      const targets = els.filter((e) => CONTROLS.includes(e.type) && nodes.has(e.name));
      if (targets.length === 0) return;
      const options = { theme, size: { width: 800, height: 600 }, measureText: () => ({ width: 0, height: 0 }) };
      const resolved = resolveStyles(doc, { theme });
      const tree = layoutDocument(doc.root, resolved.styles, resolved.partStyles, options);
      const r = render(doc, document.createElement('div'), options);
      const problems: string[] = [];
      try {
        for (const u of targets) {
          const node = nodes.get(u.name)!;
          const owner = r.elements.get(node.id)!;
          const built = tree.parts.get(node.id) ?? [];
          // Painted parts of this control, by name, in document order.
          const paintedByName = new Map<string, HTMLElement[]>();
          for (const el of owner.querySelectorAll(`[${PART_ATTRIBUTE}]`)) {
            const e = el as HTMLElement;
            if (e.getAttribute('data-uxml-part-owner') !== String(node.id)) continue;
            const name = e.getAttribute(PART_ATTRIBUTE)!;
            paintedByName.set(name, [...(paintedByName.get(name) ?? []), e]);
          }
          const seenByName = new Map<string, number>();
          const partEls: HTMLElement[] = built.map((p) => {
            const k = seenByName.get(p.name) ?? 0;
            seenByName.set(p.name, k + 1);
            return paintedByName.get(p.name)?.[k] as HTMLElement;
          });

          // The layout's part tree against the DOM.
          built.forEach((p, i) => {
            const el = partEls[i];
            if (el === undefined) { problems.push(`${u.path}: part ${p.name} not painted`); return; }
            const want = p.parent === null || p.parent === undefined ? owner : partEls[p.parent];
            if (el.parentElement !== want) problems.push(`${u.path}: part ${p.name} painted under ${el.parentElement?.getAttribute(PART_ATTRIBUTE) ?? 'its control or another element'}, its layout parent is ${p.parent === null || p.parent === undefined ? 'the control' : built[p.parent]!.name}`);
          });

          // Unity's tree against the DOM.
          const dom = new Map<string, HTMLElement>([[u.path, owner]]);
          const inside = els.filter((e) => e.path.startsWith(`${u.path}/`));
          const used = new Set<string>();
          built.forEach((p, i) => {
            const twin = inside.find((e) => !used.has(e.path) && (e.name === p.name || (e.name === '' && e.classes.includes(p.name))));
            if (twin !== undefined && partEls[i] !== undefined) { used.add(twin.path); dom.set(twin.path, partEls[i]!); }
          });
          for (const e of inside) {
            const n = e.name !== '' ? nodes.get(e.name) : undefined;
            if (n !== undefined && !used.has(e.path)) dom.set(e.path, r.elements.get(n.id)!);
          }
          for (const e of inside) {
            const el = dom.get(e.path);
            const parent = dom.get(parentPath(e.path));
            if (el === undefined || parent === undefined) continue;
            judged++;
            if (nodes.has(e.name) && !used.has(e.path)) judgedFileChildren.add(`${probe} ${e.name}`);
            if (el.parentElement !== parent) {
              problems.push(`${e.path}: painted under ${el.parentElement?.getAttribute(PART_ATTRIBUTE) ?? el.parentElement?.getAttribute('data-uxml-node') ?? '?'}, Unity's parent is ${parentPath(e.path).slice(u.path.length) || '(the control)'}`);
            }
          }
        }
        if (problems.length > 0) console.info(`PARENTS ${theme} ${probe}\n  ${problems.join('\n  ')}`);
        expect(problems).toEqual([]);
      } finally {
        r.dispose();
        tree.dispose();
      }
    });
  }

  it('judged parts and file children, the Slider children among them', () => {
    expect(judged).toBeGreaterThan(200);
    for (const child of ['sc-h-child', 'sc-label-child', 'sc-int-child', 'sc-v-child']) {
      expect(judgedFileChildren.has(`d-slider-children ${child}`), child).toBe(true);
    }
  });
});
