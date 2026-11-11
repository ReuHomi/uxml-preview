// @vitest-environment node
/**
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * readFontAsset on SYNTHETIC inputs. Every input here is synthetic: a Unity fixture
 * (tests/unity-project/font-assets/6000.3.25f1/inter/) with edits made here, or a
 * small document written here. Unity did not write these files. Expected values come
 * from the fixture (its Unity log in measured.json, its header lines, its .meta guid),
 * from the text the edit puts in, and from the contract rules C1-C9 in the JSDoc of
 * readFontAsset (src/unity-project/index.ts). Each test compares the whole result.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readFontAsset, type FontAssetResult } from '../../src/unity-project/index';

const DIR = fileURLToPath(new URL('./font-assets/6000.3.25f1/inter/', import.meta.url));
const measured = JSON.parse(readFileSync(DIR + 'measured.json', 'utf8')) as {
  asset: string; sourceFontMeta: string; scriptLine: string; versionLine: string;
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

const SCRIPT = measured.scriptLine; // m_Script: {fileID: 19001, guid: 0000000000000000e000000000000000, type: 0}
const SCRIPT_VALUE = SCRIPT.slice('m_Script: '.length);
const VERSION_VALUE = measured.versionLine.slice('m_Version: '.length); // 1.1.0
const FORMAT = { scriptFileId: 19001, scriptGuid: '0000000000000000e000000000000000', version: VERSION_VALUE };
const OTHER_SCRIPT = '{fileID: 11500000, guid: 0123456789abcdef0123456789abcdef, type: 3}';

/** The read result the base fixture gives, with `faceInfo` fields overridden. */
function read(faceInfo: Partial<typeof UNITY> = {}, sourceFontGuid: string | null = META_GUID): FontAssetResult {
  return { format: FORMAT, sourceFontGuid, faceInfo: { ...UNITY, ...faceInfo } };
}
/** A not-read result whose seen is the base fixture's candidate document. */
function notRead(unrecognized: string, seen: object = { script: SCRIPT_VALUE, version: VERSION_VALUE }): unknown {
  return { unrecognized, seen };
}

/** Replaces `from`, which must occur exactly once, so an edit cannot miss or hit twice. */
function replaceOnce(text: string, from: string, to: string): string {
  const at = text.indexOf(from);
  if (at < 0 || text.indexOf(from, at + 1) >= 0) throw new Error(`not exactly one: ${from}`);
  return text.slice(0, at) + to + text.slice(at + from.length);
}

const VERSION = `  m_Version: ${VERSION_VALUE}\n`;
const POINT = '    m_PointSize: 90\n';
const ASCENT = '    m_AscentLine: 87.1875\n';
const DESCENT = '    m_DescentLine: -21.708984\n';
const LINE_HEIGHT = '    m_LineHeight: 108.896484\n';
const GUID_LINE = `  m_SourceFontFileGUID: ${META_GUID}\n`;
// The font asset MonoBehaviour and the document after it, as the fixture writes them.
const MONO_HEADER = '--- !u!114 &11400000\n';
const NEXT_DOC = '--- !u!28 &';
const MONO = BASE.slice(BASE.indexOf(MONO_HEADER), BASE.indexOf(NEXT_DOC));
const FIRST_DOC = BASE.indexOf('--- ');
/** BASE with `doc` put before every document (after the %YAML/%TAG lines). */
const before = (doc: string) => BASE.slice(0, FIRST_DOC) + doc + BASE.slice(FIRST_DOC);
/** BASE with the font asset MonoBehaviour replaced by `doc`. */
const instead = (doc: string) => replaceOnce(BASE, MONO, doc);
/** A copy of the font asset MonoBehaviour under another anchor, with edits. */
function copyOfMono(...edits: [string, string][]): string {
  let doc = replaceOnce(MONO, MONO_HEADER, '--- !u!114 &11400002\n');
  for (const [from, to] of edits) doc = replaceOnce(doc, from, to);
  return doc;
}

it('preconditions of the edits below', () => {
  // A fixture check that does not call the reader would pass with the stub, so it
  // ends with the reader on the unedited fixture.
  expect(BASE.startsWith('%YAML 1.1\n%TAG !u! tag:unity3d.com,2011:\n--- !u!21 ')).toBe(true);
  expect(MONO.startsWith(MONO_HEADER)).toBe(true);
  expect(readFontAsset(BASE)).toEqual(read());
});

describe('not read (synthetic)', () => {
  it('5.5 a different m_Script gives not-a-font-asset', () => {
    expect(readFontAsset(replaceOnce(BASE, SCRIPT, `m_Script: ${OTHER_SCRIPT}`)))
      .toEqual(notRead('not-a-font-asset', { script: OTHER_SCRIPT, version: VERSION_VALUE }));
  });

  it('5.6 the right m_Script with an unknown m_Version gives unknown-format', () => {
    expect(readFontAsset(replaceOnce(BASE, VERSION, '  m_Version: 9.9.9\n')))
      .toEqual(notRead('unknown-format', { script: SCRIPT_VALUE, version: '9.9.9' }));
  });

  it('5.7 / T18 a faceInfo field that is not a number gives malformed', () => {
    expect(readFontAsset(replaceOnce(BASE, ASCENT, '    m_AscentLine: abc\n'))).toEqual(notRead('malformed'));
  });

  it('5.7 / T18 an empty faceInfo field gives malformed', () => {
    expect(readFontAsset(replaceOnce(BASE, ASCENT, '    m_AscentLine: \n'))).toEqual(notRead('malformed'));
  });

  it('a file with no MonoBehaviour document gives not-a-font-asset with an empty seen', () => {
    const text = instead('');
    expect(text).not.toContain('--- !u!114');
    expect(readFontAsset(text)).toEqual(notRead('not-a-font-asset', {}));
  });

  it('T5 seen keeps a space at the end of the m_Script line', () => {
    expect(readFontAsset(replaceOnce(BASE, SCRIPT + '\n', SCRIPT + ' \n')))
      .toEqual(notRead('not-a-font-asset', { script: SCRIPT_VALUE + ' ', version: VERSION_VALUE }));
  });

  it('T5 seen keeps a space at the end of the m_Version line', () => {
    expect(readFontAsset(replaceOnce(BASE, VERSION, `  m_Version: ${VERSION_VALUE} \n`)))
      .toEqual(notRead('unknown-format', { script: SCRIPT_VALUE, version: VERSION_VALUE + ' ' }));
  });

  it('T7 seen comes from the candidate, not from an earlier MonoBehaviour', () => {
    const first = copyOfMono([SCRIPT, `m_Script: ${OTHER_SCRIPT}`]);
    const text = replaceOnce(before(first), MONO, replaceOnce(MONO, VERSION, '  m_Version: 9\n'));
    expect(readFontAsset(text)).toEqual(notRead('unknown-format', { script: SCRIPT_VALUE, version: '9' }));
  });

  it('T8 the right guid with a different fileID gives not-a-font-asset', () => {
    const script = '{fileID: 19002, guid: 0000000000000000e000000000000000, type: 0}';
    expect(readFontAsset(replaceOnce(BASE, SCRIPT, `m_Script: ${script}`)))
      .toEqual(notRead('not-a-font-asset', { script, version: VERSION_VALUE }));
  });

  it('T8 the right fileID with a different guid gives not-a-font-asset', () => {
    const script = '{fileID: 19001, guid: 0000000000000000f000000000000000, type: 0}';
    expect(readFontAsset(replaceOnce(BASE, SCRIPT, `m_Script: ${script}`)))
      .toEqual(notRead('not-a-font-asset', { script, version: VERSION_VALUE }));
  });

  it('T9 a number followed by text gives malformed', () => {
    expect(readFontAsset(replaceOnce(BASE, ASCENT, '    m_AscentLine: 1x\n'))).toEqual(notRead('malformed'));
  });

  it('T11 "MonoBehaviour: {}" gives not-a-font-asset with an empty seen', () => {
    expect(readFontAsset(instead(MONO_HEADER + 'MonoBehaviour: {}\n'))).toEqual(notRead('not-a-font-asset', {}));
  });

  it('T11 a MonoBehaviour with only an m_Script line: seen has only script', () => {
    const text = instead(`${MONO_HEADER}MonoBehaviour:\n  m_Script: ${OTHER_SCRIPT}\n`);
    expect(readFontAsset(text)).toEqual(notRead('not-a-font-asset', { script: OTHER_SCRIPT }));
  });

  it('T11 a MonoBehaviour with only an m_Version line: seen has only version', () => {
    const text = instead(`${MONO_HEADER}MonoBehaviour:\n${VERSION}`);
    expect(readFontAsset(text)).toEqual(notRead('not-a-font-asset', { version: VERSION_VALUE }));
  });

  it('T12 no m_LineHeight line gives malformed', () => {
    expect(readFontAsset(replaceOnce(BASE, LINE_HEIGHT, ''))).toEqual(notRead('malformed'));
  });

  it('T12 no m_FaceInfo block gives malformed', () => {
    const block = /\n {2}m_FaceInfo:\n(?: {4}.*\n)*/.exec(MONO)![0];
    expect(block).toContain(LINE_HEIGHT);
    expect(readFontAsset(replaceOnce(BASE, block, '\n'))).toEqual(notRead('malformed'));
  });

  it('T13 the right m_Script and no m_Version line give unknown-format; seen has only script', () => {
    expect(readFontAsset(replaceOnce(BASE, VERSION, ''))).toEqual(notRead('unknown-format', { script: SCRIPT_VALUE }));
  });

  it('T14 an m_SourceFontFileGUID that is not 32 hex characters gives malformed', () => {
    expect(readFontAsset(replaceOnce(BASE, GUID_LINE, '  m_SourceFontFileGUID: xyz\n'))).toEqual(notRead('malformed'));
  });

  it('T15 a value that is not finite after Math.fround gives malformed', () => {
    expect(readFontAsset(replaceOnce(BASE, ASCENT, '    m_AscentLine: 1e99\n'))).toEqual(notRead('malformed'));
  });

  it('T17 a CRLF file that is not read: seen has no CR', () => {
    const text = replaceOnce(BASE, VERSION, '  m_Version: 9.9.9\n').replaceAll('\n', '\r\n');
    expect(readFontAsset(text)).toEqual(notRead('unknown-format', { script: SCRIPT_VALUE, version: '9.9.9' }));
  });
});

describe('read (synthetic)', () => {
  it('5.9a 1.5e-05 reads as Math.fround(0.000015)', () => {
    expect(readFontAsset(replaceOnce(BASE, ASCENT, '    m_AscentLine: 1.5e-05\n')))
      .toEqual(read({ ascentLine: Math.fround(0.000015) }));
  });

  it('5.9b CRLF line ends give the same result as LF line ends', () => {
    expect(readFontAsset(BASE.replaceAll('\n', '\r\n'))).toEqual(read());
  });

  it('5.9c a field with the same name outside the m_FaceInfo block is not read', () => {
    const decoy = '  m_PointSize: 12\n  m_AscentLine: 1\n  m_DescentLine: -1\n  m_LineHeight: 2\n';
    let text = replaceOnce(BASE, VERSION, VERSION + decoy);
    text = replaceOnce(text, NEXT_DOC, decoy + NEXT_DOC); // and after the block, at the end of the document
    expect(readFontAsset(text)).toEqual(read());
  });

  it('5.9d a MonoBehaviour with another m_Script is not read, before or after the candidate', () => {
    const other = copyOfMono([SCRIPT, `m_Script: ${OTHER_SCRIPT}`], [ASCENT, '    m_AscentLine: 1\n'], [POINT, '    m_PointSize: 12\n']);
    expect(BASE.endsWith('\n')).toBe(true);
    expect(readFontAsset(before(other))).toEqual(read());
    expect(readFontAsset(BASE + other)).toEqual(read());
  });

  it('T6 no m_SourceFontFileGUID line gives sourceFontGuid null and no unrecognized key', () => {
    // Whether Unity writes such a file is unmeasured (docs/backlog.md).
    expect(readFontAsset(replaceOnce(BASE, GUID_LINE, ''))).toEqual(read({}, null));
  });

  it('T14 an empty m_SourceFontFileGUID gives null', () => {
    expect(readFontAsset(replaceOnce(BASE, GUID_LINE, '  m_SourceFontFileGUID: \n'))).toEqual(read({}, null));
  });

  it('T1 m_PointSize is read even for a family name seen before', () => {
    expect(BASE).toContain('    m_FamilyName: Inter\n');
    expect(readFontAsset(replaceOnce(BASE, POINT, '    m_PointSize: 1\n'))).toEqual(read({ pointSize: 1 }));
  });

  it('T2 a field of a nested mapping in m_FaceInfo is not read', () => {
    const text = replaceOnce(BASE, '  m_FaceInfo:\n', '  m_FaceInfo:\n    m_Nested:\n      m_AscentLine: 2\n');
    expect(readFontAsset(text)).toEqual(read());
  });

  it('T3 -1e-1 reads as Math.fround(-0.1)', () => {
    expect(readFontAsset(replaceOnce(BASE, DESCENT, '    m_DescentLine: -1e-1\n')))
      .toEqual(read({ descentLine: Math.fround(-0.1) }));
  });

  it('T4 m_SourceFontFileGUID of another document is not read', () => {
    const decoy = '  m_SourceFontFileGUID: 0123456789abcdef0123456789abcdef\n';
    const text = replaceOnce(replaceOnce(BASE, GUID_LINE, ''), 'Material:\n', 'Material:\n' + decoy);
    expect(readFontAsset(text)).toEqual(read({}, null));
  });

  it('T10 m_PointSize 0.1 reads as Math.fround(0.1)', () => {
    expect(readFontAsset(replaceOnce(BASE, POINT, '    m_PointSize: 0.1\n'))).toEqual(read({ pointSize: Math.fround(0.1) }));
  });

  it('T16 of two candidate documents, the first one is read', () => {
    // Two candidates in one file is unmeasured (docs/backlog.md); C1 fixes the result.
    const second = copyOfMono([ASCENT, '    m_AscentLine: 1\n']);
    expect(readFontAsset(BASE + second)).toEqual(read());
    expect(readFontAsset(before(second))).toEqual(read({ ascentLine: 1 }));
  });
});
