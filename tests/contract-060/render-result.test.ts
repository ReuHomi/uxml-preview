/**
 * 0.6.0 bundle 1 — what render() hands back, and the visibility judgement
 * moved into the core.
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Where the expected values come from:
 *
 *   - `styles`/`document`: the contract is "the same cascade render() drew
 *     with", so the reference is resolveStyles() called on that document with
 *     the same options — the second call uxml-author 0.2.1 makes today, and
 *     guards with its `cascadeMismatch` check. Exposing it removes both.
 *   - classifyVisibility: uxml-author's section I fixtures, verbatim, and the
 *     verdicts that section asserts (github.com/ReuHomi/uxml-author, master,
 *     tests/conditions.mjs). The skill's own policies — skipping unnamed
 *     nodes and controls drawn as fallbacks — stay in the skill; the core
 *     classifies every laid-out node.
 *   - Every new RenderResult field is optional in the type (decision,
 *     2026-10-16: no breaking change in 0.6.0), but render() always fills it.
 */

import { beforeAll, describe, expect, it } from 'vitest';

import { classifyVisibility, loadLayoutEngine, parse, render, resolveStyles } from '../../src/index';
import type { ElementNode, MeasureText, NodeId, RenderOptions, RenderResult, UxmlDocument } from '../../src/index';

beforeAll(async () => {
  await loadLayoutEngine();
});

const PANEL = { width: 400, height: 300 };
const fixedText: MeasureText = (text, ctx) => ({ width: text.length * 6, height: ctx.fontSize });

function draw(doc: UxmlDocument, extra: Partial<RenderOptions> = {}): RenderResult {
  return render(doc, document.createElement('div'), { size: PANEL, measureText: fixedText, ...extra });
}

/** name -> id over the tree render() laid out. Names are unique in these fixtures except where noted. */
function byName(root: ElementNode): Map<string, NodeId[]> {
  const out = new Map<string, NodeId[]>();
  const walk = (n: ElementNode): void => {
    const name = n.attributes.find((a) => a.name === 'name')?.value;
    if (name !== undefined) out.set(name, [...(out.get(name) ?? []), n.id]);
    n.children.forEach(walk);
  };
  walk(root);
  return out;
}

describe('RenderResult exposes the cascade it drew with', () => {
  const uxml = `<ui:UXML xmlns:ui="UnityEngine.UIElements">
    <ui:Template name="T" src="T.uxml" />
    <ui:VisualElement name="a" class="x" /><ui:Instance template="T" name="i" /></ui:UXML>`;
  const files: Record<string, string> = {
    'T.uxml': '<ui:UXML xmlns:ui="UnityEngine.UIElements"><ui:VisualElement name="t" class="x" /></ui:UXML>',
  };
  const uss = '.x { width: 20px; height: 7px; } .x:hover { width: 33px; }';

  it('document is the expanded tree, and styles equal resolveStyles on it with the same states', () => {
    const doc = parse(uxml, uss, { resolveImport: (u) => files[u] ?? null });
    const options = { states: { '#a': ['hover'] } };
    const result = draw(doc, options);
    try {
      expect(result.document).toBeDefined();
      expect(result.styles).toBeDefined();
      expect(result.partStyles).toBeDefined();
      const names = byName(result.document!.root);
      // The template's element is in the tree render() drew, not in the parsed one.
      expect(names.get('t')).toHaveLength(1);
      expect(result.boxes.has(names.get('t')![0]!)).toBe(true);

      const reference = resolveStyles(result.document!, options);
      for (const [id] of result.boxes) {
        const ours = result.styles!.get(id);
        const theirs = reference.styles.get(id);
        expect(ours === undefined ? undefined : Object.fromEntries(ours)).toEqual(
          theirs === undefined ? undefined : Object.fromEntries(theirs),
        );
      }
      expect(result.styles!.get(names.get('a')![0]!)?.get('width')?.value).toBe('33px');
      expect(result.styles!.get(names.get('t')![0]!)?.get('width')?.value).toBe('20px');
    } finally {
      result.dispose();
    }
  });
});

describe('classifyVisibility: uxml-author section I, in the core', () => {
  const UXML_REPORT = `<ui:UXML xmlns:ui="UnityEngine.UIElements">
    <ui:VisualElement name="Hidden" style="display:none;width:80px;height:40px">
        <ui:VisualElement name="Child" style="width:20px;height:10px" />
    </ui:VisualElement>
</ui:UXML>`;

  it('the external report fixture: both hidden, the child by its ancestor, cause inline', () => {
    const result = draw(parse(UXML_REPORT));
    try {
      const v = classifyVisibility(result);
      const n = byName(result.document!.root);
      const hidden = n.get('Hidden')![0]!;
      expect(v.get(hidden)).toMatchObject({ kind: 'hidden', by: hidden, origin: { kind: 'inline', node: hidden } });
      expect(v.get(n.get('Child')![0]!)).toMatchObject({ kind: 'hidden', by: hidden });
      expect([...v.values()].filter((x) => x.kind === 'collapsed')).toEqual([]);
    } finally {
      result.dispose();
    }
  });

  const UXML_ZERO = (toggle: string): string => `<ui:UXML xmlns:ui="UnityEngine.UIElements"><Style src="Z.uss" />
  <ui:Template name="Slot" src="Slot.uxml" />
  <ui:VisualElement name="Panel">
    <ui:VisualElement name="ByClass" class="gone"><ui:VisualElement name="ByClassKid" /></ui:VisualElement>
    <ui:Instance template="Slot" name="SlotA" />
    <ui:Instance template="Slot" name="SlotB" class="off" />
    <ui:VisualElement name="Tabs"><ui:VisualElement name="PageOne" class="gone sized" /></ui:VisualElement>
    <ui:VisualElement name="Outer2"><ui:VisualElement name="Mid"><ui:VisualElement name="Deep" class="gone sized" /></ui:VisualElement></ui:VisualElement>
    <ui:VisualElement name="Mixed"><ui:VisualElement name="MixedGone" class="gone sized" /><ui:Image name="MixedLoose" /></ui:VisualElement>
    <ui:Image name="Lone" />
    <ui:VisualElement name="Zero"><ui:VisualElement name="ZeroKid" class="gone sized" /></ui:VisualElement>
    <ui:VisualElement name="Outer"><ui:Image name="Inner" /></ui:VisualElement>
    <ui:Image name="Faded" />
    <ui:Image name="Invisible" />
    <ui:Image name="Toggled" class="${toggle}" />
    <ui:Button name="Use" text="Use" />
  </ui:VisualElement>
</ui:UXML>`;
  const files: Record<string, string> = {
    'Z.uss': `#Panel { width: 380px; height: 280px; }
.gone { display: none; }
.sized { width: 30px; height: 30px; }
#SlotB .slot { display: none; }
#Zero { height: 0; }
#Faded { opacity: 0; }
#Invisible { visibility: hidden; }
#Use { width: 80px; height: 30px; }
#Use:hover { display: none; }`,
    'Slot.uxml':
      '<ui:UXML xmlns:ui="UnityEngine.UIElements"><ui:VisualElement name="SlotRoot" class="slot" style="width: 40px; height: 20px;" /></ui:UXML>',
  };
  const zero = (toggle: string): RenderResult =>
    draw(parse(UXML_ZERO(toggle), undefined, { resolveImport: (u) => files[u] ?? null }));

  it('hidden, emptied and collapsed, each for the reason section I gives', () => {
    const result = zero('none');
    try {
      const v = classifyVisibility(result);
      const n = byName(result.document!.root);
      const one = (name: string) => v.get(n.get(name)![0]!);
      const id = (name: string) => n.get(name)![0]!;

      // a USS class hides the element and its child; the cause names the rule
      expect(one('ByClass')).toMatchObject({ kind: 'hidden', by: id('ByClass'), origin: { kind: 'rule' } });
      expect(one('ByClassKid')).toMatchObject({ kind: 'hidden', by: id('ByClass') });

      // inside an instance, the screen's rule hides the template element; the
      // instance it empties is emptied, and the other instance is untouched
      const slotRoots = n.get('SlotRoot')!;
      expect(slotRoots).toHaveLength(2);
      const kinds = slotRoots.map((s) => v.get(s)?.kind).sort();
      expect(kinds).toEqual(['hidden', 'shown']);
      expect(one('SlotB')).toEqual({ kind: 'emptied' });
      expect(one('SlotA')).toEqual({ kind: 'shown' });

      // emptied: every laid-out child hidden or emptied; it propagates
      expect(one('Tabs')).toEqual({ kind: 'emptied' });
      expect(one('Mid')).toEqual({ kind: 'emptied' });
      expect(one('Outer2')).toEqual({ kind: 'emptied' });

      // one visible zero-size child keeps the parent collapsed
      expect(one('Mixed')).toEqual({ kind: 'collapsed', explicitZero: false });
      expect(one('MixedLoose')).toEqual({ kind: 'collapsed', explicitZero: false });
      expect(one('Lone')).toEqual({ kind: 'collapsed', explicitZero: false });

      // an explicit 0 is collapsed even with only hidden children
      expect(one('Zero')).toEqual({ kind: 'collapsed', explicitZero: true });
      expect(one('ZeroKid')).toMatchObject({ kind: 'hidden' });

      expect(one('Outer')).toEqual({ kind: 'collapsed', explicitZero: false });
      expect(one('Inner')).toEqual({ kind: 'collapsed', explicitZero: false });

      // opacity and visibility do not take an element out of layout
      expect(one('Faded')).toEqual({ kind: 'collapsed', explicitZero: false });
      expect(one('Invisible')).toEqual({ kind: 'collapsed', explicitZero: false });
      expect(one('Toggled')).toEqual({ kind: 'collapsed', explicitZero: false });

      // a display: none under a state that is not active hides nothing
      expect(one('Use')).toEqual({ kind: 'shown' });
      expect(one('Panel')).toEqual({ kind: 'shown' });

      // every laid-out node has a verdict
      for (const nodeId of result.boxes.keys()) expect(v.has(nodeId)).toBe(true);
    } finally {
      result.dispose();
    }
  });

  it('the same Image with the hiding class is hidden instead of collapsed', () => {
    const result = zero('gone');
    try {
      const v = classifyVisibility(result);
      const toggled = byName(result.document!.root).get('Toggled')![0]!;
      expect(v.get(toggled)).toMatchObject({ kind: 'hidden', by: toggled });
    } finally {
      result.dispose();
    }
  });

  it('follows the states render() drew with', () => {
    const doc = parse(UXML_ZERO('none'), undefined, { resolveImport: (u) => files[u] ?? null });
    const result = draw(doc, { states: { '#Use': ['hover'] } });
    try {
      const use = byName(result.document!.root).get('Use')![0]!;
      expect(classifyVisibility(result).get(use)).toMatchObject({ kind: 'hidden', by: use, origin: { kind: 'rule', states: ['hover'] } });
    } finally {
      result.dispose();
    }
  });
});
