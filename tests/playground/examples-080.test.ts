/**
 * The playground shows what 0.8.0 adds.
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * User request 2026-11-18: rework the playground examples so a visitor sees 0.8.0's work first.
 *   - "New in 0.8.0: spaces follow the text generator" — Unity evidence: r15-label-spaces (a runtime Label keeps
 *     "a     b     c" 64 wide against "a b c" 33; the 6.3 editor's Advanced collapses it, 28 against 28) and
 *     r8-trail / r8-wrap (tests/contract-080/spaces-r8.test.ts). Judged here as relations, because the
 *     playground measures with the browser's fonts.
 *   - "New in 0.8.0: line height from a Unity font asset" — the example carries a real Unity file, the
 *     Noto Sans KR font asset of the 6000.3.25f1 fixture (tests/unity-project/font-assets/), byte for byte, and
 *     the playground reads it with readFontAsset to answer resolveFont. Noto Sans KR's FaceInfo (ascent 104.4,
 *     descent -25.92, lineHeight 130.32 at 90) is taller than the default font's (87.1875, -21.73295, 108.9205),
 *     so the same three lines stand taller, and Korean text set in that font raises no font-fallback warning.
 *   - The two "Trap:" examples are one ("Traps: …"), and the first example a visitor sees is a 0.8.0 one.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { loadLayoutEngine, parse, render } from '../../src/index';
import type { RenderResult } from '../../src/index';
import { readFontAsset } from '../../src/unity-project/index';
import { EXAMPLES, resolveAsset, resolveExampleFont, resolveExampleImport } from '../../playground/examples';

beforeAll(async () => {
  await loadLayoutEngine();
});

const FIXTURE = readFileSync(join(process.cwd(), 'tests/unity-project/font-assets/6000.3.25f1/noto-sans-kr/NotoSansKR[wght] SDF.asset'), 'utf8');

const find = (pattern: RegExp) => {
  const e = EXAMPLES.find((x) => pattern.test(x.name));
  expect(e, `an example named like ${pattern}`).toBeDefined();
  return e!;
};

function draw(e: (typeof EXAMPLES)[number]): RenderResult {
  const files = e.files;
  const doc = parse(e.uxml, e.uss, files === undefined ? undefined : { resolveImport: (url, from) => resolveExampleImport(files, url, from) });
  return render(doc, document.createElement('div'), {
    size: e.panel ?? { width: 1280, height: 720 }, resolveAsset,
    resolveFont: (path) => resolveExampleFont(files, path),
  });
}

const box = (r: RenderResult, name: string) => {
  let id: number | undefined;
  const walk = (n: { id: number; attributes: Array<{ name: string; value: string }>; children: unknown[] }) => {
    if (n.attributes.some((a) => a.name === 'name' && a.value === name)) id = n.id;
    (n.children as (typeof n)[]).forEach(walk);
  };
  walk(r.document.root as never);
  expect(id, `element #${name}`).toBeDefined();
  return r.boxes.get(id as never)!;
};

it('the first example a visitor sees is a 0.8.0 one', () => {
  expect(EXAMPLES[0]!.name).toMatch(/^New in 0\.8\.0/);
});

describe('New in 0.8.0: spaces follow the text generator', () => {
  it('the runtime (Standard) Label keeps a run of spaces; an Advanced one collapses it', () => {
    const e = find(/^New in 0\.8\.0: spaces/);
    const r = draw(e);
    try {
      expect(box(r, 'runs').width).toBeGreaterThan(box(r, 'plain').width);
      expect(box(r, 'adv-runs').width).toBe(box(r, 'adv-plain').width);
      expect(e.uss).toMatch(/-unity-text-generator:\s*advanced/);
    } finally {
      r.dispose();
    }
  });
});

describe('New in 0.8.0: line height from a Unity font asset', () => {
  it('carries the 6000.3.25f1 Noto Sans KR font asset byte for byte', () => {
    const e = find(/^New in 0\.8\.0: .*font asset/);
    const assets = Object.entries(e.files ?? {}).filter(([k]) => k.endsWith('.asset'));
    expect(assets).toHaveLength(1);
    expect(assets[0]![1]).toBe(FIXTURE);
  });

  it('resolveExampleFont answers resolveFont with the FaceInfo readFontAsset reads, and null for anything else', () => {
    const e = find(/^New in 0\.8\.0: .*font asset/);
    const [path] = Object.keys(e.files!).filter((k) => k.endsWith('.asset'));
    const read = readFontAsset(FIXTURE);
    expect('faceInfo' in read).toBe(true);
    const font = resolveExampleFont(e.files, `project://database/${path}`);
    expect(font).not.toBeNull();
    expect(typeof font === 'object' && font !== null ? font.faceInfo : undefined).toEqual('faceInfo' in read ? read.faceInfo : null);
    expect(resolveExampleFont(e.files, 'project://database/Assets/Fonts/Missing SDF.asset')).toBeNull();
    expect(resolveExampleFont(undefined, `project://database/${path}`)).toBeNull();
  });

  it('the same three lines stand taller in the asset font, and its Korean raises no font-fallback warning', () => {
    const e = find(/^New in 0\.8\.0: .*font asset/);
    const r = draw(e);
    try {
      expect(box(r, 'with-asset').height).toBeGreaterThan(box(r, 'default-font').height);
      const fallback = r.warnings.filter((w) => w.reason === 'font-fallback');
      const ids = new Set(fallback.map((w) => w.node));
      let assetId: number | undefined;
      const walk = (n: { id: number; attributes: Array<{ name: string; value: string }>; children: unknown[] }) => {
        if (n.attributes.some((a) => a.name === 'name' && a.value === 'with-asset')) assetId = n.id;
        (n.children as (typeof n)[]).forEach(walk);
      };
      walk(r.document.root as never);
      expect(ids.has(assetId as never)).toBe(false);
      expect(r.warnings.filter((w) => w.subject?.kind === 'asset' && (w.subject as { role?: string }).role === 'font')).toEqual([]);
    } finally {
      r.dispose();
    }
  });
});

it('the two traps are one example', () => {
  expect(EXAMPLES.filter((e) => /^Trap:/.test(e.name))).toEqual([]);
  const traps = find(/^Traps:/);
  expect(traps.uss).toMatch(/flex-direction:\s*row/);
  expect(traps.uxml).toMatch(/z-index/);
});
