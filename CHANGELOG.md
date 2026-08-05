# Changelog

## Unreleased

### Changed — this affects what you see on screen

- **Controls with no renderer of their own are now drawn as plain boxes**
  instead of being dropped along with everything inside them. One
  `<ui:ScrollView>` used to empty a panel. Each still reports a warning, and
  what is missing is only whatever makes that control look like itself.
- **`Button` now carries Unity's default `margin: 1px 3px`.** Existing layouts
  containing buttons will shift by a few pixels — toward Unity, not away from
  it. Unity supplies this through a theme stylesheet and this library supplied
  nothing, which is why the first `Button` ever compared missed on 18 of 48
  values. Overridable from your own USS exactly as in Unity, and the values are
  in `src/controls/theme.ts`.

### Added

- **Pseudo-class states, per element.** `render(doc, el, { states: { '#UseButton':
  ['hover'], '#DropButton': ['disabled'] } })`. Keys are ordinary USS selectors.
  States are explicit input rather than mouse events, so the same call always
  draws the same picture — a screen you can compare against Unity, or against
  yesterday. Per element rather than per document because real screens mix one
  hovered button with a disabled one.
  Unity's *own* state defaults are deliberately not included: a layout dump
  measures geometry and a hover colour is not geometry, so there is no way to
  prove them yet.
- Style provenance now records which states a rule needed (`origin.states`), so
  an editor can tell "this is the hover colour" from "this is the colour".

### Verified

Now **290 of 292 element coordinates identical** against Unity 6000.0.40f1
across 23 layout cases, up from 242 of 244 across 18. The earlier figure covered
almost entirely `VisualElement`; `Button` had never been compared at all. See
[`docs/accuracy.en.md`](docs/accuracy.en.md).

Colour, borders and corners are now held by a CSS-declaration regression
baseline (`tests/render/visual.test.ts`). It detects our own drift and is not
evidence of agreement with Unity — that comparison is a one-time eye check.

## 0.1.0 — 2026-08-03

First release. Parses Unity UI Toolkit `.uxml` and `.uss`, lays them out through
the same Yoga engine UI Toolkit uses, paints to the DOM, and writes the files
back unchanged.

### Verified

Measured against **Unity 6000.0.40f1** across 18 layout cases and 61 elements:
**242 of 244 element coordinates identical** (0.5px tolerance; the matching 17
cases agree exactly, not merely within tolerance). Procedure and per-case
figures in [`docs/accuracy.en.md`](docs/accuracy.en.md).

Round-trip is byte-exact on all 15 fixtures — comments, attribute order,
entity encodings, CRLF line endings, mixed indentation, unsupported controls.

### Supported

- Controls: `VisualElement`, `Label`, `Button`
- Selectors: type, class, `#name`, descendant, child, compound, universal,
  pseudo-classes, `@import`
- Cascade: specificity, source order, inheritance, inline styles, `var()`
  custom properties, shorthand expansion
- Layout: the flex family, sizing, box model, positioning
- Full matrix: [`docs/supported.en.md`](docs/supported.en.md)

### Known limitations

- **Only geometry was compared to Unity, and only as far as Yoga.** The figure
  is measured at the layout engine's output; the painted DOM is checked against
  it by an invariant of our own, not against Unity. Colours, borders, corner
  radii and fonts render but were never measured at all.
- **Text measurement was not compared.** Unity uses its own font asset; the
  line-height factor is an estimate.
- **`Button` has no golden case.** It renders through the `Label` path.
- One measured divergence: a percentage against a parent with no explicit size.
  `yoga-layout` 3.2.1 resolves the main axis where UI Toolkit's Yoga does not.
  Recorded in `KNOWN_DIVERGENCES` rather than smoothed over.
- `-unity-slice-*`, `-unity-background-image-tint-color` and `transition` are
  parsed and preserved but not drawn.
- Editing a single attribute regenerates that tag's other attributes, so a
  multi-line attribute list collapses onto one line.
- Changing an element's child list drops comments that sat between children.

### API

`loadLayoutEngine`, `parse`, `serialize`, `render`, `resolveStyles`,
`explainProperty`. See the README.
