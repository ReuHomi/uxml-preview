# Support matrix

*English · [한국어](supported.md)*

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

| Type | v0.1 | Notes |
|---|---|---|
| `VisualElement` | verified | most golden cases are built from it |
| `Label` | written | layout verified; **text measurement was never compared to Unity** |
| `Button` | verified | five golden cases compared against Unity. Carries Unity's **default `margin: 1px 3px`** (`src/controls/theme.ts`); honours `:hover` and the other states |
| `ScrollView` | fallback | no implicit child hierarchy, so coordinates differ from Unity (S1 Step 5) |
| `TextField` | fallback | its `text` / `label` is not drawn |
| `Toggle` | fallback | as above |
| `Slider` / `SliderInt` | fallback | as above |
| `Foldout` | fallback | as above |
| `DropdownField` | fallback | as above |
| `ListView` | fallback | undecided |
| `Image` | fallback | `background-image` already works; a dedicated renderer is S1 Step 4 |

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
| `-unity-slice-*` | A | **not implemented** | warning only |
| `-unity-background-image-tint-color` | A | **not implemented** | no CSS equivalent; warning only |
| `-unity-text-outline-*` | B | not implemented | |
| translate / scale / rotate | A | written | |
| transition | A | not implemented | kept whole rather than expanded |
| background-image | A | written | needs the asset resolver; draws a placeholder on failure |
| `var()` custom properties | A | written | covered by cascade tests, not compared to Unity |

## Not supported (C)

`display: block/inline/inline-block`, `display: grid`, `position: fixed/sticky`,
`float`, `clear`, `z-index`, `box-shadow`, `filter`, `backdrop-filter`,
`mix-blend-mode`, `clip-path`, `mask`, `outline`, `line-height`,
`text-transform`, `text-decoration`, multiple backgrounds, `transform: skew()`,
3D transforms, `@keyframes`

Units: `em`, `rem`, `vh`, `vw`, `vmin`, `vmax`, `pt`, `cm`, `in`, `calc()`

Selectors: siblings (`+`, `~`), `:nth-child`, `:first/last-child`, `:not()`,
`:has()`, attribute selectors, `::before`/`::after`, `@media`

> A rule containing any unsupported selector fragment is dropped **whole**, with
> one warning naming the fragment. The parser still stores it, so the rule
> round-trips intact.

## Pseudo-class states

`:hover`, `:active`, `:focus`, `:disabled`, `:checked`, `:selected` and
`:inactive` are honoured as **styling**. States are explicit input rather than
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

## Version-dependent (needs checking)

`gap`, `aspect-ratio`, `linear-gradient()`, `hsl()`, `cubic-bezier()`,
`justify-content: space-evenly`, `background-size`/`position`/`repeat`,
`white-space` values, `overflow-wrap`/`word-break`

`:root` is also version-dependent. USS `:root` names the element a stylesheet was
applied to, not the document root as in CSS; with no UIDocument to attach to, the
preview matches it against `<ui:UXML>` and warns each time.
