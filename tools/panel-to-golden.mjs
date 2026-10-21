// node tools/panel-to-golden.mjs <panelDumpDir> <outDir>
// Writes the golden files (tests/golden/unity-runtime/) from PanelDump output.
// The conversion is tests/golden/panel-dump.ts; Node runs it by type stripping (22.18+).
import fs from 'node:fs';
import path from 'node:path';
import { panelToGolden } from '../tests/golden/panel-dump.ts';

const [from, to] = process.argv.slice(2);
fs.mkdirSync(to, { recursive: true });
for (const f of fs.readdirSync(from).filter((f) => f.endsWith('.json')).sort()) {
  const golden = panelToGolden(JSON.parse(fs.readFileSync(path.join(from, f), 'utf8')));
  fs.writeFileSync(path.join(to, f), JSON.stringify(golden, null, 2) + '\n');
}
