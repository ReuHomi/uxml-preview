// @vitest-environment node
/**
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * readFontAsset on SYNTHETIC inputs. Each input is a Unity fixture
 * (tests/unity-project/font-assets/6000.3.25f1/inter/) with one edit made here; the
 * edited file was not written by Unity. Expected faceInfo values come from the Unity
 * log of that fixture (measured.json) or from the number the edit puts in.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readFontAsset, type FontAssetResult } from '../../src/unity-project/index';

const DIR = fileURLToPath(new URL('./font-assets/6000.3.25f1/inter/', import.meta.url));
const measured = JSON.parse(readFileSync(DIR + 'measured.json', 'utf8')) as {
  asset: string; sourceFontMeta: string;
  faceInfoR: { pointSize: string; ascentLine: string; descentLine: string; lineHeight: string };
};
const BASE = readFileSync(DIR + measured.asset, 'utf8');
const META_GUID = /^guid: ([0-9a-f]{32})$/m.exec(readFileSync(DIR + measured.sourceFontMeta, 'utf8'))![1]!;

/** The Unity runtime faceInfo of the base fixture, as float32. */
const UNITY = {
  pointSize: Math.fround(Number(measured.faceInfoR.pointSize)),
  ascentLine: Math.fround(Number(measured.faceInfoR.ascentLine)),
  descentLine: Math.fround(Number(measured.faceInfoR.descentLine)),
  lineHeight: Math.fround(Number(measured.faceInfoR.lineHeight)),
};

/** Replaces `from`, which must occur exactly once, so an edit cannot miss or hit twice. */
function replaceOnce(text: string, from: string, to: string): string {
  const at = text.indexOf(from);
  if (at < 0 || text.indexOf(from, at + 1) >= 0) throw new Error(`not exactly one: ${from}`);
  return text.slice(0, at) + to + text.slice(at + from.length);
}

const SCRIPT = 'm_Script: {fileID: 19001, guid: 0000000000000000e000000000000000, type: 0}';
const ASCENT = '    m_AscentLine: 87.1875\n';
// The font asset MonoBehaviour and the document after it, as the fixture writes them.
const MONO_HEADER = '--- !u!114 &11400000\n';
const NEXT_DOC = '--- !u!28 &';

function expectNotRead(r: FontAssetResult, reason: string): void {
  expect(r).toMatchObject({ unrecognized: reason });
  expect(r).not.toHaveProperty('faceInfo');
}

describe('5.5-5.7 inputs that are not read (synthetic)', () => {
  it('5.5 a different m_Script gives not-a-font-asset', () => {
    const other = '{fileID: 11500000, guid: 0123456789abcdef0123456789abcdef, type: 3}';
    const r = readFontAsset(replaceOnce(BASE, SCRIPT, `m_Script: ${other}`));
    expectNotRead(r, 'not-a-font-asset');
    expect(r).toMatchObject({ seen: { script: other } });
  });

  it('5.6 the right m_Script with an unknown m_Version gives unknown-format', () => {
    const r = readFontAsset(replaceOnce(BASE, '  m_Version: 1.1.0\n', '  m_Version: 9.9.9\n'));
    expectNotRead(r, 'unknown-format');
    expect(r).toMatchObject({ seen: { version: '9.9.9' } });
  });

  it('5.7 a faceInfo field that is not a number gives malformed', () => {
    expectNotRead(readFontAsset(replaceOnce(BASE, ASCENT, '    m_AscentLine: abc\n')), 'malformed');
  });

  it('5.7 an empty faceInfo field gives malformed', () => {
    expectNotRead(readFontAsset(replaceOnce(BASE, ASCENT, '    m_AscentLine: \n')), 'malformed');
  });
});

describe('5.9 synthetic inputs that are read', () => {
  it('a. 1.5e-05 reads as Math.fround(0.000015)', () => {
    const r = readFontAsset(replaceOnce(BASE, ASCENT, '    m_AscentLine: 1.5e-05\n'));
    expect(r).toMatchObject({ faceInfo: { ...UNITY, ascentLine: Math.fround(0.000015) } });
  });

  it('b. CRLF line ends give the same result as LF line ends', () => {
    const r = readFontAsset(BASE.replaceAll('\n', '\r\n'));
    expect(r).toMatchObject({ faceInfo: UNITY, sourceFontGuid: META_GUID });
    expect(r).toEqual(readFontAsset(BASE));
  });

  it('c. a field with the same name outside the m_FaceInfo block is not read', () => {
    const decoy = '  m_PointSize: 12\n  m_AscentLine: 1\n  m_DescentLine: -1\n  m_LineHeight: 2\n';
    let text = replaceOnce(BASE, '  m_Version: 1.1.0\n', '  m_Version: 1.1.0\n' + decoy);
    // Also after the block: at the end of the same document.
    text = replaceOnce(text, NEXT_DOC, decoy + NEXT_DOC);
    expect(readFontAsset(text)).toMatchObject({ faceInfo: UNITY });
  });

  it('d. of two MonoBehaviour documents, only the one with the right m_Script is read', () => {
    const start = BASE.indexOf(MONO_HEADER);
    const end = BASE.indexOf(NEXT_DOC, start);
    const mono = BASE.slice(start, end);
    // Another script's document with its own m_FaceInfo values.
    let other = replaceOnce(mono, MONO_HEADER, '--- !u!114 &11400002\n');
    other = replaceOnce(other, SCRIPT, 'm_Script: {fileID: 11500000, guid: 0123456789abcdef0123456789abcdef, type: 3}');
    other = replaceOnce(other, ASCENT, '    m_AscentLine: 1\n');
    other = replaceOnce(other, '    m_PointSize: 90\n', '    m_PointSize: 12\n');
    // Before every document (after the %YAML/%TAG directives) and after the last one.
    const firstDoc = BASE.indexOf('--- ');
    expect(BASE.endsWith('\n')).toBe(true);
    for (const text of [BASE.slice(0, firstDoc) + other + BASE.slice(firstDoc), BASE + other]) {
      expect(readFontAsset(text)).toMatchObject({ faceInfo: UNITY, sourceFontGuid: META_GUID });
    }
  });
});
