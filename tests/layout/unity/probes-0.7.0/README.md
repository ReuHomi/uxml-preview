# 0.7.0 probes (controls and themes)

Measured 2026-10-16 on 6000.0.40f1 and 6000.3.25f1, batchmode.

| Dump folder | Dumper | Panel |
|---|---|---|
| `<version>/probe-panel/` | `PanelDump.cs.txt` | a real runtime panel: PanelSettings + UIDocument in Play mode, theme from Unity's own `PanelSettingsCreator.GetFirstThemeOrCreateDefaultTheme` (`@import url("unity-theme://default");`), ConstantPixelSize scale 1, 800x600 target texture, text settings left unset (Unity's default panel text settings) |
| `<version>/probe-editor-070/` | `ProbeDump.cs.txt` (this folder) | an EditorWindow under the editor theme, as the 0.6.0 probes |
| `<version>/golden-panel/` | `PanelDump.cs.txt -panelSize 400x300` | the 44 golden cases on the runtime panel above, at the golden panel size. Converted by `tools/panel-to-golden.mjs` into `tests/golden/unity-runtime/` (6.3) |
| `<version>/golden-editor-on-panel/` | `PanelDump.cs.txt -panelSize 400x300 -panelSkin editor` | the same runtime panel with the editor's dark common sheet instead of a theme: the check of PanelDump against `tools/UxmlLayoutDump.cs` (`tests/golden/panel-dump.test.ts`) |

Re-measured 2026-10-17 (bundle A, step A0). PanelDump now clears the root's style sheets
before each case; the earlier dumper did not. Re-running `probe-panel/` with the fix gave
the committed files back unchanged on both versions (every box and every resolved style),
so they stand. The 2026-10-16 `golden-panel/` was 800x600; it is replaced by the 400x300
run, and the only differences were the boxes sized by the panel width.

Both dumpers write the whole physical hierarchy with every resolved style. Elements
with class `force-hover`, `force-active` or `force-focus` get that pseudo-state set
through the internal `pseudoStates` property before the dump (`c07-states`).

Probe files: `c07-*` one file per control with its states; `kinsoku` (Noto Sans JP 20px
in 60px boxes, three characters per line, one candidate character at the break);
`pre-wrap2` (a 40px box where `white-space` values separate); `nested-disabled` and
`te-wrap` are the 0.6.0 probes, re-run on the runtime panel. Fonts are the text
cohort's (`tests/text-cohort/README.md`), at `Assets/Fonts/`.
