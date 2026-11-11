/**
 * Node-only entry point (uses `node:fs`). The main package entry stays
 * browser-safe, so this lives on its own `exports` subpath rather than
 * being folded into `src/index.ts`.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { FaceInfo } from '../render/measure';

export interface GuidIndex {
  /** Absolute path of the asset with this GUID, or null. */
  get(guid: string): string | null;
  /** Number of entries. Lets a host report an empty scan. */
  readonly size: number;
}

const EXCLUDED_DIRS = new Set(['Library', 'Temp', 'obj', '.git']);
const GUID_LINE = /^guid:\s*([0-9a-fA-F]+)/m;

/**
 * Purpose: resolve a `project://database/Assets/...` reference whose file has
 * moved, by walking `.meta` files for their `guid:` line instead.
 * Deps/Effects: reads the directory tree under `projectRoot`; unreadable
 * `.meta` files are skipped rather than thrown, so one bad file cannot fail
 * the whole scan.
 */
export async function buildGuidIndex(projectRoot: string): Promise<GuidIndex> {
  const map = new Map<string, string>();
  await scan(projectRoot, map);
  return {
    get(guid: string): string | null {
      return map.get(guid) ?? null;
    },
    get size(): number {
      return map.size;
    },
  };
}

async function scan(dir: string, map: Map<string, string>): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      await scan(path, map);
      continue;
    }
    if (!entry.name.endsWith('.meta')) continue;
    const guid = await readGuid(path);
    if (guid === null) continue;
    map.set(guid, path.slice(0, -'.meta'.length));
  }
}

// ---------------------------------------------------------------------------
// Font asset reader (0.8.0). Contract and table only; the reader is not
// written yet. Fixtures: tests/unity-project/font-assets/. Pinned tests:
// tests/unity-project/font-asset-*.test.ts.

export type { FaceInfo };

/** The header that identifies a font asset format. */
export interface FontAssetFormat {
  /** `fileID` of the `m_Script` line. */
  scriptFileId: number;
  /** `guid` of the `m_Script` line. */
  scriptGuid: string;
  /** Value of the `m_Version` line, as written (for example `1.1.0`). */
  version: string;
}

export interface KnownFontAssetFormat extends FontAssetFormat {
  /** Unity versions whose fixtures prove this row. */
  measuredOn: readonly string[];
}

export interface FontAssetRead {
  format: FontAssetFormat;
  /** `m_SourceFontFileGUID` of the candidate document (rule C8). */
  sourceFontGuid: string | null;
  /** Same shape as the `faceInfo` that `resolveFont` returns. All four values are present (rules C5-C7). */
  faceInfo: FaceInfo;
}

export interface FontAssetNotRead {
  unrecognized: 'not-a-font-asset' | 'unknown-format' | 'malformed';
  /** The `m_Script` and `m_Version` values of the candidate document, else of the first MonoBehaviour document (rule C3). */
  seen: { script?: string; version?: string };
}

export type FontAssetResult = FontAssetRead | FontAssetNotRead;

/**
 * Font asset formats that a fixture proves. A row is added only with a fixture
 * measured on that Unity version (tests/unity-project/font-assets/README.md).
 * The TextMeshPro asset (`TMP_FontAsset`) has the same m_Version and a different
 * m_Script, so it is not a row.
 */
export const KNOWN_FONT_ASSET_FORMATS: readonly KnownFontAssetFormat[] = [
  {
    scriptFileId: 19001,
    scriptGuid: '0000000000000000e000000000000000',
    version: '1.1.0',
    measuredOn: ['6000.0.40f1', '6000.3.25f1'],
  },
];

/**
 * Purpose:      read the faceInfo of a Unity Text Core font asset (.asset YAML text)
 *               so a host can answer `resolveFont` without Unity.
 * Deps/Effects: none. Pure: takes the file text, reads no files.
 * Ensures:      one result for one input, by the rules below. Lines end at LF; a CR
 *               before the LF is not part of the line. A document starts at a line
 *               that begins with `--- `; a MonoBehaviour document is one whose start
 *               line begins with `--- !u!114 `. A field of a document is a line that
 *               begins with two spaces and `key:`; a direct field of m_FaceInfo is a
 *               line that begins with four spaces (not five) and `key:`, after the
 *               `  m_FaceInfo:` line and before the next line indented less than four
 *               spaces. If a key occurs twice, the first line counts.
 *
 * C1 Candidate. The font asset document is the first MonoBehaviour document, in file
 *    order, whose m_Script equals a row of KNOWN_FONT_ASSET_FORMATS: scriptFileId and
 *    scriptGuid together. The m_Script value is compared by the pattern
 *    `{fileID: <integer>, guid: <32 lowercase hex>, type: <integer>}`; any other value
 *    equals no row. No other document is a candidate, and the reader does not look
 *    for a second candidate. No candidate: 'not-a-font-asset'.
 * C2 Version. If the candidate's m_Version is not the version of a row with the same
 *    scriptFileId and scriptGuid, or the candidate has no m_Version line: 'unknown-format'.
 * C3 seen. From the candidate document; with no candidate, from the first MonoBehaviour
 *    document; with no MonoBehaviour document, `{}`. `script` and `version` are present
 *    only when their line is in that document. A missing line is a missing key, never ''.
 * C4 Values. A value is the text after `key: ` to the end of the line (a line that is
 *    exactly `key:` has the value ''). It is not trimmed, and YAML comments and quotes
 *    are not interpreted. The table lookup and `seen` use this text exactly.
 * C5 Required fields (format 1.1.0). m_PointSize, m_AscentLine, m_DescentLine and
 *    m_LineHeight are direct fields of m_FaceInfo and all four are required. A missing
 *    field, or a missing m_FaceInfo block: 'malformed'.
 * C6 Only direct fields of m_FaceInfo are read. A field of a nested mapping is not.
 * C7 Numbers. A value must match `^[+-]?(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?$` in full;
 *    otherwise 'malformed'. Each of the four values is Math.fround(Number(value)); a
 *    result that is not finite is 'malformed'.
 * C8 sourceFontGuid. Only from the candidate's m_SourceFontFileGUID line. No line, or
 *    the value '': null. A value that is not 32 hexadecimal characters: 'malformed'.
 * C9 Shapes. A FontAssetRead has exactly the keys format, sourceFontGuid, faceInfo (no
 *    unrecognized, no seen). A FontAssetNotRead has exactly the keys unrecognized and
 *    seen (no format, sourceFontGuid or faceInfo).
 *
 * Unmeasured (docs/backlog.md): two candidate documents in one file, an empty
 * m_SourceFontFileGUID, a missing m_LineHeight. These rules fix one result for them;
 * Unity has not been shown to write such files.
 *
 * Not implemented yet. The pinned tests describe the behavior.
 */
export function readFontAsset(text: string): FontAssetResult {
  void text;
  throw new Error('readFontAsset: not implemented');
}

async function readGuid(metaPath: string): Promise<string | null> {
  let text: string;
  try {
    text = await readFile(metaPath, 'utf8');
  } catch {
    return null;
  }
  return GUID_LINE.exec(text)?.[1] ?? null;
}
