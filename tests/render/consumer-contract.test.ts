/**
 * Warning text that published consumers read, held byte for byte.
 *
 * Warning messages are not an API, and new consumers should read `kind`,
 * `reason` and `subject` instead. But two shipped consumers already match on
 * these strings, and rewording one breaks them without a type error anywhere:
 *
 *   - uxml-author `src/check.js` decides a states key was refused by
 *     `message.indexOf('states key "' + key + '"') === 0` on an
 *     `unsupported-selector` warning with no `at`, and its tests match
 *     `is not a usable USS selector` and `does not independently search
 *     Unity Packages`.
 *   - vscode-uxml-preview `webview/warnings.ts` (`pathInWarning`,
 *     `assetInWarning`) finds the failed URL or asset path as a substring of
 *     the message, and its tests compare `<Style src="missing.uss"> could not
 *     be resolved` and require a plain fallback screen to raise no
 *     `unsupported-property` at all.
 *
 * When one of these has to change, the consumers move to the structured
 * fields first, and only then does the test here change.
 */

import { beforeAll, describe, expect, it } from 'vitest';

import { expandTemplates, loadLayoutEngine, parse, render, resolveStyles } from '../../src/index';

beforeAll(async () => {
  await loadLayoutEngine();
});

const uxml = (body: string): string => `<ui:UXML xmlns:ui="UnityEngine.UIElements">${body}</ui:UXML>`;

function drawn(body: string, uss?: string, resolveAsset?: () => string | null) {
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

describe('warning text consumers match on', () => {
  it('1-2. a refused states key: prefix, phrase, kind and no location', () => {
    const doc = parse(uxml('<ui:VisualElement name="a" />'));
    const { warnings } = resolveStyles(doc, { states: { '#a[x]': ['hover'] } });
    const refused = warnings.filter((w) => w.message.indexOf('states key "#a[x]"') === 0);
    expect(refused).toHaveLength(1);
    expect(refused[0]!.kind).toBe('unsupported-selector');
    expect(refused[0]!.at).toBeUndefined();
    expect(refused[0]!.message).toContain('is not a usable USS selector');
  });

  it('3. an unresolved <Style src>', () => {
    const doc = parse(uxml('<Style src="missing.uss" />'), undefined, { resolveImport: () => null });
    expect(doc.warnings.map((w) => w.message)).toContain('<Style src="missing.uss"> could not be resolved');
  });

  it('4. an unresolved @import names its URL verbatim', () => {
    const url = 'project://database/Assets/UI/My Theme.uss';
    for (const options of [undefined, { resolveImport: () => null }]) {
      const doc = parse(uxml(''), `@import "${url}";`, options);
      const imports = doc.warnings.filter((w) => w.kind === 'import-unresolved');
      expect(imports).toHaveLength(1);
      expect(imports[0]!.message).toContain(`@import "${url}"`);
    }
  });

  it('5. an unresolved background image names its path verbatim', () => {
    const path = 'project://database/Assets/UI/My Icon.png';
    const warnings = drawn('<ui:VisualElement name="a" />', `#a { background-image: url("${path}"); }`, () => null);
    expect(warnings.map((w) => w.message)).toContain(`background-image: "${path}" was not resolved`);
  });

  it('6. a package template path the core does not search', () => {
    const doc = parse(
      uxml('<ui:Template name="T" src="Packages/com.example/t.uxml" /><ui:Instance template="T" />'),
      undefined,
      { resolveImport: () => null },
    );
    const messages = expandTemplates(doc).warnings.map((w) => w.message);
    expect(messages.some((m) => m.includes('does not independently search Unity Packages'))).toBe(true);
  });

  it('7. a plain screen with fallback controls raises no unsupported-property', () => {
    const warnings = drawn(`
      <ui:VisualElement style="width: 360px; padding: 12px; background-color: #2b2b2b;">
        <ui:Label text="Supported label" style="color: #ffffff;" />
        <ui:Toggle label="Unsupported control" />
        <ui:Slider low-value="0" high-value="10" />
        <ui:VisualElement style="height: 40px; background-color: #4f8fd9; rotate: 45deg;" />
      </ui:VisualElement>`);
    expect(warnings.filter((w) => w.kind === 'unsupported-control')).toHaveLength(2);
    expect(warnings.filter((w) => w.kind === 'unsupported-property')).toEqual([]);
  });
});
