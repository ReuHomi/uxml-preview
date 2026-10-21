/**
 * 0.7.0 review fix Y1, counted on Yoga itself (human decision 2026-10-21).
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * CLAUDE.md absolute rule 2: Yoga nodes are not garbage-collected. review-r1.test.ts checked the leak
 * with `liveNodeCount`, which is this library's own tally: a catch block that decrements the tally
 * without freeing anything passed it (mutation found 2026-10-21). Here every node Yoga creates is
 * recorded, and `free` / `freeRecursive` (with every descendant it reaches) mark them freed. After a
 * measure function throws during layout, every created node must be freed; after a successful render,
 * `dispose` must free every node it created.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { Node as YogaNode } from 'yoga-layout/load';

const created: YogaNode[] = [];
const freed: YogaNode[] = [];
// getChild hands back a new JS wrapper each call; embind's isAliasOf compares the wasm node behind it.
const alias = (n: YogaNode) => n as unknown as { isAliasOf(other: unknown): boolean };
const isFreed = (n: YogaNode): boolean => freed.some((f) => alias(f).isAliasOf(n));

vi.mock('yoga-layout/load', async (importOriginal) => {
  const original = await importOriginal<typeof import('yoga-layout/load')>();
  return {
    ...original,
    loadYoga: async () => {
      const yoga = await original.loadYoga();
      const create = yoga.Node.create.bind(yoga.Node);
      let patched = false;
      yoga.Node.create = ((config?: unknown) => {
        const node = (create as (c?: unknown) => YogaNode)(config);
        if (!patched) {
          patched = true;
          const proto = Object.getPrototypeOf(node) as { free: () => void; freeRecursive: () => void };
          const free = proto.free, freeRecursive = proto.freeRecursive;
          const markTree = (n: YogaNode): void => {
            for (let i = 0; i < n.getChildCount(); i++) markTree(n.getChild(i));
            freed.push(n);
          };
          proto.free = function (this: YogaNode) { freed.push(this); free.call(this); };
          proto.freeRecursive = function (this: YogaNode) { markTree(this); freeRecursive.call(this); };
        }
        created.push(node);
        return node;
      }) as typeof yoga.Node.create;
      return yoga;
    },
  };
});

const { loadLayoutEngine, parse, render } = await import('../../src/index');

beforeAll(async () => {
  await loadLayoutEngine();
});

const BODY = '<ui:UXML xmlns:ui="UnityEngine.UIElements"><ui:VisualElement><ui:Label text="x" /><ui:Button text="y" />' +
  '<ui:Slider value="3" /><ui:ProgressBar value="40" /><ui:TextField value="v" /></ui:VisualElement></ui:UXML>';

describe('Y1 — counted on Yoga', () => {
  it('a measure that throws: every node Yoga created is freed, and the error reaches the caller', () => {
    created.length = 0;
    freed.length = 0;
    expect(() => render(parse(BODY), document.createElement('div'), {
      size: { width: 400, height: 300 }, measureText: () => { throw new Error('measure failed'); },
    })).toThrow('measure failed');
    expect(created.length).toBeGreaterThan(0);
    expect(created.filter((n) => !isFreed(n)).length).toBe(0);
  });

  it('a render that succeeds: dispose frees every node', () => {
    created.length = 0;
    freed.length = 0;
    const r = render(parse(BODY), document.createElement('div'), {
      size: { width: 400, height: 300 }, measureText: (t, c) => ({ width: t.length * c.fontSize * 0.5, height: c.fontSize }),
    });
    expect(created.length).toBeGreaterThan(0);
    expect(created.filter((n) => !isFreed(n)).length, 'before dispose').toBe(created.length);
    r.dispose();
    expect(created.filter((n) => !isFreed(n)).length, 'after dispose').toBe(0);
  });
});
