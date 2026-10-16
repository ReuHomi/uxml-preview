// node gen-probes.mjs <spec.json> <outDir> [natural-widths.json]
// Without widths: one natural (nowrap) file per font, plus the wrap set (spec.wrap: fixed box
// widths, white-space: normal). With widths (font-sent-size -> box width measured by Unity
// 6000.0): one boundary file per font (or per font and sentence, boundaryFilePerSentence),
// white-space: normal, width W-2 and W+2. The files Unity measured are the ones in probes/;
// regenerating must reproduce them byte for byte.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
const [specPath, out, widthsPath] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, 'utf8'));
mkdirSync(out, { recursive: true });
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const U = (b) => `<ui:UXML xmlns:ui="UnityEngine.UIElements">\n<ui:VisualElement name="col" style="align-items: flex-start;">\n${b}\n</ui:VisualElement>\n</ui:UXML>\n`;
const url = (f) => `url("project://database/Assets/Fonts/${f.file}")`;
const sheet = (f) => `.cohort { padding: 0; margin: 0; white-space: nowrap; -unity-font-definition: ${url(f)}; }\n.wrap { white-space: normal; }\n`;
const widths = widthsPath ? JSON.parse(readFileSync(widthsPath, 'utf8')) : null;
const write = (name, labels, css) => {
  writeFileSync(join(out, `${name}.uxml`), U(labels.join('\n')));
  writeFileSync(join(out, `${name}.uss`), css);
};
for (const f of spec.fonts) {
  if (!widths) {
    const lines = [];
    for (const sid of f.sentences)
      for (const s of spec.sizes)
        lines.push(`<ui:Label name="${f.id}-${sid}-${s}" class="cohort" text="${esc(spec.sentences[sid])}" style="font-size: ${s}px;" />`);
    write(`cohort-${f.id}`, lines, sheet(f));
    continue;
  }
  const bySentence = f.boundarySentences.map((sid) => {
    const lines = [];
    for (const s of spec.sizes) {
      const key = `${f.id}-${sid}-${s}`;
      const w = widths[key];
      for (const off of spec.boundary.offsets)
        lines.push(`<ui:Label name="${key}-b${off > 0 ? 'p' : 'm'}${Math.abs(off)}" class="cohort wrap" text="${esc(spec.sentences[sid])}" style="font-size: ${s}px; width: ${w + off}px;" />`);
    }
    return [sid, lines];
  });
  // One file per sentence keeps the column inside the 600px panel; an overflowing column
  // would shrink the preview's Labels (Unity's text elements do not shrink).
  if (f.boundaryFilePerSentence) for (const [sid, lines] of bySentence) write(`boundary-${f.id}-${sid}`, lines, sheet(f));
  else write(`boundary-${f.id}`, bySentence.flatMap(([, lines]) => lines), sheet(f));
}
if (!widths) {
  const w = spec.wrap;
  const f = spec.fonts.find((x) => x.id === w.font);
  for (const sid of w.sentences)
    write(`wrap-${sid}`, w.widths.map((px) => `<ui:Label name="${f.id}-${sid}-${w.size}-w${px}" class="cohort" text="${esc(spec.sentences[sid])}" style="width: ${px}px;" />`),
      `.cohort { padding: 0; margin: 0; white-space: normal; font-size: ${w.size}px; -unity-font-definition: ${url(f)}; }\n`);
  // FaceInfo of the editor default font, for the Inter ttf vs Inter-Regular SDF comparison.
  writeFileSync(join(out, 'cohort-default.uxml'), U('<ui:Label name="default-en-20" text="Hamburgefonts Quick" style="font-size: 20px; padding: 0; white-space: nowrap;" />'));
}
console.log('ok');
