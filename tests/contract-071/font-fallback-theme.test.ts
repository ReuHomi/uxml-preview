/**
 * 0.7.1 — the font-fallback message names the default font of the theme it is drawn in.
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * The message said "The editor default font (Inter-Regular SDF)" under both themes. Unity's own dumps say
 * otherwise (asserted below against the dump files, so the font names are not this test's opinion):
 *
 *   - editor panel, tests/text-cohort/unity/<version>/cohort-default.json: `Inter-Regular SDF`;
 *   - runtime panel, tests/text-cohort/unity-runtime/<version>/*.json (24 of 24 files, both versions):
 *     `font=NotInter-Regular`; the 6000.3.25f1 dump also names the asset `NotInter - Regular SDF`. Same
 *     FaceInfo as Inter. The message names `NotInter-Regular`, the one name both versions report.
 *
 * What was measured where (so what the message may claim):
 *   - Hangul in the default font is taller than the measurer's height in BOTH panels, 1/2/2/4px at
 *     10/14/20/32px (results.json: editor `inter-ko-*`, runtime `inter-ko-*`). Runtime Hangul keeps the
 *     height-only message.
 *   - Han and Kana in the default font: height and width were measured in the EDITOR panel only
 *     (docs/design/0.7.0-cjk-text.md, result 3). The runtime panel has no default-font Han/Kana dump
 *     (docs/backlog.md, 0.7.1), so the runtime message must not present those figures as runtime
 *     measurements. The 0.6.1 test (contract-061/font-fallback-message.test.ts) still holds for the
 *     figures themselves.
 *
 * `reason`, `kind` and `subject` are the same in both themes (consumers read those).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import { loadLayoutEngine, parse, render } from '../../src/index';
import type { Theme, Warning } from '../../src/index';

beforeAll(async () => {
  await loadLayoutEngine();
});

const ROOT = process.cwd();
const dump = (dir: string, version: string): string =>
  readFileSync(join(ROOT, 'tests', 'text-cohort', dir, version, 'cohort-default.json'), 'utf8');

const U = (body: string) => `<ui:UXML xmlns:ui="UnityEngine.UIElements">${body}</ui:UXML>`;

function fallbackWarnings(theme: Theme): Warning[] {
  const r = render(parse(U('<ui:Label text="한글" /><ui:Label text="漢字" /><ui:Label text="かな" />')), document.createElement('div'), {
    theme, size: { width: 400, height: 300 },
    measureText: (t, c) => ({ width: t.length * 6, height: c.fontSize }),
  });
  try {
    return r.warnings.filter((w) => w.reason === 'font-fallback');
  } finally {
    r.dispose();
  }
}

describe('font names are Unity-reported, not ours', () => {
  it('both versions: the editor panel reports Inter-Regular SDF, the runtime panel font=NotInter-Regular', () => {
    for (const version of ['6000.0.40f1', '6000.3.25f1']) {
      expect(dump('unity', version)).toContain('Inter-Regular SDF');
      expect(dump('unity-runtime', version)).toContain('font=NotInter-Regular');
      expect(dump('unity-runtime', version)).not.toMatch(/(?<!Not)Inter-Regular SDF/);
    }
    expect(dump('unity-runtime', '6000.3.25f1')).toContain('NotInter - Regular SDF');
  });
});

describe('font-fallback message by theme', () => {
  it('editor: unchanged — the editor default font, Inter-Regular SDF', () => {
    const ws = fallbackWarnings('editor');
    expect(ws).toHaveLength(3);
    for (const w of ws) {
      expect(w.message).toMatch(/^The editor default font \(Inter-Regular SDF\) has no glyphs for /);
      expect(w.message).not.toMatch(/NotInter|runtime/i);
    }
  });

  it('runtime: the runtime default font, NotInter-Regular, never the editor font', () => {
    const ws = fallbackWarnings('runtime');
    expect(ws).toHaveLength(3);
    for (const w of ws) {
      expect(w.message).toMatch(/^The runtime default font \(NotInter-Regular\) has no glyphs for /);
      expect(w.message).not.toMatch(/editor default font/i);
      expect(w.message).not.toMatch(/(?<!Not)Inter-Regular SDF/);
      expect(w.message).toMatch(/1–4px taller/);
    }
  });

  it('runtime Hangul: measured in the runtime panel, so no claim about another panel and no width', () => {
    const [hangul] = fallbackWarnings('runtime');
    expect(hangul!.message).not.toMatch(/width/i);
    expect(hangul!.message).not.toMatch(/editor panel/i);
  });

  it('runtime Han and Kana: the figures stay, attributed to the editor panel they were measured in', () => {
    const [, han, kana] = fallbackWarnings('runtime');
    for (const w of [han!, kana!]) {
      expect(w.message).toMatch(/6–87px/);
      expect(w.message).toMatch(/fallback font/i);
      expect(w.message).toMatch(/measured in the editor panel/);
      expect(w.message).toMatch(/the runtime panel has not been measured for them/);
    }
  });

  it('editor Han and Kana: no attribution sentence (they were measured there)', () => {
    const [, han, kana] = fallbackWarnings('editor');
    for (const w of [han!, kana!]) expect(w.message).not.toMatch(/measured in the editor panel/);
  });

  it('reason, kind and subject do not depend on the theme', () => {
    const strip = (ws: Warning[]) => ws.map((w) => ({ kind: w.kind, reason: w.reason, node: w.node, subject: w.subject }));
    expect(strip(fallbackWarnings('runtime'))).toEqual(strip(fallbackWarnings('editor')));
    for (const w of fallbackWarnings('runtime')) {
      expect(w.subject).toMatchObject({ kind: 'property', property: '-unity-font-definition', affectsLayout: true });
    }
  });
});
