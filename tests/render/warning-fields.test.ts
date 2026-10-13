/**
 * `reason` and `subject` on every warning the core raises.
 *
 * The expectations come from what each warning means (docs/supported.md's
 * warning policy), not from reading them off the output. What matters to a
 * consumer is that "the author wrote something USS lacks" and "this preview
 * does not draw valid USS" never share a reason: a skill that fails a screen
 * on the first must not fail it on the second.
 */

import { beforeAll, describe, expect, it } from 'vitest';

import { expandTemplates, loadLayoutEngine, parse, render, resolveStyles } from '../../src/index';
import type { Warning, WarningKind } from '../../src/index';

beforeAll(async () => {
  await loadLayoutEngine();
});

const uxml = (body: string): string => `<ui:UXML xmlns:ui="UnityEngine.UIElements">${body}</ui:UXML>`;

function warningsOf(body: string, uss?: string, resolveAsset?: () => string | null): Warning[] {
  const container = document.createElement('div');
  document.body.replaceChildren(container);
  const doc = parse(uxml(body), uss);
  const result = render(doc, container, {
    size: { width: 400, height: 300 },
    measureText: (text, context) => ({ width: text.length * context.fontSize * 0.5, height: context.fontSize }),
    ...(resolveAsset === undefined ? {} : { resolveAsset }),
  });
  const warnings = [...doc.warnings, ...result.warnings];
  result.dispose();
  return warnings;
}

function only(warnings: readonly Warning[], kind: WarningKind, contains = ''): Warning {
  const hits = warnings.filter((w) => w.kind === kind && w.message.includes(contains));
  expect(hits, `${kind} containing "${contains}"`).toHaveLength(1);
  return hits[0]!;
}

const fields = (w: Warning): Pick<Warning, 'reason' | 'subject'> => ({
  ...(w.reason === undefined ? {} : { reason: w.reason }),
  ...(w.subject === undefined ? {} : { subject: w.subject }),
});

describe('selectors', () => {
  it('a refused states key is not USS, about the key', () => {
    const { warnings } = resolveStyles(parse(uxml('<ui:VisualElement name="a" />')), {
      states: { '#a[x]': ['hover'] },
    });
    expect(fields(only(warnings, 'unsupported-selector', 'states key'))).toEqual({
      reason: 'not-uss',
      subject: { kind: 'states-key', key: '#a[x]' },
    });
  });

  it('an unsupported selector names the whole selector and the fragment', () => {
    const w = only(warningsOf('<ui:VisualElement />', '.a:nth-child(2) { width: 1px; }'), 'unsupported-selector');
    expect(fields(w)).toEqual({
      reason: 'not-uss',
      subject: { kind: 'selector', selector: '.a:nth-child(2)', fragment: ':nth-child(2)' },
    });
  });

  it('a rule aiming at control parts nothing has is not rendered', () => {
    const w = only(warningsOf('<ui:VisualElement />', '#unity-text-input { width: 1px; }'), 'unsupported-selector');
    expect(fields(w)).toEqual({
      reason: 'not-rendered',
      subject: { kind: 'selector', selector: '#unity-text-input', fragment: '#unity-text-input' },
    });
  });
});

describe('values', () => {
  it('an unresolved var() is an invalid value, with the value as written', () => {
    const w = only(warningsOf('<ui:VisualElement name="a" />', '#a { width: var(--nope); }'), 'unsupported-property', 'var()');
    expect(fields(w)).toEqual({
      reason: 'invalid-value',
      subject: { kind: 'property', property: 'width', value: 'var(--nope)' },
    });
  });

  it('a CSS unit is not USS; unreadable text is an invalid value', () => {
    const em = only(warningsOf('<ui:VisualElement name="a" />', '#a { width: 2em; }'), 'unsupported-property');
    expect(fields(em)).toEqual({ reason: 'not-uss', subject: { kind: 'property', property: 'width', value: '2em' } });
    const junk = only(warningsOf('<ui:VisualElement name="a" />', '#a { width: wide; }'), 'unsupported-property');
    expect(fields(junk)).toEqual({
      reason: 'invalid-value',
      subject: { kind: 'property', property: 'width', value: 'wide' },
    });
  });

  it('position: fixed and overflow: scroll are not USS', () => {
    const fixed = only(warningsOf('<ui:VisualElement name="a" />', '#a { position: fixed; }'), 'unsupported-property');
    expect(fields(fixed)).toEqual({
      reason: 'not-uss',
      subject: { kind: 'property', property: 'position', value: 'fixed' },
    });
    const scroll = only(warningsOf('<ui:VisualElement name="a" />', '#a { overflow: scroll; }'), 'unsupported-property');
    expect(fields(scroll)).toEqual({
      reason: 'not-uss',
      subject: { kind: 'property', property: 'overflow', value: 'scroll' },
    });
  });

  it('a keyword USS does not have for a USS property is an invalid value', () => {
    const w = only(warningsOf('<ui:Label name="a" text="x" />', '#a { -unity-font-style: heavy; }'), 'unsupported-property');
    expect(fields(w)).toEqual({
      reason: 'invalid-value',
      subject: { kind: 'property', property: '-unity-font-style', value: 'heavy' },
    });
  });

  it('a non-pixel border width is an invalid value', () => {
    const w = only(warningsOf('<ui:VisualElement name="a" />', '#a { border-top-width: 10%; }'), 'unsupported-property');
    expect(fields(w)).toEqual({
      reason: 'invalid-value',
      subject: { kind: 'property', property: 'border-top-width', value: '10%' },
    });
  });
});

describe('controls and versions', () => {
  it('a control with no renderer is not rendered, about its type', () => {
    const w = only(warningsOf('<ui:Toggle />'), 'unsupported-control');
    expect(fields(w)).toEqual({ reason: 'not-rendered', subject: { kind: 'control', type: 'Toggle' } });
  });

  it('children of a text control are not rendered', () => {
    const w = only(warningsOf('<ui:Label text="x"><ui:VisualElement /></ui:Label>'), 'unsupported-property');
    expect(fields(w)).toEqual({ reason: 'not-rendered', subject: { kind: 'control', type: 'Label' } });
  });

  it('measured control geometry is version-dependent', () => {
    const warnings = warningsOf('<ui:ScrollView />');
    expect(fields(only(warnings, 'version-dependent', 'ScrollView'))).toEqual({
      reason: 'version-dependent',
      subject: { kind: 'control', type: 'ScrollView' },
    });
    expect(fields(only(warningsOf('<ui:Button />'), 'version-dependent', 'control defaults'))).toEqual({
      reason: 'version-dependent',
    });
  });
});

describe('files and assets', () => {
  it('an unresolved image says which path, in which form, and gives no support reason', () => {
    const url = only(
      warningsOf('<ui:VisualElement name="a" />', '#a { background-image: url("a.png"); }', () => null),
      'asset-unresolved',
    );
    expect(fields(url)).toEqual({ subject: { kind: 'asset', path: 'a.png', form: 'url' } });
    const resource = only(
      warningsOf('<ui:VisualElement name="a" />', '#a { background-image: resource("icons/a"); }', () => null),
      'asset-unresolved',
    );
    expect(fields(resource)).toEqual({ subject: { kind: 'asset', path: 'icons/a', form: 'resource' } });
  });

  it('an unresolved stylesheet carries the exact URL the hook saw', () => {
    const style = parse(uxml('<Style src="a.uss" />'), undefined, { resolveImport: () => null });
    expect(fields(only(style.warnings, 'import-unresolved'))).toEqual({
      subject: { kind: 'import', url: 'a.uss', from: null },
    });
    const imported = parse(uxml('<Style src="a.uss" />'), undefined, {
      resolveImport: (url) => (url === 'a.uss' ? '@import "b.uss";' : null),
    });
    expect(fields(only(imported.warnings, 'import-unresolved'))).toEqual({
      subject: { kind: 'import', url: 'b.uss', from: 'a.uss' },
    });
  });
});

describe('templates', () => {
  const expand = (source: string, files: Readonly<Record<string, string>> = {}): Warning[] =>
    expandTemplates(parse(source, undefined, { resolveImport: (url) => files[url] ?? null })).warnings as Warning[];

  it('an ignored style override matches Unity', () => {
    const warnings = expand(
      uxml(
        '<ui:Template name="Card" src="card.uxml" />' +
          '<ui:Instance template="Card"><AttributeOverrides element-name="title" style="width: 1px" /></ui:Instance>',
      ),
      { 'card.uxml': uxml('<ui:Label name="title" />') },
    );
    expect(fields(only(warnings, 'override-style-ignored'))).toEqual({
      reason: 'matches-unity',
      subject: { kind: 'name', name: 'title' },
    });
  });

  it('a missing override target is an invalid value', () => {
    const warnings = expand(
      uxml(
        '<ui:Template name="Card" src="card.uxml" />' +
          '<ui:Instance template="Card"><AttributeOverrides element-name="nope" text="x" /></ui:Instance>',
      ),
      { 'card.uxml': uxml('<ui:Label name="title" />') },
    );
    expect(fields(only(warnings, 'override-target-missing'))).toEqual({
      reason: 'invalid-value',
      subject: { kind: 'name', name: 'nope' },
    });
  });

  it('an unresolved template src carries the URL; a package path is a preview limit', () => {
    const warnings = expand(uxml('<ui:Template name="T" src="Packages/p/t.uxml" /><ui:Instance template="T" />'));
    const subject = { kind: 'import', url: 'Packages/p/t.uxml', from: null };
    expect(fields(only(warnings, 'template-src-unresolved'))).toEqual({ subject });
    expect(fields(only(warnings, 'package-path-not-searched'))).toEqual({ reason: 'not-rendered', subject });
  });

  it('an undeclared template is an invalid value', () => {
    expect(fields(only(expand(uxml('<ui:Instance template="Nope" />')), 'template-not-declared'))).toEqual({
      reason: 'invalid-value',
      subject: { kind: 'name', name: 'Nope' },
    });
  });

  it('a repeated name after expansion matches Unity', () => {
    const warnings = expand(
      uxml('<ui:Template name="Card" src="card.uxml" /><ui:Instance template="Card" /><ui:Instance template="Card" />'),
      { 'card.uxml': uxml('<ui:Label name="title" />') },
    );
    expect(fields(only(warnings, 'duplicate-name-in-tree'))).toEqual({
      reason: 'matches-unity',
      subject: { kind: 'name', name: 'title' },
    });
  });

  it('a cycle is an invalid value', () => {
    const warnings = expand(uxml('<ui:Template name="A" src="a.uxml" /><ui:Instance template="A" />'), {
      'a.uxml': uxml('<ui:Template name="A" src="a.uxml" /><ui:Instance template="A" />'),
    });
    expect(only(warnings, 'template-cycle').reason).toBe('invalid-value');
  });
});
