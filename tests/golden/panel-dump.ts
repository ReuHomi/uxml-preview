/**
 * PanelDump output (tests/layout/unity/probes-0.7.0/PanelDump.cs.txt) in the golden
 * format tools/UxmlLayoutDump.cs writes, so the harness reads a runtime-panel
 * measurement the way it reads an editor one.
 *
 * The protocol is UxmlLayoutDump's and must stay identical (runCase in harness.ts
 * relies on it): named elements only, in tree order, a repeated name suffixed #1..#n,
 * coordinates relative to the root, rounded to a tenth of a pixel.
 * panel-dump.test.ts holds it to UxmlLayoutDump on the editor theme.
 */

export interface PanelDumpFile {
  metadata: { unityVersion: string; theme: string; themeSource: string; panel: { width: number; height: number } };
  elements: Array<{ name: string; x: number; y: number; w: number; h: number }>;
}

export interface GoldenFile {
  metadata: { unityVersion: string; theme: string; themeSource: string; dumper: 'PanelDump' };
  panel: { width: number; height: number };
  elements: Record<string, { x: number; y: number; width: number; height: number }>;
}

const round = (v: number): number => Math.round(v * 10) / 10;

export function panelToGolden(dump: PanelDumpFile): GoldenFile {
  const named = dump.elements.filter((e) => e.name !== '');
  const count = new Map<string, number>();
  for (const e of named) count.set(e.name, (count.get(e.name) ?? 0) + 1);
  const seen = new Map<string, number>();
  const elements: GoldenFile['elements'] = {};
  for (const e of named) {
    let key = e.name;
    if ((count.get(e.name) ?? 0) > 1) {
      const n = (seen.get(e.name) ?? 0) + 1;
      seen.set(e.name, n);
      key += `#${n}`;
    }
    elements[key] = { x: round(e.x), y: round(e.y), width: round(e.w), height: round(e.h) };
  }
  const { unityVersion, theme, themeSource, panel } = dump.metadata;
  return { metadata: { unityVersion, theme, themeSource, dumper: 'PanelDump' }, panel, elements };
}
