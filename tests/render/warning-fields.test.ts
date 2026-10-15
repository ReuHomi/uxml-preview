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

  it(':root is reported as a difference from CSS that matches Unity, not a version question', () => {
    const w = only(warningsOf('<ui:VisualElement />', ':root { --a: 1px; }'), 'version-dependent');
    expect(fields(w)).toEqual({
      reason: 'matches-unity',
      subject: { kind: 'selector', selector: ':root', fragment: ':root' },
    });
  });

  it('no warning text sends the reader to a source file they do not have', () => {
    const texts = [
      ...warningsOf('<ui:Button /><ui:ScrollView />', ':root { --a: 1px; }'),
      ...warningsOf('<ui:Toggle label="x" />'),
    ].map((w) => w.message);
    expect(texts.length).toBeGreaterThan(3);
    expect(texts.filter((t) => /src\/|\.ts\b/.test(t))).toEqual([]);
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

describe('one warning per declaration', () => {
  const at = (w: Warning): unknown => w.at;

  it('a rule matching many elements, or none, reports each declaration once, where it is written', () => {
    const uss = '.x { filter: blur(2px); }\n.unused { gap: 4px; }';
    const warnings = warningsOf(
      '<ui:VisualElement class="x" /><ui:VisualElement class="x" /><ui:VisualElement class="x" />',
      uss,
    ).filter((w) => w.kind === 'unsupported-property');
    expect(warnings.map((w) => w.subject)).toEqual([
      {
        kind: 'property',
        property: 'filter',
        value: 'blur(2px)',
        since: '6000.3',
        affectsLayout: false,
        unityEffect: { kind: 'panel-unstyled', versions: ['6000.0'] },
      },
      { kind: 'property', property: 'gap', value: '4px' },
    ]);
    expect(warnings.map(at)).toEqual([
      { in: 'uss', sheet: 0, url: null, from: null, span: { start: uss.indexOf('filter'), end: uss.indexOf(';') } },
      { in: 'uss', sheet: 0, url: null, from: null, span: { start: uss.indexOf('gap'), end: uss.lastIndexOf(';') } },
    ]);
  });

  it('an inherited property is reported where it is declared, not on every descendant', () => {
    const warnings = warningsOf(
      '<ui:VisualElement name="r"><ui:Label text="a" /><ui:VisualElement><ui:Label text="b" /></ui:VisualElement></ui:VisualElement>',
      '#r { -unity-font-definition: resource("f"); -unity-font-style: heavy; }',
    ).filter((w) => w.kind === 'unsupported-property');
    expect(warnings.map((w) => w.subject?.kind === 'property' && w.subject.property)).toEqual([
      '-unity-font-definition',
      '-unity-font-style',
    ]);
  });

  it('a value problem reached by many elements is reported once, at its declaration', () => {
    const uss = '.x { width: 2em; }';
    const warnings = warningsOf('<ui:VisualElement class="x" /><ui:VisualElement class="x" />', uss).filter(
      (w) => w.kind === 'unsupported-property',
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.at).toEqual({ in: 'uss', sheet: 0, url: null, from: null, span: { start: 5, end: uss.indexOf(';') } });
  });

  it('an inline declaration points into the UXML text', () => {
    const body = '<ui:VisualElement style="width: 10px; z-index: 3" />';
    const source = uxml(body);
    const w = only(warningsOf(body), 'unsupported-property');
    expect(w.reason).toBe('not-uss');
    expect(w.at).toEqual({ in: 'uxml', span: { start: source.indexOf('z-index'), end: source.indexOf('3"') + 1 } });
  });

  it('two instances of one template report its inline declaration once, by file', () => {
    const doc = parse(
      uxml('<ui:Template name="Card" src="card.uxml" /><ui:Instance template="Card" /><ui:Instance template="Card" />'),
      undefined,
      { resolveImport: (url) => (url === 'card.uxml' ? uxml('<ui:VisualElement style="z-index: 1" />') : null) },
    );
    const container = document.createElement('div');
    const result = render(doc, container, {
      size: { width: 400, height: 300 },
      measureText: () => ({ width: 0, height: 0 }),
    });
    const warnings = result.warnings.filter((w) => w.kind === 'unsupported-property');
    result.dispose();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.sourceDocument).toBe('card.uxml');
    expect(warnings[0]!.at).toBeUndefined();
  });

  it('bounds a not-uss verdict by the newest Unity reference the registry holds', () => {
    // The reference is Unity 6.3 LTS; 6.7 beta adds gap, so "not USS" must say up to when.
    const w = only(warningsOf('<ui:VisualElement name="a" />', '#a { gap: 4px; }'), 'unsupported-property');
    expect(w.reason).toBe('not-uss');
    expect(w.message).toContain('up to Unity 6.6');
  });

  it('says what USS calls a renamed CSS property', () => {
    const w = only(warningsOf('<ui:Label text="x" style="font-family: Arial" />'), 'unsupported-property');
    expect(w.subject).toEqual({
      kind: 'property',
      property: 'font-family',
      value: 'Arial',
      replacements: ['-unity-font-definition'],
    });
  });
});

describe('syntax that used to be ignored without a word', () => {
  it('a pseudo-class Unity never sets is reported where the selector is written', () => {
    const uss = '.a:first-child { width: 1px; }\n.b:selected, .c { width: 2px; }\n.d:bogus { width: 3px; }';
    const warnings = warningsOf('<ui:VisualElement class="a" />', uss).filter(
      (w) => w.kind === 'unsupported-selector',
    );
    expect(warnings.map(fields)).toEqual([
      { reason: 'not-uss', subject: { kind: 'selector', selector: '.a:first-child', fragment: ':first-child' } },
      { reason: 'not-uss', subject: { kind: 'selector', selector: '.b:selected, .c', fragment: ':selected' } },
      { reason: 'not-uss', subject: { kind: 'selector', selector: '.d:bogus', fragment: ':bogus' } },
    ]);
    expect(warnings[0]!.at).toEqual({ in: 'uss', sheet: 0, url: null, from: null, span: { start: 0, end: '.a:first-child'.length } });
  });

  it('every Unity state and :root stay quiet', () => {
    const uss = [':root', ...['hover', 'active', 'inactive', 'focus', 'disabled', 'enabled', 'checked'].map((s) => `.a:${s}`)]
      .map((selector) => `${selector} { width: 1px; }`)
      .join('\n');
    const warnings = warningsOf('<ui:VisualElement class="a" />', uss);
    expect(warnings.filter((w) => w.kind === 'unsupported-selector')).toEqual([]);
  });

  it('@media and @keyframes blocks are reported, @import is not', () => {
    const uss = '@media screen { .a { width: 1px; } }\n@keyframes spin { from { rotate: 0deg; } }\n.a { width: 2px; }';
    const warnings = warningsOf('<ui:VisualElement class="a" />', uss).filter(
      (w) => w.subject?.kind === 'at-rule',
    );
    expect(warnings.map((w) => [w.kind, w.reason, w.subject])).toEqual([
      ['unsupported-selector', 'not-uss', { kind: 'at-rule', name: 'media' }],
      ['unsupported-selector', 'not-uss', { kind: 'at-rule', name: 'keyframes' }],
    ]);
    expect(warnings[0]!.at).toEqual({ in: 'uss', sheet: 0, url: null, from: null, span: { start: 0, end: uss.indexOf('\n') } });
  });

  it('a display value USS does not have is reported, once, and still laid out as flex', () => {
    for (const value of ['grid', 'block', 'inline', 'inline-block']) {
      const warnings = warningsOf(
        '<ui:VisualElement class="a" /><ui:VisualElement class="a" />',
        `.a { display: ${value}; }`,
      ).filter((w) => w.kind === 'unsupported-property');
      expect(warnings.map(fields), value).toEqual([
        { reason: 'invalid-value', subject: { kind: 'property', property: 'display', value } },
      ]);
    }
    for (const value of ['flex', 'none']) {
      expect(warningsOf('<ui:VisualElement class="a" />', `.a { display: ${value}; }`), value).toEqual([]);
    }
  });

  it('a background image that is not an asset reference is not USS, not an unresolved asset', () => {
    const warnings = warningsOf(
      '<ui:VisualElement name="a" />',
      '#a { background-image: linear-gradient(red, blue); }',
      () => 'data:image/png;base64,AAAA',
    );
    expect(warnings.filter((w) => w.kind === 'asset-unresolved')).toEqual([]);
    expect(fields(only(warnings, 'unsupported-property'))).toEqual({
      reason: 'not-uss',
      subject: { kind: 'property', property: 'background-image', value: 'linear-gradient(red, blue)' },
    });
  });
});
