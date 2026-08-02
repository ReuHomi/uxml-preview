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
stays `written` no matter how finished the code looks. See
[`accuracy.en.md`](accuracy.en.md).

## Controls

| Type | v0.1 | Notes |
|---|---|---|
| `VisualElement` | verified | most golden cases are built from it |
| `Label` | written | layout verified; **text measurement was never compared to Unity** |
| `Button` | written | **no golden case at all.** Renders through the same path as `Label`; `:hover` is Phase 7 |
| `ScrollView` | — | Phase 7 |
| `TextField` | — | Phase 7 |
| `Toggle` | — | Phase 7 |
| `Slider` / `SliderInt` | — | Phase 7 |
| `Foldout` | — | Phase 7 |
| `DropdownField` | — | Phase 7 |
| `ListView` | — | undecided |
| `Image` | — | Phase 7 |

> Parsing succeeds for unsupported controls. They stay in the tree marked
> unsupported, are excluded from rendering, and are reported as warnings.
> **They survive a round trip unchanged** — the playground's `round-trip: exact`
> indicator is that guarantee checked live.

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

## Version-dependent (needs checking)

`gap`, `aspect-ratio`, `linear-gradient()`, `hsl()`, `cubic-bezier()`,
`justify-content: space-evenly`, `background-size`/`position`/`repeat`,
`white-space` values, `overflow-wrap`/`word-break`

`:root` is also version-dependent. USS `:root` names the element a stylesheet was
applied to, not the document root as in CSS; with no UIDocument to attach to, the
preview matches it against `<ui:UXML>` and warns each time.
