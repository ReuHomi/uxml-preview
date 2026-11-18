// The seven tests of PR #21 (xAFK-BOTx), in the contract shape (rules C1-C9 in the
// JSDoc of readFontAsset, src/unity-project/index.ts). Inputs are synthetic and kept
// as the PR wrote them; expectations follow the contract. No measured fixture has a
// value in exponent notation: the exponent cases only check that the C7 pattern
// accepts it.
import { describe, expect, it } from 'vitest';

import { readFontAsset } from '../../src/unity-project';

const HEADER = `%YAML 1.1
%TAG !u! tag:unity3d.com,2011:
--- !u!114 &11400000
MonoBehaviour:
  m_Script: {fileID: 19001, guid: 0000000000000000e000000000000000, type: 0}
  m_Version: 1.1.0
  m_SourceFontFileGUID: 9028724ab4860dc4986985c027881692
`;

const FACE = `  m_FaceInfo:
    m_PointSize: 90
    m_LineHeight: 105.46875
    m_AscentLine: 83.49609
    m_DescentLine: -21.972656
  m_FallbackFontAssetTable: []
`;

const FORMAT = { scriptFileId: 19001, scriptGuid: '0000000000000000e000000000000000', version: '1.1.0' };
const SEEN = { script: '{fileID: 19001, guid: 0000000000000000e000000000000000, type: 0}', version: '1.1.0' };

describe('readFontAsset (PR #21 cases)', () => {
  it('reads the source font GUID and FaceInfo from a TextCore FontAsset', () => {
    expect(readFontAsset(HEADER + FACE)).toEqual({
      format: FORMAT,
      sourceFontGuid: '9028724ab4860dc4986985c027881692',
      faceInfo: {
        pointSize: Math.fround(90),
        lineHeight: Math.fround(105.46875),
        ascentLine: Math.fround(83.49609),
        descentLine: Math.fround(-21.972656),
      },
    });
  });

  it('exponent values with no m_LineHeight line give malformed (C5)', () => {
    const source = `${HEADER}  m_FaceInfo:
    m_PointSize: 1.5e-05
    m_AscentLine: 119.70703
    m_DescentLine: -2.5e-06
  m_FallbackFontAssetTable: []
`;
    expect(readFontAsset(source)).toEqual({ unrecognized: 'malformed', seen: SEEN });
  });

  it('m_FaceInfo with no m_LineHeight gives malformed, whatever another block holds (C5)', () => {
    const source = `${HEADER}  m_FaceInfo:
    m_PointSize: 90
    m_AscentLine: 10
    m_DescentLine: -2
  m_FontAssetCreationEditorSettings:
    m_PointSize: 999
    m_AscentLine: 999
    m_DescentLine: -999
`;
    expect(readFontAsset(source)).toEqual({ unrecognized: 'malformed', seen: SEEN });
  });

  it('rejects a different m_Script', () => {
    const source = HEADER.replace('fileID: 19001', 'fileID: 19002') + FACE;
    expect(readFontAsset(source)).toEqual({
      unrecognized: 'not-a-font-asset',
      seen: { ...SEEN, script: '{fileID: 19002, guid: 0000000000000000e000000000000000, type: 0}' },
    });
  });

  it('rejects a different m_Version', () => {
    const source = HEADER.replace('m_Version: 1.1.0', 'm_Version: 2.0.0') + FACE;
    expect(readFontAsset(source)).toEqual({ unrecognized: 'unknown-format', seen: { ...SEEN, version: '2.0.0' } });
  });

  it('a recognized font asset without FaceInfo gives malformed (C5)', () => {
    expect(readFontAsset(HEADER)).toEqual({ unrecognized: 'malformed', seen: SEEN });
  });

  it('m_SourceFontFile is not read for the source GUID (C8)', () => {
    const source = HEADER.replace(
      '  m_SourceFontFileGUID: 9028724ab4860dc4986985c027881692\n',
      '  m_SourceFontFile: {fileID: 12800000, guid: 0123456789abcdef0123456789abcdef, type: 3}\n',
    ) + FACE;
    expect(readFontAsset(source)).toEqual({
      format: FORMAT,
      sourceFontGuid: null,
      faceInfo: {
        pointSize: Math.fround(90),
        lineHeight: Math.fround(105.46875),
        ascentLine: Math.fround(83.49609),
        descentLine: Math.fround(-21.972656),
      },
    });
  });
});
