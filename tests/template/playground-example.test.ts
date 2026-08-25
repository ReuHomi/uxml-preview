// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { expandTemplates, parse } from '../../src/index';
import type { ElementNode } from '../../src/model/types';
import { EXAMPLES, resolveExampleImport } from '../../playground/examples';

describe('template playground example', () => {
  it('expands four instances and exposes the intentional override typo', () => {
    const example = EXAMPLES.find((item) => item.name.startsWith('Templates:'))!;
    const files = example.files!;
    const expanded = expandTemplates(
      parse(example.uxml, example.uss, {
        resolveImport: (url, from) => resolveExampleImport(files, url, from),
      }),
    );
    const texts: string[] = [];
    let containers = 0;
    const walk = (node: ElementNode): void => {
      if (node.derived?.kind === 'template-container') containers++;
      const text = node.attributes.find((attribute) => attribute.name === 'text')?.value;
      if (text !== undefined) texts.push(text);
      node.children.forEach(walk);
    };
    walk(expanded.document.root);

    expect(containers).toBe(4);
    expect(texts).toEqual(expect.arrayContaining(['Potion', 'Key', 'Map', 'Empty']));
    const typo = expanded.warnings.find((warning) => warning.kind === 'override-target-missing');
    expect(typo?.message).toContain('item-naem');
    expect(typo?.message).toContain('item-name');
  });
});
