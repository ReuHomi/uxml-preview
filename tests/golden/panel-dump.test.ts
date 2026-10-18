// @vitest-environment node

/**
 * The runtime golden set is only as good as the dumper and its conversion.
 *
 * PanelDump lays a case out on a real runtime panel; UxmlLayoutDump, which the
 * published editor figures rest on, lays it out in an EditorWindow. Run with
 * -panelSkin editor, PanelDump must give UxmlLayoutDump's numbers exactly: then any
 * difference in the runtime set is the theme, not the tool (0.7.0 bundle A, step A0).
 * Measured 2026-10-17 on 6000.0.40f1 and 6000.3.25f1: 1012/1012 on both.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { panelToGolden } from './panel-dump';
import type { PanelDumpFile } from './panel-dump';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const LAYOUT = join(HERE, '..', 'layout', 'unity');
const VERSIONS = ['6000.0.40f1', '6000.3.25f1'] as const;

const read = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;

/** UxmlLayoutDump files carry NaN in their observations, so the boxes are read by pattern, in file order. */
function uxmlLayoutBoxes(path: string): Array<[string, number[]]> {
  const re = /"([^"]+)": \{ "x": ([-\d.eE]+), "y": ([-\d.eE]+), "width": ([-\d.eE]+), "height": ([-\d.eE]+) \}/g;
  return [...readFileSync(path, 'utf8').matchAll(re)].map((m) => [m[1]!, m.slice(2, 6).map(Number)]);
}

const boxes = (g: ReturnType<typeof panelToGolden>): Array<[string, number[]]> =>
  Object.entries(g.elements).map(([k, b]) => [k, [b.x, b.y, b.width, b.height]]);

describe('PanelDump against UxmlLayoutDump', () => {
  for (const v of VERSIONS) {
    it(`${v}: on the editor theme every golden value is UxmlLayoutDump's`, () => {
      const dir = join(LAYOUT, v, 'golden-editor-on-panel');
      const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
      expect(files).toHaveLength(44);
      let values = 0;
      for (const f of files) {
        const panel = panelToGolden(read<PanelDumpFile>(join(dir, f)));
        expect(panel.metadata.theme, f).toBe('editor-on-panel');
        expect(panel.panel, f).toEqual({ width: 400, height: 300 });
        const expected = uxmlLayoutBoxes(join(LAYOUT, v, 'golden', f));
        expect(boxes(panel), f).toEqual(expected);
        values += expected.length * 4;
      }
      expect(values).toBe(1012);
    });
  }

  it('the runtime set is the conversion of the 6.3 runtime-panel dump, unedited', () => {
    const dir = join(LAYOUT, '6000.3.25f1', 'golden-panel');
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    // 44 until bundle G added settings and settings-ko (no editor-on-panel dump for them: the
    // check above compares the two dumpers on the original 44).
    expect(files).toHaveLength(46);
    for (const f of files) {
      const panel = panelToGolden(read<PanelDumpFile>(join(dir, f)));
      expect(panel.metadata.theme, f).toBe('runtime-panel');
      expect(read(join(HERE, 'unity-runtime', f)), f).toEqual(panel);
    }
  });

  it('runtime-panel coordinates are the same on 6000.0.40f1 and 6000.3.25f1', () => {
    const [a, b] = VERSIONS.map((v) => join(LAYOUT, v, 'golden-panel'));
    for (const f of readdirSync(a!).filter((f) => f.endsWith('.json'))) {
      expect(boxes(panelToGolden(read(join(a!, f)))), f).toEqual(boxes(panelToGolden(read(join(b!, f)))));
    }
  });
});
