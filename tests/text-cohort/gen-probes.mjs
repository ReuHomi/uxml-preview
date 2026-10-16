// node gen-cohort.mjs <spec.json> <outDir> [natural-widths.json]
// Without widths: one natural (nowrap) file per font. With widths (font-sent-size -> box width
// measured by Unity 6000.0): one boundary file per font, white-space: normal, width W-2 and W+2.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
const [specPath, out, widthsPath] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, 'utf8'));
mkdirSync(out, { recursive: true });
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const U = (b) => `<ui:UXML xmlns:ui="UnityEngine.UIElements">\n<ui:VisualElement name="col" style="align-items: flex-start;">\n${b}\n</ui:VisualElement>\n</ui:UXML>\n`;
const sheet = (f) => `.cohort { padding: 0; margin: 0; white-space: nowrap; -unity-font-definition: url("project://database/Assets/Fonts/${f.file}"); }\n.wrap { white-space: normal; }\n`;
const widths = widthsPath ? JSON.parse(readFileSync(widthsPath, 'utf8')) : null;
for (const f of spec.fonts) {
  const lines = [];
  if (!widths) {
    for (const [sid, text] of Object.entries(spec.sentences))
      for (const s of spec.sizes)
        lines.push(`<ui:Label name="${f.id}-${sid}-${s}" class="cohort" text="${esc(text)}" style="font-size: ${s}px;" />`);
    writeFileSync(join(out, `cohort-${f.id}.uxml`), U(lines.join('\n')));
    writeFileSync(join(out, `cohort-${f.id}.uss`), sheet(f));
  } else {
    for (const sid of spec.boundary.sentences)
      for (const s of spec.sizes) {
        const key = `${f.id}-${sid}-${s}`;
        const w = widths[key];
        for (const off of spec.boundary.offsets)
          lines.push(`<ui:Label name="${key}-b${off > 0 ? 'p' : 'm'}${Math.abs(off)}" class="cohort wrap" text="${esc(spec.sentences[sid])}" style="font-size: ${s}px; width: ${w + off}px;" />`);
      }
    writeFileSync(join(out, `boundary-${f.id}.uxml`), U(lines.join('\n')));
    writeFileSync(join(out, `boundary-${f.id}.uss`), sheet(f));
  }
}
// FaceInfo of the editor default font, for the Inter ttf vs Inter-Regular SDF comparison.
if (!widths) writeFileSync(join(out, 'cohort-default.uxml'), U('<ui:Label name="default-en-20" text="Hamburgefonts Quick" style="font-size: 20px; padding: 0; white-space: nowrap;" />'));
console.log('ok');
