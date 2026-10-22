# Support matrix

*English · [한국어](supported.md)*

> **Reference Unity version: 6.3 LTS.** "Not in USS" means absent from Unity's official USS
> property reference up to 6.6. Unity 6.7 (beta) is not supported; it will be reconsidered
> when 6.7 reaches LTS.
> The public coordinate figure was measured on 6000.0.40f1; the 6.3 LTS re-measurement and the
> text cohort are kept separately in [Accuracy](accuracy.en.md). The numbers live only there.

This page says what is supported and **how far each item was checked**. The evidence comes in
three kinds.

- **Measured** — dumped or compared in Unity directly (`tests/golden/unity/`, `tests/layout/unity/`, `tests/text-cohort/unity/`)
- **Documented** — read from Unity's documentation or property reference. Wrong values do not show, so this is marked until measured
- **Inferred** — decided by reasoning, without either of the above. These are the `inferred: true` rows of the registry (`src/style/registry.ts`)

## Portability grades

- **A** — supported as-is
- **B** — approximated by other means (there is a difference)
- **C** — not supported. A warning is recorded and the declaration ignored
- **D** — needs a structural change

## Status vocabulary

- `not implemented` — not started
- `in progress`
- `written` — code exists, not compared with Unity
- `verified` — compared with Unity and matching. The notes say what it was compared with
- `fallback` — drawn as a `VisualElement`, with no renderer of its own
- `deferred` — postponed on purpose, with a reason

**`written` and `verified` are never conflated.** Golden cases compare coordinates only, so
anything coordinates cannot see — colour, borders, fonts — stays `written` no matter how finished
the code looks.

That comparison also stops at the coordinates Yoga produces. Whether the painted DOM reproduces
them is checked by an invariant of our own (`tests/render/border-offset.test.ts`), not against
Unity. See "What this number covers" in [Accuracy](accuracy.en.md) for why that matters.

## Controls

| Type | Status | Notes |
|---|---|---|
| `VisualElement` | verified | most golden cases are built from it (coordinates, measured) |
| `Label` | verified | layout compared through the golden cases, text boxes through the text cohort (measured). Height follows Unity's FaceInfo formula; letter, word and paragraph spacing follow Unity's rules — see "Text and fonts" below |
| `Button` | verified | ten golden cases compared by coordinates (measured). Its label is **centred**, found by the eye check. Carries the theme's margin, padding, border, colours and `:hover`/`:active`/`:focus`/`:disabled` colours on both themes, all from dumps (`src/controls/theme.ts`, 0.7.0); `flex-shrink: 0` |
| `ScrollView` | verified | reproduces the **three implicit levels** (`unity-content-and-vertical-scroll-container` → `unity-content-viewport` → `unity-content-container`); four golden cases compared by coordinates (measured). **Known difference: scrollbars reserve their width and are not drawn** (13px on the editor theme, 24px on the runtime theme, measured). The scroller parts Unity builds (`unity-scroller` and below) are not built, and the class test and the golden comparison leave them out (human decision 2026-10-18; first candidate for the next version, `docs/backlog.md`). Dragging, wheeling and scroll position are outside a static render |
| `GroupBox` | verified | 0.7.0 bundle B. `unity-group-box`, margin and padding (both themes, measured). With `text` it builds Unity's title Label before the children (part name `unity-group-box__label` — Unity gives it no name, so the class names it). The `c07-GroupBox` dumps match on both themes: boxes, title, resolved styles. An empty `text=""` builds no title and `text=" "` builds one — measured on both versions and both themes (`r1-groupbox-empty`). A title of only spaces is 0 high on the runtime theme; the editor theme draws 6.3's 15 and warns `version-dependent` (6000.0: 0); under the standard generator both versions are 0 (`c-whitespace`). A Label or Button whose text is only spaces follows the same rule. An author rule on `.unity-group-box__label` reaches the title (`r1-groupbox-author`) |
| `Box` | verified | 0.7.0 bundle B. `unity-box`, a 1px border, border colour and background (both themes, measured). The `c07-Box` dumps match on both themes |
| `Image` | verified | has its own renderer (`unity-image`). The six `Image` elements of the representative screen (`inventory`) match Unity 6000.0.40f1 in all 24 coordinate values (measured), and the default scale mode `stretch-to-fill` was confirmed by eye ([visual check](visual-check.md), item 5). Its picture arrives through USS `background-image` — a texture assigned from C# leaves no path a preview can follow |
| `TextField` | verified | 0.7.0 bundle C. Single-line, `multiline`, placeholder, `password` (`mask-character`, `*` by default), disabled, with and without a label, both themes. Builds Unity's parts: the label (when `label` is set; part name `unity-text-field__label`), `#unity-text-input`, `unity-base-text-field__multiline-container` when multiline, and the inner text `unity-text-element--inner-input-field-component`. An empty value draws the placeholder in its colour; a password draws only the mask and never puts the value in the DOM; an empty field is still one line high; multiline wraps only with `white-space: normal`. The `c07-TextField`, `c-textfield` and `c-textfield-hook` dumps (6.3) match on both themes: boxes, parts, resolved styles, hover and focus borders. Author USS reaches `#unity-text-input`, `.unity-text-field__input`, `.unity-text-field__label` (measured). **Not drawn:** the caret, the text selection, input and editing, a multiline scrollbar — interaction is a 0.8 candidate |
| `Toggle` / `RadioButton` | verified | 0.7.0 bundle E. Label (`label`), text (`text`), checked (`value="true"` → `:checked` on the control and its input part), disabled, both themes. Parts: label `unity-toggle__label`, input `unity-toggle__input`, `#unity-checkmark`, text `unity-toggle__text` (RadioButton: `unity-radio-button__*` and a checkmark background). The radio checkmark is hidden unchecked, 12×12 (runtime) / 6×6 (editor) checked. The 6.3 `c07-Toggle`, `c07-RadioButton`, `e-toggle` and `e-radio` dumps match on both themes: boxes, parts, resolved styles, classes. **The check mark is the preview's own drawing, not Unity's textures (`check`, `d_toggle_bg`, `d_toggle_on`)** — judged by a person (rule 5, `docs/design/0.7.0-bundle-E-shots/`). On the editor theme the Toggle box (Unity's `d_toggle_bg`/`d_toggle_on` textures) is painted in colours measured off Unity's screen (E2: inside #2a2a2a, top edge #0d0d0d, other edges #212121, radius estimated from the picture, 1-3px). Clicking is not drawn (a 0.8 candidate). RadioButtonGroup is a fallback |
| `ProgressBar` | verified | 0.7.0 bundle F. Value (`value`), range (`low-value`, `high-value`), title (`title`), disabled, both themes. Parts: `#unity-progress-bar` (`unity-progress-bar__container`) > background `unity-progress-bar__background` > bar `unity-progress-bar__progress` + title container `unity-progress-bar__title-container` > title Label `unity-progress-bar__title`. The bar width follows Unity's code, `floor(background width - 2) * clamp(value) / high-value` (the value clamped between low and high, then divided by high: low 40 with value 40 is 40%, `k-progress`, measured 2026-10-21), matching all 14 `f-progress` rows (values 0-150, ranges, widths 57-292) on both themes and versions. File children are the ProgressBar's own children, after its parts. **Version difference:** on the editor theme an empty bar (fill 0) is 1px wide on 6000.0.40f1 and 0px on 6.3; drawn as 6.3, with a version warning |
| `TextElement` / `RepeatButton` | verified | 0.7.0 bundle F. Plain text as in Unity (no theme margin, border or background; `flex-shrink` 1). **A RepeatButton does not look like a button** — that is Unity's screen (both themes, measured). As decided for design question 6, it is drawn as plain text, as Unity draws it. With file children, the children decide its size (its own text adds no height). Forced hover, active, focus and disabled change no value (`f-states`). Repeating on press is not drawn |
| `Slider` / `SliderInt` | verified | 0.7.0 bundle D. Horizontal and vertical (`direction`), label, input field (`show-input-field`), disabled, both themes. Builds the label (`unity-slider__label`), the input (`unity-slider__input`), `#unity-tracker`, `#unity-dragger-border` and `#unity-dragger` inside `#unity-drag-container`, and with an input field a TextField `#unity-text-field` showing the value. The dragger: t = clamp((value - low) / (high - low), 0, 1); horizontal translate-x = t × (drag container width - dragger width), vertical translate-y = (1 - t) × (drag container height - dragger height) — measured at eleven values, vertical, a 30-144 range, a reversed range and an out-of-range value (`d-slider`, `d-sliderint`). The 6.3 `c07-Slider`, `c07-SliderInt` and `d-*` dumps match on both themes: boxes, parts, resolved styles, classes. A file child written inside a slider is the slider's own child, after its parts (at the row's end when horizontal), as in Unity (`d-slider-children`, measured). **Not drawn:** dragging and changing the value (interaction, a 0.8 candidate) |
| `Foldout` | fallback | as above |
| `DropdownField` | fallback | as above |
| `ListView` | fallback | undecided |

> **A control with no renderer of its own is drawn as a `VisualElement`** (`fallback`).
> Its own styles and its children come out normally; what is missing is whatever makes that
> control look like itself — scrollbars, an input field, an implicit child hierarchy. One
> warning is reported per element.
>
> This reverses v0.1, which dropped the whole subtree. Losing half a screen to one unfamiliar
> tag is a defect rather than a scope limit, and a screen like that gives you nothing to judge
> the rest of the render by.
>
> Parsing succeeds either way, and nothing is lost on a round trip.

More control renderers are for the bundles after 0.7.0's first.

**Themes (0.7.0).** `render`'s `theme` option picks `'runtime'` (the default, a game screen: the default runtime theme Unity creates for a new PanelSettings) or `'editor'` (the dark editor theme). Both themes' default text size and colour and their Label and Button values are read from dumps (`tests/layout/unity/6000.3.25f1/probe-panel/`, `6000.0.40f1/probe-editor-070/`). The light editor theme is not covered. The core paints nothing behind the panel (transparent, as Unity does); runtime text is dark (#1b1b1b), so the backdrop is the host's to choose.

## Templates and instances

| Element | Status | Notes |
|---|---|---|
| `<ui:Template name="…" src="…">` | verified | reads the declaration and resolves relative paths through `resolveImport(url, from)`. `project://…` and `/…` are project-root relative |
| `<ui:Instance template="…">` | verified | expands into an opaque `TemplateContainer` carrying the Instance's `name`, `class` and inline `style`. Nested expansion is capped at 32 (`TEMPLATE_DEPTH_LIMIT`). A template's own `Style` is scoped to its container |
| `<AttributeOverrides>` | verified | overrides ordinary attributes on **every** duplicate target with that `element-name`. A missing target is reported as `override-target-missing` with the names that do exist. A `style` override is reported as `override-style-ignored` and not applied — Unity ignores it during import (measured); this is not a preview limit |
| Template cycles | not implemented | not expanded; blocked fail-closed and the whole path reported as `template-cycle` |
| Slots | deferred | measured alive in 6000.0.40f1. Slot children are not placed; `template-slot-unsupported` is reported |

A template `src` of `Packages/...` is treated as relative to the declaring file and fails in
the measured case. UXML in an embedded package, physically present under
`<projectRoot>/Packages/<name>/`, resolves through `project://database/Packages/...` (measured
on Unity 6000.0.40f1). Neither the core nor the hosts search `Library/PackageCache`; a
registry-package template found only there is reported as `package-path-not-searched`.

`collectDependencies(source)` lists a document's template dependency URLs in source order, for
prefetching. Of the 14 documents in the external sample only one uses `<ui:Template>` — template
support rests on the measured cases above, not on that sample.

Out of scope: runtime `binding-path`, `ListView`/`TreeView` item templates decided by C#
`makeItem`, per-instance pseudo-states, and partially drawing a cycle. Template editing,
automatic extraction and UI Builder emulation are non-goals of the viewer core.

## USS properties

**`verified` means compared with Unity and matching, nothing less.** The notes say what it was
compared with (coordinate golden cases, the text cohort, value probes, the eye check). Whether a
property exists, inherits, and when it was introduced comes only from the registry,
`src/style/registry.ts`.

| Property group | Grade | Status | Notes |
|---|---|---|---|
| flex properties | A | verified | `flex-direction` defaults to `column`, `flex-shrink` to `1` (coordinates) |
| width/height/min/max | A | verified | including min/max conflict priority (coordinates) |
| margin / padding | A | verified | no margin collapsing (coordinates) |
| position / top·left·right·bottom | A | verified | including nested absolute (coordinates). `fixed`/`sticky` are C |
| box model (border-box) | A | verified | width includes padding and border (coordinates) |
| `%` sizes | A | **partial** | matches only when the parent's size is definite; not otherwise — the known divergence in [Accuracy](accuracy.en.md) |
| `aspect-ratio` (6.3+) | A | verified | handed to Yoga. Compared with a 6000.3.25f1 probe (`aspect2.json`, measured) |
| `justify-content: space-evenly` | A | verified | works on both versions (value probe, measured) |
| background-color | A | written | not covered by coordinates. Matched in the representative screen's eye check |
| border-width / color / radius | A | written | width verified through layout. `border-style` is solid only |
| opacity / visibility | A | written | Unity reads `opacity: 50%` as 50, fully opaque (measured) — warned `invalid-value` |
| color / font-size | A | written | font-size inheritance covered by cascade tests |
| `letter-spacing` / `word-spacing` | A | verified | the value is not CSS px but **value × font size / 100**. Measured and painted by that rule (spacing probes, measured). See "Text and fonts" below |
| `-unity-paragraph-spacing` | A | verified | measured and painted (spacing probes, measured) |
| `-unity-text-generator` | A | verified | the spacing difference between `standard` and `advanced` is measured and painted (measured) |
| `white-space` | A | verified | A Label or Button is `nowrap` unless the author writes otherwise (Unity's theme, `g-clamp`, both versions and themes, 0.7.0 review C1); TextElement and RepeatButton are `normal`. Space handling is measured (below). Unity does not wrap `pre` to the width either (`pre-wrap2`, both versions and themes, 2026-10-16) — 0.6.0's "Unity wraps `pre`" came from evidence that could not tell them apart |
| `-unity-font-definition` | B | verified | when the host returns a font through the `resolveFont` hook, text is measured and painted in it (text cohort, measured). Without the hook, or on `null`, it warns and uses the browser's default font |
| `-unity-font` | B | written | its precedence against `-unity-font-definition` follows Unity's documentation (documented); not measured on its own |
| `-unity-font-style` | B | written | |
| `-unity-text-align` | B | written | vertical + horizontal combined |
| `-unity-background-scale-mode` | A | **default verified** | `stretch-to-fill`→`100% 100%`, `scale-and-crop`→`cover`, `scale-to-fit`→`contain`. The default was confirmed by eye ([visual check](visual-check.md)). The other two values are not in the representative screen and are **unconfirmed individually** |
| translate / scale / rotate | A | written | |
| background-image | A | written | passes the `url()`/`resource()` form to the resolver. `resource()` is a Resources lookup and editor built-ins cannot be resolved by a disk-only host; draws a placeholder on failure. Unity measurement: [Accuracy](accuracy.en.md) |
| `var()` custom properties | A | written | covered by cascade tests, not compared with Unity |
| `-unity-slice-*` | A | not implemented | warned `not-rendered` |
| `-unity-background-image-tint-color` | A | not implemented | no CSS counterpart; warned `not-rendered` |
| `-unity-text-outline-*`, `text-shadow` | B | not implemented | warned `not-rendered`. Both change pixels only, not the box (measured) |
| `-unity-text-auto-size` (6.3+) | A | not implemented | warned `not-rendered`. In Unity it **changes the box** (32×15 → 99×49 on 6000.3.25f1, measured) — coordinates on a screen that uses it differ from Unity's |
| transition | A | not implemented | kept whole, not expanded. A still frame has nothing to draw |

## Text and fonts

From 0.6.0 text boxes are measured by Unity's rules. All of it rests on Unity dumps
(`tests/layout/unity/`, `tests/text-cohort/unity/`, 6000.0.40f1 and 6000.3.25f1).

- **Height** — `ceil(lines × font size × (ascent − descent) / pointSize)`. The coefficients are the
  FaceInfo Unity reports for that font, not fitted values. The default font (the editor's Inter)
  gives 12px → 15, 20px → 25. Several lines are rounded once as a block, not line by line (1–4
  lines × five sizes, matching on both versions). 6000.0 computes from the second line on
  differently; the preview follows the reference version (6.3)
- **Spacing** — `letter-spacing` and `word-spacing` are value × font size / 100. The default
  generator (`advanced`) puts no letter spacing beside a space or after the last character.
  Painting follows the same rule, so the painted glyphs fit the measured box (checked in a real
  browser, `tests/text-cohort/paint.mjs`)
- **Spaces** — 6.3 collapses a run of spaces to one and drops leading spaces under `normal` and
  `nowrap`, and keeps them under `pre` and `pre-wrap` (measured). 6000.0 does not collapse. The
  preview follows 6.3. **Trailing spaces are not measured**
- **Fonts** — the host resolves a `-unity-font-definition` path through `resolveFont(path, form)`,
  returning a font family name, or `{ family, faceInfo }` (with FaceInfo the height matches
  Unity's), or `null`. Details in the [API](api.en.md)
- **Fallback fonts** — text with no font set that contains Hangul, Han or Kana raises a
  `font-fallback` warning. The default font (Inter in the editor panel, NotInter-Regular in the runtime panel) has none of
  those glyphs, so Unity draws them with a fallback font, and that box measured 1–4px taller (Hangul:
  both panels). For Han and Kana the width differs too:
  Unity's box was 6–87px narrower (editor panel only; 10–32px, Chrome on one PC; the preview's width depends on the
  device's fallback font). **Glyphs missing from a font you set are not checked** — the preview
  does not read a font file's coverage
- **Han and Kana line breaking** — from 0.6.1 lines break between Han and Kana characters (Hangul
  and Latin at spaces only, measured). Japanese and Chinese in a font you set match Unity in line
  count, height and width (text cohort). **Kinsoku (not starting a line with `。` and the like) is
  not measured and not done** — a line count can differ from Unity 6.3's by one
- **Rich text** — Unity interprets tags such as `<b>` and `<size=…>` by default. The preview draws
  them as characters and warns on every element with an interpreted tag (not with
  `enable-rich-text="false"`, where Unity draws them as characters too)
- Text outlines and shadows are not drawn

The text cohort's figures and failure classes are in [Accuracy](accuracy.en.md).

## Not supported (C)

`display: block/inline/inline-block`, `display: grid`, `position: fixed/sticky`,
`float`, `clear`, `z-index`, `box-shadow`, `gap`/`row-gap`/`column-gap`,
`overflow-wrap`, `word-break`, `mix-blend-mode`, `clip-path`, `mask`, `outline`,
`line-height`, `text-transform`, `text-decoration`, multiple backgrounds, `transform: skew()`,
3D transforms, `@keyframes`, `linear-gradient()`

All are reported as `not-uss`. With no `z-index`, overlap follows sibling order — porting means
reordering the markup (grade D from the porting point of view, [USS reference](uss-reference.md)).
Unity draws a warning icon for `linear-gradient()` (measured).

Units: `em`, `rem`, `vh`, `vw`, `vmin`, `vmax`, `pt`, `cm`, `in`, `calc()`

Selectors: siblings (`+`, `~`), `:nth-child`, `:first/last-child`, `:not()`, `:has()`,
attribute selectors, `::before`/`::after`, `@media`, and pseudo-classes Unity never sets, such
as `:selected`

> A rule containing any unsupported selector fragment is dropped **whole**, with one warning
> naming the fragment. The parser still stores it, so the rule round-trips intact.

USS properties this preview does not draw (warned `not-rendered`) are the `handling: 'none'` rows
of the registry: `text-shadow`, transitions, `-unity-text-outline*`, 9-slice,
`-unity-text-auto-size`, `filter` (6.3+), `-unity-material` (6.3+), `backdrop-filter` (6.6+) and
so on. Those that change a box in Unity carry `affectsLayout: true` on the warning.

## Values Unity cannot apply

Put into Unity 6000.0.40f1 and 6000.3.25f1 directly in 0.6.0 (value probes, measured). The
preview draws what the author meant and warns.

| Value | In Unity | Warning |
|---|---|---|
| an `hsl()` colour | 6.3: that element and **every element after it** lose their style. 6000.0: drawn black | `invalid-value`, `unityEffect: unstyled-from-here` |
| `cubic-bezier()` | on both versions, styling stops from that element on | `invalid-value`, `unityEffect: unstyled-from-here` |
| `filter` | not a property in 6000.0, so styling stops from that element on; fine in 6.3 | `not-rendered`, `unityEffect` (6000.0) |
| one bad unit in an inline `style` | every inline style in that file is dropped | `unityEffect: file-inline-dropped` |
| `opacity: 50%` | read as 50, fully opaque | `invalid-value` |
| `inherit` | read as transparent | `invalid-value` |
| `linear-gradient()` | a warning icon is drawn | `not-uss` |

Version differences in `white-space` values themselves are not judged yet.

## Pseudo-class states

`:hover`, `:active`, `:inactive`, `:focus`, `:disabled`, `:enabled` and `:checked`
(`USS_STATES`) are honoured as **styling**. States are explicit input rather than mouse events:

```ts
render(doc, el, { states: { '#UseButton': ['hover'], '#DropButton': ['disabled'] } });
```

Keys are USS selectors, and states are per element — a real screen has one button hovered while
another is disabled, which a single document-wide set cannot express.

- Nothing changes state because a pointer moved. The same call always draws the same picture,
  which is what makes it comparable to Unity, or to yesterday.
- Keys are matched against the tree with **no states active**, so `:hover` inside a key is
  meaningless: it cannot switch itself on. A key that matches nothing, a key containing a state,
  and a state name Unity never sets are all warned.
- **`:enabled` applies automatically** to every element that is not disabled — Unity does so
  (measured on 6000.0.40f1 and 6000.3.25f1).
- **Button's own state defaults (`:hover`, `:active`, `:focus`, `:disabled` colours) are included since 0.7.0**,
  measured as resolved styles under forced pseudo-states (`c07-states`, both themes). Other controls' state
  defaults are measured when those controls get drawn.
- **Only the element written disabled is dimmed (0.7.0).** Unity gives `unity-disabled` and opacity 0.5
  to the element with `enabled="false"` and leaves its descendants at 1 (measured, `nested-disabled`); so
  does the preview. An element forced `disabled` through `states` is dimmed alone too.

`:selected` is not a state: Unity's page says USS does not support it (use `:checked`).

`:root` is not a version question. USS `:root` names the element a stylesheet was applied to,
not the document root as in CSS; with no UIDocument to attach to, the preview matches it against
`<ui:UXML>` and says so once, with a `matches-unity` warning.

## Versions

When a property was introduced comes from `src/style/registry.ts`, transcribed from Unity's
reference tables.

- 6.3+: `aspect-ratio`, `filter`, `-unity-material`, `-unity-text-auto-size`
- 6.6+: `backdrop-filter`, `animation-play-state`, `-unity-animation-clip`

Of these only `aspect-ratio` is laid out; the rest are not drawn, and their warnings carry
`subject.since` (e.g. `6000.3`).

## Warnings

In 0.6.0 this section ("Warning policy") moved to the [API](api.en.md#warnings): how a warning is
built (`kind`, `reason`, `subject`, `nodes`, `at`) and how a consumer should read it.

## Not checked

- **Known difference (half-pixel rounding, found 2026-10-19):** when a centred text's free space is odd and its position falls on a half pixel, Unity rounds up to the next pixel and the preview's Yoga floors a text node's position. A ProgressBar title on the runtime theme is 1px off in x (`bundle-f.test.ts` `KNOWN_HALF_PIXEL`, 6 rows; one on the settings screen). Decided after measuring the rounding per alignment (`docs/backlog.md`)
- **A Unity-side effect (runtime panel, cause found 2026-10-19):** when the **same text** was laid out earlier in the same panel with a different wrap setting (a TextElement or Label with `white-space: normal`), a later element with that text comes out 4-8px shorter, and the earlier element's own line count goes wrong too (`g-clamp`'s 20-21px; the `t-bis-*` dumps separate the cause: remove the earlier same text and it is 25px again). With no same text before it, Unity matches the preview. The preview does not reproduce the contamination; Unity appears to reuse a string's text layout [inferred]. Not seen on the 6.3 editor theme
- Colour, borders and corners rest on one eye comparison of one screen ([visual check](visual-check.md)).
  Anything that screen did not contain is unmeasured
- A wrapped `ScrollView`'s content height differs: Unity clamps it to the viewport, Yoga grows it
  to the content. Unity's rule is not identified yet
- **Known difference:** scrollbars reserve their width and are not drawn, and nothing scrolls (0.7.0 decision; first candidate for the next version)
- The runtime theme (PanelSettings) is compared as its own set since 0.7.0 (`docs/accuracy.en.md`, "Runtime theme"). The light editor theme is not compared
