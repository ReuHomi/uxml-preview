/**
 * Node-only: this is the fs-touching sibling to the resolveAsset path
 * fallback. Both the VSCode extension and the (planned) CLI need "path moved,
 * only the GUID is still good" lookups, so the logic lives here once instead
 * of twice.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildGuidIndex } from '../../src/unity-project/index';

let root: string;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'uxml-preview-guid-'));

  await mkdir(join(root, 'Assets', 'UI'), { recursive: true });
  await writeFile(
    join(root, 'Assets', 'UI', 'icon.png.meta'),
    'fileFormatVersion: 2\nguid: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n',
  );

  // No guid line at all — must be skipped, not crash the scan.
  await writeFile(
    join(root, 'Assets', 'UI', 'broken.png.meta'),
    'fileFormatVersion: 2\nlabels:\n  - foo\n',
  );

  // Sits inside an excluded folder — must not be picked up even though the
  // guid line is well-formed.
  await mkdir(join(root, 'Library', 'ShaderCache'), { recursive: true });
  await writeFile(
    join(root, 'Library', 'ShaderCache', 'ghost.shader.meta'),
    'fileFormatVersion: 2\nguid: bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n',
  );
  await mkdir(join(root, 'Temp'), { recursive: true });
  await writeFile(
    join(root, 'Temp', 'stale.asset.meta'),
    'fileFormatVersion: 2\nguid: cccccccccccccccccccccccccccccccc\n',
  );
  await mkdir(join(root, 'obj'), { recursive: true });
  await writeFile(
    join(root, 'obj', 'gen.cs.meta'),
    'fileFormatVersion: 2\nguid: dddddddddddddddddddddddddddddddd\n',
  );
  await mkdir(join(root, '.git'), { recursive: true });
  await writeFile(
    join(root, '.git', 'x.meta'),
    'fileFormatVersion: 2\nguid: eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee\n',
  );
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('buildGuidIndex', () => {
  it('resolves a known guid to its asset path', async () => {
    const index = await buildGuidIndex(root);
    expect(index.get('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBe(
      join(root, 'Assets', 'UI', 'icon.png'),
    );
  });

  it('returns null for a guid that is not in the project', async () => {
    const index = await buildGuidIndex(root);
    expect(index.get('00000000000000000000000000000000')).toBeNull();
  });

  it('does not index .meta files inside Library, Temp, obj, or .git', async () => {
    const index = await buildGuidIndex(root);
    expect(index.get('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')).toBeNull();
    expect(index.get('cccccccccccccccccccccccccccccccc')).toBeNull();
    expect(index.get('dddddddddddddddddddddddddddddddd')).toBeNull();
    expect(index.get('eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee')).toBeNull();
  });

  it('skips a .meta file with no guid line rather than throwing', async () => {
    const index = await buildGuidIndex(root);
    expect(index.size).toBe(1);
  });

  it('reports size equal to the number of indexed entries', async () => {
    const index = await buildGuidIndex(root);
    expect(index.size).toBe(1);
  });
});
