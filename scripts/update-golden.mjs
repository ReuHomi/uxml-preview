/**
 * Rewrites the golden regression snapshots.
 *
 * Run this only after an intended change in output, and read the resulting diff
 * — a snapshot updated without being looked at records a bug as the truth.
 *
 * A script rather than `GOLDEN_UPDATE=1 vitest ...` in package.json, because
 * that syntax does not set an environment variable on Windows, and this project
 * is developed there.
 */

import { spawnSync } from 'node:child_process';

const result = spawnSync('vitest', ['run', 'tests/golden'], {
  env: { ...process.env, GOLDEN_UPDATE: '1' },
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
