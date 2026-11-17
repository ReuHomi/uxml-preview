import type { FontAssetNotRead, FontAssetResult, KnownFontAssetFormat } from './index';

const SCRIPT = /^\{fileID: (-?\d+), guid: ([0-9a-f]{32}), type: (-?\d+)\}$/;
const NUMBER = /^[+-]?(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?$/;

function fields(lines: readonly string[], indent: number): Map<string, string> {
  const pattern = new RegExp(`^ {${indent}}([^\\s:]+):(?: (.*))?$`);
  const values = new Map<string, string>();
  for (const line of lines) {
    const match = pattern.exec(line);
    if (match && !values.has(match[1]!)) values.set(match[1]!, match[2] ?? '');
  }
  return values;
}

function faceInfoBlock(lines: readonly string[]): readonly string[] | null {
  const start = lines.findIndex(line => /^ {2}m_FaceInfo:(?: |$)/.test(line));
  if (start < 0 || lines[start] !== '  m_FaceInfo:') return null;
  let end = start + 1;
  while (end < lines.length && lines[end]!.startsWith('    ')) end++;
  return lines.slice(start + 1, end);
}

/**
 * Purpose: implement the C1-C9 contract on readFontAsset in index.ts.
 */
export function readFontAssetText(text: string, formats: readonly KnownFontAssetFormat[]): FontAssetResult {
  const documents: string[][] = [];
  let document: string[] | undefined;
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (line.startsWith('--- ')) {
      document = line.startsWith('--- !u!114 ') ? [] : undefined;
      if (document) documents.push(document);
    } else {
      document?.push(line);
    }
  }

  let candidate: readonly string[] | undefined;
  let rows: readonly KnownFontAssetFormat[] = [];
  let values = fields(documents[0] ?? [], 2);
  for (const doc of documents) {
    const docValues = fields(doc, 2);
    const script = SCRIPT.exec(docValues.get('m_Script') ?? '');
    if (!script) continue;
    rows = formats.filter(row => row.scriptFileId === Number(script[1]) && row.scriptGuid === script[2]);
    if (rows.length === 0) continue;
    candidate = doc;
    values = docValues;
    break;
  }

  const seen: FontAssetNotRead['seen'] = {};
  if (values.has('m_Script')) seen.script = values.get('m_Script')!;
  if (values.has('m_Version')) seen.version = values.get('m_Version')!;
  if (!candidate) return { unrecognized: 'not-a-font-asset', seen };
  const format = rows.find(row => row.version === values.get('m_Version'));
  if (!format) return { unrecognized: 'unknown-format', seen };

  const block = faceInfoBlock(candidate);
  if (block === null) return { unrecognized: 'malformed', seen };
  const faceValues = fields(block, 4);
  const numbers: number[] = [];
  for (const key of ['m_PointSize', 'm_AscentLine', 'm_DescentLine', 'm_LineHeight']) {
    const value = faceValues.get(key);
    if (value === undefined || !NUMBER.test(value)) return { unrecognized: 'malformed', seen };
    const number = Math.fround(Number(value));
    if (!Number.isFinite(number)) return { unrecognized: 'malformed', seen };
    numbers.push(number);
  }
  const sourceFontGuid = values.get('m_SourceFontFileGUID') || null;
  if (sourceFontGuid !== null && !/^[0-9a-fA-F]{32}$/.test(sourceFontGuid)) {
    return { unrecognized: 'malformed', seen };
  }
  return {
    format: { scriptFileId: format.scriptFileId, scriptGuid: format.scriptGuid, version: format.version },
    sourceFontGuid,
    faceInfo: { pointSize: numbers[0]!, ascentLine: numbers[1]!, descentLine: numbers[2]!, lineHeight: numbers[3]! },
  };
}
