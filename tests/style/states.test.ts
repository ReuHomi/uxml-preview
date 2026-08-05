// @vitest-environment node

/**
 * Pseudo-class states.
 *
 * States are explicit input, never mouse events. That is not a shortcut: a
 * render that depends on where the pointer happens to be cannot be compared to
 * Unity, or to its own output from a minute ago, and both comparisons are what
 * this library exists for.
 *
 * The interesting half is that states are *per element*. The screen S1 has to
 * reproduce puts a normal button next to a disabled one, so a single set for
 * the whole document cannot draw it at all.
 */

import { describe, it, expect } from 'vitest';

import { parse, resolveStyles, explainProperty } from '../../src/index';
import type { ResolveOptions } from '../../src/index';
import type { ElementNode, UxmlDocument } from '../../src/model/types';

function doc(body: string, uss = ''): UxmlDocument {
  return parse(`<ui:UXML xmlns:ui="UnityEngine.UIElements">${body}</ui:UXML>`, uss);
}

function byName(node: ElementNode, name: string): ElementNode {
  const hit = tryByName(node, name);
  if (hit === null) throw new Error(`no element named ${name}`);
  return hit;
}
function tryByName(node: ElementNode, name: string): ElementNode | null {
  if (node.attributes.some((a) => a.name === 'name' && a.value === name)) return node;
  for (const child of node.children) {
    const hit = tryByName(child, name);
    if (hit !== null) return hit;
  }
  return null;
}

function value(
  d: UxmlDocument,
  name: string,
  property: string,
  options?: ResolveOptions,
): string | undefined {
  return resolveStyles(d, options).styles.get(byName(d.root, name).id)?.get(property)?.value;
}

const TWO_BUTTONS =
  '<ui:Button name="use" text="Use" /><ui:Button name="drop" text="Drop" />';
const USS =
  'Button { color: black; }\n' +
  'Button:hover { color: blue; }\n' +
  'Button:disabled { color: grey; }\n';

describe('states are off unless asked for', () => {
  it('leaves a :hover rule unmatched by default', () => {
    expect(value(doc(TWO_BUTTONS, USS), 'use', 'color')).toBe('black');
  });
});

describe('per element', () => {
  /** The case the whole design exists for. */
  it('gives two buttons different states in one render', () => {
    const d = doc(TWO_BUTTONS, USS);
    const options = { states: { '#use': ['hover'], '#drop': ['disabled'] } };
    expect(value(d, 'use', 'color', options)).toBe('blue');
    expect(value(d, 'drop', 'color', options)).toBe('grey');
  });

  it('leaves elements no key matched alone', () => {
    const d = doc(TWO_BUTTONS, USS);
    expect(value(d, 'drop', 'color', { states: { '#use': ['hover'] } })).toBe('black');
  });

  it('accepts any USS selector as a key, not just #name', () => {
    const d = doc(
      '<ui:Button name="a" class="primary" text="A" /><ui:Button name="b" text="B" />',
      USS,
    );
    const options = { states: { '.primary': ['hover'] } };
    expect(value(d, 'a', 'color', options)).toBe('blue');
    expect(value(d, 'b', 'color', options)).toBe('black');
  });

  it('matches a key against the implicit control class too', () => {
    const d = doc(TWO_BUTTONS, USS);
    expect(value(d, 'use', 'color', { states: { '.unity-button': ['hover'] } })).toBe('blue');
  });

  it('unions the states when several keys hit the same element', () => {
    const d = doc(
      '<ui:Button name="a" class="primary" text="A" />',
      'Button:hover:disabled { color: purple; }',
    );
    const options = { states: { '#a': ['hover'], '.primary': ['disabled'] } };
    expect(value(d, 'a', 'color', options)).toBe('purple');
  });

  it('still honours activeStates as a document-wide switch', () => {
    const d = doc(TWO_BUTTONS, USS);
    const options = { activeStates: new Set(['hover']) };
    expect(value(d, 'use', 'color', options)).toBe('blue');
    expect(value(d, 'drop', 'color', options)).toBe('blue');
  });
});

describe('states on an ancestor', () => {
  it('are read from the ancestor, not the element', () => {
    const d = doc(
      '<ui:VisualElement name="panel"><ui:Label name="text" text="x" /></ui:VisualElement>',
      '#panel:hover #text { color: red; }',
    );
    expect(value(d, 'text', 'color', { states: { '#panel': ['hover'] } })).toBe('red');
    // Putting the state on the descendant must not satisfy an ancestor's :hover.
    expect(value(d, 'text', 'color', { states: { '#text': ['hover'] } })).toBeUndefined();
  });
});

describe('keys cannot switch themselves on', () => {
  /**
   * Keys are matched against the tree with no states active. Were they matched
   * against the result, `Button:hover` as a key would be true because it made
   * itself true, and the render would depend on its own output.
   */
  it('ignores a state pseudo-class inside a key', () => {
    const d = doc(TWO_BUTTONS, USS);
    expect(value(d, 'use', 'color', { states: { 'Button:hover': ['hover'] } })).toBe('black');
  });
});

describe('a key that is not a usable selector', () => {
  it('warns and is ignored, rather than throwing', () => {
    const d = doc(TWO_BUTTONS, USS);
    const { warnings } = resolveStyles(d, { states: { '#use + #drop': ['hover'] } });
    expect(warnings.some((w) => w.kind === 'unsupported-selector')).toBe(true);
    expect(value(d, 'drop', 'color', { states: { '#use + #drop': ['hover'] } })).toBe('black');
  });
});

describe('provenance', () => {
  it('records which states the winning rule needed', () => {
    const d = doc(TWO_BUTTONS, USS);
    const winner = explainProperty(d, byName(d.root, 'use'), 'color', {
      states: { '#use': ['hover'] },
    }).find((c) => c.winner)!;
    expect(winner.origin.kind).toBe('rule');
    if (winner.origin.kind === 'rule') expect(winner.origin.states).toEqual(['hover']);
  });

  it('says nothing about states when the rule is unconditional', () => {
    const d = doc(TWO_BUTTONS, USS);
    const winner = explainProperty(d, byName(d.root, 'use'), 'color').find((c) => c.winner)!;
    if (winner.origin.kind === 'rule') expect(winner.origin.states).toBeUndefined();
  });

  /**
   * `.a, .b:hover` reaching an element through `.a` is not conditional on
   * anything, and saying otherwise sends an editor to the wrong rule.
   *
   * Both cases below are needed. Asserting `['hover']` while the hover selector
   * is the one that won proves nothing — taking the states from the whole group
   * would give the same answer. These two are the ones that can tell them apart.
   */
  it('says nothing when the group mentions a state but the match did not use it', () => {
    const d = doc('<ui:Button name="a" class="plain" text="A" />', '.plain, Button:hover { color: green; }');
    const winner = explainProperty(d, byName(d.root, 'a'), 'color').find((c) => c.winner)!;
    if (winner.origin.kind === 'rule') expect(winner.origin.states).toBeUndefined();
  });

  it('says nothing when a stateless selector outranks the stateful one', () => {
    // `#a` is (1,0,0); `Button:hover` is (0,1,1) because a pseudo-class counts
    // as a class. The id wins even with hover active, so nothing is conditional.
    const d = doc('<ui:Button name="a" text="A" />', '#a, Button:hover { color: green; }');
    const winner = explainProperty(d, byName(d.root, 'a'), 'color', {
      states: { '#a': ['hover'] },
    }).find((c) => c.winner)!;
    if (winner.origin.kind === 'rule') expect(winner.origin.states).toBeUndefined();
  });

  it('reports the state when the stateful selector is the one that won', () => {
    const d = doc('<ui:Button name="a" class="plain" text="A" />', '.plain, Button:hover { color: green; }');
    const winner = explainProperty(d, byName(d.root, 'a'), 'color', {
      states: { '#a': ['hover'] },
    }).find((c) => c.winner)!;
    if (winner.origin.kind === 'rule') expect(winner.origin.states).toEqual(['hover']);
  });
});
