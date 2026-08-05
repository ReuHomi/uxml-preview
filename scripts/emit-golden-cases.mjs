/**
 * Writes the golden case set out as real .uxml/.uss files for Unity to load.
 *
 * tests/golden/cases.ts stays the single source: the tests read it directly, so
 * there is no second copy for them to drift from. These files exist only
 * because Unity needs assets on disk.
 */

import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'tests', 'golden', 'cases');

// cases.ts is types plus string literals, so stripping types is enough to
// import it. Node needs --experimental-strip-types until 23.6; the npm script
// passes it.
const { CASES, PANEL } = await import('../tests/golden/cases.ts');

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

for (const golden of CASES) {
  writeFileSync(join(outDir, `${golden.name}.uxml`), golden.uxml, 'utf8');
  writeFileSync(join(outDir, `${golden.name}.uss`), golden.uss, 'utf8');
}

// Assets the cases reference by path. Unity has to import a real file, and the
// representative screen needs a picture with a known aspect ratio — the three
// scale modes are indistinguishable on a square one.
const assetDir = join(here, '..', 'tests', 'golden', 'assets');
for (const asset of readdirSync(assetDir)) {
  copyFileSync(join(assetDir, asset), join(outDir, asset));
}

writeFileSync(
  join(outDir, 'README.md'),
  [
    '# Golden cases (generated)',
    '',
    '`pnpm golden:emit` writes this folder from `tests/golden/cases.ts`.',
    'Do not edit these files: edit the source and re-run.',
    '',
    `Panel size: ${PANEL.width} x ${PANEL.height}. \`tools/UxmlLayoutDump.cs\` uses the`,
    'same figure, and every dump records it so the web side can match.',
    '',
    'Copy this folder into a Unity project and run',
    '`Tools > uxml-preview > Golden Case Dumper`.',
    '',
    '| case | question |',
    '|---|---|',
    ...CASES.map((c) => `| \`${c.name}\` | ${c.question} |`),
    '',
  ].join('\n'),
  'utf8',
);

console.log(`wrote ${readdirSync(outDir).length} files to tests/golden/cases/`);
