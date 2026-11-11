// @vitest-environment node
/**
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * readFontAsset against Unity output. Every expected value comes from a fixture in
 * tests/unity-project/font-assets/ (README there): the runtime faceInfo that Unity
 * logged with "R" (measured.json), the guid line of the source font .meta, and the
 * m_Script / m_Version lines of the .asset file. None comes from an implementation.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  KNOWN_FONT_ASSET_FORMATS, readFontAsset,
  type FontAssetFormat, type FontAssetRead, type FontAssetResult,
} from '../../src/unity-project/index';

const ROOT = fileURLToPath(new URL('./font-assets/', import.meta.url));

interface Measured {
  unity: string;
  asset: string;
  sourceFontMeta: string;
  scriptLine: string;
  versionLine: string;
  documentOrder: string[];
  faceInfoR?: { pointSize: string; ascentLine: string; descentLine: string; lineHeight: string };
}

interface Fixture { dir: string; font: string; measured: Measured; text: string; metaGuid: string }

function load(dir: string): Fixture {
  const path = ROOT + dir + '/';
  const measured = JSON.parse(readFileSync(path + 'measured.json', 'utf8')) as Measured;
  const meta = readFileSync(path + measured.sourceFontMeta, 'utf8');
  const metaGuid = /^guid: ([0-9a-f]{32})$/m.exec(meta)?.[1];
  if (metaGuid === undefined) throw new Error(`no guid in ${dir}/${measured.sourceFontMeta}`);
  return { dir, font: dir.split('/')[1]!, measured, text: readFileSync(path + measured.asset, 'utf8'), metaGuid };
}

const UNITY_VERSIONS = ['6000.0.40f1', '6000.3.25f1'];
const TMP_DIR = '6000.3.25f1/tmp-inter';
// Text Core fixtures: every <version>/<font> folder except the TextMeshPro one.
const textCore: Fixture[] = UNITY_VERSIONS.flatMap(v =>
  readdirSync(ROOT + v, { withFileTypes: true })
    .filter(e => e.isDirectory() && `${v}/${e.name}` !== TMP_DIR)
    .map(e => load(`${v}/${e.name}`)));

/** The format the fixture's own header lines state (step 2.6), parsed here, not by the reader. */
function formatFromLines(m: Measured): FontAssetFormat {
  const script = /^m_Script: \{fileID: (\d+), guid: ([0-9a-f]{32}), type: \d+\}$/.exec(m.scriptLine);
  const version = /^m_Version: (\S+)$/.exec(m.versionLine);
  if (script === null || version === null) throw new Error(`bad header lines in ${m.asset}`);
  return { scriptFileId: Number(script[1]), scriptGuid: script[2]!, version: version[1]! };
}

function expectRead(r: FontAssetResult): FontAssetRead {
  expect(r).not.toHaveProperty('unrecognized');
  return r as FontAssetRead;
}

// Guards the loops below against a fixture folder that silently went missing.
// A module-level check, so it is not a test that passes with the stub.
const EXPECTED_SET = '6000.0.40f1/inter,6000.0.40f1/noto-sans-kr,6000.3.25f1/inter,6000.3.25f1/noto-sans-kr';
if (textCore.map(f => f.dir).sort().join() !== EXPECTED_SET
  || textCore.some(f => f.measured.faceInfoR === undefined)) {
  throw new Error(`font asset fixture set changed: ${textCore.map(f => f.dir).join()}`);
}

describe('5.1 faceInfo equals Math.fround of the Unity value', () => {
  for (const f of textCore) {
    it(f.dir, () => {
      const u = f.measured.faceInfoR!;
      expect(expectRead(readFontAsset(f.text)).faceInfo).toEqual({
        pointSize: Math.fround(Number(u.pointSize)),
        ascentLine: Math.fround(Number(u.ascentLine)),
        descentLine: Math.fround(Number(u.descentLine)),
        lineHeight: Math.fround(Number(u.lineHeight)),
      });
    });
  }
});

describe('5.2 sourceFontGuid equals the guid in the source font .meta', () => {
  for (const f of textCore) {
    it(f.dir, () => {
      expect(expectRead(readFontAsset(f.text)).sourceFontGuid).toBe(f.metaGuid);
    });
  }
});

describe('5.3 the measured differences between Unity versions do not change the result', () => {
  // Measured differences: m_EditorClassIdentifier, m_IsMultiAtlasTexturesEnabled,
  // m_ClearDynamicDataOnBuild, and the order of the YAML documents (README).
  for (const font of ['inter', 'noto-sans-kr']) {
    it(`a. ${font}: 6000.0.40f1 and 6000.3.25f1 give the same faceInfo and format`, () => {
      const [old, cur] = UNITY_VERSIONS.map(v => textCore.find(f => f.dir === `${v}/${font}`)!);
      const a = expectRead(readFontAsset(old!.text));
      const b = expectRead(readFontAsset(cur!.text));
      expect(b.faceInfo).toEqual(a.faceInfo);
      expect(b.format).toEqual(a.format);
    });
  }

  it('b. the font asset document is found by m_Script, not by its position', () => {
    // Precondition from the fixtures: the MonoBehaviour is not always at the same index.
    const positions = new Set(textCore.map(f => f.measured.documentOrder.indexOf('MonoBehaviour')));
    expect(positions.size).toBeGreaterThan(1);
    for (const f of textCore) {
      expect(expectRead(readFontAsset(f.text)).format, f.dir).toEqual(formatFromLines(f.measured));
    }
  });
});

describe('5.4 KNOWN_FONT_ASSET_FORMATS and the fixtures prove each other', () => {
  it('each row has a fixture on each Unity version it names', () => {
    for (const row of KNOWN_FONT_ASSET_FORMATS) {
      const { measuredOn, ...format } = row;
      expect(measuredOn.length).toBeGreaterThan(0);
      for (const unity of measuredOn) {
        const proving = textCore.filter(f => f.measured.unity === unity
          && JSON.stringify(expectRead(readFontAsset(f.text)).format) === JSON.stringify(format));
        expect(proving.length, `${JSON.stringify(format)} on ${unity}`).toBeGreaterThan(0);
      }
    }
  });

  it('each fixture format is in the table, for its Unity version', () => {
    for (const f of textCore) {
      const format = expectRead(readFontAsset(f.text)).format;
      expect(format, f.dir).toEqual(formatFromLines(f.measured));
      const row = KNOWN_FONT_ASSET_FORMATS.find(r => r.scriptFileId === format.scriptFileId
        && r.scriptGuid === format.scriptGuid && r.version === format.version);
      expect(row?.measuredOn, f.dir).toContain(f.measured.unity);
    }
  });
});

describe('5.8 TextMeshPro asset: same m_Version, different m_Script', () => {
  it('gives not-a-font-asset and no faceInfo', () => {
    const tmp = load(TMP_DIR);
    // From the fixture: TMP writes m_Version 1.1.0, like Text Core.
    expect(tmp.measured.versionLine).toBe('m_Version: 1.1.0');
    const r = readFontAsset(tmp.text);
    expect(r).toMatchObject({
      unrecognized: 'not-a-font-asset',
      seen: { script: tmp.measured.scriptLine.slice('m_Script: '.length) },
    });
    expect(r).not.toHaveProperty('faceInfo');
  });
});
