/**
 * 0.7.0 review fix C1 (grok review 2026-10-20, human decision 2026-10-21): a Label and a Button
 * do not wrap unless the author says so.
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Source: tests/layout/unity/<version>/{probe-panel,probe-editor-070}/g-clamp.json (PanelDump /
 * ProbeDump 0.7.0-r3, each probe alone in its Unity process), probe
 * tests/layout/unity/probes-0.7.0/g-clamp.uxml. Both versions and both themes resolve:
 *   white-space NoWrap — every Label and Button with no white-space of its own (cs-label, cs-button,
 *     cs-ellipsis, st-label, row-label, rh-label, abs-label, free-label). Across every 0.7.0 probe
 *     dump, an element with the unity-label or unity-button class is NoWrap unless the author wrote
 *     white-space (2026-10-21 scan);
 *   white-space Normal — a TextElement (cs-te, row-te-el) and a Label with author white-space: normal
 *     (cs-wrap). RepeatButton, which has no unity-button class, is Normal too (c07-RepeatButton.json).
 * A no-wrap text wider than its box is one line clipped to the box: cs-label 94x25 on the runtime
 * panel, 100x15 on the editor theme; cs-button 92x39 / 94x19.
 *
 * Why this file exists: g-clamp.test.ts judged the same dump with a measuring stub that answers
 * Unity's MeasureTextSize and never wraps, so it passed while the shipped measurer wrapped every
 * default Label to the box (93x59 for cs-label). Here the boxes come from the real default measurer,
 * createDefaultMeasureText(document). jsdom has no canvas, so its glyph widths are the measurer's
 * own per-character estimate; the text (178px runtime, 153px editor in Unity) is wider than the box
 * either way, so the clipped boxes do not depend on glyph widths. The wrap decision, the clipping and
 * the line height are the shipped code's.
 *
 * Runtime heights of st-label, row-label, rh-label and free-label are not judged: Unity's are
 * 12-13px from a Unity-side contamination in this probe (g-clamp.test.ts header).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { createDefaultMeasureText, loadLayoutEngine, parse, render, resolveStyles } from '../../src/index';
import type { ElementNode, Theme } from '../../src/index';

const UNITY = join(process.cwd(), 'tests', 'layout', 'unity');
const FOLDER: Record<Theme, string> = { runtime: 'probe-panel', editor: 'probe-editor-070' };
const VERSIONS = ['6000.0.40f1', '6000.3.25f1'] as const;
const PROBE = readFileSync(join(UNITY, 'probes-0.7.0', 'g-clamp.uxml'), 'utf8');

interface DumpElement { path: string; name: string; type: string; x: number; y: number; w: number; h: number; style: Record<string, string> }
interface Dump { metadata: { panel: { width: number; height: number } }; elements: DumpElement[] }
const readDump = (version: string, theme: Theme): Dump =>
  JSON.parse(readFileSync(join(UNITY, version, FOLDER[theme], 'g-clamp.json'), 'utf8').replace(/\bNaN\b/g, 'null')) as Dump;
const named = (dump: Dump, name: string): DumpElement => {
  const e = dump.elements.find((x) => x.name === name);
  if (e === undefined) throw new Error(`dump has no ${name}`);
  return e;
};

const TEXTS = ['cs-label', 'cs-te', 'cs-button', 'cs-wrap', 'cs-ellipsis', 'st-label', 'row-label', 'row-te-el', 'rh-label', 'abs-label', 'free-label'];
const ONE_LINE_CLIPPED = ['cs-label', 'cs-button', 'cs-ellipsis', 'st-label', 'row-label', 'rh-label'];
const RUNTIME_SHORT = ['st-label', 'row-label', 'rh-label', 'free-label'];

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

beforeAll(async () => {
  await loadLayoutEngine();
});

describe('C1 — the dumps', () => {
  it('Label and Button are NoWrap, TextElement and an author normal are Normal, on both versions and themes', () => {
    for (const version of VERSIONS) {
      for (const theme of ['runtime', 'editor'] as const) {
        const d = readDump(version, theme);
        for (const name of ['cs-label', 'cs-button', 'cs-ellipsis', 'st-label', 'row-label', 'rh-label', 'abs-label', 'free-label']) {
          expect(named(d, name).style['whiteSpace'], `${version} ${theme} ${name}`).toBe('NoWrap');
        }
        for (const name of ['cs-te', 'row-te-el', 'cs-wrap']) expect(named(d, name).style['whiteSpace'], `${version} ${theme} ${name}`).toBe('Normal');
      }
    }
  });
});

for (const theme of ['runtime', 'editor'] as const) {
  describe(`C1 — ${theme} theme`, () => {
    it('resolves white-space as Unity does for every text in the probe', () => {
      for (const version of VERSIONS) {
        const dump = readDump(version, theme);
        const doc = parse(PROBE);
        const resolved = resolveStyles(doc, { theme });
        for (const name of TEXTS) {
          const ours = resolved.styles.get(nodeByName(doc.root, name).id)?.get('white-space')?.value ?? 'normal';
          const unity = named(dump, name).style['whiteSpace'] === 'NoWrap' ? 'nowrap' : 'normal';
          expect(ours, `${version} ${name}`).toBe(unity);
        }
      }
    });

    it('with the default measurer, a no-wrap Label and Button in 100px are one line clipped to the box', () => {
      for (const version of VERSIONS) {
        const dump = readDump(version, theme);
        const doc = parse(PROBE);
        const r = render(doc, document.createElement('div'), { theme, size: dump.metadata.panel, measureText: createDefaultMeasureText(document) });
        try {
          for (const name of ONE_LINE_CLIPPED) {
            const b = r.boxes.get(nodeByName(r.document!.root, name).id)!;
            const u = named(dump, name);
            expect(b.width, `${version} ${name} width`).toBe(u.w);
            if (theme === 'editor' || !RUNTIME_SHORT.includes(name)) expect(b.height, `${version} ${name} height`).toBe(u.h);
          }
          // The author's white-space: normal still wraps: several lines, as Unity draws it.
          const wrap = r.boxes.get(nodeByName(r.document!.root, 'cs-wrap').id)!;
          expect(wrap.height, `${version} cs-wrap height`).toBe(named(dump, 'cs-wrap').h);
        } finally {
          r.dispose();
        }
      }
    });
  });
}
