// @vitest-environment node

/**
 * The cascade.
 *
 * Written against small inline documents rather than fixtures: a precedence
 * question is easier to read when the two competing rules sit next to each
 * other. Fixture-scale behaviour is covered by tests/structure.
 */

import { describe, it, expect } from 'vitest';

import { parse, resolveStyles, explainProperty } from '../../src/index';
import type { ElementNode, UxmlDocument } from '../../src/model/types';

function doc(body: string, uss: string): UxmlDocument {
  return parse(`<ui:UXML xmlns:ui="UnityEngine.UIElements">${body}</ui:UXML>`, uss);
}

function byName(node: ElementNode, name: string): ElementNode {
  if (node.attributes.some((a) => a.name === 'name' && a.value === name)) return node;
  for (const child of node.children) {
    try {
      return byName(child, name);
    } catch {
      /* keep looking */
    }
  }
  throw new Error(`no element named ${name}`);
}

/** Winning value of one property on the named element. */
function value(d: UxmlDocument, name: string, property: string): string | undefined {
  const node = byName(d.root, name);
  return resolveStyles(d).styles.get(node.id)?.get(property)?.value;
}

const ONE = '<ui:Label name="a" class="x y" text="t" />';

describe('specificity', () => {
  it('a name beats a class', () => {
    expect(value(doc(ONE, '.x { color: red; } #a { color: blue; }'), 'a', 'color')).toBe('blue');
  });

  it('a name beats a class even when the class comes later', () => {
    expect(value(doc(ONE, '#a { color: blue; } .x { color: red; }'), 'a', 'color')).toBe('blue');
  });

  it('a class beats a type', () => {
    expect(value(doc(ONE, 'Label { color: red; } .x { color: blue; }'), 'a', 'color')).toBe('blue');
  });

  it('a class beats a type regardless of order', () => {
    expect(value(doc(ONE, '.x { color: blue; } Label { color: red; }'), 'a', 'color')).toBe('blue');
  });

  it('a type beats the universal selector', () => {
    expect(value(doc(ONE, 'Label { color: blue; } * { color: red; }'), 'a', 'color')).toBe('blue');
  });

  it('two classes beat one', () => {
    expect(value(doc(ONE, '.x.y { color: blue; } .x { color: red; }'), 'a', 'color')).toBe('blue');
  });

  it('a pseudo-class counts toward specificity like a class', () => {
    const d = doc(ONE, 'Label { color: red; } Label:hover { color: blue; }');
    const node = byName(d.root, 'a');
    const styles = resolveStyles(d, { activeStates: new Set(['hover']) }).styles;
    expect(styles.get(node.id)?.get('color')?.value).toBe('blue');
  });

  it('an inactive pseudo-class does not match at all', () => {
    expect(
      value(doc(ONE, 'Label { color: red; } Label:hover { color: blue; }'), 'a', 'color'),
    ).toBe('red');
  });

  it('scores a comma group by its most specific matching selector', () => {
    // CSS Cascade: when a selector list matches, the rule takes the specificity
    // of the *most specific* selector that matched, not the first one in source
    // order. Here `.a` matches first at (0,1,0) but `#b` also matches at
    // (1,0,0), which has to beat `.c` in the later rule.
    const d = doc(
      '<ui:VisualElement name="b" class="a c" />',
      '.a, #b { color: red; }\n.c { color: blue; }',
    );
    expect(value(d, 'b', 'color')).toBe('red');
  });

  it('still scores by the matching selector, not the most specific in the group', () => {
    // The mirror of the above: `#zzz` is more specific but does not match, so
    // it must not lend its score to the rule.
    const d = doc(
      '<ui:VisualElement name="b" class="a" />',
      '.a, #zzz { color: red; }\n.a.x, #b { color: blue; }',
    );
    expect(value(d, 'b', 'color')).toBe('blue');
  });

  it('a descendant selector adds the ancestor to the score', () => {
    const d = doc(
      '<ui:VisualElement class="p"><ui:Label name="a" class="x" /></ui:VisualElement>',
      '.x { color: red; } .p .x { color: blue; }',
    );
    expect(value(d, 'a', 'color')).toBe('blue');
  });
});

describe('source order', () => {
  it('the later rule wins a tie', () => {
    expect(value(doc(ONE, '.x { color: red; } .y { color: blue; }'), 'a', 'color')).toBe('blue');
  });

  it('the later rule wins a tie the other way round too', () => {
    expect(value(doc(ONE, '.y { color: blue; } .x { color: red; }'), 'a', 'color')).toBe('red');
  });

  it('a later declaration inside the same rule wins', () => {
    expect(value(doc(ONE, '.x { color: red; color: blue; }'), 'a', 'color')).toBe('blue');
  });

  it('does not let source order override specificity', () => {
    expect(value(doc(ONE, '#a { color: blue; } * { color: red; }'), 'a', 'color')).toBe('blue');
  });
});

describe('inline styles', () => {
  const inline = '<ui:Label name="a" class="x" style="color: green;" />';

  it('beat every selector', () => {
    expect(value(doc(inline, '#a { color: blue; }'), 'a', 'color')).toBe('green');
  });

  it('only override the properties they name', () => {
    const d = doc(inline, '#a { color: blue; font-size: 12px; }');
    expect(value(d, 'a', 'font-size')).toBe('12px');
  });

  it('are reported as coming from the element', () => {
    const d = doc(inline, '#a { color: blue; }');
    const node = byName(d.root, 'a');
    expect(resolveStyles(d).styles.get(node.id)?.get('color')?.origin).toEqual({
      kind: 'inline',
      node: node.id,
      declIndex: 0,
    });
  });
});

describe('selector kinds', () => {
  const tree =
    '<ui:VisualElement name="p" class="panel">' +
    '<ui:VisualElement name="mid"><ui:Label name="deep" class="t" /></ui:VisualElement>' +
    '</ui:VisualElement>';

  it('matches a child combinator only one level down', () => {
    expect(value(doc(tree, '.panel > .t { color: red; }'), 'deep', 'color')).toBeUndefined();
  });

  it('matches a child combinator at the right level', () => {
    expect(value(doc(tree, '#mid > .t { color: red; }'), 'deep', 'color')).toBe('red');
  });

  it('matches a descendant at any depth', () => {
    expect(value(doc(tree, '.panel .t { color: red; }'), 'deep', 'color')).toBe('red');
  });

  it('backtracks across repeated ancestors', () => {
    const nested =
      '<ui:VisualElement class="a"><ui:VisualElement class="b">' +
      '<ui:VisualElement class="a"><ui:Label name="deep" class="b" /></ui:VisualElement>' +
      '</ui:VisualElement></ui:VisualElement>';
    expect(value(doc(nested, '.a .b .a .b { color: red; }'), 'deep', 'color')).toBe('red');
  });

  it('is case-sensitive on type selectors', () => {
    expect(value(doc(ONE, 'label { color: red; }'), 'a', 'color')).toBeUndefined();
  });

  it('matches a name selector against the name attribute, not an id', () => {
    expect(value(doc(ONE, '#a { color: red; }'), 'a', 'color')).toBe('red');
  });
});

describe('unsupported selectors', () => {
  const d = doc(ONE, '.x { color: red; } .x:nth-child(2) { color: blue; }');

  it('ignore the whole rule', () => {
    expect(value(d, 'a', 'color')).toBe('red');
  });

  it('warn once, naming the fragment', () => {
    const { warnings } = resolveStyles(d);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.kind).toBe('unsupported-selector');
    expect(warnings[0]!.message).toContain(':nth-child(2)');
  });

  it('treat a sibling combinator the same way', () => {
    const sibling = doc(ONE, '.x + .y { color: blue; }');
    expect(resolveStyles(sibling).warnings[0]!.message).toContain('"+"');
  });
});

describe('inheritance', () => {
  const tree = '<ui:VisualElement name="p"><ui:Label name="c" text="t" /></ui:VisualElement>';

  it('passes an inherited property down', () => {
    expect(value(doc(tree, '#p { color: red; }'), 'c', 'color')).toBe('red');
  });

  it('does not pass down a property that does not inherit', () => {
    expect(value(doc(tree, '#p { width: 10px; }'), 'c', 'width')).toBeUndefined();
  });

  it('lets any direct match beat an inherited value, even a weaker one', () => {
    // The parent is targeted by #p and the child only by `*`, but the child's
    // own declaration still wins: inheritance is a lower tier, not a score.
    const d = doc(tree, '#p { color: red; } * { color: blue; }');
    expect(value(d, 'c', 'color')).toBe('blue');
  });

  it('records where an inherited value came from', () => {
    const d = doc(tree, '#p { color: red; }');
    const child = byName(d.root, 'c');
    const origin = resolveStyles(d).styles.get(child.id)?.get('color')?.origin;
    expect(origin?.kind).toBe('inherited');
  });
});

describe('shorthands', () => {
  it('expand into longhands', () => {
    const d = doc(ONE, '.x { padding: 6px 14px; }');
    expect(value(d, 'a', 'padding-top')).toBe('6px');
    expect(value(d, 'a', 'padding-right')).toBe('14px');
    expect(value(d, 'a', 'padding-bottom')).toBe('6px');
    expect(value(d, 'a', 'padding-left')).toBe('14px');
  });

  it('let a longhand written later override part of a shorthand', () => {
    const d = doc(ONE, '.x { padding: 6px; padding-top: 2px; }');
    expect(value(d, 'a', 'padding-top')).toBe('2px');
    expect(value(d, 'a', 'padding-bottom')).toBe('6px');
  });

  it('let a shorthand written later override a longhand', () => {
    const d = doc(ONE, '.x { padding-top: 2px; padding: 6px; }');
    expect(value(d, 'a', 'padding-top')).toBe('6px');
  });

  it('run border-radius clockwise from the top-left', () => {
    const d = doc(ONE, '.x { border-radius: 1px 2px 3px 4px; }');
    expect(value(d, 'a', 'border-top-left-radius')).toBe('1px');
    expect(value(d, 'a', 'border-top-right-radius')).toBe('2px');
    expect(value(d, 'a', 'border-bottom-right-radius')).toBe('3px');
    expect(value(d, 'a', 'border-bottom-left-radius')).toBe('4px');
  });

  it('expand flex with a single number', () => {
    const d = doc(ONE, '.x { flex: 1; }');
    expect(value(d, 'a', 'flex-grow')).toBe('1');
    expect(value(d, 'a', 'flex-shrink')).toBe('1');
    expect(value(d, 'a', 'flex-basis')).toBe('0');
  });

  it('keep a value with parentheses in one piece', () => {
    const d = doc(ONE, '.x { border-color: rgb(1, 2, 3); }');
    expect(value(d, 'a', 'border-top-color')).toBe('rgb(1, 2, 3)');
  });
});

describe('custom properties', () => {
  const tree = '<ui:VisualElement name="p"><ui:Label name="c" text="t" /></ui:VisualElement>';

  it('resolve var() against an inherited token', () => {
    const d = doc(tree, '#p { --accent: rgb(1, 2, 3); } #c { color: var(--accent); }');
    expect(value(d, 'c', 'color')).toBe('rgb(1, 2, 3)');
  });

  it('resolve var() declared on the same element', () => {
    const d = doc(ONE, '.x { --c: red; color: var(--c); }');
    expect(value(d, 'a', 'color')).toBe('red');
  });

  it('use the fallback when the token is missing', () => {
    expect(value(doc(ONE, '.x { color: var(--nope, green); }'), 'a', 'color')).toBe('green');
  });

  it('drop the declaration when nothing can satisfy it', () => {
    const d = doc(ONE, '.x { color: var(--nope); }');
    expect(value(d, 'a', 'color')).toBeUndefined();
    expect(resolveStyles(d).warnings.some((w) => w.message.includes('var()'))).toBe(true);
  });

  it('survive a reference cycle instead of hanging', () => {
    const d = doc(ONE, '.x { --a: var(--b); --b: var(--a); color: var(--a); }');
    expect(value(d, 'a', 'color')).toBeUndefined();
  });

  it('resolves a var() nested inside a fallback', () => {
    // VAR_PATTERN's fallback group is `[^)]*`, so it cannot span the inner
    // `var(...)` in one pass — the substitution loop gets there on a second
    // iteration instead. Pinned here because it currently works by arithmetic
    // rather than by the pattern being right.
    const d = doc(ONE, '.x { --b: green; color: var(--a, var(--b)); }');
    expect(value(d, 'a', 'color')).toBe('green');
  });

  it('resolves a nested fallback chain down to the last one', () => {
    const d = doc(ONE, '.x { color: var(--a, var(--b, red)); }');
    expect(value(d, 'a', 'color')).toBe('red');
  });

  it('resolve a token that refers to another token', () => {
    const d = doc(ONE, '.x { --base: red; --fg: var(--base); color: var(--fg); }');
    expect(value(d, 'a', 'color')).toBe('red');
  });

  it('let :root tokens reach the whole tree', () => {
    const d = doc(tree, ':root { --accent: blue; } #c { color: var(--accent); }');
    expect(value(d, 'c', 'color')).toBe('blue');
  });

  it('warn that :root semantics are version-dependent', () => {
    const d = doc(tree, ':root { --accent: blue; }');
    expect(resolveStyles(d).warnings.some((w) => w.kind === 'version-dependent')).toBe(true);
  });
});

describe('explainProperty', () => {
  const d = doc(
    '<ui:Label name="a" class="x" style="color: green;" />',
    '* { color: grey; } .x { color: red; } #a { color: blue; }',
  );
  const node = byName(d.root, 'a');
  const candidates = explainProperty(d, node, 'color');

  it('lists every declaration that competed', () => {
    expect(candidates.map((c) => c.value)).toEqual(['grey', 'red', 'blue', 'green']);
  });

  it('marks exactly one winner', () => {
    expect(candidates.filter((c) => c.winner)).toHaveLength(1);
  });

  it('agrees with resolveStyles about which one won', () => {
    const winner = candidates.find((c) => c.winner)!;
    expect(winner.value).toBe(resolveStyles(d).styles.get(node.id)!.get('color')!.value);
  });

  it('points each candidate at the declaration it came from', () => {
    expect(candidates.map((c) => c.origin.kind)).toEqual(['rule', 'rule', 'rule', 'inline']);
  });

  it('returns nothing for a property nobody set', () => {
    expect(explainProperty(d, node, 'width')).toEqual([]);
  });
});

describe('@import', () => {
  it('places imported rules before the importing sheet', () => {
    const d = parse(
      '<ui:UXML xmlns:ui="UnityEngine.UIElements"><ui:Label name="a" class="x" /></ui:UXML>',
      '@import url("base.uss");\n.x { color: red; }',
      { resolveImport: () => '.x { color: blue; }' },
    );
    const node = byName(d.root, 'a');
    // Same specificity, so the importing sheet's own rule is the later one.
    expect(resolveStyles(d).styles.get(node.id)?.get('color')?.value).toBe('red');
  });

  it('still applies an imported rule nothing else overrides', () => {
    const d = parse(
      '<ui:UXML xmlns:ui="UnityEngine.UIElements"><ui:Label name="a" class="x" /></ui:UXML>',
      '@import url("base.uss");',
      { resolveImport: () => '.x { color: blue; }' },
    );
    const node = byName(d.root, 'a');
    expect(resolveStyles(d).styles.get(node.id)?.get('color')?.value).toBe('blue');
  });
});
