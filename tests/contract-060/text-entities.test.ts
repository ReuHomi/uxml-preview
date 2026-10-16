/**
 * 0.6.0 bundle 2 follow-up — the text the layout measures is the text the
 * painter draws.
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Found on 2026-10-16: the painter decodes XML entities in a `text` attribute
 * (src/render/paint.ts uses decodeEntities), but the layout handed the raw
 * attribute to measureText, so `Tom &amp; Jerry` was measured as 19 characters
 * and drawn as 11, and `&#10;` was never a line break when measuring. Unity
 * reads UXML with an XML parser, so the attribute value it lays out is the
 * decoded one. 0.5.1 did the same; no test covered it. The model keeps the raw
 * value (round-trip); decoding happens at the point of use.
 */

import { beforeAll, describe, expect, it } from 'vitest';

import { loadLayoutEngine, parse, render } from '../../src/index';

beforeAll(async () => {
  await loadLayoutEngine();
});

function measured(text: string): string[] {
  const seen: string[] = [];
  const r = render(
    parse(`<ui:UXML xmlns:ui="UnityEngine.UIElements"><ui:Label text="${text}" /></ui:UXML>`),
    document.createElement('div'),
    {
      size: { width: 400, height: 300 },
      measureText: (t, c) => {
        seen.push(t);
        return { width: t.length * 6, height: c.fontSize };
      },
    },
  );
  r.dispose();
  return seen;
}

describe('measureText receives decoded text', () => {
  it('named and numeric entities', () => {
    expect(measured('Tom &amp; Jerry')).toEqual(['Tom & Jerry']);
    expect(measured('&lt;b&gt; &quot;x&quot; &#65;&#x42;')).toEqual(['<b> "x" AB']);
  });

  it('&#10; is a line break for the measurer too', () => {
    expect(measured('one&#10;two')).toEqual(['one\ntwo']);
  });
});
