# Changelog

## Unreleased

### Changed

- Relative `@import` requests are deduplicated by `(url, from)`, matching Unity's
  parent-relative loading. `project://` imports remain globally deduplicated and
  nested `<Style>` attachments now keep their Unity subtree scope.

- **`resolveImport` now receives a second argument, `from: string | null`** —
  the URL of the stylesheet containing the import being resolved, `null` for
  a `<Style src="…">` reference. Without it, a relative `@import` inside an
  imported sheet was unresolvable in principle: `a.uss` importing `"b.uss"`
  means a path relative to `a.uss`, and the host had no way to learn `a.uss`'s
  own URL at the point it resolved `b.uss`. `from` is always the exact string
  this hook received as `url` for the containing sheet, never reconstructed —
  matters most for nested imports, where it is the immediate parent, not the
  original sheet. **Non-breaking**: existing one-argument callbacks keep
  working unchanged, same as `resolveAsset`'s `form` argument in 0.3.0.
  **Known limitation, not addressed here**: a stylesheet imported by two
  different parents is only ever resolved once (`parse`'s cycle guard
  deduplicates by URL), so the hook only ever sees the first parent's `from`
  for it — changing that would mean re-fetching and re-parsing the same sheet
  per importer, which risks duplicate rules in the cascade.
- With this, `resolveImport` joins `resolveAsset` at two positional arguments.
  Per the "코어에 무언가를 더하기 전에" rule in CLAUDE.md, the next argument
  either hook would need is the point to switch to an options object instead
  of adding a third positional one.

### Fixed

- **Inline `style="…"` asset URLs reach `resolveAsset` XML-entity-decoded**,
  matching what a `<Style src>`-loaded `.uss` file's URLs already got (that
  file was never XML, so it never had entities to decode; an inline attribute
  is XML text and did). `background-image: url('…&guid=…')` written inline
  used to reach the hook as `&apos;…&amp;guid=…&apos;` — wrapper quotes and
  ampersands both literal — because `inlineDeclarations` (style/resolve.ts)
  parses straight from the raw XML source. Fixed at `assetPath()`
  (render/css-map.ts), immediately before the `url()`/`resource()` wrapper is
  parsed and right before the value leaves the model for the hook — the same
  point `<Style src>` and painted text already decode at, not at parse time
  (decoding then would corrupt the byte-exact round-trip source slices).
  Confirmed against two real URLs from the external corpus in
  `ReuHomi/vscode-uxml-preview` (`examples/external`, commit `dbda387`) where
  this caused `asset-unresolved` for 7 URLs across 2 files. Scope: only the
  asset-URL value reaching `resolveAsset`; other inline-style property values
  still carry undecoded entities in the model (unaffected here, since no
  other current consumer inspects their text — `-unity-font-definition`'s
  `resource(...)` value is only checked for presence, never read).

### Docs

- **`docs/accuracy.md`'s "which controls this covers" table now has a stated,
  computed rule** instead of being left unverified. It never added up on its
  own terms (17+1+6+5+1 = 30, not the stated 31) and the original counting
  rule was never written down, so it is now defined explicitly — classify
  `inventory` as the representative screen, then each other case by the first
  of `<ui:ScrollView`, `<ui:Button`, `<ui:Label` its UXML contains, else
  `VisualElement` only — and computed from `tests/golden/cases.ts` rather than
  hand-counted. Updated numbers: `Button` 6→10, `ScrollView` 5→4 (`VisualElement`
  only, `Label`, and the representative screen are unchanged). Mirrored into
  `docs/accuracy.en.md`, which is not machine-checked.
- **The drift guard now covers this table's five numbers too**, in
  `docs/accuracy.md` only. Same shape as the three headline figures: recomputed
  live and failing (not skipping) if it can't find a row to check. Confirmed by
  breaking a count and by removing a row's label, both on purpose.

## 0.3.0 — 2026-08-09

Four fixes the VSCode extension (`vscode-uxml-preview`) hit while consuming
this package as a dependency — not speculative additions.

### Added

- **`KNOWN_DIVERGENCES`** gives a host something to tell apart "a limit we
  know about" from "a bug". Three entries, and the kinds carry the
  distinction that matters. Font metrics move with the platform, so the
  difference cannot be reproduced here at all. Unity's rule for a wrap
  container's height is simply not specified, so there is nothing to match
  yet. And the Yoga vendored in UI Toolkit resolves a main-axis percentage
  against an indefinite parent differently from the one this package depends
  on — that one reproduces perfectly every time; it just cannot be fixed
  from inside this repository. The 1px case is deliberately absent: that is
  the golden tests' judgement parameter, not a limit of the renderer, and a
  host showing it would read as a defect.
- **`uxml-preview/unity-project`**, a Node-only subpath exporting
  `buildGuidIndex(projectRoot)`. Builds a GUID → absolute-path index from a
  Unity project's `.meta` files, for the case where an asset reference's path
  has gone stale but its GUID is still good. Skips `Library/`, `Temp/`,
  `obj/`, `.git/`, and any `.meta` file it cannot read. Kept out of the main
  entry point because it uses `node:fs` and the main entry must stay
  browser-safe.

### Changed

- **`resolveAsset` now receives a second argument, `form: 'url' | 'resource'`**,
  telling `url("...")` and `resource("...")` background-image references
  apart. They resolve differently — `url()` is a path, `resource()` is a
  Unity Resources-folder name — and a host that resolved both the same way
  before this had no way to know which one it was looking at.
  **Non-breaking**: existing `(path) => ...` implementations keep working
  unchanged: `form` is an additional argument, not a replacement one.

### Fixed

- `UxmlDocument.warnings` and `RenderResult.warnings` doc comments corrected.
  The former said it covers "malformed input" only; it also carries
  `'import-unresolved'` for an unreadable `<Style src="…">` or `@import`. The
  latter said it is distinct from the former on that same wrong premise.
  Comment-only — no behavior changed.

### Docs

- **`docs/accuracy.md`'s published figures were stale**: two comparable cases
  (`state-vs-id`, `state-vs-inline`) were merged after the doc's numbers were
  last written, and nothing caught it. Recomputed from a live run rather than
  trusted: **548 / 564 values (97.2%)**, **31 / 33 cases matching**, **33 / 33**
  Unity baseline coverage — up from the stale 532/548, 29/31, 31/31. Mirrored
  into `README.md` (both languages) and `docs/uss-vs-css.md`/`.ko.md`.
  `docs/accuracy.en.md` was updated too but is not machine-checked (see next).
- **Added a regression guard**: `tests/golden/golden.test.ts` now has
  `matches the figures published in docs/accuracy.md`, which recomputes the
  three headline numbers from the actual case set and fails if
  `docs/accuracy.md` says anything else — including failing (not skipping) if
  it cannot find a row to check, so the guard can't be silently defeated by a
  table-format change. This is the third time this specific number went stale
  publicly (`docs/accuracy.md` itself already records the first two); the doc
  fix alone would only prevent a third, not a fourth.
- Left unfixed and flagged in `docs/accuracy.md`/`accuracy.en.md`: the
  "which controls this covers" breakdown table (`Button`/`ScrollView`/etc.
  row counts) was already internally inconsistent before this change
  (17+1+6+5+1 = 30, not the stated 31) and is not machine-checked. Recomputing
  it requires a counting rule that is not written down anywhere; a guess
  risked swapping one wrong number for another, so it was left alone and
  called out inline instead.

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
- **Disabled elements render at half opacity**, as Unity draws them. The value
  came from sampling the screenshots rather than judging them: Unity paints the
  disabled button rgb(41,50,67), which is its base colour composited at exactly
  one half over the footer on all three channels.

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
