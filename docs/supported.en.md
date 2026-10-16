# Support matrix

*English · [한국어](supported.md)*

> **Reference Unity version: 6.3 LTS.** "Not in USS" means absent from Unity's USS
> property reference up to 6.6. Coordinate accuracy figures were measured on
> 6000.0.40f1; a 6.3 LTS cohort is added in 0.6.0. Unity 6.7 (beta) is not
> supported and will be reconsidered when 6.7 LTS ships (`docs/backlog.md`).

Updated as phases land. Detailed CSS↔USS mappings are in `uss-reference.md`.

## Portability grades

- **A** — supported as-is
- **B** — approximated by other means (there is a difference)
- **C** — not supported. A warning is recorded and the declaration ignored
- **D** — needs a structural change

## Status vocabulary

- `not implemented` — not started
- `in progress`
- `written` — code exists, not checked against Unity
- `verified` — geometry compared against Unity and matching
- `deferred` — postponed on purpose, with a reason in `backlog.md`

**`written` and `verified` are never conflated.** Golden cases compare
coordinates only, so anything coordinates cannot see — colour, borders, fonts —
stays `written` no matter how finished the code looks.

That comparison also stops at the coordinates Yoga produces. Whether the painted
DOM reproduces them is checked by an invariant of our own
(`tests/render/border-offset.test.ts`), not against Unity. See
[`accuracy.en.md`](accuracy.en.md) for why that distinction matters.

## Controls

| Type | v0.5.0 | Notes |
|---|---|---|
| `VisualElement` | verified | most golden cases are built from it |
| `Label` | written | layout verified; **text measurement was never compared to Unity** |
| `Button` | verified | ten golden cases compared against Unity. Its label is **centred**, found by the eye check. Carries Unity's **default `margin: 1px 3px`** (`src/controls/theme.ts`); honours `:hover` and the other states |
| `ScrollView` | verified | reproduces the **three implicit levels** (`unity-content-and-vertical-scroll-container` → `unity-content-viewport` → `unity-content-container`); four golden cases compared against Unity. The scrollbar's **width is reserved (13px) but nothing is drawn** — dragging, wheeling and scroll position are outside a static render |
| `TextField` | fallback | its `text` / `label` is not drawn |
| `Toggle` | fallback | as above |
| `Slider` / `SliderInt` | fallback | as above |
| `Foldout` | fallback | as above |
| `DropdownField` | fallback | as above |
| `ListView` | fallback | undecided |
| `Image` | verified (visually) | has its own renderer (`unity-image`). Its picture arrives through USS `background-image` — a texture assigned from C# leaves no path a preview can follow. **Not compared to Unity** |

> **A control with no renderer of its own is drawn as a `VisualElement`**
> (`fallback`). Its own styles and its children come out normally; what is
> missing is whatever makes that control look like itself — scrollbars, an input
> field, an implicit child hierarchy. One warning is reported per element.
>
> This reverses v0.1, which dropped the whole subtree. Losing half a screen to
> one unfamiliar tag is a defect rather than a scope limit, and a screen like
> that gives you nothing to judge the rest of the render by.
>
> Parsing succeeds either way, and **nothing is lost in a round trip** — the
> playground's `round-trip: exact` indicator is that guarantee checked live.

## Templates and instances

| Element | v0.5.0 | Notes |
|---|---|---|
| `<ui:Template name="…" src="…">` | verified | Reads declarations and reuses `resolveImport(url, from)` for relative resolution. `project://…` and `/…` are project-root-fixed. |
| `<ui:Instance template="…">` | verified | Expansion creates an opaque `TemplateContainer`; the Instance `name`, `class`, and inline `style` attach to that container. Nested expansion is capped at 32. A template `Style` is scoped to that container's subtree. |
| `<AttributeOverrides>` | verified | Overrides ordinary attributes on **all** duplicate `element-name` targets. A missing target reports `override-target-missing` with the requested name and the names actually present. A `style` override reports the target element-name and style value as `override-style-ignored`. Unity ignores it during import; this is not a preview limitation, so it is not applied. |
| Cyclic templates | not supported | Expansion is blocked fail-closed and the full path is reported as `template-cycle`. |
| Slots | not supported | **Slots — measured alive in 6000.0.40f1. Out of this release scope and reported with `template-slot-unsupported`.** Slot children are not placed. |

`Packages/...` in a template `src` is treated as relative to the declaring UXML
and failed in the measured case. An embedded package UXML physically present at
`<projectRoot>/Packages/<name>/` resolves through
`project://database/Packages/...` (measured in Unity 6000.0.40f1). The core and
host do not search `Library/PackageCache`; a registry-package template
available only there reports `package-path-not-searched`.

`collectDependencies(source)` provides the template dependency URLs in source
order for host prefetching. The public `WarningKind` union grows from 8 to
**17**; consumers must update their classifiers. The nine new template
diagnostics are `template-src-unresolved`, `template-not-declared`,
`template-cycle`, `template-depth-exceeded`, `override-target-missing`,
`duplicate-name-in-tree`, `package-path-not-searched`, and
`template-slot-unsupported`, and `override-style-ignored`.

This scope excludes runtime `binding-path`, `ListView`/`TreeView` item templates
selected by C# `makeItem`, per-instance pseudo-state control, and drawing a
truncated cyclic graph. Template editing, automatic extraction, and UI Builder
reproduction are also non-goals for the viewer core.

## USS properties

**`verified` means the geometry was compared against Unity 6000.0.40f1 and
matched** ([`accuracy.en.md`](accuracy.en.md)).

| Property group | Grade | Status | Notes |
|---|---|---|---|
| flex family | A | verified | `flex-direction` defaults to `column`, `flex-shrink` to `1` — both confirmed |
| width/height/min/max | A | verified | including min/max conflict precedence |
| margin / padding | A | verified | no margin collapsing, confirmed |
| position / top·left·right·bottom | A | verified | including nested absolute. `fixed`/`sticky` are C |
| box model (border-box) | A | verified | width includes padding and border, confirmed |
| percentage sizes | A | **partial** | matches when the parent size is definite. Diverges when it is not — see `accuracy.en.md` |
| background-color | A | written | not something coordinates can check |
| border-width / color / radius | A | written | width is verified through layout. `border-style` is solid only |
| opacity / visibility | A | written | |
| color / font-size | A | written | font-size inheritance covered by cascade tests |
| `-unity-font-definition` | B | written | warns and falls back to the browser default font |
| `-unity-font-style` | B | written | |
| `-unity-text-align` | B | written | vertical+horizontal pair. Text cases are excluded from comparison |
| `-unity-background-scale-mode` | A | **default verified** | `stretch-to-fill`→`100% 100%`, `scale-and-crop`→`cover`, `scale-to-fit`→`contain`. The `stretch-to-fill` default was confirmed by the eye check (`docs/visual-check.md`); the other two values are not on the representative screen and remain **individually unconfirmed** |
| `-unity-slice-*` | A | **not implemented** | warning only |
| `-unity-background-image-tint-color` | A | **not implemented** | no CSS equivalent; warning only |
| `-unity-text-outline-*` | B | not implemented | |
| translate / scale / rotate | A | written | |
| transition | A | not implemented | kept whole rather than expanded |
| background-image | A | written | passes `url()`/`resource()` form to the resolver. `resource()` is a Resources lookup and editor built-ins cannot be resolved by a disk-only host; draws a placeholder on failure. Unity measurement: `accuracy.en.md` |
| `var()` custom properties | A | written | covered by cascade tests, not compared to Unity |

## Not supported (C)

`display: block/inline/inline-block`, `display: grid`, `position: fixed/sticky`,
`float`, `clear`, `z-index`, `box-shadow`, `gap`/`row-gap`/`column-gap`,
`overflow-wrap`, `word-break`, `mix-blend-mode`, `clip-path`, `mask`, `outline`, `line-height`,
`text-transform`, `text-decoration`, multiple backgrounds, `transform: skew()`,
3D transforms, `@keyframes`

Units: `em`, `rem`, `vh`, `vw`, `vmin`, `vmax`, `pt`, `cm`, `in`, `calc()`

Selectors: siblings (`+`, `~`), `:nth-child`, `:first/last-child`, `:not()`,
`:has()`, attribute selectors, `::before`/`::after`, `@media`, and pseudo-classes
Unity's pseudo-class page does not list, such as `:selected`

USS properties this preview does not draw (warned as `not-rendered`): `text-shadow`,
transitions, `-unity-text-outline*`, 9-slice, font assets, `filter` (6.3+),
`backdrop-filter` (6.6+), and the rest of the `handling: 'none'` rows in
`src/style/registry.ts`.

> A rule containing any unsupported selector fragment is dropped **whole**, with
> one warning naming the fragment. The parser still stores it, so the rule
> round-trips intact.

## Pseudo-class states

`:hover`, `:active`, `:inactive`, `:focus`, `:disabled`, `:enabled` and
`:checked` (`USS_STATES`) are honoured as **styling**. States are explicit input rather than
mouse events:

```ts
render(doc, el, { states: { '#UseButton': ['hover'], '#DropButton': ['disabled'] } });
```

Keys are USS selectors, and states are per element — a real screen has one
button hovered while another is disabled, which a single document-wide set
cannot express.

- Nothing changes state because a pointer moved. The same call always draws the
  same picture, which is what makes it comparable to Unity, or to yesterday.
- Keys are matched against the tree with **no states active**, so `:hover`
  inside a key is meaningless: it cannot switch itself on.
- **Unity's own state defaults (a `:hover` background, say) are not included.**
  A layout dump measures geometry, and a colour is not geometry, so there is no
  way to prove them. Only state styling you wrote yourself applies.

`:selected` is not a state: Unity's page says USS does not support it (use
`:checked`). `:enabled` only applies when passed in `states`; switching it on
automatically is 0.6.0.

## Versions

When a property was introduced comes from `src/style/registry.ts`, transcribed
from Unity's reference tables. 6.3+: `aspect-ratio`, `filter`, `-unity-material`,
`-unity-text-auto-size`. 6.6+: `backdrop-filter`, `animation-play-state`,
`-unity-animation-clip`. None of them is drawn; warnings say `Unity 6.3+`.

Value-level version differences are not judged yet (0.6.0): `linear-gradient()`,
`hsl()`, `cubic-bezier()`, `justify-content: space-evenly`, `white-space` values.

`:root` is not a version question. USS `:root` names the element a stylesheet was
applied to, not the document root as in CSS; with no UIDocument to attach to, the
preview matches it against `<ui:UXML>` and says so once, with `reason: 'matches-unity'`.

## Warning policy (0.5.1)

Every warning carries `reason` and `subject` where one applies. Read those, not
`message` — the text is for people and may change in any release.

| `reason` | Meaning | Whose problem |
|---|---|---|
| `not-uss` | Something absent from USS as of Unity's reference up to 6.6 (a CSS property, an unknown pseudo-class, `@media`) | the author |
| `invalid-value` | A USS name with a value or target that cannot work | the author |
| `not-rendered` | Valid USS/UXML this preview does not draw | the tool |
| `font-fallback` | Drawn, but Unity draws some glyphs with a fallback font, so text size may differ (Hangul, Han, Kana in the default font Inter, `subject.missingGlyphs`) | needs checking |
| `version-dependent` | The result may differ by Unity version (measured on one) | needs checking |
| `matches-unity` | Ignored, and Unity ignores it too | not a defect |

- **Both are open sets.** New values may arrive in a minor release; give them a
  `default` branch. `WarningKind` does not grow.
- Property warnings are raised **once per declaration**, with its `at`, including in
  rules that match nothing. Inherited values are never reported again.
- `subject.replacements` names the USS properties to write for 11 common CSS names.
- `subject.affectsLayout` (on a `not-rendered` property warning): whether the
  property can change a box's size or position in Unity. When `true`, the
  preview's coordinates may differ from Unity's, so a coordinate-based finding
  (zero size, overflow) is not settled. The judgement and its basis, marked when
  inferred, are the registry's `unity`, `basis` and `inferred` columns.
- `subject.applied: 'paint'`: drawn, but not laid out as Unity would
  (`letter-spacing`, `word-spacing` — left out of text measurement).
- Seven message texts shipped consumers match on are kept byte for byte
  (`tests/render/consumer-contract.test.ts`).
