# Changelog

## 0.2.0 — 2026-08-06

Five controls instead of three, a representative screen measured end to end
against Unity, and two cascade defects that a synthetic case set could not have
found.

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
- **`Button` labels are now centred**, which is what Unity does. Found by the eye
  check rather than by measurement: where a glyph sits inside a box does not move
  the box, so all 548 compared coordinates agreed while the two screenshots
  plainly did not.
- **Control defaults now lose to your USS regardless of specificity.** They are a
  lower origin, like a browser's user-agent sheet — measured, and the opposite of
  what this library previously did and documented. `Button { margin: 0 }` in your
  stylesheet now wins against the built-in `.unity-button` rule, as in Unity.
- **`enabled="false"` puts an element and its subtree into `:disabled`**, without
  anyone passing `states`. Both the state and its inheritance are measured.

### Added

- **`ScrollView`.** One tag becomes four elements in Unity, and the three it adds
  decide where everything inside lands — reproducing the box alone put every
  descendant in the wrong place and squeezed children that should have overflowed.
  The hierarchy was observed from layout dumps rather than read from a source
  mirror; the middle level, `unity-content-and-vertical-scroll-container`, appears
  in no documentation. Scrollbar width is reserved but nothing is drawn: dragging,
  wheeling and scroll position are outside a static render.
- **`Image`**, and `-unity-background-scale-mode` with its three values. The
  default is `stretch-to-fill`, confirmed by the eye check.
- **Author USS reaches control parts.** `#unity-content-container { flex-direction: row }`
  — how a real project lays out a scroll region's contents — previously reached
  nothing at all, because parts were built after the cascade had run. A selector
  naming any `unity-` element that matches nothing now warns and says why.
- **`<Style src="…">` is read**, through the same `resolveImport` hook as
  `@import`. UI Builder writes that element into a file whenever a stylesheet is
  attached, so it is the ordinary shape of a real document — and ignoring it meant
  a real project's UXML rendered unstyled with nothing said about why.

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

**532 of 548 element coordinates identical** against Unity 6000.0.40f1 across 31
layout cases, one of which is a complete inventory screen.

The ratio is lower than 0.1.0's 242/244, and the reason is worth stating: that
figure covered 18 cases of which 17 were `VisualElement` alone, and no `Button`
had ever been compared. This one includes a text-heavy working screen, and **ten
of the sixteen differences are font metrics rather than layout** — both engines
shrink the same box for the same reason, and only the ruler differs. Three more
are 1px, two are the `yoga-layout` version difference already known in 0.1.0, and
**one is genuinely unresolved**. All sixteen are named in
[`docs/accuracy.en.md`](docs/accuracy.en.md).

Colour, borders and corners are held by a CSS-declaration regression baseline
(`tests/render/visual.test.ts`), which detects our own drift and is not evidence
of agreement with Unity. That comparison is a one-time eye check, recorded with
both screenshots in [`docs/visual-check.md`](docs/visual-check.md).

### Known limitations

- **Text-driven layout will not match exactly.** A browser cannot measure Unity's
  font asset, so any box sized by its text differs. This is the same fact that
  makes screenshot diffing useless, and it is not fixable here.
- **A wrapped ScrollView's content height diverges.** Unity clamps it to the
  viewport; Yoga grows it to the content. Unity's rule is not yet identified —
  the fix that matches one case breaks another, so nothing was guessed.
- Scrollbars reserve space but are not drawn, and there is no scrolling.
- `-unity-background-scale-mode`'s two non-default values are implemented from
  Unity's documented semantics but have not been seen side by side.

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
