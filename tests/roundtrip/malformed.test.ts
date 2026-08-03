// @vitest-environment node

/**
 * Round-trip on input that does not parse cleanly.
 *
 * Span re-emission means the serializer never regenerates text it was not asked
 * to change, so recovery from malformed input costs nothing: whatever the
 * scanner could not make sense of stays inside a gap and is copied back out.
 *
 * This is what makes the playground's `round-trip: exact` indicator hold for
 * anything a user types, half-finished tags included. If one of these ever
 * fails, the guarantee in the README has stopped being true — which is the
 * point of pinning them here rather than trusting the property to hold.
 */

import { describe, it, expect } from 'vitest';

import { parse, serialize } from '../../src/index';

const HOST = '<ui:UXML xmlns:ui="UnityEngine.UIElements" />\n';

const uxml: Array<[string, string]> = [
  [
    'a closing tag is missing',
    '<ui:UXML xmlns:ui="UnityEngine.UIElements">\n' +
      '  <ui:VisualElement>\n' +
      '    <ui:Label text="a" />\n' +
      '</ui:UXML>\n',
  ],
  ['there is no root element', 'just some text\n'],
  [
    'an open tag is never finished',
    '<ui:UXML xmlns:ui="UnityEngine.UIElements">\n  <ui:Label text="a"\n',
  ],
  [
    'a stray angle bracket sits in the text',
    '<ui:UXML xmlns:ui="UnityEngine.UIElements">\n  a < b\n</ui:UXML>\n',
  ],
  [
    'an attribute value is unquoted',
    '<ui:UXML xmlns:ui="UnityEngine.UIElements">\n  <ui:Label text=a />\n</ui:UXML>\n',
  ],
  [
    'a comment is never closed',
    '<ui:UXML xmlns:ui="UnityEngine.UIElements">\n  <!-- forever\n</ui:UXML>\n',
  ],
  ['the document is empty', ''],
  ['the document is only whitespace', '\n\n  \n'],
];

const uss: Array<[string, string]> = [
  ['a block is never closed', '.a {\n  color: red;\n'],
  ['a declaration has no colon', '.a {\n  color red;\n  width: 2px;\n}\n'],
  ['a comment is never closed', '.a { color: red; }\n/* never closed\n'],
  ['the text is not USS at all', '}}}{{{\n'],
  ['a selector has no block', '.a, .b\n'],
];

describe('malformed UXML still round-trips byte for byte', () => {
  for (const [label, text] of uxml) {
    it(label, () => {
      expect(serialize(parse(text)).uxml).toBe(text);
    });
  }
});

describe('malformed USS still round-trips byte for byte', () => {
  for (const [label, text] of uss) {
    it(label, () => {
      expect(serialize(parse(HOST, text)).uss).toBe(text);
    });
  }
});

describe('warnings', () => {
  it('are raised for input the scanner had to recover from', () => {
    // Preserved is not the same as accepted. The text survives, and the reader
    // is still told something was wrong with it.
    const doc = parse('<ui:UXML xmlns:ui="UnityEngine.UIElements">\n  <ui:Label text="a"\n');
    expect(doc.warnings.length).toBeGreaterThan(0);
  });

  it('are not raised for input that parsed cleanly', () => {
    expect(parse(HOST).warnings).toEqual([]);
  });
});
