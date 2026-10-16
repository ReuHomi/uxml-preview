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
| `Button` | verified | ten golden cases compared by coordinates (measured). Its label is **centred**, found by the eye check. Carries Unity's **default `margin: 1px 3px`** (`src/controls/theme.ts`); honours `:hover` and the other states. Editor theme; the runtime theme is 0.7.0 |
| `ScrollView` | verified | reproduces the **three implicit levels** (`unity-content-and-vertical-scroll-container` → `unity-content-viewport` → `unity-content-container`); four golden cases compared by coordinates (measured). The scrollbar's **width is reserved (13px) but nothing is drawn** — dragging, wheeling and scroll position are outside a static render |
| `Image` | verified | has its own renderer (`unity-image`). The six `Image` elements of the representative screen (`inventory`) match Unity 6000.0.40f1 in all 24 coordinate values (measured), and the default scale mode `stretch-to-fill` was confirmed by eye ([visual check](visual-check.md), item 5). Its picture arrives through USS `background-image` — a texture assigned from C# leaves no path a preview can follow |
| `TextField` | fallback | its `text` / `label` is not drawn |
| `Toggle` | fallback | as above |
| `Slider` / `SliderInt` | fallback | as above |
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

More control renderers and a runtime theme option are 0.7.0.

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
| `white-space` | A | **partial** | space handling is measured (below). Wrapping under `pre` differs — Unity wraps `pre` to the width too (measured); the preview does not |
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
  `font-fallback` warning. The default font Inter has none of those glyphs, so Unity draws them
  with a fallback font, and that box measured 1–4px taller. **Glyphs missing from a font you set
  are not checked** — the preview does not read a font file's coverage
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
- **Unity's own state defaults (a `:hover` background, say) are not included.** A layout dump
  measures geometry, and a colour is not geometry, so there is no way to prove them. Only state
  styling you wrote yourself applies.
- **Nested disabled elements differ from Unity.** Unity dims only the element with
  `enabled="false"` to opacity 0.5 and leaves its descendants alone (measured). The preview
  compounds it to 0.25. To be fixed with the 0.7.0 theme work.

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

How a warning is built (`kind`, `reason`, `subject`, `nodes`, `at`) and how a consumer should
read it is in the [API](api.en.md#warnings).

## Not checked

- Colour, borders and corners rest on one eye comparison of one screen ([visual check](visual-check.md)).
  Anything that screen did not contain is unmeasured
- A wrapped `ScrollView`'s content height differs: Unity clamps it to the viewport, Yoga grows it
  to the content. Unity's rule is not identified yet
- Scrollbars reserve their width but are not drawn, and nothing scrolls
- The runtime theme (PanelSettings) has not been compared. Every baseline is the editor theme
