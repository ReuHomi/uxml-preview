// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { parse, serialize } from '../../src/index';
import { CASES } from './cases';

describe('template corpus round-trip', () => {
  for (const fixture of CASES) {
    it(`${fixture.id} and its helper UXML remain byte-identical`, () => {
      expect(serialize(parse(fixture.uxml)).uxml).toBe(fixture.uxml);
      for (const [path, source] of Object.entries(fixture.files ?? {})) {
        if (!path.endsWith('.uxml')) continue;
        expect(serialize(parse(source)).uxml, path).toBe(source);
      }
    });
  }
});
