// @vitest-environment node
//
// Pure string work, no DOM. jsdom would also break `import.meta.url`, which it
// serves as an http: URL that fileURLToPath rejects.

/**
 * Round-trip: parse a fixture, serialize it back, expect the same bytes.
 *
 * With span re-emission an unedited document is byte-identical by
 * construction, so a failure here means the parser mis-recorded a span, not
 * that the target was too ambitious.
 *
 * What this file does NOT prove: that the tree is correct. Slicing the source
 * reproduces the file even if the parser nested elements wrongly or split
 * attributes at the wrong place, as long as the spans still cover the text.
 * Structure is checked in tests/structure/.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse, serialize } from '../../src/index';

const UXML_DIR = fileURLToPath(new URL('../fixtures/uxml', import.meta.url));
const USS_DIR = fileURLToPath(new URL('../fixtures/uss', import.meta.url));

/** USS fixtures need a document to hang off; this one contributes nothing. */
const HOST_UXML = '<ui:UXML xmlns:ui="UnityEngine.UIElements" />\n';

function fixtures(dir: string, ext: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(ext))
    .sort();
}

function read(dir: string, name: string): string {
  return readFileSync(join(dir, name), 'utf8');
}

const uxmlFixtures = fixtures(UXML_DIR, '.uxml');
const ussFixtures = fixtures(USS_DIR, '.uss');

describe('fixture corpus', () => {
  it('has at least 10 fixtures', () => {
    expect(uxmlFixtures.length + ussFixtures.length).toBeGreaterThanOrEqual(10);
  });

  // Without this, an editor or a git config that normalises line endings would
  // quietly turn the CRLF round-trip cases into duplicates of the LF ones and
  // nothing would fail.
  it('keeps the CRLF fixtures in CRLF', () => {
    expect(read(UXML_DIR, 'crlf.uxml')).toContain('\r\n');
    expect(read(USS_DIR, 'crlf.uss')).toContain('\r\n');
  });

  it('keeps prologue.uxml without a trailing newline', () => {
    expect(read(UXML_DIR, 'prologue.uxml').endsWith('\n')).toBe(false);
  });
});

describe('round-trip: UXML', () => {
  for (const name of uxmlFixtures) {
    it(`${name} is byte-identical after parse -> serialize`, () => {
      const original = read(UXML_DIR, name);
      const { uxml } = serialize(parse(original));
      expect(uxml).toBe(original);
    });
  }
});

describe('round-trip: USS', () => {
  for (const name of ussFixtures) {
    it(`${name} is byte-identical after parse -> serialize`, () => {
      const original = read(USS_DIR, name);
      const { uss } = serialize(parse(HOST_UXML, original));
      expect(uss).toBe(original);
    });
  }
});
