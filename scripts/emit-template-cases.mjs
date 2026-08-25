/**
 * Emit the G3 template measurement inputs for Unity.
 *
 * tests/template/cases.ts is the only source of truth. The output is separate
 * from tests/golden/cases because it contains observations and probes, not
 * browser-side expected values.
 */

import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'tests', 'template', 'cases');
const { CASES, PANEL, TEMPLATE_MEASUREMENTS } = await import('../tests/template/cases.ts');

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

for (const templateCase of CASES) {
  writeFileSync(join(outDir, `${templateCase.id}.uxml`), templateCase.uxml, 'utf8');
  writeFileSync(join(outDir, `${templateCase.id}.uss`), templateCase.uss, 'utf8');

  for (const [relativePath, source] of Object.entries(templateCase.files ?? {})) {
    const output = join(outDir, relativePath);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, source, 'utf8');
  }
}

const allProbes = CASES.flatMap((templateCase) =>
  templateCase.probes.map((item) => ({ ...item, caseId: templateCase.id })),
);

writeFileSync(
  join(outDir, 'README.md'),
  [
    '# Template cases (generated)',
    '',
    '`pnpm template:emit` writes this folder from `tests/template/cases.ts`.',
    'Do not edit generated files: edit the source and re-run the emitter.',
    '',
    `Panel reference: ${PANEL.width} x ${PANEL.height}.`,
    '`tools/UxmlLayoutDump.cs` supplies Unity-side observations; probe notes are questions, not expected values.',
    `Cases: ${CASES.length}; probes: ${allProbes.length}; measurement questions: ${TEMPLATE_MEASUREMENTS.length}.`,
    `Measurement IDs: ${TEMPLATE_MEASUREMENTS.join(', ')}.`,
    '',
    '## Package-path dependency',
    '',
    'G3-10 X3 references `project://database/Packages/com.uxml-preview.golden/g3-10-package.uxml`.',
    'Before dumping, copy the generated `Packages/com.uxml-preview.golden/g3-10-package.uxml` helper to that exact path in the Unity measurement project embedded package.',
    'The package root and child must both appear in the dump. A zero-child TemplateContainer is not resolution evidence.',
    '',
    '| case | question | helper files |',
    '|---|---|---|',
    ...CASES.map((templateCase) => {
      const helpers = Object.keys(templateCase.files ?? {})
        .map((file) => `\`${file}\``)
        .join('<br>');
      return `| \`${templateCase.id}\` | ${templateCase.question} | ${helpers || '—'} |`;
    }),
    '',
    '## Probes',
    '',
    '| case | id | read | targets | question |',
    '|---|---|---|---|---|',
    ...allProbes.map((item) =>
      `| \`${item.caseId}\` | \`${item.id}\` | ${item.read} | ${item.targets.map((target) => `\`${target}\``).join(', ')} | ${item.question} |`,
    ),
    '',
    '## Legacy slot-probe cleanup (Unity measurement project)',
    '',
    'G3-12 is the formal, repo-owned home of the former slot inputs; it does not recreate the old Unity-project probe folder.',
    'In the Unity measurement project, the legacy folder is `Assets/TemplateSlotProbe` with `slot-probe.uxml`, `window.uxml`, both file `.meta` files, and the sibling `Assets/TemplateSlotProbe.meta`.',
    'If execution policy blocks recursive `Remove-Item`, delete those exact files non-recursively, then remove the empty directory and its sibling `.meta`:',
    '',
    '```powershell',
    '$measurementProject = \'C:\\path\\to\\unity-measurement-project\'',
    '$probeDir = Join-Path $measurementProject \'Assets\\TemplateSlotProbe\'',
    'Remove-Item -LiteralPath (Join-Path $probeDir \'slot-probe.uxml\') -Force',
    'Remove-Item -LiteralPath (Join-Path $probeDir \'slot-probe.uxml.meta\') -Force',
    'Remove-Item -LiteralPath (Join-Path $probeDir \'window.uxml\') -Force',
    'Remove-Item -LiteralPath (Join-Path $probeDir \'window.uxml.meta\') -Force',
    'Remove-Item -LiteralPath $probeDir -Force',
    'Remove-Item -LiteralPath (Join-Path $measurementProject \'Assets\\TemplateSlotProbe.meta\') -Force',
    '```',
    '',
    'X1 is preserved as known-unsupported evidence: the Unity dump records the slot child alive in 6000.0.40f1. This corpus does not authorize implementing slots.',
    '',
  ].join('\n'),
  'utf8',
);

console.log(`wrote ${readdirSync(outDir).length} files to tests/template/cases/`);
