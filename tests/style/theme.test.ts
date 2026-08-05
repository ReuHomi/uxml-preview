// @vitest-environment node

/**
 * Unity's control defaults.
 *
 * These exist because the first Button ever compared against Unity missed by
 * 3px horizontally and 1px vertically, on every one of five cases. Unity ships
 * a theme stylesheet; this renderer shipped none, and the gap was invisible
 * until a control other than VisualElement was measured.
 *
 * The tests below fix the two things that could silently go wrong: which
 * elements the defaults reach, and where they sit in the cascade.
 */

import { describe, it, expect } from 'vitest';

import { parse, resolveStyles, explainProperty } from '../../src/index';
import type { ElementNode, UxmlDocument } from '../../src/model/types';
import { THEME_UNITY_VERSION } from '../../src/controls/theme';

function doc(body: string, uss = ''): UxmlDocument {
  return parse(`<ui:UXML xmlns:ui="UnityEngine.UIElements">${body}</ui:UXML>`, uss);
}

function byName(node: ElementNode, name: string): ElementNode {
  if (node.attributes.some((a) => a.name === 'name' && a.value === name)) return node;
  for (const child of node.children) {
    const hit = tryByName(child, name);
    if (hit !== null) return hit;
  }
  throw new Error(`no element named ${name}`);
}
function tryByName(node: ElementNode, name: string): ElementNode | null {
  if (node.attributes.some((a) => a.name === 'name' && a.value === name)) return node;
  for (const child of node.children) {
    const hit = tryByName(child, name);
    if (hit !== null) return hit;
  }
  return null;
}

function value(d: UxmlDocument, name: string, property: string): string | undefined {
  return resolveStyles(d).styles.get(byName(d.root, name).id)?.get(property)?.value;
}

describe('which elements the defaults reach', () => {
  it('gives Button the margin measured in Unity', () => {
    const d = doc('<ui:Button name="b" text="OK" />');
    expect(value(d, 'b', 'margin-left')).toBe('3px');
    expect(value(d, 'b', 'margin-right')).toBe('3px');
    expect(value(d, 'b', 'margin-top')).toBe('1px');
    expect(value(d, 'b', 'margin-bottom')).toBe('1px');
  });

  // Measured, not assumed: `inherit-vs-direct` puts an explicitly-sized Label at
  // the origin of a sized parent and Unity reports x=0, y=0.
  it('gives Label nothing, because Unity gives Label nothing', () => {
    const d = doc('<ui:Label name="l" text="hi" />');
    expect(value(d, 'l', 'margin-left')).toBeUndefined();
  });

  it('gives VisualElement nothing', () => {
    const d = doc('<ui:VisualElement name="v" />');
    expect(value(d, 'v', 'margin-left')).toBeUndefined();
  });

  // A fallback box is not the control it stands in for. Styling it as one would
  // be guessing at defaults we have never measured.
  it('gives a control with no renderer nothing', () => {
    const d = doc('<ui:Foldout name="s" />');
    expect(value(d, 's', 'margin-left')).toBeUndefined();
  });
});

describe('where the defaults sit in the cascade', () => {
  it('loses to an author rule of equal specificity, because it comes first', () => {
    const d = doc('<ui:Button name="b" text="OK" />', '.unity-button { margin-left: 20px; }');
    expect(value(d, 'b', 'margin-left')).toBe('20px');
  });

  it('loses to anything more specific', () => {
    const d = doc('<ui:Button name="b" text="OK" />', '#b { margin-left: 20px; }');
    expect(value(d, 'b', 'margin-left')).toBe('20px');
  });

  /**
   * This test used to assert the opposite, on the theory that the theme's
   * `.unity-button` (0,1,0) outranks an author's type selector (0,0,1) and that
   * reproducing the resulting gotcha was a feature. **Unity refuted it.** The
   * `states-disabled` case writes `Button { margin: 0 }` and Unity puts the
   * button at x=0, so the author's type rule won.
   *
   * Control defaults are a lower *origin*, like a browser's user-agent sheet,
   * not merely a sheet that loaded first — so specificity never enters into it.
   * See the 2026-08-06 rows in docs/progress.md.
   */
  it('loses to an author type selector, however specific the theme rule is', () => {
    const d = doc('<ui:Button name="b" text="OK" />', 'Button { margin-left: 20px; }');
    expect(value(d, 'b', 'margin-left')).toBe('20px');
  });

  it('loses to a universal selector too, which is as weak as USS gets', () => {
    const d = doc('<ui:Button name="b" text="OK" />', '* { margin-left: 7px; }');
    expect(value(d, 'b', 'margin-left')).toBe('7px');
  });

  it('lets an implicit class be targeted from author USS', () => {
    const d = doc('<ui:Button name="b" text="OK" />', '.unity-button { color: red; }');
    expect(value(d, 'b', 'color')).toBe('red');
  });

  it('does not put the implicit class on a control that has no renderer', () => {
    const d = doc('<ui:Foldout name="s" />', '.unity-button { color: red; }');
    expect(value(d, 's', 'color')).toBeUndefined();
  });

  it('gives Image its own class, and not another control class', () => {
    const d = doc('<ui:Image name="i" />', '.unity-image { color: red; }');
    expect(value(d, 'i', 'color')).toBe('red');
    expect(value(doc('<ui:Image name="i" />', '.unity-button { color: red; }'), 'i', 'color'))
      .toBeUndefined();
  });
});

describe('provenance', () => {
  it('marks the value as built-in, with no file to jump to', () => {
    const d = doc('<ui:Button name="b" text="OK" />');
    const winner = explainProperty(d, byName(d.root, 'b'), 'margin-left').find((c) => c.winner)!;
    expect(winner.origin.kind).toBe('builtin-theme');
    // An editor must be able to see there is nowhere to go. A `rule` origin with
    // an invented sheet index would send it to a file that does not exist.
    expect(winner.origin).not.toHaveProperty('sheet');
    if (winner.origin.kind === 'builtin-theme') {
      expect(winner.origin.selector).toBe('.unity-button');
      expect(winner.origin.unityVersion).toBe(THEME_UNITY_VERSION);
    }
  });

  it('still reports the author rule as the winner when one exists', () => {
    const d = doc('<ui:Button name="b" text="OK" />', '#b { margin-left: 20px; }');
    const winner = explainProperty(d, byName(d.root, 'b'), 'margin-left').find((c) => c.winner)!;
    expect(winner.origin.kind).toBe('rule');
  });
});

describe('the version warning', () => {
  it('is raised when a default actually applies', () => {
    const { warnings } = resolveStyles(doc('<ui:Button name="b" text="OK" />'));
    const themed = warnings.filter((w) => w.message.includes(THEME_UNITY_VERSION));
    expect(themed).toHaveLength(1);
    expect(themed[0]!.kind).toBe('version-dependent');
  });

  // Announcing the theme on a document it never touched is a warning about
  // something that did not happen, and noise is what stops warnings being read.
  it('is silent on a document with no Button', () => {
    const { warnings } = resolveStyles(doc('<ui:VisualElement name="v" />'));
    expect(warnings.filter((w) => w.message.includes(THEME_UNITY_VERSION))).toHaveLength(0);
  });

  it('is raised once, not once per element', () => {
    const { warnings } = resolveStyles(
      doc('<ui:Button name="a" text="A" /><ui:Button name="b" text="B" />'),
    );
    expect(warnings.filter((w) => w.message.includes(THEME_UNITY_VERSION))).toHaveLength(1);
  });
});

/**
 * Control parts in the cascade.
 *
 * A ScrollView is one tag that becomes four elements, and the three it adds are
 * where a real project puts its grid rules. Those rules had nowhere to land
 * until parts were resolved alongside elements, and the representative screen
 * lost 56 of its 70 wrong values the moment they did.
 */
describe('parts', () => {
  const SV = '<ui:ScrollView name="sv"><ui:VisualElement name="kid" /></ui:ScrollView>';

  function partValue(d: UxmlDocument, owner: string, part: string, property: string): string | undefined {
    const resolved = resolveStyles(d);
    return resolved.partStyles.get(byName(d.root, owner).id)?.get(part)?.get(property)?.value;
  }

  it('lets author USS reach a part by name', () => {
    const d = doc(SV, '#unity-content-container { flex-direction: row; }');
    expect(partValue(d, 'sv', 'unity-content-container', 'flex-direction')).toBe('row');
  });

  // The part's own declarations are control defaults, so they sit at the theme
  // rank and an author rule overrides them — the same rule as the Button margin.
  it('lets an author rule override what the control fixed', () => {
    expect(partValue(doc(SV), 'sv', 'unity-content-container', 'flex-shrink')).toBe('0');
    const d = doc(SV, '#unity-content-container { flex-shrink: 1; }');
    expect(partValue(d, 'sv', 'unity-content-container', 'flex-shrink')).toBe('1');
  });

  it('reaches a part through a descendant selector', () => {
    const d = doc(
      `<ui:VisualElement name="panel" class="panel">${SV}</ui:VisualElement>`,
      '.panel #unity-content-viewport { opacity: 0.5; }',
    );
    expect(partValue(d, 'sv', 'unity-content-viewport', 'opacity')).toBe('0.5');
  });

  /**
   * Measured, and it is why the cascade was not simply moved onto the visual
   * tree. A slot inside a ScrollView is physically inside the content container,
   * yet `#sv > .kid` reaches it in Unity — so an element from the file keeps its
   * file parent, and parts are transparent to it.
   */
  it('keeps a file element a child of its file parent, not of a part', () => {
    const d = doc(SV, '#sv > #kid { width: 99px; }');
    expect(value(d, 'kid', 'width')).toBe('99px');
  });

  it('inherits through the parts, so children of a ScrollView still inherit', () => {
    const d = doc(SV, '#sv { color: red; }');
    expect(partValue(d, 'sv', 'unity-content-container', 'color')).toBe('red');
    expect(value(d, 'kid', 'color')).toBe('red');
  });

  it('gives a control with no parts none', () => {
    expect(resolveStyles(doc('<ui:Button name="b" text="x" />')).partStyles.size).toBe(0);
  });
});

describe('the unreachable part-selector warning', () => {
  const unity = (uxml: string, uss: string): string[] =>
    resolveStyles(doc(uxml, uss))
      .warnings.filter((w) => w.kind === 'unsupported-selector')
      .map((w) => w.message);

  // Root A fixed this for controls that have parts. Controls drawn as plain
  // boxes still have none, so `#unity-text-input` goes on doing nothing — the
  // same silent failure in a different control, which rule 6 forbids.
  it('fires for a part name no control in the document builds', () => {
    const messages = unity('<ui:TextField name="t" />', '#unity-text-input { width: 40px; }');
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('#unity-text-input');
    // Says why, not just that: the control is drawn as a plain box.
    expect(messages[0]).toContain('plain box');
  });

  it('says nothing when the part is really there', () => {
    expect(unity('<ui:ScrollView name="s" />', '#unity-content-container { width: 40px; }'))
      .toHaveLength(0);
  });

  it('ignores ordinary selectors that happen to match nothing', () => {
    expect(unity('<ui:VisualElement name="a" />', '#nonexistent { width: 40px; }')).toHaveLength(0);
  });

  it('covers unity- classes too, not just names', () => {
    const messages = unity(
      '<ui:VisualElement name="a" />',
      '.unity-scroll-view__content-container { width: 40px; }',
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('.unity-scroll-view__content-container');
  });
});
