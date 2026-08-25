// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { collectDependencies, expandTemplates, parse, serialize } from '../../src/index';
import { resolveControl } from '../../src/controls/registry';
import { resolveStyles } from '../../src/style/resolve';
import type { ElementNode } from '../../src/model/types';

const host = (body: string): string =>
  `<ui:UXML xmlns:ui="UnityEngine.UIElements">${body}</ui:UXML>`;

function named(node: ElementNode, value: string): ElementNode | null {
  if (node.attributes.some((attribute) => attribute.name === 'name' && attribute.value === value)) {
    return node;
  }
  for (const child of node.children) {
    const found = named(child, value);
    if (found !== null) return found;
  }
  return null;
}

describe('template dependency scanning', () => {
  it('parses direct Template declarations and decodes src values in source order', () => {
    expect(
      collectDependencies(
        host(
          '<ui:Template name="A" src="templates/a&amp;one.uxml" />' +
            '<ui:Template name="B" src="templates/b.uxml" />',
        ),
      ),
    ).toEqual(['templates/a&one.uxml', 'templates/b.uxml']);
  });

  it('does not treat an arbitrary src attribute as a dependency', () => {
    expect(collectDependencies(host('<ui:VisualElement src="not-a-template.uxml" />'))).toEqual([]);
  });
});

describe('render-only template expansion', () => {
  it('keeps the original AST and expands one Instance into a container', () => {
    const source = host(
      '<ui:Template name="Card" src="card.uxml" />' +
        '<ui:Instance template="Card" name="card-instance" class="host" style="width: 80px;" />',
    );
    const template = host('<ui:VisualElement name="card-root"><ui:Label name="title" text="Card" /></ui:VisualElement>');
    const document = parse(source, undefined, {
      resolveImport: (url, from) => (url === 'card.uxml' && from === null ? template : null),
    });

    expect(serialize(document).uxml).toBe(source);
    const expanded = expandTemplates(document);
    const container = named(expanded.document.root, 'card-instance');
    const root = named(expanded.document.root, 'card-root');
    const instance = named(document.root, 'card-instance')!;
    expect(container?.derived?.kind).toBe('template-container');
    expect(container?.attributes.find((attribute) => attribute.name === 'class')?.value).toBe('host');
    expect(root).not.toBeNull();
    expect(container?.children).toContain(root);
    expect(resolveStyles(expanded.document).styles.get(container!.id)?.get('width')?.origin).toMatchObject({
      kind: 'inline',
      node: instance.id,
    });
    expect(expanded.warnings.filter((warning) => warning.kind === 'template-src-unresolved')).toHaveLength(0);
    expect(resolveControl(container!).fallback).toBe(false);
    expect(resolveControl(parse(host('<ui:TemplateContainer />')).root.children[0]!).fallback).toBe(true);
  });

  it('rebases cloned inline-attribute spans into the render source', () => {
    const source = host('<ui:Template name="Card" src="card.uxml" /><ui:Instance template="Card" />');
    const template = host('<ui:VisualElement name="card-root" style="width: 42px;" />');
    const expanded = expandTemplates(
      parse(source, undefined, { resolveImport: (url) => (url === 'card.uxml' ? template : null) }),
    );
    const root = named(expanded.document.root, 'card-root')!;
    const style = root.attributes.find((attribute) => attribute.name === 'style')!;
    expect(expanded.document.source.slice(style.span.start, style.span.end)).toContain('style="width: 42px;"');
    expect(expanded.document.source.slice(style.span.start, style.span.end)).not.toContain('card.uxml');
    expect(root.sourceDocument).toBe('card.uxml');
    expect(root.sourceNode).toBe(parse(template).root.children[0]!.id);
    expect(style.sourceDocument).toBe('card.uxml');
    expect(resolveStyles(expanded.document).styles.get(root.id)?.get('width')?.value).toBe('42px');
  });

  it('passes the exact containing template URL to nested resolution', () => {
    const calls: Array<{ url: string; from: string | null }> = [];
    const root = host('<ui:Template name="Outer" src="./outer.uxml" /><ui:Instance template="Outer" />');
    const outer = host('<ui:Template name="Inner" src="inner.uxml" /><ui:Instance template="Inner" />');
    const inner = host('<ui:VisualElement name="inner-root" />');
    const document = parse(root, undefined, {
      resolveImport: (url, from) => {
        calls.push({ url, from });
        if (url === './outer.uxml' && from === null) return outer;
        if (url === 'inner.uxml' && from === './outer.uxml') return inner;
        return null;
      },
    });
    expandTemplates(document);
    expect(calls).toEqual([
      { url: './outer.uxml', from: null },
      { url: 'inner.uxml', from: './outer.uxml' },
    ]);
  });

  it('resolves a template-local Style src from the declaring UXML', () => {
    const calls: Array<{ url: string; from: string | null }> = [];
    const source = host('<ui:Template name="Card" src="templates/card.uxml" /><ui:Instance template="Card" />');
    const template = host('<Style src="card.uss" /><ui:VisualElement name="card-root" />');
    const document = parse(source, undefined, {
      resolveImport: (url, from) => {
        calls.push({ url, from });
        if (url === 'templates/card.uxml' && from === null) return template;
        if (url === 'card.uss' && from === 'templates/card.uxml') return '#card-root { width: 73px; }';
        return null;
      },
    });
    const expanded = expandTemplates(document);
    const root = named(expanded.document.root, 'card-root')!;
    const width = resolveStyles(expanded.document).styles.get(root.id)?.get('width');
    expect(width?.value).toBe('73px');
    expect(width?.origin).toMatchObject({ kind: 'rule', sourceDocument: 'card.uss' });
    expect(width?.origin).toMatchObject({ sourceDocumentFrom: 'templates/card.uxml' });
    expect(calls).toEqual([
      { url: 'templates/card.uxml', from: null },
      { url: 'card.uss', from: 'templates/card.uxml' },
    ]);
  });

  it('rebases template stylesheet warnings and keeps their source document', () => {
    const source = host('<ui:Template name="Card" src="card.uxml" /><ui:Instance template="Card" />');
    const template = host('<Style src="broken.uss" /><ui:VisualElement />');
    const expanded = expandTemplates(
      parse(source, ':root { width: 10px; }', {
        resolveImport: (url, from) =>
          url === 'card.uxml' && from === null
            ? template
            : url === 'broken.uss' && from === 'card.uxml'
              ? '@import url("missing.uss"); .bad { width: 1px; }'
              : null,
      }),
    );
    const warning = expanded.warnings.find((item) => item.sourceDocument === 'broken.uss');
    expect(warning?.at).toMatchObject({ in: 'uss', sheet: 1 });
  });

  it('treats a template stylesheet :root as the generated container only', () => {
    const source = host(
      '<ui:Template name="Card" src="card.uxml" /><ui:Instance template="Card" name="instance" /><ui:VisualElement name="sibling" />',
    );
    const template = host('<Style src="card.uss" /><ui:VisualElement name="card-root" />');
    const expanded = expandTemplates(
      parse(source, undefined, {
        resolveImport: (url, from) =>
          url === 'card.uxml' && from === null
            ? template
            : url === 'card.uss' && from === 'card.uxml'
              ? ':root { width: 81px; } VisualElement { height: 19px; }'
              : null,
      }),
    );
    const styles = resolveStyles(expanded.document).styles;
    const instance = named(expanded.document.root, 'instance')!;
    const root = named(expanded.document.root, 'card-root')!;
    const sibling = named(expanded.document.root, 'sibling')!;
    expect(styles.get(instance.id)?.get('width')?.value).toBe('81px');
    expect(styles.get(root.id)?.get('width')).toBeUndefined();
    expect(styles.get(root.id)?.get('height')?.value).toBe('19px');
    expect(styles.get(sibling.id)?.get('height')).toBeUndefined();
  });

  it('remaps an entry stylesheet attached under Instance to the generated container', () => {
    const source = host(
      '<ui:Template name="Card" src="card.uxml" />' +
        '<ui:Instance template="Card" name="instance"><Style src="instance.uss" /></ui:Instance>',
    );
    const expanded = expandTemplates(
      parse(source, undefined, {
        resolveImport: (url, from) =>
          url === 'card.uxml' && from === null
            ? host('<ui:VisualElement name="inside" />')
            : url === 'instance.uss' && from === null
              ? ':root { width: 91px; }'
              : null,
      }),
    );
    const instance = named(expanded.document.root, 'instance')!;
    expect(resolveStyles(expanded.document).styles.get(instance.id)?.get('width')?.value).toBe('91px');
  });

  it('does not confuse identical relative declarations from different parents with a cycle', () => {
    const source = host('<ui:Template name="A" src="same.uxml" /><ui:Instance template="A" />');
    const middle = host('<ui:Template name="A" src="same.uxml" /><ui:Instance template="A" />');
    const leaf = host('<ui:VisualElement name="leaf" />');
    const expanded = expandTemplates(
      parse(source, undefined, {
        resolveImport: (url, from) =>
          url === 'same.uxml' && from === null
            ? middle
            : url === 'same.uxml' && from === 'same.uxml'
              ? leaf
              : null,
      }),
    );
    expect(named(expanded.document.root, 'leaf')).not.toBeNull();
    expect(expanded.warnings.some((warning) => warning.kind === 'template-cycle')).toBe(false);
  });

  it('caches a parsed template document while cloning it for each Instance', () => {
    let loads = 0;
    const source = host(
      '<ui:Template name="Card" src="card.uxml" /><ui:Instance template="Card" /><ui:Instance template="Card" />',
    );
    const template = host('<ui:VisualElement name="card-root" />');
    const document = parse(source, undefined, {
      resolveImport: (url) => {
        if (url !== 'card.uxml') return null;
        loads++;
        return template;
      },
    });
    const expanded = expandTemplates(document);
    expect(loads).toBe(1);
    expect(expanded.document.root.children.filter((node) => node.derived?.kind === 'template-container')).toHaveLength(2);
    const clones = expanded.document.root.children.map((node) => node.children[0]!);
    expect(clones[0]!.id).not.toBe(clones[1]!.id);
    expect(clones[0]!.sourceNode).toBe(clones[1]!.sourceNode);
  });

  it('updates every duplicate override target and reports missing names', () => {
    const source = host(
      '<ui:Template name="Card" src="card.uxml" />' +
        '<ui:Instance template="Card"><AttributeOverrides element-name="title" text="new" />' +
        '<AttributeOverrides element-name="missing" text="ignored" /></ui:Instance>',
    );
    const template = host(
      '<ui:VisualElement><ui:Label name="title" text="one" /><ui:Label name="title" text="two" /></ui:VisualElement>',
    );
    const document = parse(source, undefined, { resolveImport: (url) => (url === 'card.uxml' ? template : null) });
    const expanded = expandTemplates(document);
    const titles: ElementNode[] = [];
    const walk = (node: ElementNode): void => {
      if (node.attributes.some((attribute) => attribute.name === 'name' && attribute.value === 'title')) {
        titles.push(node);
      }
      node.children.forEach(walk);
    };
    walk(expanded.document.root);
    expect(titles.map((node) => node.attributes.find((attribute) => attribute.name === 'text')?.value)).toEqual([
      'new',
      'new',
    ]);
    expect(expanded.warnings.some((warning) => warning.kind === 'override-target-missing' && warning.message.includes('missing'))).toBe(true);
  });

  it('reports Unity-ignored style AttributeOverrides without applying them', () => {
    const source = host(
      '<ui:Template name="Card" src="card.uxml" />' +
        '<ui:Instance template="Card"><AttributeOverrides element-name="title" ' +
        'style="color: rgb(220, 30, 30);" /></ui:Instance>',
    );
    const template = host(
      '<ui:Label name="title" text="old" style="color: rgb(30, 30, 30);" />',
    );
    const expanded = expandTemplates(
      parse(source, undefined, { resolveImport: (url) => (url === 'card.uxml' ? template : null) }),
    );
    const title = named(expanded.document.root, 'title')!;
    expect(title.attributes.find((attribute) => attribute.name === 'text')?.value).toBe('old');
    expect(title.attributes.find((attribute) => attribute.name === 'style')?.value).toBe(
      'color: rgb(30, 30, 30);',
    );
    const warning = expanded.warnings.find((item) => String(item.kind) === 'override-style-ignored');
    expect(warning?.message).toContain('element-name "title"');
    expect(warning?.message).toContain('color: rgb(220, 30, 30);');
    expect(warning?.message).toContain('Unity ignores style AttributeOverrides');
    expect(warning?.message).toContain('not a preview limitation');
  });

  it('omits slot children and emits a diagnostic with definitions and descriptors', () => {
    const source = host(
      '<ui:Template name="Window" src="window.uxml" /><ui:Instance template="Window"><ui:Label name="body" slot="content" /></ui:Instance>',
    );
    const template = host('<ui:VisualElement name="window"><ui:VisualElement name="content" slot-name="content" /></ui:VisualElement>');
    const document = parse(source, undefined, { resolveImport: (url) => (url === 'window.uxml' ? template : null) });
    const expanded = expandTemplates(document);
    expect(named(expanded.document.root, 'body')).toBeNull();
    const warning = expanded.warnings.find((item) => item.kind === 'template-slot-unsupported');
    expect(warning?.message).toContain('content');
    expect(warning?.message).toContain('<Label name="body" slot="content">');
  });

  it('diagnoses a slot child even when its template source is unavailable', () => {
    const source = host(
      '<ui:Template name="Missing" src="missing.uxml" /><ui:Instance template="Missing"><ui:Label slot="content" /></ui:Instance>',
    );
    const expanded = expandTemplates(parse(source, undefined, { resolveImport: () => null }));
    expect(expanded.warnings.some((warning) => warning.kind === 'template-slot-unsupported')).toBe(true);
  });

  it('diagnoses a slot definition even when the Instance supplies no child', () => {
    const source = host('<ui:Template name="Window" src="window.uxml" /><ui:Instance template="Window" />');
    const template = host('<ui:VisualElement slot-name="title" />');
    const expanded = expandTemplates(
      parse(source, undefined, { resolveImport: (url) => (url === 'window.uxml' ? template : null) }),
    );
    const warning = expanded.warnings.find((item) => item.kind === 'template-slot-unsupported');
    expect(warning?.message).toContain('title');
    expect(warning?.message).toContain('children not placed: (none)');
  });

  it('reports undeclared, unresolved package, and depth failures explicitly', () => {
    const undeclared = expandTemplates(parse(host('<ui:Instance template="Unknown" />')));
    expect(undeclared.warnings.some((warning) => warning.kind === 'template-not-declared')).toBe(true);

    const packageSource = host(
      '<ui:Template name="Package" src="project://database/Packages/com.example/missing.uxml" />' +
        '<ui:Instance template="Package" />',
    );
    const unresolved = expandTemplates(
      parse(packageSource, undefined, { resolveImport: () => null }),
    );
    expect(
      unresolved.warnings.some(
        (warning) =>
          warning.kind === 'template-src-unresolved' &&
          warning.message.includes('attempted resolveImport'),
      ),
    ).toBe(true);
    expect(
      unresolved.warnings.some(
        (warning) => warning.kind === 'package-path-not-searched' && warning.message.includes('PackageCache'),
      ),
    ).toBe(true);

    const root = host('<ui:Template name="T0" src="0.uxml" /><ui:Instance template="T0" />');
    const sources = new Map<string, string>();
    for (let index = 0; index < 34; index++) {
      sources.set(
        `${index}.uxml`,
        host(
          `<ui:Template name="T${index + 1}" src="${index + 1}.uxml" />` +
            `<ui:Instance template="T${index + 1}" />`,
        ),
      );
    }
    const deep = expandTemplates(
      parse(root, undefined, { resolveImport: (url) => sources.get(url) ?? null }),
    );
    expect(
      deep.warnings.some(
        (warning) => warning.kind === 'template-depth-exceeded' && warning.message.includes('32'),
      ),
    ).toBe(true);
  });

  it('fails cycles closed and preserves the source on a round trip', () => {
    const source = host(
      '<ui:Template name="A" src="a.uxml" /><ui:Instance template="A" name="cycle" />',
    );
    const a = host('<ui:Template name="B" src="b.uxml" /><ui:Instance template="B" />');
    const b = host(
      '<ui:Template name="A" src="a.uxml" />' +
        '<ui:Instance template="A"><ui:Label slot="content" /></ui:Instance>',
    );
    const document = parse(source, undefined, {
      resolveImport: (url) => (url === 'a.uxml' ? a : url === 'b.uxml' ? b : null),
    });
    const expanded = expandTemplates(document);
    expect(
      expanded.warnings.some(
        (warning) =>
          warning.kind === 'template-cycle' &&
          warning.message.includes('A@a.uxml') &&
          warning.message.includes('B@b.uxml') &&
          warning.message.split(' -> ').length === 3,
      ),
    ).toBe(true);
    expect(expanded.warnings.some((warning) => warning.kind === 'template-slot-unsupported')).toBe(true);
    expect(serialize(document).uxml).toBe(source);
  });

  it('reports duplicate names introduced by expansion', () => {
    const source = host('<ui:Template name="A" src="a.uxml" /><ui:Instance template="A" /><ui:Instance template="A" />');
    const template = host('<ui:VisualElement name="same" />');
    const expanded = expandTemplates(
      parse(source, undefined, { resolveImport: (url) => (url === 'a.uxml' ? template : null) }),
    );
    expect(expanded.warnings.some((warning) => warning.kind === 'duplicate-name-in-tree' && warning.message.includes('2'))).toBe(true);
  });
});
