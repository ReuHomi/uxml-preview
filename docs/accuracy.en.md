# Accuracy

*English · [한국어](accuracy.md)*

**The document that answers "does it actually match Unity?" with numbers.**
It is the first question anyone asks, and without an answer nobody uses this.

## Current state (measured 2026-08-05)

| | |
|---|---|
| Cases | 34 (31 comparable, 3 dependent on text measurement) |
| Unity ground truth available | **31 / 31** |
| Elements compared | 137 (548 values = elements × x/y/width/height) |
| **Cases matching** | **29 / 31** |
| **Values matching** | **532 / 548 (97.1%)** |
| Known divergences | 16 values — **and they are four different things** |

Tolerance 0.5px, kept deliberately tighter than the 1px the S1 plan allows:
loosening it would hide a real 1px error in any of the other thirty cases.

### What the 16 divergences actually are

| Kind | Values | What it means |
|---|---|---|
| **Text metrics** | **10** | **Not a layout defect.** Both engines behave identically; only the ruler differs |
| 1px, inside the plan's tolerance | 3 | Named individually rather than tolerated away |
| `yoga-layout` version difference | 2 | Judged and recorded 2026-08-02 |
| **Unresolved** | **1** | A wrapped container's height. Unity's rule is not yet identified |

The evidence for the ten: the representative screen's footer is a fixed width
holding a flexible panel beside a 96px action bar, and the boundary between them
is pushed by the labels' min-content width. **Both engines shrink that bar** —
Unity to 93, this renderer to 85 — and pinning the labels collapses our excess to
the same 3px Unity has. Same mechanism, different ruler. A browser cannot measure
Unity's font asset, which is the fact that made pixel diffing useless, showing up
in coordinates instead of colours.

> The previous figure was 242/244 (99.2%). **The ratio fell because the case set
> widened, not because accuracy did.** Then, 17 of 18 cases were `VisualElement`
> alone and no `Button` had ever been compared. Now a text-heavy working screen
> is in there and 10 of the 16 divergences are font metrics. **Move the case
> composition along with the number whenever you quote it.**

> Across six re-measurements every pre-existing case reproduced **byte for
> byte** (20, 26, 27, 30, 32, 34). The dump harness is deterministic, which is
> what lets a new number be attributed to the change rather than the environment.

### Which controls this covers — it widened on 2026-08-05

| Cases containing | Count |
|---|---|
| `VisualElement` only | 17 |
| `Label` | 1 (`inherit-vs-direct`) |
| `Button` | 6 |
| `ScrollView` | 5 |
| the representative screen | 1 — all five plus Image |

The previous figure (242/244) was 17 of 18 cases in that first row: it was, in
effect, `VisualElement` geometry, and **no `Button` had ever been compared**.
Only one case with a `Label` is comparable because the other two depend on text
measurement and are excluded. Control coverage is a different axis from value
count, and it does not widen just because the value count does.

### What this number covers, and what it does not

**The 97.1% is measured at the coordinates Yoga produces.** The pipeline has
four layers — parse, resolve styles, Yoga layout, DOM paint — and the comparison
against Unity is of the third one's output. Whether the DOM actually drawn on
screen reproduces those coordinates is **not** compared against Unity.

That last step is covered a different way rather than left open.
`tests/render/border-offset.test.ts` walks the painted tree, re-derives every
element's panel position from its CSS, and asserts it equals what Yoga produced.
It checks **our two layers against each other**, not against Unity.

The distinction earned its keep. A code review on 2026-08-03 found that
descendants of a bordered element were displaced by the border width: Yoga's
coordinates were right and the translation into CSS was wrong. The golden suite
could not see it by construction, and no render test at the time had a bordered
parent. The invariant above is what closes that gap.

Measurement environment:

| | |
|---|---|
| Unity | **6000.0.40f1** (Unity 6) |
| `yoga-layout` | 3.2.1 |
| Panel size | 400 × 300 |
| Tolerance | 0.5px |

> The Unity version decides the result, because the Yoga vendored inside UI
> Toolkit differs between versions — which is exactly what the divergence below
> is. **When re-measuring on another Unity version, add a table for it rather
> than overwriting this one.**

## Why geometry and not pixels

Unity draws text with its own font asset; a browser draws it with `sans-serif`.
Antialiasing and subpixel rendering differ too. **Even with layout that is 100%
correct, every glyph pixel differs.** A pixel diff over a case set containing any
text measures the font choice, not the layout — and then "92% accurate" is a
statement about nothing in particular.

The question worth answering is "does my layout land in the same place in
Unity", and coordinates answer it. Visual properties — colours, borders, corner
radii — are invisible to coordinates and are checked separately, by eye.

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

A case with no ground truth is **skipped, not failed.** A build must not break
for want of a file no machine here can produce, and at the same time an
unmeasured case must never read as a passing one — so the suite prints its
coverage on every run.

Each dump records its panel size and the web side lays the case out at that same
size, so there are never two numbers to keep in sync by hand.

## How a comparison is judged

- Per element: `x` / `y` / `width` / `height`
- Tolerance **0.5px** — wobble from Yoga's point rounding is not a mismatch
- Join key is the UXML `name` attribute; unnamed elements are not compared
- Cases flagged `measuresText: true` are excluded. Unity's font metrics are not
  ours, so a difference there would not be a layout error

## Assumptions this case set settled

Carried unasserted since Phases 1–4, all confirmed by this measurement.

| Assumption | Where it came from | Case | Result |
|---|---|---|---|
| `flex-shrink` defaults to 1 (Yoga's engine default is 0) | `src/render/values.ts` | `flex-grow-shrink` | **correct** |
| Specificity is a triple, pseudo-classes count as classes | `src/style/specificity.ts` | `specificity-tie` | **correct** |
| A direct match always beats an inherited value | CLAUDE.md | `inherit-vs-direct` | **correct** |
| Inline styles beat every selector | CLAUDE.md | `inline-override` | **correct** |
| Percentages do not resolve without an explicit parent size | CLAUDE.md | `percent-without-parent-size` | **correct — we were wrong** |
| Line height is `font-size * 1.2` | `src/render/measure.ts` | `text-size` | not settled (text excluded) |
| `-unity-text-align` vertical mapping | `src/render/css-map.ts` | `text-align` | not settled (text excluded) |

`flex-shrink` mattered most. Yoga's own engine default is 0, so leaving it alone
would have been wrong — and the Phase 4 decision to **write every supported
property explicitly** rather than lean on whichever defaults happened to line up
is what caught it.

## The divergence that got fixed — Unity's control defaults (2026-08-05)

The first time `Button` was ever compared, **18 of 48 values missed**, all the
same shape: 3px out horizontally, 1px vertically, compounding along a row.

The cause was not layout but a **missing input**. Unity ships a theme stylesheet
that gives controls default spacing, and this renderer shipped none. The
hypothesis was checked by computation rather than by eye: adding the single rule
`.unity-button { margin: 1px 3px }` made **all 48 values match**.

How it was fixed matters. No offset was added to any coordinate — the renderer
was given *the same stylesheet Unity has*. The first would violate CLAUDE.md's
first rule (never implement layout); the second is matching the input. The
values live in `src/controls/theme.ts`.

- Measured values only. `Label` gets nothing, and **that is a measurement**:
  the explicitly-sized `Label` in `inherit-vs-direct` sits at x=0, y=0 in Unity.
- Padding, border and font defaults are **unmeasured** and therefore absent.
  Every compared element is explicitly sized and USS is border-box, so they
  would not move the outer rectangle and the cases cannot see them.
- The selector `.unity-button` comes from Unity's documented `Button.ussClassName`
  and **was not measured at first** — the margin dumps proved the spacing, not the
  selector carrying it. The `theme-class-hook` case was written to settle that,
  and Unity answered on 2026-08-05: a `.unity-button` rule in author USS reaches a
  bare `<ui:Button>`, sizing it 120×40 in both engines. The selector is measured now.

These values are version-dependent, so a `version-dependent` warning naming the
measured Unity version is raised once per document whenever they apply.

## ScrollView — the hierarchy was observed, not assumed (2026-08-05)

A ScrollView is one tag that becomes four elements, and the three Unity adds
decide where everything inside lands:

```
ScrollView
└── #unity-content-and-vertical-scroll-container
    └── #unity-content-viewport                  <- clips
        └── #unity-content-container             <- the file's children
```

**The middle level appears in no documentation.** It was found by dumping rather
than by reading a source mirror: the dumper walks `hierarchy`, the physical
tree, and Unity names these parts, so they simply appear in the output.

Three measured rules:

- level 1 fills the ScrollView's content box, inside padding and border
- the viewport surrenders 13px to a vertical scrollbar **only when the content
  overflows**; otherwise the scroller is 0x0 and the full width is kept. Being
  conditional matters as much as the number
- the content container's height is the *content's*, not the viewport's

That last rule is the substance. The old fallback squeezed three 60px children
into a 100px box and produced 33/34/33; Unity grows the container to 180, keeps
the children at 60, and lets the viewport clip. **Child sizes were wrong, not
just positions by a few pixels.**

The scrollbar's seven internal parts are not reproduced — out of scope for a
static render — and sit in an explicit `NOT_REPRODUCED` list in
`golden.test.ts`. A `unity-` pattern would have excused
`unity-content-viewport` too, which has to match exactly.

## The one divergence — percentages against an auto-sized parent

**Unity is right and we are wrong.**

```
parent: no explicit size, child: width 50% / height 50%, panel 400 x 300

           Unity      ours
  parent    0 x 0     0 x 150
  child     0 x 0     0 x 75
```

CLAUDE.md's rule — "percentages do not resolve when the parent has no explicit
size" — holds on both axes. `yoga-layout` 3.2.1 resolves a **main-axis**
percentage even against a parent whose size is not yet definite; the Yoga
vendored in UI Toolkit does not.

### Why it was not fixed

Every attempt to configure around it failed. The trail is recorded so nobody
repeats it.

| Attempt | Result |
|---|---|
| Changing the available size given to `calculateLayout` (undefined / NaN / auto) | no change |
| Every `Errata` value (`None`, `StretchFlexBasis`, `AbsolutePercentAgainstInnerSize`, `All`, `Classic`) | no change |
| `ExperimentalFeature.WebFlexBasis` | no change |
| `useWebDefaults(true)` | axes swap (200×0), confirming this is **main vs cross axis**, not width vs height |
| `flex-basis: 0` on the parent | **produces Unity's 0×0** — but as a default it collapses every element with an explicit height to zero (`height: 40px` → `0`). A coincidence, and trading 17 passing cases for 1 |

It cannot be configured away, and correcting it by hand means intervening in
layout calculation — **which CLAUDE.md rule 1 forbids**, precisely because such
corrections drift over time.

So it is registered in `KNOWN_DIVERGENCES` in `tests/golden/golden.test.ts` as
**exactly two values**. A list rather than a widened tolerance: a tolerance hides
whatever else drifts into it, while a list has to match exactly, so the test
fails if this divergence disappears or spreads.

### What it means in practice

Putting percentage-sized children under a parent with no definite size **does not
work in Unity anyway**. Our preview is more permissive there: something invisible
in Unity may be visible in the preview. The reverse — visible in Unity, missing
in the preview — does not happen, so a UI built while trusting the preview does
not break when it reaches Unity. Specifying the parent's size is still the safer
habit.

## Case list

`pnpm golden:emit` writes `tests/golden/cases/README.md`, which lists the
question each case asks. The case definitions themselves live in
`tests/golden/cases.ts` and that file is their only source.
