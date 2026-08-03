# Changelog

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
