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

describe('readFontAsset', () => {
  it('reads the source font GUID and FaceInfo from a TextCore FontAsset', () => {
    expect(readFontAsset(HEADER + FACE)).toEqual({
      kind: 'font-asset',
      sourceFontGuid: '9028724ab4860dc4986985c027881692',
      faceInfo: {
        pointSize: Math.fround(90),
        lineHeight: Math.fround(105.46875),
        ascentLine: Math.fround(83.49609),
        descentLine: Math.fround(-21.972656),
      },
    });
  });

  it('parses scientific notation and rounds values to float32', () => {
    const source = `${HEADER}  m_FaceInfo:
    m_PointSize: 1.5e-05
    m_AscentLine: 119.70703
    m_DescentLine: -2.5e-06
  m_FallbackFontAssetTable: []
`;
    const result = readFontAsset(source);

    expect(result.kind).toBe('font-asset');
    if (result.kind !== 'font-asset') return;
    expect(result.faceInfo).toEqual({
      pointSize: Math.fround(1.5e-05),
      ascentLine: Math.fround(119.70703),
      descentLine: Math.fround(-2.5e-06),
    });
  });

  it('only reads m_FaceInfo fields from the m_FaceInfo block', () => {
    const source = `${HEADER}  m_FaceInfo:
    m_PointSize: 90
    m_AscentLine: 10
    m_DescentLine: -2
  m_FontAssetCreationEditorSettings:
    m_PointSize: 999
    m_AscentLine: 999
    m_DescentLine: -999
`;
    const result = readFontAsset(source);

    expect(result.kind).toBe('font-asset');
    if (result.kind !== 'font-asset') return;
    expect(result.faceInfo).toEqual({
      pointSize: Math.fround(90),
      ascentLine: Math.fround(10),
      descentLine: Math.fround(-2),
    });
  });

  it('rejects a different m_Script', () => {
    const source = HEADER.replace('fileID: 19001', 'fileID: 19002') + FACE;
    expect(readFontAsset(source)).toEqual({
      kind: 'unrecognized',
      reason: 'm_Script is not a TextCore FontAsset script',
    });
  });

  it('rejects a different m_Version', () => {
    const source = HEADER.replace('m_Version: 1.1.0', 'm_Version: 2.0.0') + FACE;
    expect(readFontAsset(source)).toEqual({
      kind: 'unrecognized',
      reason: 'm_Version is not a supported TextCore FontAsset version',
    });
  });

  it('keeps a recognized font asset without FaceInfo', () => {
    expect(readFontAsset(HEADER)).toEqual({
      kind: 'font-asset',
      sourceFontGuid: '9028724ab4860dc4986985c027881692',
    });
  });

  it('falls back to the m_SourceFontFile reference for the source GUID', () => {
    const source = HEADER.replace(
      '  m_SourceFontFileGUID: 9028724ab4860dc4986985c027881692\n',
      '  m_SourceFontFile: {fileID: 12800000, guid: 0123456789abcdef0123456789abcdef, type: 3}\n',
    ) + FACE;
    const result = readFontAsset(source);

    expect(result.kind).toBe('font-asset');
    if (result.kind !== 'font-asset') return;
    expect(result.sourceFontGuid).toBe('0123456789abcdef0123456789abcdef');
  });
});
