// @vitest-environment node

import { readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from '../../src/index';
import type { WarningKind } from '../../src/model/types';

const NEW_KINDS = [
  'template-src-unresolved',
  'template-not-declared',
  'template-cycle',
  'template-depth-exceeded',
  'override-target-missing',
  'duplicate-name-in-tree',
  'package-path-not-searched',
  'template-slot-unsupported',
  'override-style-ignored',
] as const satisfies readonly WarningKind[];

const host = (body: string): string =>
  `<ui:UXML xmlns:ui="UnityEngine.UIElements">${body}</ui:UXML>`;

async function observedKinds(module: typeof import('../../src/template/expand')): Promise<Set<WarningKind>> {
  const warnings: WarningKind[] = [];
  const expand = (source: string, resolver?: (url: string, from: string | null) => string | null): void => {
    const document = parse(source);
    module.rememberTemplateResolver(document, resolver);
    warnings.push(...module.expandTemplates(document).warnings.map((warning) => warning.kind));
  };

  expand(host('<ui:Instance template="Unknown" />'));
  expand(
    host(
      '<ui:Template name="P" src="project://database/Packages/x/missing.uxml" />' +
        '<ui:Instance template="P" />',
    ),
    () => null,
  );
  expand(
    host('<ui:Template name="A" src="a.uxml" /><ui:Instance template="A" />'),
    (url) =>
      url === 'a.uxml'
        ? host('<ui:Template name="B" src="b.uxml" /><ui:Instance template="B" />')
        : host('<ui:Template name="A" src="a.uxml" /><ui:Instance template="A" />'),
  );

  const deep = new Map<string, string>();
  for (let index = 0; index < 34; index++) {
    deep.set(
      `${index}.uxml`,
      host(
        `<ui:Template name="T${index + 1}" src="${index + 1}.uxml" />` +
          `<ui:Instance template="T${index + 1}" />`,
      ),
    );
  }
  expand(
    host('<ui:Template name="T0" src="0.uxml" /><ui:Instance template="T0" />'),
    (url) => deep.get(url) ?? null,
  );

  expand(
    host(
      '<ui:Template name="Card" src="card.uxml" />' +
        '<ui:Instance template="Card"><AttributeOverrides element-name="same" style="width: 1px;" />' +
        '<AttributeOverrides element-name="missing" text="x" /></ui:Instance>' +
        '<ui:Instance template="Card" />',
    ),
    (url) =>
      url === 'card.uxml'
        ? host('<ui:VisualElement slot-name="title"><ui:Label name="same" /><ui:Label name="same" /></ui:VisualElement>')
        : null,
  );
  return new Set(warnings);
}

describe('new template diagnostics mutation checks', () => {
  for (const kind of NEW_KINDS) {
    it(`detects a one-line ${kind} emission mutation`, async () => {
      const sourcePath = fileURLToPath(new URL('../../src/template/expand.ts', import.meta.url));
      const mutantPath = join(dirname(sourcePath), `.diagnostic-mutant-${process.pid}-${kind}.ts`);
      const source = await readFile(sourcePath, 'utf8');
      const mutant = source.replaceAll(`'${kind}'`, "'malformed'");
      expect(mutant).not.toBe(source);
      await writeFile(mutantPath, mutant);
      try {
        const module = (await import(`${pathToFileURL(mutantPath).href}?v=${Date.now()}`)) as typeof import('../../src/template/expand');
        module.registerTemplateParser((text, resolver) =>
          resolver === undefined ? parse(text) : parse(text, undefined, { resolveImport: resolver }),
        );
        expect((await observedKinds(module)).has(kind)).toBe(false);
      } finally {
        await unlink(mutantPath);
      }
    });
  }
});
