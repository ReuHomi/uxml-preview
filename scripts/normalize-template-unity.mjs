import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const [broadDir, correctedG310Dir, outputDir, matchedRulesDir] = process.argv.slice(2);
if (!broadDir || !correctedG310Dir || !outputDir) {
  throw new Error(
    'usage: node scripts/normalize-template-unity.mjs <broad-output> <corrected-g3-10-output> <output-dir> [matched-rules-output]',
  );
}

await mkdir(outputDir, { recursive: true });
for (const id of ['G3-1', 'G3-2', 'G3-3', 'G3-4', 'G3-5', 'G3-6', 'G3-7', 'G3-8', 'G3-9', 'G3-10', 'G3-12']) {
  const sourceDir =
    id === 'G3-10' ? correctedG310Dir : id === 'G3-1' && matchedRulesDir ? matchedRulesDir : broadDir;
  const text = await readFile(join(sourceDir, `${id}.json`), 'utf8');
  // Unity's JsonUtility prints float NaN as a bare token, which JSON.parse
  // correctly rejects. It is not a comparable value, so normalize it to null.
  const raw = JSON.parse(text.replace(/\bNaN\b/g, 'null'));
  const keep = (name) => /^(?:g3|slot-)/.test(name);
  const normalized = {
    unityVersion: raw.metadata.unityVersion,
    panel: raw.panel,
    elements: Object.fromEntries(Object.entries(raw.elements).filter(([name]) => keep(name))),
    observations: raw.observations.filter((item) => keep(item.name)),
  };
  await writeFile(join(outputDir, `${id}.json`), `${JSON.stringify(normalized, null, 2)}\n`);
}
