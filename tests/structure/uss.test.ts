// @vitest-environment node

/**
 * Structural assertions on the parsed stylesheet.
 *
 * As with the UXML side, the round-trip suite would pass even if selectors were
 * split wrongly. Phase 3 matches against these shapes, so a mistake here shows
 * up there as "the cascade is wrong" and costs a day to trace back.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from '../../src/index';
import type { Rule, SimpleSelector, StyleSheet } from '../../src/model/types';

const DIR = fileURLToPath(new URL('../fixtures/uss', import.meta.url));
const HOST = '<ui:UXML xmlns:ui="UnityEngine.UIElements" />\n';

function load(name: string): StyleSheet {
  const doc = parse(HOST, readFileSync(join(DIR, name), 'utf8'));
  return doc.sheets[0]!;
}

function rules(sheet: StyleSheet): Rule[] {
  return sheet.items.flatMap((i) => (i.kind === 'rule' ? [i.rule] : []));
}

/** Every simple selector in a rule, flattened. */
function simples(rule: Rule): SimpleSelector[] {
  return rule.selectors.flatMap((s) => s.parts.flatMap((p) => p.simple));
}

describe('minimal.uss', () => {
  const sheet = load('minimal.uss');

  it('has one rule with one class selector', () => {
    expect(sheet.items).toHaveLength(1);
    const [rule] = rules(sheet);
    expect(simples(rule!)).toEqual([{ kind: 'class', name: 'panel' }]);
  });

  it('keeps the declaration value raw', () => {
    expect(rules(sheet)[0]!.declarations).toEqual([
      expect.objectContaining({ property: 'background-color', value: 'rgb(40, 42, 48)' }),
    ]);
  });
});

describe('comments.uss', () => {
  const sheet = load('comments.uss');

  it('does not turn comments into items', () => {
    expect(sheet.items).toHaveLength(2);
    expect(rules(sheet).map((r) => r.declarations.length)).toEqual([2, 1]);
  });
});

describe('selectors.uss', () => {
  const all = rules(load('selectors.uss'));
  const byIndex = (i: number): Rule => all[i]!;

  it('reads the simple kinds', () => {
    expect(simples(byIndex(0))).toEqual([{ kind: 'universal' }]);
    expect(simples(byIndex(1))).toEqual([{ kind: 'type', name: 'Label' }]);
    expect(simples(byIndex(5))).toEqual([{ kind: 'name', name: 'header' }]);
  });

  it('splits a descendant selector into two parts', () => {
    const [selector] = byIndex(2).selectors;
    expect(selector!.parts).toEqual([
      { combinator: 'descendant', simple: [{ kind: 'type', name: 'VisualElement' }] },
      { combinator: 'descendant', simple: [{ kind: 'type', name: 'Button' }] },
    ]);
  });

  it('marks the child combinator', () => {
    const [selector] = byIndex(3).selectors;
    expect(selector!.parts.map((p) => p.combinator)).toEqual(['descendant', 'child']);
  });

  it('keeps a compound selector as one part', () => {
    const [selector] = byIndex(4).selectors;
    expect(selector!.parts).toHaveLength(1);
    expect(selector!.parts[0]!.simple).toHaveLength(3);
  });

  it('reads a pseudo-class alongside a class', () => {
    expect(simples(byIndex(6))).toEqual([
      { kind: 'class', name: 'btn' },
      { kind: 'pseudo', name: 'hover' },
    ]);
  });

  it('splits a comma group into separate selectors', () => {
    expect(byIndex(7).selectors).toHaveLength(2);
    expect(simples(byIndex(7))).toEqual([
      { kind: 'type', name: 'Button' },
      { kind: 'pseudo', name: 'active' },
      { kind: 'class', name: 'btn' },
      { kind: 'class', name: 'primary' },
      { kind: 'pseudo', name: 'focus' },
    ]);
  });

  it('treats :root as an ordinary pseudo-class', () => {
    expect(simples(byIndex(8))).toEqual([{ kind: 'pseudo', name: 'root' }]);
  });
});

describe('unsupported.uss', () => {
  const sheet = load('unsupported.uss');

  it('flags every unsupported selector so the resolver can drop the rule', () => {
    const texts = rules(sheet).map(
      (r) => simples(r).find((s) => s.kind === 'unknown')?.text,
    );
    expect(texts).toEqual([':nth-child(2)', '+', '~', '[readonly="true"]', '::before']);
  });

  it('keeps @media whole and never looks inside it', () => {
    const media = sheet.items.at(-1)!;
    expect(media.kind).toBe('unknown');
    expect(rules(sheet)).toHaveLength(5);
  });
});

describe('values.uss', () => {
  const all = rules(load('values.uss'));

  it('does not expand shorthands', () => {
    expect(all[0]!.declarations.map((d) => [d.property, d.value])).toEqual([
      ['padding', '6px 14px'],
      ['margin', '0'],
      ['border-top-width', '1px'],
    ]);
  });

  it('reads a final declaration that has no semicolon', () => {
    const last = all[0]!.declarations.at(-1)!;
    expect(last.value).toBe('1px');
    // The span stops at the value, so the missing `;` is not the parser's problem.
    expect(load('values.uss').source[last.span.end]).toBe('\n');
  });

  it('keeps custom properties as ordinary declarations', () => {
    expect(all[1]!.declarations.map((d) => d.property)).toEqual([
      '--gap',
      'margin-top',
      'color',
    ]);
  });

  it('keeps a value that spans lines intact', () => {
    const transition = all[2]!.declarations[0]!;
    expect(transition.value).toContain('\n');
    expect(transition.value).toContain('translate 200ms ease-in-out');
  });

  it('reads several declarations on one line', () => {
    expect(all[3]!.declarations.map((d) => d.property)).toEqual(['flex-grow', 'flex-shrink']);
  });
});

describe('import.uss', () => {
  const sheet = load('import.uss');

  it('extracts the imported paths', () => {
    const imports = sheet.items.flatMap((i) => (i.kind === 'import' ? [i.url] : []));
    expect(imports).toEqual([
      'project://database/Assets/UI/base.uss',
      'theme.uss',
    ]);
  });

  it('warns for each import when no loader was supplied', () => {
    const doc = parse(HOST, readFileSync(join(DIR, 'import.uss'), 'utf8'));
    expect(doc.warnings.map((w) => w.kind)).toEqual([
      'import-unresolved',
      'import-unresolved',
    ]);
  });

  it('pulls the imported sheet in when a loader is supplied', () => {
    const doc = parse(HOST, readFileSync(join(DIR, 'import.uss'), 'utf8'), {
      resolveImport: (url) => (url === 'theme.uss' ? '.imported { color: rgb(1, 2, 3); }' : null),
    });
    expect(doc.sheets).toHaveLength(2);
    expect(doc.sheets[1]!.origin).toBe('theme.uss');
    expect(doc.warnings.map((w) => w.kind)).toEqual(['import-unresolved']);
  });
});

describe('every fixture', () => {
  // import.uss is excluded on purpose: it warns because no loader is supplied,
  // which is covered above.
  const names = [
    'minimal.uss',
    'comments.uss',
    'selectors.uss',
    'unsupported.uss',
    'values.uss',
    'crlf.uss',
  ];

  it('parses without warnings', () => {
    for (const name of names) {
      const doc = parse(HOST, readFileSync(join(DIR, name), 'utf8'));
      expect(doc.warnings, `${name}: ${JSON.stringify(doc.warnings)}`).toEqual([]);
    }
  });
});
