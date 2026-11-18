// @vitest-environment node
/**
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * readFontAsset after the independent review of PR #22 (2026-11-18). Synthetic inputs: the 6000.3.25f1 Inter
 * fixture with one line edited here; Unity did not write these files. Expected values come from the contract
 * (JSDoc of readFontAsset, src/unity-project/index.ts) and were written before the reader was run on them.
 *
 * Line terminators (review P2). C4: a value is the text after `key: ` to the end of the line, and a line ends
 * only at LF (a CR right before the LF is not part of it). So U+2028, U+2029 and a lone CR are characters of
 * the value, never the end of a line.
 *
 * Clarifications (human decision 2026-11-18: accept only the form Unity writes):
 *   - fileID is an integer without a sign and without leading zeros; "+19001" and "019001" equal no row (C1).
 *   - A field line is "key: value" (one space after the colon), or exactly "key:"; "key:value" is not a field.
 *   - The m_FaceInfo block starts only at the exact line "  m_FaceInfo:"; with a trailing space it does not (C5).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readFontAsset } from '../../src/unity-project/index';

const DIR = fileURLToPath(new URL('./font-assets/6000.3.25f1/inter/', import.meta.url));
const measured = JSON.parse(readFileSync(DIR + 'measured.json', 'utf8')) as { asset: string; scriptLine: string; versionLine: string };
const BASE = readFileSync(DIR + measured.asset, 'utf8');
const SCRIPT = measured.scriptLine; // m_Script: {fileID: 19001, guid: 0000000000000000e000000000000000, type: 0}
const SCRIPT_VALUE = SCRIPT.slice('m_Script: '.length);
const VERSION_VALUE = measured.versionLine.slice('m_Version: '.length); // 1.1.0

function replaceOnce(text: string, from: string, to: string): string {
  const at = text.indexOf(from);
  if (at < 0 || text.indexOf(from, at + 1) >= 0) throw new Error(`not exactly one: ${from}`);
  return text.slice(0, at) + to + text.slice(at + from.length);
}
const GUID_LINE = /^ {2}m_SourceFontFileGUID: [0-9a-f]{32}\n/m.exec(BASE)![0];
const GUID = GUID_LINE.trim().slice('m_SourceFontFileGUID: '.length);

describe('line terminators: only LF ends a line (C4)', () => {
  it('a. m_SourceFontFileGUID with U+2028 after the 32 hex digits gives malformed', () => {
    const text = replaceOnce(BASE, GUID_LINE, `  m_SourceFontFileGUID: ${GUID} x\n`);
    expect(readFontAsset(text)).toEqual({ unrecognized: 'malformed', seen: { script: SCRIPT_VALUE, version: VERSION_VALUE } });
  });

  it('b. m_Version "1.1.0<U+2028>x" gives unknown-format; seen.version keeps the full text', () => {
    const text = replaceOnce(BASE, `  m_Version: ${VERSION_VALUE}\n`, `  m_Version: ${VERSION_VALUE} x\n`);
    expect(readFontAsset(text)).toEqual({ unrecognized: 'unknown-format', seen: { script: SCRIPT_VALUE, version: `${VERSION_VALUE} x` } });
  });

  it('c. m_Script with U+2028 inside gives not-a-font-asset; seen.script keeps the full text', () => {
    const broken = SCRIPT_VALUE.replace(', guid:', ', guid:');
    expect(broken).not.toBe(SCRIPT_VALUE);
    const text = replaceOnce(BASE, SCRIPT, `m_Script: ${broken}`);
    expect(readFontAsset(text)).toEqual({ unrecognized: 'not-a-font-asset', seen: { script: broken, version: VERSION_VALUE } });
  });

  it('d. a lone CR inside m_Version gives unknown-format; seen.version keeps the CR', () => {
    const text = replaceOnce(BASE, `  m_Version: ${VERSION_VALUE}\n`, '  m_Version: 1.1\r.0\n');
    expect(readFontAsset(text)).toEqual({ unrecognized: 'unknown-format', seen: { script: SCRIPT_VALUE, version: '1.1\r.0' } });
  });
});

describe('clarifications: only the form Unity writes', () => {
  it('fileID "+19001" equals no row: not-a-font-asset', () => {
    const script = SCRIPT_VALUE.replace('fileID: 19001', 'fileID: +19001');
    expect(readFontAsset(replaceOnce(BASE, SCRIPT, `m_Script: ${script}`)))
      .toEqual({ unrecognized: 'not-a-font-asset', seen: { script, version: VERSION_VALUE } });
  });

  it('fileID "019001" equals no row: not-a-font-asset', () => {
    const script = SCRIPT_VALUE.replace('fileID: 19001', 'fileID: 019001');
    expect(readFontAsset(replaceOnce(BASE, SCRIPT, `m_Script: ${script}`)))
      .toEqual({ unrecognized: 'not-a-font-asset', seen: { script, version: VERSION_VALUE } });
  });

  it('"  m_Version:1.1.0" is not a field: no m_Version line, unknown-format, seen has only script', () => {
    expect(readFontAsset(replaceOnce(BASE, `  m_Version: ${VERSION_VALUE}\n`, `  m_Version:${VERSION_VALUE}\n`)))
      .toEqual({ unrecognized: 'unknown-format', seen: { script: SCRIPT_VALUE } });
  });

  it('"  m_FaceInfo: " (trailing space) does not start the block: malformed', () => {
    expect(readFontAsset(replaceOnce(BASE, '  m_FaceInfo:\n', '  m_FaceInfo: \n')))
      .toEqual({ unrecognized: 'malformed', seen: { script: SCRIPT_VALUE, version: VERSION_VALUE } });
  });
});
