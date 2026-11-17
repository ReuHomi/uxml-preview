export interface FontAssetFaceInfo {
  readonly pointSize: number;
  readonly ascentLine: number;
  readonly descentLine: number;
  readonly lineHeight?: number;
}

export type FontAssetReadResult =
  | {
      readonly kind: 'font-asset';
      readonly sourceFontGuid: string | null;
      readonly faceInfo?: FontAssetFaceInfo;
    }
  | { readonly kind: 'unrecognized'; readonly reason: string };

const FACE_INFO_HEADER = /^ {2}m_FaceInfo:\s*$/m;
const FACE_INFO_FIELD = /^ {4}(m_PointSize|m_AscentLine|m_DescentLine|m_LineHeight):\s*([-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?)\s*$/gm;
const SOURCE_GUID = /^ {2}m_SourceFontFileGUID:\s*([0-9a-f]{32})\s*$/gim;
const SOURCE_REFERENCE = /^ {2}m_SourceFontFile:\s*\{[^}]*\bguid:\s*([0-9a-f]{32})/gim;
const TEXTCORE_SCRIPT = /^ {2}m_Script:\s*\{fileID:\s*19001,\s*guid:\s*0000000000000000e000000000000000,\s*type:\s*0\}\s*$/m;
const TEXTCORE_VERSION = /^ {2}m_Version:\s*1\.1\.0\s*$/m;

function faceInfoBlock(source: string): string | null {
  const header = FACE_INFO_HEADER.exec(source);
  if (header === null) return null;
  const start = header.index + header[0].length;
  const lines = source.slice(start).split(/\r?\n/);
  const block: string[] = [];
  for (const line of lines) {
    if (line.trim() === '') {
      block.push(line);
      continue;
    }
    if (!line.startsWith('    ')) break;
    block.push(line);
  }
  return block.join('\n');
}

function firstGuid(pattern: RegExp, source: string): string | null {
  pattern.lastIndex = 0;
  return pattern.exec(source)?.[1] ?? null;
}

export function readFontAsset(source: string): FontAssetReadResult {
  if (!TEXTCORE_SCRIPT.test(source)) {
    return { kind: 'unrecognized', reason: 'm_Script is not a TextCore FontAsset script' };
  }
  if (!TEXTCORE_VERSION.test(source)) {
    return { kind: 'unrecognized', reason: 'm_Version is not a supported TextCore FontAsset version' };
  }

  const sourceFontGuid = firstGuid(SOURCE_GUID, source) ?? firstGuid(SOURCE_REFERENCE, source);
  const block = faceInfoBlock(source);
  if (block === null) {
    return { kind: 'font-asset', sourceFontGuid };
  }

  const values = new Map<string, number>();
  FACE_INFO_FIELD.lastIndex = 0;
  for (const match of block.matchAll(FACE_INFO_FIELD)) {
    values.set(match[1]!, Math.fround(Number(match[2]!)));
  }

  const pointSize = values.get('m_PointSize');
  const ascentLine = values.get('m_AscentLine');
  const descentLine = values.get('m_DescentLine');
  if (pointSize === undefined || ascentLine === undefined || descentLine === undefined) {
    return { kind: 'font-asset', sourceFontGuid };
  }
  const lineHeight = values.get('m_LineHeight');
  return {
    kind: 'font-asset',
    sourceFontGuid,
    faceInfo: { pointSize, ascentLine, descentLine, ...(lineHeight === undefined ? {} : { lineHeight }) },
  };
}
