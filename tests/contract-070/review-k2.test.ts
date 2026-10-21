/**
 * 0.7.0 review fixes, second round (grok review 2026-10-20, human decision 2026-10-21: measure first; the
 * 2022.3 source grok cited is not evidence, the dumps are).
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Source: tests/layout/unity/<version>/{probe-panel,probe-editor-070}/{k-bool,k-slider,k-progress,k-textfield,
 * c-edge}.json (PanelDump / ProbeDump 0.7.0-r3, 2026-10-21, each probe alone in its Unity process; pictures
 * with -panelPng in docs/design/0.7.0-k2-shots/). Both versions agree on every value judged here except where
 * named. Probes: tests/layout/unity/probes-0.7.0/.
 *
 * K1 — boolean attributes ignore case: password="True" masks, Toggle value="True" is Checked, multiline="True"
 *      builds the multiline input, show-input-field="True" shows the field, enabled="False" disables.
 *      "1" is not true (pw-1 shows "secret", tg-1 is not Checked).
 * K2 — direction ignores case: "vertical" and "VERTICAL" are vertical sliders (unity-base-slider--vertical).
 * K3 — inverted="true" mirrors the dragger: value 0 at the far end (x 196), 10 at the start (4), 3 at 138.4.
 * K4 — SliderInt value="1.6" is not an integer: the default stands (field "0", dragger at the start).
 * K5 — Slider value="abc" or "NaN": the default stands (field "0"); "Infinity" is clamped to high-value (field
 *      "10", dragger at the end of the track). A value that is not a number is warned (rule 6).
 * K6 — ProgressBar: the value is clamped to [low, high] and the fill is width × value / high: low 40 with
 *      value 40 or 10 is 40% full (75px of 194 on the runtime panel), 50 is 95px, 100 full; high 0 is empty.
 *      On the editor theme 6000.0.40f1 draws an empty fill 1px wide and 6000.3.25f1 0px (p-neg, p-abc) — the
 *      preview draws 6.3 and the existing version warning belongs to an empty fill, not to "value at low".
 * K7 — password with multiline: Unity keeps the multiline input and masks the newline too (7 marks on one
 *      line). No change expected; pinned so it stays.
 * K8 — the obsolete attribute names: text="Hello" is the value; maskCharacter="#" is the mask, as
 *      mask-character.
 * C2 — an absolutely placed Label with white-space: normal is not wrapped: Unity offers it no width
 *      (abs-normal 182x25 runtime, 156x15 editor: one line). Judged with the default measurer, which wraps
 *      whenever it is given a width.
 * C3 — an empty TextField in a 20px row is clipped like one with a value (tf-empty 26x22 next to tf-value 63x22).
 * C4 — a multiline TextField's inner text keeps its wrapped height even when the field's height is fixed
 *      (ml-fixed: input 40px high, inner text 138x85 runtime / 154x59 editor).
 * C8 — a no-wrap Label wider than the panel in an auto row is clipped to the panel (wide 794 on the runtime
 *      panel, measured 865): the root offers the panel's width. No change expected.
 *
 * Text sizes: the boxes are judged given Unity's text sizes (as bundle-g.test.ts): MeasureTextSize, or Unity's
 * layout width where that is 1-2px more. Two texts the dump does not size: a password mask (the dump keeps the
 * value, so the mask takes the inner text's laid-out width) and a wrapped multiline value (it takes the inner
 * text's laid-out height). These check boxes given text sizes, not text widths.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { createDefaultMeasureText, loadLayoutEngine, parse, render, resolveStyles } from '../../src/index';
import type { ElementNode, MeasureText, Theme } from '../../src/index';
import { layoutDocument } from '../../src/layout/yoga';

const UNITY = join(process.cwd(), 'tests', 'layout', 'unity');
const PROBES = join(UNITY, 'probes-0.7.0');
const FOLDER: Record<Theme, string> = { runtime: 'probe-panel', editor: 'probe-editor-070' };
const BASE = '6000.3.25f1';
const PROBE_FILES = ['k-bool', 'k-slider', 'k-progress', 'k-textfield', 'c-edge'];

interface DumpElement { path: string; name: string; type: string; classes: string[]; x: number; y: number; w: number; h: number; text?: string; measured?: { w: number; h: number }; pseudoStates?: string; style: Record<string, string> }
interface Dump { metadata: { panel: { width: number; height: number } }; elements: DumpElement[] }
const readDump = (version: string, theme: Theme, probe: string): Dump =>
  JSON.parse(readFileSync(join(UNITY, version, FOLDER[theme], `${probe}.json`), 'utf8').replace(/\bNaN\b/g, 'null')) as Dump;
const at = (dump: Dump, path: string): DumpElement => {
  const e = dump.elements.find((x) => x.path === path);
  if (e === undefined) throw new Error(`dump has no ${path}`);
  return e;
};
const attr = (n: ElementNode, name: string): string | undefined => n.attributes.find((a) => a.name === name)?.value;
const px = (s: Record<string, string>, ...keys: string[]): number => keys.reduce((t, k) => t + Number(s[k]), 0);

beforeAll(async () => {
  await loadLayoutEngine();
});

/** Unity's text sizes; see the header for the mask and the wrapped multiline value. */
function unityMeasure(dump: Dump): MeasureText {
  const sizes = new Map<string, { width: number; height: number }>();
  const key = (text: string, fontSize: number): string => `${text}|${fontSize}`;
  for (const e of dump.elements) {
    if (e.measured === undefined || e.text === undefined) continue;
    const s = e.style;
    const contentW = e.w - px(s, 'paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth');
    const contentH = e.h - px(s, 'paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth');
    const over = contentW - e.measured.w;
    const size = over >= 1 && over <= 2 ? { width: contentW, height: e.measured.h } : { width: e.measured.w, height: e.measured.h };
    // A wrapped multiline value: Unity's laid-out height (c-edge ml-fixed).
    if (e.text.includes(' ') && contentH > e.measured.h + 1 && e.path.includes('/unity-text-input/')) { size.width = contentW; size.height = contentH; }
    sizes.set(key(e.text, Number(s['fontSize'])), size);
    // A password field's mask: the laid-out width of its inner text (the dump keeps the value as text).
    const field = dump.elements.find((f) => f.type === 'TextField' && e.path.startsWith(`${f.path}/`));
    if (field !== undefined && /^(pw-True|pw-true|pm|mask-old|mask-new)$/.test(field.name)) {
      const mask = /^mask/.test(field.name) ? '#' : '*';
      sizes.set(key(mask.repeat([...e.text].length), Number(s['fontSize'])), { width: contentW, height: contentH });
    }
  }
  const line = new Map<number, number>();
  for (const e of dump.elements) if (e.measured !== undefined && e.text !== undefined && !e.text.includes('\n')) line.set(Number(e.style['fontSize']), e.measured.h);
  return (text, context) => {
    const hit = sizes.get(key(text, context.fontSize));
    if (hit !== undefined) return hit;
    if (text === '') return { width: 0, height: 0 };
    // A text Unity did not draw (the preview drew something else): an estimate, so the boxes show the difference.
    return { width: [...text].length * context.fontSize * 0.5, height: line.get(context.fontSize) ?? context.fontSize };
  };
}

function named(root: ElementNode): Map<string, ElementNode> {
  const out = new Map<string, ElementNode>();
  const walk = (n: ElementNode): void => {
    const name = attr(n, 'name');
    if (name !== undefined && name !== '') out.set(name, n);
    n.children.forEach(walk);
  };
  walk(root);
  return out;
}

function layout(theme: Theme, probe: string, version = BASE) {
  const dump = readDump(version, theme, probe);
  const doc = parse(readFileSync(join(PROBES, `${probe}.uxml`), 'utf8'));
  const resolved = resolveStyles(doc, { theme });
  const tree = layoutDocument(doc.root, resolved.styles, resolved.partStyles, { theme, size: dump.metadata.panel, measureText: unityMeasure(dump) });
  return { dump, doc, resolved, tree };
}

/** Every judged box: [Unity path, ours, Unity's], parts included, the dragger after its translate. */
function boxes(theme: Theme, probe: string): Array<[string, number[], number[]]> {
  const { dump, doc, tree } = layout(theme, probe);
  try {
    const nodes = named(doc.root);
    const out: Array<[string, number[], number[]]> = [];
    for (const u of dump.elements) {
      const node = nodes.get(u.name);
      if (node === undefined) continue;
      const b = tree.boxes.get(node.id)!;
      out.push([u.path, [b.left, b.top, b.width, b.height], [u.x, u.y, u.w, u.h]]);
      const inside = dump.elements.filter((e) => e.path.startsWith(`${u.path}/`));
      const used = new Set<string>();
      for (const part of tree.parts.get(node.id) ?? []) {
        const twin = inside.find((e) => !used.has(e.path) && !nodes.has(e.name) && (e.name === part.name || (e.name === '' && e.classes.includes(part.name))));
        if (twin === undefined) continue;
        used.add(twin.path);
        const [tx = 0, ty = 0] = (part.style.get('translate')?.value ?? '').split(/\s+/).filter((v) => v !== '').map((v) => parseFloat(v));
        const r3 = (v: number): number => Math.round(v * 1000) / 1000;
        out.push([twin.path, [r3(part.box.left + tx), r3(part.box.top + ty), part.box.width, part.box.height], [twin.x, twin.y, twin.w, twin.h]]);
      }
    }
    return out;
  } finally {
    tree.dispose();
  }
}

describe('round 2 — the dumps', () => {
  it('both versions agree on what is judged (editor fills: 6000.0 draws an empty fill 1px wide)', () => {
    for (const theme of ['runtime', 'editor'] as const) {
      for (const probe of PROBE_FILES) {
        const a = readDump('6000.0.40f1', theme, probe);
        const b = readDump(BASE, theme, probe);
        for (const e of a.elements) {
          if (!e.name || e.type === 'TextElement') continue;
          const o = b.elements.find((x) => x.path === e.path)!;
          expect([o.x, o.y], `${theme} ${probe} ${e.path}`).toEqual([e.x, e.y]);
        }
      }
    }
    const fill = (v: string, theme: Theme, bar: string): number =>
      at(readDump(v, theme, 'k-progress'), `col/${bar}/unity-progress-bar/VisualElement[0]/VisualElement[0]`).w;
    expect([fill('6000.0.40f1', 'editor', 'p-neg'), fill(BASE, 'editor', 'p-neg')]).toEqual([1, 0]);
    expect([fill('6000.0.40f1', 'editor', 'p-40-40'), fill(BASE, 'editor', 'p-40-40')]).toEqual([79, 79]);
  });

  it('K1 K2 K4 K5 K8: what the dumps say', () => {
    for (const version of ['6000.0.40f1', BASE]) {
      for (const theme of ['runtime', 'editor'] as const) {
        const bool = readDump(version, theme, 'k-bool');
        expect(at(bool, 'col/tg-True').pseudoStates, `${version} ${theme}`).toContain('Checked');
        expect(at(bool, 'col/tg-1').pseudoStates ?? 'None').not.toContain('Checked');
        expect(at(bool, 'col/ml-True/unity-text-input').classes).toContain('unity-base-text-field__input--multiline');
        expect(at(bool, 'col/ve-False').pseudoStates).toContain('Disabled');
        const slider = readDump(version, theme, 'k-slider');
        for (const n of ['dir-lower', 'dir-upper', 'dir-ok']) expect(at(slider, `col/vrow/${n}`).classes).toContain('unity-base-slider--vertical');
        const field = (n: string): string | undefined => at(slider, `col/${n}/VisualElement[0]/unity-text-field/unity-text-input/TextElement[0]`).text;
        expect(['sint-frac', 'sint-abc', 'sl-abc', 'sl-inf', 'sl-nan'].map(field)).toEqual(['0', '0', '0', '10', '0']);
        expect(at(readDump(version, theme, 'k-textfield'), 'col/old-text/unity-text-input/TextElement[0]').text).toBe('Hello');
      }
    }
  });
});

for (const theme of ['runtime', 'editor'] as const) {
  describe(`round 2 — ${theme} theme`, () => {
    for (const probe of PROBE_FILES) {
      it(`${probe}: every named element and part lands where Unity puts it`, () => {
        const problems: string[] = [];
        for (const [path, ours, unity] of boxes(theme, probe)) {
          (['x', 'y', 'w', 'h'] as const).forEach((field, i) => {
            if (ours[i] !== unity[i]) problems.push(`${path} ${field}: ours ${ours[i]}, Unity ${unity[i]}`);
          });
        }
        if (problems.length > 0) console.info(`K2 ${theme} ${probe}\n  ${problems.join('\n  ')}`);
        expect(problems).toEqual([]);
      });
    }

    it('K1 K4 K5 K8: the text drawn in fields', () => {
      const text = (probe: string, name: string, partName = 'unity-text-element--inner-input-field-component'): string | undefined => {
        const { doc, tree } = layout(theme, probe);
        try {
          const node = named(doc.root).get(name)!;
          return (tree.parts.get(node.id) ?? []).filter((p) => p.name === partName || p.text !== undefined).map((p) => p.text).filter((t) => t !== undefined).at(-1);
        } finally {
          tree.dispose();
        }
      };
      expect(text('k-bool', 'pw-True'), 'password="True" masks').toBe('******');
      expect(text('k-bool', 'pw-1'), 'password="1" does not').toBe('secret');
      expect(['sint-frac', 'sint-abc', 'sl-abc', 'sl-inf', 'sl-nan'].map((n) => text('k-slider', n))).toEqual(['0', '0', '0', '10', '0']);
      expect(text('k-textfield', 'old-text'), 'text= is the value').toBe('Hello');
      expect(text('k-textfield', 'mask-old'), 'maskCharacter= is the mask').toBe('######');
    });

    it('K1: value="True" checks a Toggle; "1" does not', () => {
      const r = render(parse('<ui:UXML xmlns:ui="UnityEngine.UIElements"><ui:Toggle name="a" value="True" /><ui:Toggle name="b" value="1" /></ui:UXML>',
        'Toggle:checked { margin-left: 13px; }'), document.createElement('div'), { theme, size: { width: 400, height: 300 }, measureText: () => ({ width: 0, height: 0 }) });
      try {
        const nodes = named(r.document!.root);
        const left = (n: string): number => r.boxes.get(nodes.get(n)!.id)!.left;
        expect(left('a') - left('b'), 'the :checked rule applies to "True" only').toBe(13 - Number(theme === 'runtime' ? 4 : 3));
        expect(r.elements.get(nodes.get('a')!.id)!.querySelectorAll('svg').length, 'check mark drawn').toBe(1);
        expect(r.elements.get(nodes.get('b')!.id)!.querySelectorAll('svg').length).toBe(0);
      } finally {
        r.dispose();
      }
    });

    it('K5: a value that is not a number is warned; Infinity is not', () => {
      const r = render(parse(readFileSync(join(PROBES, 'k-slider.uxml'), 'utf8')), document.createElement('div'),
        { theme, size: { width: 800, height: 600 }, measureText: (t, c) => ({ width: t.length * c.fontSize * 0.5, height: c.fontSize }) });
      try {
        const nodes = named(r.document!.root);
        const about = (n: string) => r.warnings.filter((w) => w.node === nodes.get(n)!.id && w.reason === 'invalid-value');
        for (const n of ['sint-frac', 'sint-abc', 'sl-abc', 'sl-nan']) expect(about(n).length, n).toBeGreaterThan(0);
        expect(about('sl-inf').length).toBe(0);
      } finally {
        r.dispose();
      }
    });

    it('C2: an absolute Label with white-space: normal is one line, with the default measurer', () => {
      const dump = readDump(BASE, theme, 'c-edge');
      const r = render(parse(readFileSync(join(PROBES, 'c-edge.uxml'), 'utf8')), document.createElement('div'),
        { theme, size: dump.metadata.panel, measureText: createDefaultMeasureText(document) });
      try {
        const b = r.boxes.get(named(r.document!.root).get('abs-normal')!.id)!;
        expect(b.height, 'one line').toBe(at(dump, 'col/abs-host/abs-normal').h);
        expect(b.width, 'its natural width, past the 100px host').toBeGreaterThan(100);
      } finally {
        r.dispose();
      }
    });
  });
}
