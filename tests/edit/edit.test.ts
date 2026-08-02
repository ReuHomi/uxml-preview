// @vitest-environment node

/**
 * What happens to the text around an edit.
 *
 * Round-trip proves the spans cover the file; these prove the spans are
 * *split* usefully. If an edit to one attribute rewrote the whole document the
 * round-trip suite would still be green and the library would still be useless
 * for its stated purpose — a clean git diff after opening and saving.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse, serialize } from '../../src/index';
import type { ElementNode } from '../../src/model/types';

const UXML_DIR = fileURLToPath(new URL('../fixtures/uxml', import.meta.url));
const USS_DIR = fileURLToPath(new URL('../fixtures/uss', import.meta.url));
const HOST = '<ui:UXML xmlns:ui="UnityEngine.UIElements" />\n';

const readUxml = (n: string): string => readFileSync(join(UXML_DIR, n), 'utf8');
const readUss = (n: string): string => readFileSync(join(USS_DIR, n), 'utf8');

function find(node: ElementNode, pred: (n: ElementNode) => boolean): ElementNode {
  if (pred(node)) return node;
  for (const child of node.children) {
    const hit: ElementNode | null = tryFind(child, pred);
    if (hit !== null) return hit;
  }
  throw new Error('no matching node');
}

function tryFind(node: ElementNode, pred: (n: ElementNode) => boolean): ElementNode | null {
  if (pred(node)) return node;
  for (const child of node.children) {
    const hit = tryFind(child, pred);
    if (hit !== null) return hit;
  }
  return null;
}

/** Everything outside [start, end) must be untouched. */
function expectOnlyRegionChanged(
  original: string,
  output: string,
  start: number,
  end: number,
): void {
  expect(output.slice(0, start)).toBe(original.slice(0, start));
  const tailLength = original.length - end;
  expect(output.slice(output.length - tailLength)).toBe(original.slice(end));
}

describe('UXML: editing one attribute', () => {
  const original = readUxml('formatting.uxml');
  const doc = parse(original);
  const button = find(doc.root, (n) => n.name.local === 'Button');
  const span = button.spans.openTag;

  button.attributes.find((a) => a.name === 'text')!.value = 'Cancel';
  button.tagDirty = true;
  const { uxml } = serialize(doc);

  it('applies the change', () => {
    expect(uxml).toContain('text="Cancel"');
    expect(uxml).not.toContain('text="OK"');
  });

  it('leaves every byte outside that one tag alone', () => {
    expectOnlyRegionChanged(original, uxml, span.start, span.end);
  });

  it('reflows the other attributes of that tag (known cost of tag-level dirty)', () => {
    // The open tag is regenerated as a whole, so attributes that were spread
    // over three lines collapse onto one. Nothing outside the tag moves, but
    // the diff is larger than it needs to be. Fixing this means giving each
    // attribute its own dirty flag and slicing the gaps between them, the same
    // way children are handled -- see docs/progress.md.
    expect(original).toContain('tooltip="여러 줄에 걸친 속성"');
    expect(uxml).toContain('<ui:Button text="Cancel" class="btn btn--primary"');
    expect(uxml.split('\n').length).toBeLessThan(original.split('\n').length);
  });
});

describe('UXML: removing a child', () => {
  const original = readUxml('formatting.uxml');
  const doc = parse(original);
  const container = find(doc.root, (n) => n.attributes.some((a) => a.value === 'header'));
  const inner = container.spans.inner;

  container.children = container.children.filter(
    (c) => !c.attributes.some((a) => a.name === 'name' && a.value === 'spacer'),
  );
  container.childrenDirty = true;
  const { uxml } = serialize(doc);

  it('drops the child', () => {
    expect(original).toContain('name="spacer"');
    expect(uxml).not.toContain('name="spacer"');
  });

  it('keeps the surviving children byte-identical', () => {
    expect(uxml).toContain("<ui:Label text='단일 따옴표로 감싼 값' class=\"title\"/>");
  });

  it('leaves everything outside the container alone', () => {
    expectOnlyRegionChanged(original, uxml, inner.start, inner.end);
  });
});

describe('UXML: childrenDirty loses comments between children', () => {
  // Known limitation. Comments survive only inside the recorded gaps, and a
  // changed child list invalidates those gaps. Serializing then re-indents from
  // scratch and the comments are gone. Acceptable while nothing edits the tree;
  // Phase 8 has to keep the gaps as first-class siblings instead.
  const original = readUxml('comments.uxml');
  const doc = parse(original);
  const container = find(doc.root, (n) => n.name.local === 'VisualElement');

  container.childrenDirty = true;
  const { uxml } = serialize(doc);

  it('keeps both labels', () => {
    expect(uxml).toContain('text="A"');
    expect(uxml).toContain('text="B"');
  });

  it('drops the comment that sat between them', () => {
    expect(original).toContain('여러 줄에 걸친 주석');
    expect(uxml).not.toContain('여러 줄에 걸친 주석');
  });

  it('keeps the comments outside that container', () => {
    expect(uxml).toContain('파일 첫머리 주석');
    expect(uxml).toContain('루트 뒤');
  });
});

describe('USS: editing one declaration', () => {
  const original = readUss('values.uss');
  const doc = parse(HOST, original);
  const rule = doc.sheets[0]!.items[0]!;
  if (rule.kind !== 'rule') throw new Error('expected a rule');
  const decl = rule.rule.declarations[0]!;
  const span = decl.span;

  decl.value = '10px';
  decl.dirty = true;
  const { uss } = serialize(doc);

  it('applies the change', () => {
    expect(uss).toContain('padding: 10px');
  });

  it('leaves every byte outside that declaration alone', () => {
    expectOnlyRegionChanged(original, uss, span.start, span.end);
  });

  it('keeps the comment and the missing final semicolon in the same rule', () => {
    expect(uss).toContain('/* 마지막 선언에 세미콜론이 없다 */');
    expect(uss).toContain('border-top-width: 1px\n}');
  });
});

describe('USS: editing a selector', () => {
  const original = readUss('selectors.uss');
  const doc = parse(HOST, original);
  const item = doc.sheets[0]!.items[6]!;
  if (item.kind !== 'rule') throw new Error('expected a rule');
  const span = item.rule.selectorSpan;

  item.rule.selectors[0]!.parts[0]!.simple[0] = { kind: 'class', name: 'button' };
  item.rule.selectorDirty = true;
  const { uss } = serialize(doc);

  it('rewrites only the selector', () => {
    expect(uss).toContain('.button:hover {');
    expectOnlyRegionChanged(original, uss, span.start, span.end);
  });
});

describe('no edit at all', () => {
  it('touches nothing when dirty flags stay false', () => {
    const original = readUxml('comments.uxml');
    const doc = parse(original, readUss('values.uss'));
    const out = serialize(doc);
    expect(out.uxml).toBe(original);
    expect(out.uss).toBe(readUss('values.uss'));
  });
});
