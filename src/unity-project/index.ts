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
  /**
   * `m_SourceFontFileGUID` of the font asset document; null when that document has no
   * such line. Unmeasured: when Unity writes it empty or leaves it out (docs/backlog.md).
   */
  sourceFontGuid: string | null;
  /** Same shape as the `faceInfo` that `resolveFont` returns. Each value is float32 (`Math.fround`). */
  faceInfo: FaceInfo;
}

export interface FontAssetNotRead {
  unrecognized: 'not-a-font-asset' | 'unknown-format' | 'malformed';
  /**
   * From the first MonoBehaviour document (`--- !u!114`) of the file, whatever its
   * m_Script: the text after `m_Script: ` and after `m_Version: `. A field is present
   * exactly when its line is in that document. No MonoBehaviour document: `{}`.
   */
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
 * Ensures:      a read result only for a document whose m_Script and m_Version are a
 *               row of KNOWN_FONT_ASSET_FORMATS; faceInfo comes from that document's
 *               m_FaceInfo block. Otherwise a FontAssetNotRead without faceInfo.
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
