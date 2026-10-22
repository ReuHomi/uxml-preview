# Accuracy

*English · [한국어](accuracy.md)*

**The document that answers "does it actually match Unity?" with numbers.**
It is the first question anyone asks, and without an answer nobody uses this.

**This document decides the one number quoted outside.** `docs/S1-renderer-capability.md`
did that at 0.1.0, but it is now a record frozen at that time.

| Number | Meaning | Use |
|---|---|---|
| **1122 / 1148 (97.7%)** | Runtime values matching — the runtime theme (0.7.0 default) against a real Unity 6.3 runtime panel | **quoted outside, README first line** ("Runtime theme" below) |
| **1122 / 1148 (97.7%)** | Editor theme: values matching, of the values compared (287 elements × `x`/`y`/`w`/`h`), Unity 6000.0.40f1 | **quoted outside, README second line** |
| 38 / 42 | Cases matching completely | internal. Quote it only together with 1122/1148 |
| 43 / 43 | Cases with Unity ground truth available | **coverage, not accuracy.** Never quoted outside |

31/31 was once quoted as accuracy (`docs/visual-check.md`, 2026-08-06) — the same mistake
0.1.0 made with 18/18, repeated a day later with a different case set. When a new number is
needed, this table changes first.

Third, this table itself was once left stale (found 2026-08-09): `state-vs-id` and
`state-vs-inline` were merged before the commit that last touched it, and the numbers were not
updated. `tests/golden/golden.test.ts`'s `matches the figures published in docs/accuracy.md`
now checks the three numbers of this table (and of "Current state" below) against a live
recomputation on every run — fixing only the document would drift again at the next case.
From 0.6.0 the same check covers this English page and both READMEs (the READMEs' text-cohort
figures against `tests/text-cohort/results.json`).

## Current state (coordinates measured 2026-08-12; resource() measured 2026-08-15)

| Item | Value |
|---|---|
| Cases | 46 (42 coordinate comparisons, 1 resource observation, 3 dependent on text measurement) |
| Unity ground truth available | **43 / 43** |
| Elements compared | 287 (1148 values = elements × x/y/width/height) |
| **Cases matching** | **38 / 42** |
| **Values matching** | **1122 / 1148 (97.7%)** |
| Known divergences | 26 values — **and they are four different things** |

`resource-resolution` measures Unity's resolved background object and asset path, not
coordinate accuracy. It counts toward baseline coverage but not the 1122/1148 matching values or
the 38/42 coordinate cases.

**What this figure does not measure (2026-10-21, review findings G2, X1, X3):**
- The harness measures text with a fixed measurer (`FIXED_MEASURE`: one line, never wraps). So 1122/1148 measures **layout given the text sizes**, not the preview's own text measurement (line breaking included); the text cohort measures that separately
- 16 of the 1122 values (the Slider dragger `x`/`y` on the two settings screens) match because the harness adds the dragger's `translate` to its box: Unity's dump is after the move, the preview's Yoga box before it. The translate itself is checked against Unity by `bundle-d.test.ts`, and the painter paints the same value. Without these 16: 1106/1148
- The settings contract test's (`bundle-g.test.ts`) "Unity's text sizes" are the dump's `MeasureTextSize`, except that a text Unity's layout made 1-2px wider takes that layout width, and wrapped TextField and ProgressBar text takes its height from the dump box. So it checks **the boxes given the text widths and line breaks**, not the text widths themselves

## Template / Instance expansion (separate cohort, measured on Unity 6000.0.40f1)

The base-control and template-expansion cohorts answer different questions and are never added
together. The base figure stays **1122 / 1148 (287 elements, with the 0.7.0 editor theme values and the settings screen)**.

| Item | Template expansion cohort | Meaning |
|---|---:|---|
| Coordinate comparison | **215 / 220** (before 0.6.0: 200 / 220) | 55 elements × `x`/`y`/`width`/`height` |
| Rendered cases | **11** | G3-1 through G3-10 and G3-12 |
| Unity baseline coverage | **11 / 11** | coverage of rendered cases, not accuracy |
| Divergences | **5** | (a) known font/text metrics 5 / (b) 1px 0 / (c) new cause 0 |

G3-11 has no layout baseline: Unity's `CloneTree` raises a `StackOverflowException` for the
cyclic template. The core blocks the same input **fail-closed** and reports `template-cycle`. It
is not included in the 11 rendered cases or in the base-control figures.

### The 5 template-expansion divergences — (a) / (b) / (c)

`problems` and `lines` are units used by the external re-observation table; the golden table
below counts only coordinate divergences in rendered template cases. Neither of those two units,
nor a match between empty boxes, is added to accuracy.

| Unit | Definition |
|---|---|
| `problems` | number of core failures observed |
| `lines` | number of diagnostic-panel lines emitted by core and host |

| Case | Element | Axis | ours | Unity | Δ |
|---|---|---|---:|---:|---:|
| `G3-4` | `g34-instance` | width | 143 | 145 | -2 |
| `G3-4` | `g34-template-root` | width | 143 | 145 | -2 |
| `G3-4` | `g34-internal-label` | width | 143 | 145 | -2 |
| `G3-4` | `g34-outside-label` | x | 143 | 145 | -2 |
| `G3-4` | `g34-outside-label` | width | 153 | 140 | 13 |

The classification is **(a) 5 / (b) 0 / (c) 0**, with axes `width` 4, `x` 1. In 0.6.0 the
harness's text height moved from `height = fontSize` to the FaceInfo formula (`textHeight`, D3),
which removed 14 Label heights and the one `y` they pushed (200/220 → 215/220). The 5 left are
G3-4 Label widths, a text-metric difference from the harness's fixed-width measurement (half an
em).

Tolerance 0.5px. **Kept deliberately stricter than the 1px criterion 2 allows** — loosening it
would hide a real 1px error in another case.

### What the 14 divergences are — this distinction matters more than the number

| Kind | Values | What it means |
|---|---|---|
| **Text metrics** | **21** | **Not a layout defect.** Both engines behave the same way; only the ruler differs. All widths and x |
| 1px (inside criterion 2's tolerance) | 2 | named in a list; the comparator is not loosened |
| `yoga-layout` version difference | 2 | judged and recorded 2026-08-02 |
| **Unresolved** | **1** | a wrapped container's height. Unity's rule is not identified |

The evidence for the nine text ones: the representative screen's footer is a fixed width
holding a flexible panel beside a 96px ActionBar, and the boundary between them is pushed by the
labels' min-content width. **Both engines** compress the ActionBar — Unity to 92 (the solo value; 93 in a session that drew other dumps first), this renderer
to 84 — and pinning the label widths makes our excess **converge on the same 3px Unity has.**
Same mechanism, different ruler. A browser cannot measure Unity's font asset, which is the fact
that made pixel diffing useless, **showing up in coordinates instead of colours**.

> The previous figure was 242/244 (99.2%). **The ratio fell because the case set widened, not
> because accuracy did** — then, 17 of 18 cases were `VisualElement` alone and no `Button` had
> ever been compared. Now a text-heavy working screen is in there, and 9 of the 14 divergences
> are fonts (first counted as 10; `ItemDesc.height` was a theme value, and 0.7.0's Label `flex-shrink: 0` made both `ItemDesc` values match).
> **Move the case composition along with the number whenever you compare it.**

> Across six re-measurements every pre-existing case reproduced **byte for byte** (at 20, 26, 27,
> 30, 32 and 34 cases). The dump harness is deterministic, which is what lets a new number be
> attributed to the change rather than the environment.

### 2026-08-12 `inventory` 1px reproduction — baseline kept

In the 2026-08-12 dump, `inventory`'s `DetailPanel` width and `ActionBar` width came out as
292px/92px, and a re-dump in the same Editor session reproduced them. The existing baseline is
291px/93px, and the current renderer matches that existing baseline.

With the same Unity version and revision, OS and GPU, the two dumps of the same session were
byte-identical across all 37 JSON files. So the dump itself was deterministic within the session,
but older dumps did not record DPI scaling or font settings, and which measuring condition
triggered the 1px change cannot be settled. After this investigation `UxmlLayoutDump.cs` was
changed to record the Unity version and revision, the editor DPI scale, the font settings it can
reach and the dump time, as metadata separate from coordinates.

This 1px was not adopted as the new baseline. It is within tolerance and is a measuring
condition rather than a renderer change, and moving the baseline without knowing the old
conditions would leave nobody knowing what it is being matched to.

**Resolved 2026-10-18 — the cause was dump order.** Under the Standard generator (the 6000.0 editor) a text's width differs by 0-2px depending on what the same Unity process drew before (bundle A plan 27-2: five repeats of one batch never move; a probe dumped in its own process is deterministic). `inventory` dumped alone gives 292/92; 291/93 came from a session that drew other cases first. The baseline (`tests/golden/unity/inventory.json`) now holds the solo values. The nine were already counted as text-measurement mismatches (the preview gives 84/85), so 662/676 does not move.

### `ScrollView` — the hierarchy was observed, not assumed (2026-08-05)

A `ScrollView` is one tag that becomes four elements. The **three implicit levels** Unity builds
decide where every child inside lands, so drawing it as one box puts the coordinates out.

```
ScrollView
└── #unity-content-and-vertical-scroll-container
    └── #unity-content-viewport                  <- clips
        └── #unity-content-container             <- the file's children
```

**The middle level appears in no documentation.** It was found by dumping rather than by reading
source: the dumper walks `hierarchy`, the physical tree, and Unity names these parts, so they
simply appear in the output.

Three measured rules:

- level 1 fills the ScrollView's **content box**, inside padding and border
- the viewport surrenders 13px to a vertical scrollbar **only when the content overflows**;
  otherwise the scroller is `0×0` and the full width is kept. Being conditional matters as much
  as the number
- the content container's height is the **content's**, not the viewport's

That last rule is the substance. The old fallback squeezed three 60px children into a 100px box
and produced 33/34/33; Unity grows the container to 180, keeps the children at 60 and lets the
viewport clip. **Whole child sizes were wrong, not positions by a few pixels.**

**Known difference: scrollbars reserve their width and are not drawn** (through 0.7.0, human decision
2026-10-18; first candidate for the next version).
The scrollbar's seven internal parts are not reproduced — outside a static render — and sit in an
**explicit list**, `NOT_REPRODUCED` in `golden.test.ts`. Excusing a `unity-` pattern would have
excused `unity-content-viewport` too, which has to match.

### Which controls this covers

The composition of the 42 compared cases. In the previous measurement (242/244) the first row of
this table was 17 of 18 — **in effect `VisualElement` geometry** — and no `Button` had ever been
compared.

**This table is computed from `tests/golden/cases.ts`, on this rule**: the `inventory`, `settings` and `settings-ko` cases are
classified as the representative screens. Each of the other 39 is ScrollView if its UXML contains
`<ui:ScrollView`, otherwise Button if it contains `<ui:Button`, otherwise Label if it contains
`<ui:Label`, otherwise `VisualElement` only. All 39 contain at most one of the three tags, so the
order does not change the result (checked directly: `inventory` is the only case with more than
one).

| Cases containing | Count |
|---|---|
| `VisualElement` only | 24 |
| `Label` | 1 (`inherit-vs-direct`) |
| `Button` | 10 |
| `ScrollView` | 4 |
| the representative screens (inventory, the settings screen in two variants) | 3 — inventory: all five above plus Image. The settings screen (`settings`, `settings-ko`, bundle G): all 15 controls 0.7.0 draws |

Only one case contains a `Label` because the other two (`text-size`, `text-align`) depend on text
measurement and are excluded from the comparison. **Control coverage is a different axis from
value count, and does not widen just because the value count does.**

The drift guard in `tests/golden/golden.test.ts` keeps this table's five numbers too (since
2026-08-09), in the Korean original — nobody has to recount when a case is added.

### What this number covers — important

**The 97.9% is measured at the coordinates Yoga produces.** The pipeline has four layers (parse
→ resolve styles → Yoga layout → DOM paint), and the comparison with Unity is of the third
layer's output. Whether the DOM actually drawn on screen reproduces those coordinates is **not
compared with Unity.**

It is covered another way rather than left open. "CSS reproduces the Yoga geometry" in
`tests/render/border-offset.test.ts` walks the painted tree, re-derives every element's panel
position from its CSS, and checks it equals what Yoga produced. It checks **our own two layers
against each other**, not against Unity.

The distinction mattered. A code review on 2026-08-03 found that **descendants of a bordered
parent were displaced by the border width**: Yoga's coordinates were right and the translation
into CSS was wrong. The golden suite could not see it by definition, and no render test at the
time had a bordered parent. The invariant above closes that gap.

Measurement environment:

| | |
|---|---|
| Unity | **6000.0.40f1** (Unity 6.0. The re-measurement on the reference version, 6.3 LTS, is the next section) |
| `yoga-layout` | 3.2.1 |
| Panel size | 400 × 300 |
| Tolerance | 0.5px |
| 2026-08-12 dump DPI | `EditorGUIUtility.pixelsPerPoint = 1`, Windows `AppliedDPI = 96` |
| 2026-08-12 dump font | Editor `(builtin)`, 12, Normal; font smoothing 2/type 2/gamma 0 |

> The Unity version decides the result, because the Yoga vendored inside UI Toolkit differs
> between versions — which is exactly what the divergence below is. **When re-measuring on
> another Unity version, fill this table for that version.** Side by side, not overwritten.

## Runtime theme (separate set, measured 2026-10-17)

Since 0.7.0 the default theme is Unity's runtime theme (a game screen). The same 44 golden cases were dumped on a
**real runtime panel** and are compared on their own. **Never added** to the editor set.

| Item | Value |
|---|---|
| Measured | Unity 6000.3.25f1, PanelSettings + UIDocument in Play mode (`tests/layout/unity/probes-0.7.0/PanelDump.cs.txt`), the default runtime theme Unity creates for a new PanelSettings, 400×300 |
| Ground truth | `tests/golden/unity-runtime/` (generated by `tools/panel-to-golden.mjs`). 6000.0.40f1 gives the same coordinates |
| Dumper check | the same dumper on the editor theme equals UxmlLayoutDump on 1012/1012 values, both versions — `tests/golden/panel-dump.test.ts` |
| Compared | as the editor set (42 coordinate cases, 0.5px, scroller parts excluded) |
| **Runtime values matching** | **1122 / 1148 (97.7%)** |
| The 26 left | every one sits where the editor set has a known divergence (text metrics 21 — inventory 9, the settings footer 12 —, 1px 2, wrapped container 1, `%` 2). Anything else fails `tests/golden/runtime.test.ts` |

Before the theme values went in (0.6.x behaviour) this set read 609/676. The values that moved came from the runtime Label
spacing (4·4·2·2 / 4·2·4·1), the Button margin, padding and border, 14px text and a 24px vertical scroller, all read from
dumps (`probe-panel/`, `probe-editor-070/`).

**A Unity-side effect (seen 2026-10-18, cause found 2026-10-19):** on the runtime panel, when the same text was laid out earlier with a different wrap setting, a later element with that text comes out 4-8px shorter (`g-clamp` 20-21px). Remove the earlier same text and it is 25px again, as the preview draws it (`t-bis-*`, `t-cache-*`, `t-fit*` dumps). It has nothing to do with the width being set from outside (`t-fit-pad`: a Label stretched in a narrow column is 25px). None of the 44 golden cases has this, so it is not in the figure above. Dumping each probe alone does not stop contamination **within** one document — probes avoid writing the same text twice with different wrapping. The pinned test (`g-clamp`) does not judge the four contaminated runtime heights (`st-label`, `row-label`, `rh-label`, `free-label`): 25px is what the `t-bis-*` dumps show, not a value a test pins (review X4).

## Unity 6.3 LTS re-measurement (2026-10-15)

The reference version is 6.3 LTS, but the figures above were measured on 6000.0.40f1. The 44
golden cases were dumped again on 6000.3.25f1 to check whether the two versions lay out the same
(`tests/layout/unity/6000.3.25f1/golden/`, editor theme).

- Against a 6000.0.40f1 dump taken the same day (`tests/layout/unity/6000.0.40f1/golden/`), **all
  1012 coordinates are the same.** No layout difference between 6000.0 and 6.3 was observed on the
  golden set
- Against the committed baselines (`tests/golden/unity/`, the 2026-08-12 dump) nine differ. All are
  the 1px of `inventory`'s footer boundary (the widths of `DetailPanel`, `ItemName` and `ItemDesc`;
  the x and width of `ActionBar`, `UseButton` and `DropButton`) — the same thing as "2026-08-12
  `inventory` 1px reproduction" above. The baselines were not changed — on 2026-10-18 the cause (dump order) was found and they took the solo values
- Accuracy was not recomputed with the 6.3 dump as the baseline. Doing so would change the figure,
  because of those nine
- `aspect-ratio` (6.3+) is not in that set and was measured separately: 52 coordinates of 13 boxes
  are the same as 6000.3.25f1 within 0.5px (`tests/layout/unity/6000.3.25f1/probe-editor/aspect2.json`,
  `tests/contract-060/aspect-ratio.test.ts`)

## Text cohort (separate set, measured 2026-10-16)

**Never added** to the coordinate figure (1122/1148) or the template cohort. Text is judged by its
boxes and line counts, not by pixels or bytes. The same UXML (`tests/text-cohort/probes/`) is drawn
by Unity and by a real Chromium, and the Label boxes compared. Run it with `pnpm test:text`
(`tests/text-cohort/README.md`).

| Item | Value |
|---|---|
| Measured | 2026-10-16 |
| Preview side | Google Chrome 155.0.8059.85 (Chromium). Playwright Chromium 1140 does not start on this machine (Windows side-by-side error), so the installed Chrome was used |
| Unity side | 6000.0.40f1, 6000.3.25f1 (editor window, editor theme) |
| Fonts | Inter, Pretendard, Jua, DungGeunMo (pixel), Wanted Sans Bold, Noto Sans JP, Noto Sans SC (from 0.6.1) |
| Sentences and sizes | English, Korean, mixed (five Korean fonts) · Japanese, Chinese, Japanese–Latin mixed, English (two Noto fonts) × 10/14/20/32px = 92; 144 at the line-break boundary (6000.0 single-line width ±2px); 15 fixed-width wraps (Noto Sans JP 20px, 60/100/140/170/220px) |
| Coefficients | the FaceInfo Unity reports for that font. Not fitted |

Judgement: line count must match, height must match the formula exactly, width within 1px or 1%.
The failure columns count (a)/(b)/(c) over all 251 rows, line-break cases included. "Boundary lines" counts the boundary and the fixed-width wrap cases together — **line counts only**; a boundary row's height or width difference is in the failure columns.

| Unity | Lines | Height | Width (1px/1%) | Boundary lines | Failures (a/b/c): lines · height · width | Width Δ range |
|---|---:|---:|---:|---:|---|---|
| 6000.0.40f1 | 92/92 | 60/92 | 89/92 | 153/159 | 5/1/0 · 74/2/0 · 3/0/0 | -4…0 |
| 6000.3.25f1 | 92/92 | 84/92 | 92/92 | 157/159 | 1/1/0 · 17/1/0 · 0/0/0 | -1…0 |

**On the reference version (6.3 LTS), (c) is zero.** What the failures are:

- (a) 16 heights on 6.3 (8 ordinary + 8 boundary): Korean and mixed sentences set in Inter. Inter
  has no Hangul glyphs, so Unity and the browser draw them with different fallback fonts (Unity
  14/19/27/43, preview 13/17/25/39). The other four fonts, which have the glyphs, match in height
  exactly. **A known difference**; from 0.6.0, text drawn in the default font that contains Hangul,
  Han or Kana is warned (reason `font-fallback`, `missingGlyphs`). Coverage of a font you set is
  not checked
- (b) one boundary case on 6.3: `inter-en-32-bm2`. Its natural width is 330 in Unity and 329 in the
  preview (1px), so in a 329px box Unity breaks the line and the preview does not. The height miss
  follows from that
- (a) one line-break case on 6.3 (lines and height): `noto-jp-zh-20-w60`. From 0.6.1 the measurer
  breaks between every Han/Kana character and gets 7 lines; Unity 6.3 draws 8 (6000.0: 7). Not
  starting a line with `，` or `。` (kinsoku) explains it [inferred]. Kinsoku is not measured and not
  implemented — **a known difference** (`tests/text-cohort/spec.json` `known`). The browser paints
  this box in 8 lines too, one more than measured (`paint.mjs` holds it for the same reason)
- Up to 0.6.0 the measurer broke lines at spaces only, so a Japanese or Chinese sentence was always
  measured as one line. That failure was classified (b) in this table and hidden; from 0.6.1 a
  boundary case gets (b) only when the preview's line count agrees with its own natural width
- (a) The rest on 6000.0 is a **text generator** difference, not a version one (confirmed 2026-10-19 by item T: the 6000.0 editor uses Standard, the 6.3 editor Advanced, and the runtime panel, Standard, gives the same values on 6.3 too). 6000.0 adds one to a height that comes out as a
  whole number (Jua, DungGeunMo: 10px → 11), and advances lines after the first by FaceInfo
  `lineHeight` (Jua, two lines at 10px → 23; 6.3 gives 20). 6000.0 also draws Jua's English 2–4px
  wider than 6.3. The preview matches 6.3

**Spaces.** Runs of spaces and leading spaces are measured (`probe-editor/spaces.json`,
`spaces-prewrap.json`, 20px, both versions): 6.3 collapses a run to one and drops leading spaces
under `normal` and `nowrap`, and keeps them under `pre` and `pre-wrap`; 6000.0 does not collapse.
The preview follows 6.3. **Trailing spaces are not measured** — they follow CSS, which is also
what the browser paints. No cohort sentence ends in a space, so the table above is unaffected.

*(The above is the 0.6.x record.)* **0.7.0, now:** whether runs collapse is decided by the generator, not the
version — the 6.3 editor (Advanced) collapses (`r15-label-spaces`, 28 against 28) while Standard (the runtime
panel, both versions, and the 6000.0 editor) keeps them (64 against 33, 55 against 28). Trailing spaces are
measured too (TextField `trail     `: Standard drops them, Advanced counts them, `r15-tf-spaces`). The preview
collapses with either generator, so a runtime Label's run of spaces and a TextField's trailing spaces are
**measured but not implemented known differences**, 0.8 candidates (`docs/backlog.md` item 3; the trailing-space part (T6) was a human decision for 0.8 on 2026-10-21).

A font without FaceInfo (only a web font was given) falls back to the canvas's ascent and descent.
How those differ from FaceInfo:

| Font | FaceInfo (ascent − descent) / size | Canvas (ascent + descent) / size |
|---|---:|---:|
| Inter | 1.2102 | 1.2111 |
| Pretendard | 1.1929 | 1.2000 |
| Jua | 1.0000 | 1.0000 |
| DungGeunMo | 1.0000 | 1.0000 |
| Wanted Sans Bold | 1.1934 | 1.2000 |

With the canvas values, one line comes out 1px taller at some sizes. Between 8 and 72px,
Pretendard differs at 31, 36, 41, 46, 51, 56, 57, 61, 62, 66, 67, 71 and 72px, Inter at 19, 38
and 57px (the cohort's 10/14/20/32px are the same either way). A host that passes FaceInfo is
exact.

### Runtime panel (separate set, measured 2026-10-19 — item T)

0.7.0's default theme is the runtime one (a game screen). The table above was measured in an editor
window, so the same cohort was measured again on **a real runtime panel**. It is **never added** to
the table above.

| Item | Value |
|---|---|
| Unity side | 6000.0.40f1, 6000.3.25f1, PanelDump (PanelSettings + UIDocument, default runtime theme), **a fresh Unity process per probe** (`tests/layout/unity/dump-solo.sh`) — `tests/text-cohort/unity-runtime/` |
| Preview side | the same Chrome, `theme: 'runtime'` |
| Criteria | as above (line count equal, height equal, width within 1px or 1%). The boundary cases are the same files (6000.0 editor one-line width ±2px) |

| Unity (런타임 패널) | 줄 수 | 높이 | 너비(1px/1%) | 경계 줄 수 | 실패 (a/b/c): 줄·높이·너비 | 너비 Δ 범위 |
|---|---:|---:|---:|---:|---|---|
| 6000.0.40f1 | 92/92 | 84/92 | 92/92 | 159/159 | 0/0/0 · 17/0/0 · 0/0/0 | -1…0 |
| 6000.3.25f1 | 92/92 | 84/92 | 92/92 | 159/159 | 0/0/0 · 17/0/0 · 0/0/0 | -1…0 |

- **The runtime panel gives the same values on both versions, and the same as the 6000.0 editor above.** All three use the
  Standard generator. The height rule (a whole-number height +1, later lines by `lineHeight`) and Jua's English 2-4px wider are
  the Standard generator's, not a version's. So classification moved from version to generator: a Standard row is explained
  against the Advanced reference (the 6.3 editor). The editor table does not change
- **The preview measures Standard text by Standard's rules (2026-10-20).** Height `floor(fs·r + (n−1)·fs·lineHeight/pointSize) + 1`, widths
  without kerning — 234/235 heights and 84/84 widths on the three Standard dump sets (bundle A plan section 29 — the one height exception is `noto-jp-zh-20-w60`: 6000.0 editor 202, runtime 201, the rule 203; on the runtime side a fallback glyph starting the last line explains it). The generator is the resolved
  `-unity-text-generator`, not the theme. Before (Advanced's formula throughout) this table read heights 60/92, widths 89/92, boundary 153/159
- The 8 heights left (a) are Inter's Hangul and mixed sentences drawn with fallback glyphs, the same 8 as the 6.3 editor table's
- **Known difference — a glyph the font does not have (cause found 2026-10-20, classified (a) 2026-10-21):** when a glyph the
  given font does not have starts the last line, the runtime preview's box can be taller than Unity's (2px in the measured pair).
  In `noto-jp-zh-20-w60` (Noto Sans JP 20px in 60px, 7 lines) the last line is `张。`; Noto Sans JP has no `张`, Unity draws it with
  a fallback font, and Unity's runtime panel gives 201 (both versions) where the preview's Standard rule gives 203. Thirteen probes
  dumped alone show the 2px only when the fallback glyph **starts the last line**; anywhere else the height is the same
  (`tests/text-cohort/fallback-zh/`). The preview does not know a font's glyph coverage, so it does not reproduce this
  (`spec.json` `known`, `docs/backlog.md`). The line count agrees
- Kinsoku: the runtime panel has none, so the 6.3 editor's `known` row (8 lines) agrees here at 7
- The editor set's 6000.0 dumps taken again alone have the same boxes (only 11 Jua measured widths differ, not used to judge)

## Why geometry and not pixels

Unity draws text with its own font asset; a browser draws it with `sans-serif`. Antialiasing and
subpixel rendering differ too. **Even with layout that is 100% correct, every glyph pixel
differs.** A pixel diff over cases containing text measures the font, not the layout accuracy.

The question worth answering is "does my layout land in the same place as in Unity", and
coordinates answer it. Visual properties — colours, borders, corner radii — are invisible to
coordinates and are compared separately, by eye.

## Producing the ground truth

```
1. pnpm golden:emit
     tests/golden/cases.ts  ->  tests/golden/cases/*.uxml + *.uss

2. Copy tests/golden/cases/ into a Unity project (e.g. Assets/GoldenCases/)
   Put tools/UxmlLayoutDump.cs under Assets/Editor/

3. Unity: Tools > uxml-preview > Golden Case Dumper
   Browse to the case folder -> Run -> choose an output folder

4. Copy the resulting *.json into tests/golden/unity/

5. pnpm test:golden
```

A case with no ground truth is **skipped, not failed.** A build must not break for want of a file
nobody can produce, and at the same time an unmeasured case must never read as a passing one.

Each dump records its panel size and the web side lays the case out at that same size, so there
are never two numbers to keep in sync by hand.

**Known difference — half-pixel rounding (2026-10-19):** a centred text at a half pixel is rounded up by Unity and down by the preview (Yoga's text node). The golden sets have no such case (it is not a named element); the contract tests `bundle-f` and `bundle-g` name it. Not fixed — decided after measuring per alignment (`docs/backlog.md`).

**Measuring condition — the font (2026-10-21):** the text figures are measured with the same font file Unity uses passed to the preview. Without a font, the preview measures with the browser's default font: text widths can differ by a few pixels and wrapped text can break into a different number of lines (re-check R3-C4: four lines with Chrome's default font, five with Unity's; R1: an unconstrained Label 178 against 182). The coordinate figures (1122/1148) measure layout given the text sizes — the harness uses a fixed measure (`FIXED_MEASURE`). The real measurer is measured separately by `tests/text-cohort/measure-real.mjs`, with Unity's font (Inter).

**Known difference — 1px when the panel overflows (re-check R1-H, 2026-10-21):** in a column taller than the panel, as in the runtime `g-clamp`, the shrunk (flex-shrink) height can differ from Unity's by 1px (`row-label`, `rh-label`: 21 against 20). Not fixed.

## How a comparison is judged

- per element: `x` / `y` / `width` / `height`
- tolerance **0.5px** — wobble from Yoga's point rounding is not a mismatch
- **The reference is the solo run.** In Unity itself, under the Standard text generator, a text's width can differ by 0-2px depending on what the same process drew before (the runtime panel on both versions, the 6000.0 editor; the 6.3 editor, Advanced, does not). So every baseline is dumped by a fresh Unity process per probe or case (`tests/layout/unity/dump-solo.sh`, decided 2026-10-18). The tolerance is not widened
- the join key is the UXML `name` attribute; unnamed elements are not compared
- cases flagged `measuresText: true` are excluded. A browser cannot measure text with Unity's font
  asset, so a difference there is not a layout error. Text boxes themselves are compared separately,
  in a real browser, by the text cohort above

## Assumptions this case set settled

Carried unasserted through Phases 1–4. All but the last row have been settled by measurement.

| Assumption | Where it came from | Case | Result |
|---|---|---|---|
| `flex-shrink` defaults to 1 (Yoga's engine default is 0) | `src/render/values.ts` | `flex-grow-shrink` | **correct** |
| Specificity is a triple, pseudo-classes count as classes | `src/style/specificity.ts` | `specificity-tie` | **correct** |
| A direct match always beats an inherited value | CLAUDE.md | `inherit-vs-direct` | **correct** |
| Inline styles beat every selector | CLAUDE.md | `inline-override` | **correct** |
| Percentages do not resolve without an explicit parent size | CLAUDE.md | `percent-without-parent-size` | **correct — we were wrong** |
| `<Style>` applies only to its parent and descendants, not siblings | issue #4 measurement | `style-subtree-scope` | **correct — 120/40** |
| Line height is `font-size * 1.2` | `src/render/measure.ts` | `lines.json`, text cohort | **wrong** — replaced in 0.6.0 by Unity's FaceInfo formula (1–4 lines × five sizes, right on both versions) |
| `-unity-text-align` vertical mapping | `src/render/css-map.ts` | `text-align` | not settled (text excluded) |

`flex-shrink` mattered most. Yoga's own engine default is 0, so leaving it alone would have left
elements that should shrink unshrunk — and the Phase 4 decision to **write every supported
property explicitly** is what caught it.

## The divergence that got fixed — Unity's control defaults (2026-08-05)

The first time five `Button` cases were compared, **18 of 48 values missed**, all the same shape:
x 3px out, y 1px out, compounding along a row.

The cause was not layout but a **missing input**. Unity gives controls default spacing through a
theme stylesheet, and this renderer gave none. The hypothesis was checked by computation: adding
the single rule `.unity-button { margin: 1px 3px }` made **all 48 values** of the five cases match.

How it was fixed matters. No offset was added to any coordinate — the renderer was given **the
same stylesheet Unity has**. The first would violate CLAUDE.md rule 1 (never implement layout);
the second is matching the input. The values live in `src/controls/theme.ts`.

- Measured values only. `Label` gets **no default margin, and that is a measurement**: the
  explicitly sized Label in `inherit-vs-direct` sits at x=0, y=0 in Unity
- Padding, border and font defaults are **unmeasured** and therefore absent. Every current case is
  explicitly sized and USS is border-box, so they do not move the outer rectangle and do not show
- The selector `.unity-button` came from Unity's documented `Button.ussClassName` and **was not a
  measured value at first** — the margin dumps proved the spacing, not the selector carrying it.
  The `theme-class-hook` case was written to settle that, and **it was settled on 2026-08-05**: a
  `.unity-button` rule in author USS reaches a bare `<ui:Button>`, giving 120×40 on both sides.
  The selector is a measured value now

**These values are version-dependent.** Theme values differ between Unity versions, so whenever
they apply a `version-dependent` warning naming the measured version is raised once per document.

## The one known divergence — percentages against an auto-sized parent

**Unity is right and we are wrong.**

```
parent: no explicit size, child: width 50% / height 50%, panel 400 x 300

           Unity      ours
  parent    0 x 0     0 x 150
  child     0 x 0     0 x 75
```

CLAUDE.md's "percentages do not resolve when the parent has no explicit size" holds on both axes.
`yoga-layout` 3.2.1 resolves a **main-axis** percentage even against a parent whose size is not
definite; the Yoga vendored in UI Toolkit does not.

### Why it was not fixed

Every attempt to configure around it failed. The trail is kept.

| Attempt | Result |
|---|---|
| Changing the available size given to `calculateLayout` (undefined / NaN / auto) | no change |
| Every `Errata` value (`None` / `StretchFlexBasis` / `AbsolutePercentAgainstInnerSize` / `All` / `Classic`) | no change |
| `ExperimentalFeature.WebFlexBasis` | no change |
| `useWebDefaults(true)` | only the axes swap (200×0), confirming this is **main vs cross axis, not width vs height** |
| `flex-basis: 0` on the parent | **Unity's 0×0.** But as a default it collapses every element with an explicit height to zero (`height: 40px` → `0`). A coincidence, trading 17 cases for 1 |

It cannot be configured away, and correcting it by hand means intervening in layout calculation —
**which CLAUDE.md rule 1 forbids**, precisely because such corrections drift over time.

So it is registered in `KNOWN_DIVERGENCES` in `tests/golden/golden.test.ts` as **exactly two
values**. A list rather than a widened tolerance, so the test fails if this divergence disappears
or spreads.

### What it means in practice

Putting percentage-sized children under a parent with no definite size **does not work in Unity
anyway**. The preview draws that situation more permissively than Unity — something invisible in
Unity may be visible in the preview. The reverse (missing in the preview, visible in Unity) does
not happen, so a UI built by trusting the preview does not break when it reaches Unity. Still,
specifying the parent's size is the safer habit when using `%`.

## Case list

`pnpm golden:emit` writes `tests/golden/cases/README.md`, which lists the question each case asks.
The case definitions themselves live in `tests/golden/cases.ts`, their only source.
