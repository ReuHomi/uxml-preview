// @vitest-environment node

/**
 * Structural assertions on the parsed tree.
 *
 * The round-trip suite cannot catch a wrong tree: slicing the source reproduces
 * the file even if elements were nested wrongly, so long as the spans still
 * cover the text. These tests are what actually says the parse is right, and
 * they are what Phase 3 relies on when a selector fails to match.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from '../../src/index';
import type { ElementNode } from '../../src/model/types';

const DIR = fileURLToPath(new URL('../fixtures/uxml', import.meta.url));
const load = (name: string): ElementNode =>
  parse(readFileSync(join(DIR, name), 'utf8')).root;

const tag = (n: ElementNode): string =>
  n.name.prefix === null ? n.name.local : `${n.name.prefix}:${n.name.local}`;
const attr = (n: ElementNode, name: string): string | undefined =>
  n.attributes.find((a) => a.name === name)?.value;

describe('minimal.uxml', () => {
  const root = load('minimal.uxml');

  it('roots at ui:UXML with one Label child', () => {
    expect(tag(root)).toBe('ui:UXML');
    expect(root.children.map(tag)).toEqual(['ui:Label']);
    expect(attr(root.children[0]!, 'text')).toBe('Hello');
  });
});

describe('comments.uxml', () => {
  const root = load('comments.uxml');

  it('does not turn comments into elements', () => {
    expect(root.children.map(tag)).toEqual(['ui:VisualElement']);
    expect(root.children[0]!.children.map(tag)).toEqual(['ui:Label', 'ui:Label']);
  });

  it('keeps the labels distinguishable', () => {
    const labels = root.children[0]!.children;
    expect(labels.map((l) => attr(l, 'text'))).toEqual(['A', 'B']);
  });
});

describe('formatting.uxml', () => {
  const root = load('formatting.uxml');
  const container = root.children[0]!;

  it('preserves attribute order as written', () => {
    expect(container.attributes.map((a) => a.name)).toEqual([
      'class',
      'name',
      'picking-mode',
    ]);
  });

  it('reads single-quoted values', () => {
    expect(attr(container.children[0]!, 'text')).toBe('단일 따옴표로 감싼 값');
  });

  it('reads attributes split across lines', () => {
    const button = container.children[1]!;
    expect(tag(button)).toBe('ui:Button');
    expect(attr(button, 'class')).toBe('btn btn--primary');
    expect(attr(button, 'tooltip')).toBe('여러 줄에 걸친 속성');
  });

  it('distinguishes self-closing from an explicit end tag', () => {
    expect(container.children[0]!.spans.closeTag).toBeNull();
    expect(container.children[2]!.spans.closeTag).not.toBeNull();
    expect(container.children[2]!.children).toHaveLength(0);
  });
});

describe('unsupported.uxml', () => {
  const root = load('unsupported.uxml');

  it('keeps unknown elements in the tree with their prefixes', () => {
    expect(root.children.map(tag)).toEqual([
      'ui:Template',
      'ui:ScrollView',
      'custom:HealthBar',
      'ui:Instance',
    ]);
  });

  it('still parses supported controls nested inside unsupported ones', () => {
    const scroll = root.children[1]!;
    expect(scroll.children.map(tag)).toEqual(['ui:Label']);
  });
});

describe('entities.uxml', () => {
  const root = load('entities.uxml');
  const texts = root.children.map((c) => attr(c, 'text'));

  it('leaves entity references encoded', () => {
    // `&amp;` and `&#38;` both mean `&`. Decoding would make them
    // indistinguishable and the round trip would have to guess.
    expect(texts[0]).toBe('A &amp; B');
    expect(texts[1]).toBe('A &#38; B');
    expect(texts[2]).toBe('&lt;tag&gt; &quot;큰따옴표&quot; &apos;작은따옴표&apos;');
  });
});

describe('prologue.uxml', () => {
  const source = readFileSync(join(DIR, 'prologue.uxml'), 'utf8');
  const root = parse(source).root;

  it('starts the root span after the declaration and leading comment', () => {
    expect(source.slice(root.spans.openTag.start, root.spans.openTag.start + 8)).toBe(
      '<ui:UXML',
    );
    expect(source.slice(0, root.spans.openTag.start)).toContain('<?xml');
  });
});

describe('inline-style.uxml', () => {
  const root = load('inline-style.uxml');

  it('keeps the style attribute as raw text', () => {
    expect(attr(root.children[0]!, 'style')).toBe(
      'flex-direction: row; padding: 6px 14px;',
    );
    expect(attr(root.children[2]!, 'style')).toBe('  margin-top : 8px ;  ');
  });
});

describe('every fixture', () => {
  const names = [
    'minimal.uxml',
    'comments.uxml',
    'formatting.uxml',
    'unsupported.uxml',
    'entities.uxml',
    'prologue.uxml',
    'inline-style.uxml',
    'crlf.uxml',
  ];

  it('parses without warnings', () => {
    for (const name of names) {
      const doc = parse(readFileSync(join(DIR, name), 'utf8'));
      expect(doc.warnings, `${name}: ${JSON.stringify(doc.warnings)}`).toEqual([]);
    }
  });

  it('assigns every node a distinct id', () => {
    for (const name of names) {
      const seen = new Set<number>();
      const walk = (n: ElementNode): void => {
        expect(seen.has(n.id), `${name}: duplicate id ${n.id}`).toBe(false);
        seen.add(n.id);
        n.children.forEach(walk);
      };
      walk(load(name));
    }
  });
});
