# 0.7.0 probes (controls and themes)

Measured 2026-10-16 on 6000.0.40f1 and 6000.3.25f1, batchmode.

| Dump folder | Dumper | Panel |
|---|---|---|
| `<version>/probe-panel/` | `PanelDump.cs.txt` | a real runtime panel: PanelSettings + UIDocument in Play mode, theme from Unity's own `PanelSettingsCreator.GetFirstThemeOrCreateDefaultTheme` (`@import url("unity-theme://default");`), ConstantPixelSize scale 1, 800x600 target texture, text settings left unset (Unity's default panel text settings) |
| `<version>/probe-editor-070/` | `ProbeDump.cs.txt` (this folder) | an EditorWindow under the editor theme, as the 0.6.0 probes |

Both dumpers write the whole physical hierarchy with every resolved style. Elements
with class `force-hover`, `force-active` or `force-focus` get that pseudo-state set
through the internal `pseudoStates` property before the dump (`c07-states`).

Probe files: `c07-*` one file per control with its states; `kinsoku` (Noto Sans JP 20px
in 60px boxes, three characters per line, one candidate character at the break);
`pre-wrap2` (a 40px box where `white-space` values separate); `nested-disabled` and
`te-wrap` are the 0.6.0 probes, re-run on the runtime panel. Fonts are the text
cohort's (`tests/text-cohort/README.md`), at `Assets/Fonts/`.
