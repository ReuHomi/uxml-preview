/**
 * Node-only entry point (uses `node:fs`). The main package entry stays
 * browser-safe, so this lives on its own `exports` subpath rather than
 * being folded into `src/index.ts`.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

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

async function readGuid(metaPath: string): Promise<string | null> {
  let text: string;
  try {
    text = await readFile(metaPath, 'utf8');
  } catch {
    return null;
  }
  return GUID_LINE.exec(text)?.[1] ?? null;
}
