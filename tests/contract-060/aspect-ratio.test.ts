/**
 * 0.6.0 — aspect-ratio reaches Yoga (decision D6).
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Expected boxes are Unity 6000.3.25f1's, read from
 * tests/layout/unity/6000.3.25f1/probe-editor/aspect2.json (probe source:
 * tests/layout/unity/probes-0.6.0/aspect2.uxml, 800x600 panel, 2026-10-15).
 * The pre-check reproduced them 52/52 by calling yoga-layout's setAspectRatio
 * directly; this pins the same numbers through parse → render. The cases
 * include a fixed width, a fixed height, max/min height against the ratio,
 * width and height both set, flex-grow in a row, and a stretched element — and
 * the column overflows the panel, so several of them are also shrunk.
 *
 * Also measured (aspect.json, both versions): `aspect-ratio: 2 / 1` written
 * inline is an import error in Unity and drops every inline style in that UXML
 * file. That is the unityEffect rule bundle 1 already pins for unsupported
 * units; it is pinned again here for this value.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { loadLayoutEngine, parse, render } from '../../src/index';
import type { ElementNode, NodeId, RenderResult } from '../../src/index';

beforeAll(async () => {
  await loadLayoutEngine();
});

const UNITY_DIR = join(process.cwd(), 'tests', 'layout', 'unity');
const unity = JSON.parse(
  readFileSync(join(UNITY_DIR, '6000.3.25f1', 'probe-editor', 'aspect2.json'), 'utf8').replace(/\bNaN\b/g, 'null'),
) as { elements: Array<{ name: string; x: number; y: number; w: number; h: number }> };
const probe = readFileSync(join(UNITY_DIR, 'probes-0.6.0', 'aspect2.uxml'), 'utf8');

function byName(root: ElementNode): Map<string, NodeId> {
  const out = new Map<string, NodeId>();
  const walk = (n: ElementNode): void => {
    const name = n.attributes.find((a) => a.name === 'name')?.value;
    if (name !== undefined) out.set(name, n.id);
    n.children.forEach(walk);
  };
  walk(root);
  return out;
}

describe('aspect-ratio against Unity 6000.3.25f1', () => {
  it('all 13 boxes, 52 values, within 0.5px', () => {
    const r: RenderResult = render(parse(probe), document.createElement('div'), { size: { width: 800, height: 600 } });
    try {
      const ids = byName(r.document!.root);
      const expected = unity.elements.filter((e) => e.name !== '');
      expect(expected).toHaveLength(13);
      let matched = 0;
      for (const e of expected) {
        const box = r.boxes.get(ids.get(e.name)!)!;
        const ours = [box.left, box.top, box.width, box.height];
        const theirs = [e.x, e.y, e.w, e.h];
        ours.forEach((v, i) => {
          if (Math.abs(v - theirs[i]!) <= 0.5) matched++;
        });
        expect(ours.map(Math.round), e.name).toEqual(theirs);
      }
      expect(matched).toBe(52);
      expect(
        r.warnings.filter((w) => w.subject?.kind === 'property' && w.subject.property === 'aspect-ratio' && w.reason === 'not-rendered'),
      ).toEqual([]);
    } finally {
      r.dispose();
    }
  });

  it('"2 / 1" inline: Unity drops the file\'s inline styles; here it is reported and the others still apply', () => {
    const r = render(
      parse('<ui:UXML xmlns:ui="UnityEngine.UIElements"><ui:VisualElement name="a" style="width: 100px; aspect-ratio: 2 / 1;" /><ui:VisualElement name="b" style="width: 30px; height: 4px;" /></ui:UXML>'),
      document.createElement('div'),
      { size: { width: 400, height: 300 } },
    );
    try {
      const ws = r.warnings.filter((w) => w.subject?.kind === 'property' && w.subject.property === 'aspect-ratio');
      expect(ws).toHaveLength(1);
      expect(ws[0]!.reason).toBe('invalid-value');
      expect(ws[0]!.subject).toMatchObject({ unityEffect: { kind: 'file-inline-dropped', versions: ['6000.0', '6000.3'] } });
      const b = byName(r.document!.root).get('b')!;
      expect(r.boxes.get(b)).toMatchObject({ width: 30, height: 4 });
    } finally {
      r.dispose();
    }
  });
});
