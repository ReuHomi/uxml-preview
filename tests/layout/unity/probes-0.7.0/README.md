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

## Cleanup round R1 (2026-10-17)

`r1-*` probes, dumped on both versions with both dumpers (`probe-panel/` and
`probe-editor-070/`). From this round every dump names its dumper in the metadata:
`"dumper": "PanelDump" | "ProbeDump" | "UxmlLayoutDump"` and `"dumperVersion": "0.7.0-r1"`
(bump the version string whenever a dumper changes what it writes). Earlier dumps carry
neither field.

| Probe | What it settles |
|---|---|
| `r1-text-spacing` | the 0.6.0 `text-spacing` probe unchanged, on the runtime panel: letter- and word-spacing widths with no `-unity-text-generator` written |
| `r1-groupbox-empty` | GroupBox `text=""` (with and without a child) and `text=" "`: whether a title is built |
| `r1-groupbox-author` (+ `.uss`) | an author rule on `.unity-group-box__label` (margin-left 17px, red) reaching the title |

## Bundle C and the whitespace title (2026-10-17, dumper 0.7.0-r2)

Dumper 0.7.0-r2 adds, for a `TextField`, `"field": {value, isPasswordField, maskChar,
multiline, placeholder}`, and for a text element the drawn text (`renderedText`) when the
internal property exists. On 6000.0.40f1 and 6000.3.25f1 it does not, so no dump has
`renderedText`: a mask or a placeholder shows only in the boxes. Re-running `c07-TextField`
with r2 gave every box, text, measurement and resolved style back unchanged (4 dumps,
0 differences); the committed files are replaced by the r2 run for the new fields.

| Probe | What it settles |
|---|---|
| `c-textfield` | password mask (`iiiiii` against `WWWWWW`, a `mask-character`), placeholder with a value, with a label, disabled; one long sentence single-line and multiline (with and without `white-space: normal`); long and empty labels; auto widths |
| `c-textfield-hook` (+ `.uss`) | author rules on `#unity-text-input`, `.unity-text-field__input`, `.unity-text-field__label` |
| `c-whitespace` | text `" "` in a Label, a GroupBox title and a Button, with no, standard and advanced generator |

## Bundle D (2026-10-17, dumper 0.7.0-r2)

| Probe | What it settles |
|---|---|
| `d-slider`, `d-sliderint` | the dragger position: values 0-10 in eleven steps, horizontal (300px column) and vertical (120 high); a 30-144 range, a label, an input field, a value out of range (12), a reversed range (10 to 0), and for Slider 0.7 in 0-1 |

## A2 and bundle E (2026-10-17, dumper 0.7.0-r3)

Dumper 0.7.0-r3 also forces `Disabled` on an element with class `force-disabled` (the
internal pseudoStates bit, as for hover/active/focus). That is the "forced pseudo-state"
of the bundle E check; `enabled="false"` is SetEnabled(false). Re-running c07-Toggle,
c07-RadioButton, c07-states and c07-existing with r3 gave them back unchanged, except one
value that moved between runs: 6000.0.40f1 editor `c07-existing` `free/label-auto` width 92
(committed 91). The committed files stand.

| Probe | What it settles |
|---|---|
| `a2-hook` (+ `.uss`) | an author rule on `.unity-text-element` reaching a Label, a Button, a TextField's label and value, a GroupBox title |
| `a2-scrollview` | ScrollView classes per `mode` (default, Vertical, Horizontal, VerticalAndHorizontal) |
| `d-slider-children` | where a Slider's own file children go (Unity's contentContainer) |
| `e-disabled` | `enabled="false"` against a forced Disabled pseudo-state, on a VisualElement with a child, Label, Button, Toggle, RadioButton, TextField, Slider |
| `e-toggle`, `e-radio` | label with text, long label, forced hover/focus/active, checked with text, auto widths |

## Bundle F (2026-10-18, dumper 0.7.0-r3)

| Probe | What it settles |
|---|---|
| `f-progress` | the bar width: values 0, 1, 25, 33.3, 50, 99, 100, 150, -10; a 10-20 range, a 200 high, a 40 low; widths 101, 57, 80; a title longer than the bar |
| `f-states` | forced hover/active/focus/disabled on ProgressBar, RepeatButton, TextElement; a wrapping TextElement; a file child inside each of the three |
| `f-hook` (+ `.uss`) | author rules on the ProgressBar parts and `.unity-repeat-button`; a `TextElement` type selector beside a Label and a RepeatButton |

Re-running `c07-ProgressBar`, `c07-RepeatButton` and `c07-TextElement` with r3 gave them back
unchanged except one value that moved between runs: `c07-TextElement` `free/te-auto` width 104
on the runtime panel of both versions (committed 103, text "Hamburgefonts"). The committed
files stand; the run-to-run question belongs to item T (plan section 25).

## Text clipping (2026-10-18, dumper 0.7.0-r3)

| Probe | What it settles |
|---|---|
| `g-clamp` | where Unity clips a text's width to the width it is offered: a column with align-items flex-start, a stretched column, a row, a row with overflow hidden, an absolute Label, a row of auto width, a TextField's inner text, and the registry test's scene with letter-, word-spacing and both generators |

Dumped alone in its own Unity process. The repeatability runs of the same day (plan section 27)
found that a text's layout width under the Standard generator depends on what the same process
drew before (0-2px); a probe run alone gives the committed values.
