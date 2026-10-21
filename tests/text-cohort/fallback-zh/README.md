# Fallback glyph on the last line (`noto-jp-zh-20-w60`)

Why the runtime cohort row `noto-jp-zh-20-w60` is (a), not (c) (2026-10-20, human decision 2026-10-21).

The cohort writes the Chinese sentence `天地玄黄，宇宙洪荒。日月盈昃，辰宿列张。` in Noto Sans JP. That font has
every character of it but `张` (U+5F20, simplified; read from the font's cmap), so Unity draws `张` with a
fallback font. At 20px in 60px the text is 7 lines and the last line is `张。`.

Each probe here is one Label, `width: 60px`, the cohort's `.cohort` class (Noto Sans JP 20px,
`white-space: normal`), dumped alone in its own Unity process (`tests/layout/unity/dump-solo.sh`, PanelDump).

| probe | last line | Unity runtime (6000.0.40f1 = 6000.3.25f1) | Standard rule |
|---|---|---|---|
| `zh-alone` (the cohort row alone in its file) | `张。` | 201 | 203 |
| `zh-six`, `last-fb-only` | `张` | 172 | 174 |
| `last-fb-first` | `张寒` | 172 | 174 |
| `last-fb-second` | `寒张` | 174 | 174 |
| `first-fb` (`张` starts line 1) | `列` | 174 | 174 |
| `mid-fb` (`张` starts line 4) | `列` | 174 | 174 |
| `zh-nopunct`, `zh-seven-full`, `zh-punct-end`, `zh-punct-start` | no `张` first | 203 | 203 |
| `zh-newlines` (the same 7 lines broken by hand, 200px) | `张。` | 203 | 203 |
| `zh-eight` | | 232 | 232 |

When the last line starts with a glyph the font does not have, Unity's runtime box is 2px shorter (this font
pair). Anywhere else the fallback glyph changes nothing. The row is not the in-document contamination
(`zh-alone` holds the label alone), and the line breaks are the preview's (7 lines, checked on a `-panelPng`
picture of 6.3). The preview does not know which glyphs a font lacks, so it keeps the Standard height:
`spec.json` `known` names the row on both runtime versions. The 6000.0.40f1 editor dumps (`unity/`) give 202
for `zh-alone`.

- `probes/` — the UXML/USS dumped
- `unity-runtime/<version>/` — PanelDump, runtime panel
- `unity/6000.0.40f1/` — ProbeDump, editor theme (the first 8 probes)
