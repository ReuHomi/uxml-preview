/**
 * 0.7.0 — disabled two ways: SetEnabled(false) against a forced Disabled pseudo-state.
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * History. Bundle A step A2 (e9da79e) pinned an inference here: a `disabled` forced through
 * `states` was taken as the element disabling itself, so it got `unity-disabled` and
 * opacity 0.5. The human asked for it to be measured in bundle E and fixed if wrong. It
 * was wrong; this file now holds the measurement (2026-10-17, human instruction).
 *
 * Source: tests/layout/unity/<version>/{probe-panel,probe-editor-070}/e-disabled.json
 * (PanelDump / ProbeDump 0.7.0-r3), probe tests/layout/unity/probes-0.7.0/e-disabled.uxml.
 * Each pair is one control written twice: `*-off` with enabled="false" (SetEnabled), and
 * `*-forced` with class force-disabled, which the dumper turns into the Disabled bit of the
 * element's pseudoStates (Unity's forced pseudo-state). In the preview the forced one is
 * `states: { '#x-forced': ['disabled'] }`. On both versions and both themes:
 *   - enabled="false": the element gets unity-disabled and opacity 0.5; every child and
 *     part is :disabled too (their own disabled colours), not dimmed a second time.
 *   - forced: no unity-disabled, opacity 1; :disabled on that element alone — its file
 *     child (ve-forced-child) and its parts (a Toggle's checkmark, a TextField's input, ...)
 *     keep their enabled values.
 * Judged: each pair element and everything inside it, by Unity's resolved opacity and
 * colours, against the 6000.3.25f1 dumps (6000.0.40f1 agrees; first test).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { loadLayoutEngine, parse, resolveStyles } from '../../src/index';
import type { ElementNode, MeasureText, Theme } from '../../src/index';
import { layoutDocument } from '../../src/layout/yoga';

const UNITY = join(process.cwd(), 'tests', 'layout', 'unity');
const PROBE = readFileSync(join(UNITY, 'probes-0.7.0', 'e-disabled.uxml'), 'utf8');
const FOLDER: Record<Theme, string> = { runtime: 'probe-panel', editor: 'probe-editor-070' };
const PAIRS = ['ve', 'l', 'b', 't', 'r', 'tf', 's'] as const;
const KEBAB: Record<string, string> = {
  Toggle: 'toggle', RadioButton: 'radio-button', TextField: 'text-field', Slider: 'slider',
};

interface DumpElement { path: string; name: string; type: string; classes: string[]; text?: string; measured?: { w: number; h: number }; style: Record<string, string> }
interface Dump { metadata: { panel: { width: number; height: number } }; elements: DumpElement[] }
const readDump = (version: string, theme: Theme): Dump =>
  JSON.parse(readFileSync(join(UNITY, version, FOLDER[theme], 'e-disabled.json'), 'utf8').replace(/\bNaN\b/g, 'null')) as Dump;
const byName = (dump: Dump, name: string): DumpElement => {
  const e = dump.elements.find((x) => x.name === name);
  if (e === undefined) throw new Error(`dump has no ${name}`);
  return e;
};

function unityMeasure(dump: Dump): MeasureText {
  const sizes = new Map<string, { width: number; height: number }>();
  for (const e of dump.elements) {
    if (e.measured !== undefined && e.text !== undefined) sizes.set(`${e.text}|${Number(e.style['fontSize'])}`, { width: e.measured.w, height: e.measured.h });
  }
  return (text, context) => sizes.get(`${text}|${context.fontSize}`) ?? { width: 0, height: 0 };
}

function nodeByName(root: ElementNode, name: string): ElementNode {
  let found: ElementNode | undefined;
  const walk = (n: ElementNode): void => {
    if (n.attributes.some((a) => a.name === 'name' && a.value === name)) found = n;
    n.children.forEach(walk);
  };
  walk(root);
  if (found === undefined) throw new Error(`no element named ${name}`);
  return found;
}

/** The preview's name for a Unity part: Unity's name, else its control-specific class. */
function partName(owner: DumpElement, e: DumpElement): string {
  if (e.name !== '') return e.name;
  if (e.classes.includes('unity-text-element--inner-input-field-component')) return 'unity-text-element--inner-input-field-component';
  const prefix = `unity-${KEBAB[owner.type]}__`;
  const specific = e.classes.filter((c) => c.startsWith(prefix));
  if (specific.length !== 1) throw new Error(`${e.path}: no single ${prefix} class in ${e.classes.join(' ')}`);
  return specific[0]!;
}

function rgba(text: string): number[] {
  const t = text.trim().toLowerCase();
  if (t === 'transparent') return [0, 0, 0, 0];
  const hex = /^#([0-9a-f]+)$/.exec(t)?.[1];
  if (hex !== undefined) {
    const full = hex.length <= 4 ? [...hex].map((c) => c + c).join('') : hex;
    const n = (i: number): number => parseInt(full.slice(i, i + 2), 16) / 255;
    return [n(0), n(2), n(4), full.length === 8 ? n(6) : 1];
  }
  const fn = /^rgba?\(([^)]*)\)$/.exec(t)?.[1];
  if (fn !== undefined) {
    const p = fn.split(',').map((s) => Number(s.trim()));
    return [p[0]! / 255, p[1]! / 255, p[2]! / 255, p[3] ?? 1];
  }
  throw new Error(`not a colour: ${text}`);
}
const unityRgba = (text: string): number[] => /rgba\(([^)]*)\)/.exec(text)![1]!.split(',').map(Number);
const COLOUR: Array<[string, string]> = [
  ['color', 'color'], ['background-color', 'backgroundColor'], ['border-top-color', 'borderTopColor'], ['border-left-color', 'borderLeftColor'],
];
const INITIAL: Record<string, string> = { 'background-color': 'transparent', 'border-top-color': 'transparent', 'border-left-color': 'transparent', opacity: '1' };

function expectDisabledLook(get: (p: string) => string | undefined, u: DumpElement, label: string): void {
  const value = (p: string): string => (get(p) ?? INITIAL[p] ?? '0').trim();
  expect(parseFloat(value('opacity')), `${label} opacity`).toBeCloseTo(Number(u.style['opacity']), 3);
  for (const [css, unity] of COLOUR) {
    const ours = rgba(value(css));
    const theirs = unityRgba(u.style[unity]!);
    ours.forEach((c, i) => expect(Math.abs(c - theirs[i]!), `${label} ${css} [${i}] ${value(css)} vs ${u.style[unity]}`).toBeLessThanOrEqual(0.0011));
  }
}

const FORCED = Object.fromEntries(PAIRS.map((p) => [`#${p}-forced`, ['disabled']]));

beforeAll(async () => {
  await loadLayoutEngine();
});

describe('disabled two ways — the dumps', () => {
  it('enabled="false" dims and disables the subtree; the forced state does neither, on both versions and themes', () => {
    for (const version of ['6000.0.40f1', '6000.3.25f1']) {
      for (const theme of ['runtime', 'editor'] as const) {
        const dump = readDump(version, theme);
        for (const p of PAIRS) {
          const off = byName(dump, `${p}-off`);
          const forced = byName(dump, `${p}-forced`);
          expect(off.classes, `${version} ${theme} ${p}-off`).toContain('unity-disabled');
          expect(forced.classes, `${version} ${theme} ${p}-forced`).not.toContain('unity-disabled');
          expect(off.style['opacity'], `${version} ${theme} ${p}-off`).toBe('0.5');
          expect(forced.style['opacity'], `${version} ${theme} ${p}-forced`).toBe('1');
          for (const e of dump.elements.filter((x) => x.path.startsWith(`${off.path}/`))) expect(e.style['opacity'], e.path).toBe('1');
        }
      }
    }
  });
});

for (const theme of ['runtime', 'editor'] as const) {
  describe(`disabled two ways — ${theme} theme`, () => {
    it('each pair element and everything inside it looks as Unity\'s', () => {
      const dump = readDump('6000.3.25f1', theme);
      const doc = parse(PROBE);
      const resolved = resolveStyles(doc, { theme, states: FORCED });
      const tree = layoutDocument(doc.root, resolved.styles, resolved.partStyles, { theme, size: dump.metadata.panel, measureText: unityMeasure(dump) });
      try {
        for (const p of PAIRS) {
          for (const which of ['off', 'forced']) {
            const u = byName(dump, `${p}-${which}`);
            const node = nodeByName(doc.root, u.name);
            expectDisabledLook((q) => resolved.styles.get(node.id)?.get(q)?.value, u, u.name);
            const parts = tree.parts.get(node.id) ?? [];
            for (const e of dump.elements.filter((x) => x.path.startsWith(`${u.path}/`))) {
              if (e.name !== '' && e.name.startsWith(`${p}-`)) {
                // A file child (ve-off-child, ve-forced-child).
                const child = nodeByName(doc.root, e.name);
                expectDisabledLook((q) => resolved.styles.get(child.id)?.get(q)?.value, e, e.name);
                continue;
              }
              const part = parts.find((x) => x.name === partName(u, e));
              expect(part, `${u.name} ${partName(u, e)}`).toBeDefined();
              expectDisabledLook((q) => part!.style.get(q)?.value, e, `${u.name} ${part!.name}`);
            }
          }
        }
      } finally {
        tree.dispose();
      }
    });
  });
}
