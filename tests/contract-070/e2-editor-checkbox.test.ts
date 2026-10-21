/**
 * 0.7.0 E2 — the editor theme's Toggle box (human decision 2026-10-18, after bundle E).
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * In the editor theme Unity does not draw the Toggle box with USS colours: the checkmark
 * resolves background-color transparent, no border, and background-image d_toggle_bg
 * (unchecked) or d_toggle_on (checked), a built-in texture (6000.3.25f1/probe-editor-070/
 * c07-Toggle.json). The preview cannot load that texture and drew nothing, so an unchecked
 * Toggle was invisible. The box is now painted from colours measured off Unity's picture.
 *
 * How the colours were measured.
 *   File:   docs/design/0.7.0-bundle-E-shots/unity-editor-c07-Toggle.png (and -RadioButton.png),
 *           PanelDump 0.7.0-r3 `-panelPng`, 6000.3.25f1, editor sheet on a runtime panel
 *           (DefaultCommonDark_inter.uss), panel cleared to 0.22 grey (#383838), 300x260.
 *   Boxes:  the checkmark boxes of tests/layout/unity/6000.3.25f1/probe-editor-070/c07-Toggle.json
 *           (14x14; t-plain at 3,1, t-checked at 3,57). The PNG run's own dump gives the same boxes.
 *   Pixels (x, y relative to the box; the same on d_toggle_bg and d_toggle_on):
 *           interior (3,3) and (7,7) on unchecked           #2a2a2a
 *           top edge (7,0)                                  #0d0d0d
 *           left (0,7), right (13,7), bottom (7,13) edges   #212121
 *           corner (0,0) #272727, (1,0) #101010: a 1px edge rounded by about 2px
 *           ([추론] from anti-aliasing; the radius is not a dumped value). The corner pixel is
 *           about half edge, half panel; a quarter circle covers that much of it at a radius
 *           near 2 (about 0.8 at 1px, 0.45 at 2px, 0.15 at 3px). So the radius is judged as a
 *           range, 1px to 3px, not as an exact value; the colours above are read exactly.
 *           A disabled Toggle is the same box at the owner's opacity 0.5 (#313131 inside).
 *   RadioButton: the editor radio is drawn from USS colours that the dump resolves
 *           (background #2a2a2a, border 1px #212121, radius 6), and the PNG agrees
 *           (r-plain: centre (6,6) #2a2a2a, left edge (0,6) #212121). It did not have this problem.
 * The check glyph's shape stays judging rule 5 (screenshots in the E2 report).
 *
 * What is pinned on the preview: the painted Toggle checkmark element of every Toggle in
 * the editor theme carries that box as paint only — background-color, border-radius 1-3px and
 * four 1px inset box-shadow edges — so the layout box, the resolved styles (still Unity's
 * transparent values, bundle-e.test.ts) and the runtime theme do not change.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PNG } from 'pngjs';
import { beforeAll, describe, expect, it } from 'vitest';

import { loadLayoutEngine, parse, render, PART_ATTRIBUTE } from '../../src/index';
import type { ElementNode, MeasureText, RenderResult, Theme } from '../../src/index';

const UNITY = join(process.cwd(), 'tests', 'layout', 'unity');
const SHOTS = join(process.cwd(), 'docs', 'design', '0.7.0-bundle-E-shots');
const FOLDER: Record<Theme, string> = { runtime: 'probe-panel', editor: 'probe-editor-070' };

interface DumpElement { path: string; name: string; classes: string[]; x: number; y: number; w: number; h: number; text?: string; measured?: { w: number; h: number }; style: Record<string, string> }
interface Dump { metadata: { panel: { width: number; height: number } }; elements: DumpElement[] }
const readDump = (theme: Theme, probe: string): Dump =>
  JSON.parse(readFileSync(join(UNITY, '6000.3.25f1', FOLDER[theme], `${probe}.json`), 'utf8').replace(/\bNaN\b/g, 'null')) as Dump;

function pixels(file: string): (x: number, y: number) => string {
  const png = PNG.sync.read(readFileSync(join(SHOTS, file)));
  return (x, y) => {
    const i = (png.width * y + x) * 4;
    return `#${[0, 1, 2].map((k) => png.data[i + k]!.toString(16).padStart(2, '0')).join('')}`;
  };
}

function box(dump: Dump, pathPrefix: string, cls: string): DumpElement {
  const e = dump.elements.find((x) => x.path.startsWith(pathPrefix) && x.classes.includes(cls));
  if (e === undefined) throw new Error(`no ${cls} under ${pathPrefix}`);
  return e;
}

function unityMeasure(dump: Dump): MeasureText {
  const sizes = new Map<string, { width: number; height: number }>();
  for (const e of dump.elements) {
    if (e.measured !== undefined && e.text !== undefined) sizes.set(`${e.text}|${Number(e.style['fontSize'])}`, { width: e.measured.w, height: e.measured.h });
  }
  return (text, context) => sizes.get(`${text}|${context.fontSize}`) ?? { width: 0, height: 0 };
}

function toggles(root: ElementNode, local: string): ElementNode[] {
  const out: ElementNode[] = [];
  const walk = (n: ElementNode): void => {
    if (n.name.local === local) out.push(n);
    n.children.forEach(walk);
  };
  walk(root);
  return out;
}

function hex(colour: string): string {
  const t = colour.trim().toLowerCase();
  const short = /^#([0-9a-f]{3})$/.exec(t)?.[1];
  if (short !== undefined) return `#${[...short].map((c) => c + c).join('')}`;
  if (/^#[0-9a-f]{6}$/.test(t)) return t;
  const fn = /^rgba?\(([^)]*)\)$/.exec(t)?.[1];
  if (fn !== undefined) return `#${fn.split(',').slice(0, 3).map((s) => Number(s.trim()).toString(16).padStart(2, '0')).join('')}`;
  throw new Error(`not a colour: ${colour}`);
}

/** The inset box-shadow layers as edge → colour (top: y>0, bottom: y<0, left: x>0, right: x<0). */
function insetEdges(shadow: string): Record<string, string> {
  const layers = shadow.split(/,(?![^(]*\))/).map((s) => s.trim()).filter((s) => s !== '');
  const edges: Record<string, string> = {};
  for (const layer of layers) {
    const tokens = layer.match(/rgba?\([^)]*\)|\S+/g) ?? [];
    expect(tokens, layer).toContain('inset');
    const lengths = tokens.filter((t) => /^-?\d+(\.\d+)?(px)?$/.test(t)).map((t) => parseFloat(t));
    const colour = tokens.find((t) => t !== 'inset' && !/^-?\d+(\.\d+)?(px)?$/.test(t))!;
    const [x = 0, y = 0, blur = 0, spread = 0] = lengths;
    expect([blur, spread], `${layer}: no blur or spread`).toEqual([0, 0]);
    expect(Math.abs(x) + Math.abs(y), `${layer}: one 1px edge`).toBe(1);
    const edge = y > 0 ? 'top' : y < 0 ? 'bottom' : x > 0 ? 'left' : 'right';
    edges[edge] = hex(colour);
  }
  return edges;
}

beforeAll(async () => {
  await loadLayoutEngine();
});

describe('E2 — Unity\'s picture', () => {
  it('the editor Toggle box: #2a2a2a inside, #0d0d0d top edge, #212121 other edges, checked or not', () => {
    const at = pixels('unity-editor-c07-Toggle.png');
    const dump = readDump('editor', 'c07-Toggle');
    for (const name of ['col/t-plain/', 'col/t-checked/']) {
      const b = box(dump, name, 'unity-toggle__checkmark');
      expect([b.w, b.h], name).toEqual([14, 14]);
      const p = (dx: number, dy: number): string => at(b.x + dx, b.y + dy);
      expect(p(3, 3), `${name} interior`).toBe('#2a2a2a');
      expect(p(7, 0), `${name} top`).toBe('#0d0d0d');
      expect([p(0, 7), p(13, 7), p(7, 13)], `${name} left right bottom`).toEqual(['#212121', '#212121', '#212121']);
      expect([p(0, 0), p(1, 0)], `${name} rounded corner`).toEqual(['#272727', '#101010']);
    }
    const plain = box(dump, 'col/t-plain/', 'unity-toggle__checkmark');
    expect(at(plain.x + 7, plain.y + 7), 'unchecked centre').toBe('#2a2a2a');
    expect(plain.style['backgroundColor'], 'the dump resolves no box colour').toBe('rgba(0,0,0,0)');
    expect(plain.style['backgroundImage']).toContain('d_toggle_bg');
  });

  it('the editor RadioButton is drawn with the colours its dump resolves', () => {
    const at = pixels('unity-editor-c07-RadioButton.png');
    const b = box(readDump('editor', 'c07-RadioButton'), 'col/r-plain/', 'unity-radio-button__checkmark-background');
    expect(b.style['backgroundColor']).toBe('rgba(0.165,0.165,0.165,1)');
    expect(b.style['borderLeftColor']).toBe('rgba(0.129,0.129,0.129,1)');
    expect(at(b.x + 6, b.y + 6), 'centre').toBe('#2a2a2a');
    expect(at(b.x, b.y + 6), 'left edge').toBe('#212121');
  });
});

describe('E2 — the preview paints it', () => {
  const draw = (theme: Theme, probe: string): { r: RenderResult; dump: Dump } => {
    const dump = readDump(theme, probe);
    const doc = parse(readFileSync(join(UNITY, 'probes-0.7.0', `${probe}.uxml`), 'utf8'));
    return { dump, r: render(doc, document.createElement('div'), { theme, size: dump.metadata.panel, measureText: unityMeasure(dump) }) };
  };
  const partOf = (r: RenderResult, node: ElementNode, part: string): HTMLElement => {
    const found = [...r.elements.get(node.id)!.querySelectorAll(`[${PART_ATTRIBUTE}="${part}"]`)] as HTMLElement[];
    expect(found.length, `${part} of a ${node.name.local}`).toBe(1);
    return found[0]!;
  };

  it('editor: every Toggle checkmark, checked or not, enabled or not, carries the measured box', () => {
    for (const probe of ['c07-Toggle', 'e-toggle']) {
      const { r } = draw('editor', probe);
      try {
        const all = toggles(r.document!.root, 'Toggle');
        expect(all.length, probe).toBeGreaterThan(5);
        for (const t of all) {
          const el = partOf(r, t, 'unity-checkmark');
          expect(hex(el.style.backgroundColor), `${probe} background`).toBe('#2a2a2a');
          // Estimated from the picture, not read (header): a range.
          expect(el.style.borderRadius, `${probe} radius in px`).toMatch(/^\d+(\.\d+)?px$/);
          const radius = parseFloat(el.style.borderRadius);
          expect(radius >= 1 && radius <= 3, `${probe} radius ${el.style.borderRadius} within 1-3px`).toBe(true);
          expect(insetEdges(el.style.getPropertyValue('box-shadow')), `${probe} edges`).toEqual({
            top: '#0d0d0d', left: '#212121', right: '#212121', bottom: '#212121',
          });
          expect(el.style.borderTopWidth === '' || el.style.borderTopWidth === '0px', `${probe}: paint only, no border`).toBe(true);
        }
      } finally {
        r.dispose();
      }
    }
  });

  it('runtime: the Toggle box stays the USS one, with no painted edges', () => {
    const { r } = draw('runtime', 'c07-Toggle');
    try {
      for (const t of toggles(r.document!.root, 'Toggle')) {
        const el = partOf(r, t, 'unity-checkmark');
        expect(el.style.getPropertyValue('box-shadow'), 'runtime').toBe('');
        // probe-panel/c07-Toggle.json: rgba(0.941,…) enabled, rgba(0.584,…) for enabled="false".
        const disabled = t.attributes.some((a) => a.name === 'enabled' && a.value === 'false');
        expect(hex(el.style.backgroundColor)).toBe(disabled ? '#959595' : '#f0f0f0');
      }
    } finally {
      r.dispose();
    }
  });

  it('editor: the RadioButton background is painted in the picture\'s colours', () => {
    const { r } = draw('editor', 'c07-RadioButton');
    try {
      const radios = toggles(r.document!.root, 'RadioButton');
      expect(radios.length).toBeGreaterThan(3);
      for (const t of radios) {
        const el = partOf(r, t, 'unity-radio-button__checkmark-background');
        expect(hex(el.style.backgroundColor)).toBe('#2a2a2a');
        expect(hex(el.style.borderLeftColor)).toBe('#212121');
      }
    } finally {
      r.dispose();
    }
  });
});
