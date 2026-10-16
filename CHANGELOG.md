# Changelog

## 0.6.0 — unreleased (draft)

Diagnostics that say what Unity does instead, text measured the way Unity
measures it, fonts, and `aspect-ratio`. A minor version in 0.x because drawn
output changes (text height, `:enabled`, letter/word spacing, `aspect-ratio`)
and the published accuracy figures move. No type is removed and no
`WarningKind` is added; every new field is optional.

### Accuracy — previous and new figures

| Set | 0.5.1 | 0.6.0 | Why |
|---|---:|---:|---|
| Base coordinates (Unity 6000.0.40f1) | 660 / 676 | 660 / 676 | unchanged: the three text-measuring cases are excluded from it, and of its 16 mismatches the 9 caused by text are widths and x. `ItemDesc.height` has a fixed height and shrinks for a theme reason (Unity gives Labels `flex-shrink: 0`), so text height cannot reach it |
| Template cohort (6000.0.40f1) | 200 / 220 | 215 / 220 | text height from FaceInfo removed 14 Label heights and the `y` they pushed |
| Text cohort (new; Chromium vs Unity 6.3) | — | lines 60/60, height 52/60, width 60/60, boundary 79/80 | see `docs/accuracy.md`; none unexplained |
| 6.3 re-dump of the golden set | — | 1012 / 1012 equal to a 6000.0 dump of the same day | every golden case lays out the same on 6000.3.25f1. Against the committed 2026-08-12 baselines nine values differ, all the known `inventory` footer 1px |

### Behavior changes

- **Text height follows Unity.** `ceil(lines × size × (ascent − descent) /
  pointSize)`, from the FaceInfo Unity reports, plus paragraph spacing. The
  default (editor Inter) gives 12px → 15, 20px → 25 where 0.5.1 gave
  14.4 / 24. A multi-line block is rounded once, not per line.
- **`letter-spacing` / `word-spacing` are not CSS px.** Unity widens by
  value × font size / 100 per gap; measured and drawn that way.
  `-unity-paragraph-spacing` is measured and drawn.
- **`:enabled` applies automatically** to every element that is not disabled
  (measured on 6000.0.40f1 and 6000.3.25f1). A screen with `:enabled` rules
  draws differently.
- **`aspect-ratio` is laid out** (Unity 6.3+); it matched Unity 52/52 on the
  measured case.
- A Label's text is measured decoded (`&amp;`, `&#10;`), as it is drawn.
- **Spaces are measured the way Unity 6.3 LTS lays them out.** Under
  `normal` and `nowrap`, a run of spaces measures as one and leading spaces
  as none; `pre` and `pre-wrap` keep them. Measured at 20px
  (`tests/layout/unity/<version>/probe-editor/spaces.json`,
  `spaces-prewrap.json`). Unity 6000.0 does not collapse them; the preview
  follows 6.3. Trailing spaces are not measured; they follow CSS, which is
  what the browser paints. 0.5.1 measured every space as written.
- Painted letter spacing matches measured spacing: no spacing beside a
  space (advanced generator) and none after the last character.
- `-unity-text-generator` (`standard` / `advanced`) is measured and painted,
  and no longer raises a `not-rendered` warning with `affectsLayout`.
- A border width in an unsupported unit is reported once, not twice.
- New warnings, all `unsupported-property` with `reason: 'invalid-value'`
  unless noted: `hsl()`, `cubic-bezier()`, `opacity` in `%`, `inherit`.
  `linear-gradient()` keeps `not-uss` and says Unity shows its warning icon.
- Text drawn with the default font (no `-unity-font-definition`) that
  contains Hangul, Han or Kana warns: `unsupported-property` with the new
  reason `font-fallback` and `subject.missingGlyphs`. Inter has no such
  glyphs; Unity draws them with a fallback font, measured 1–4px taller.
- `states` keys that match nothing, contain a state pseudo-class, or list a
  state Unity never sets now warn: `unsupported-selector` with
  `subject.problem`.

### New, all optional

- `Warning.nodes` — every element a declaration's rule matched.
- `at.url` / `at.from` on USS locations — the arguments `resolveImport`
  received for that sheet, so `at.sheet` can be mapped without the expanded
  document.
- `subject.unityEffect` — `unstyled-from-here` (Unity's style updater throws:
  `hsl()` on 6000.3, `cubic-bezier()`,
  `filter` on 6000.0 — measured: the element with the value and every element after it in the panel lose their style, elements before it keep theirs; hence `unstyled-from-here`) or `file-inline-dropped` (one bad inline value drops
  every inline style in that UXML file), with the Unity versions measured.
- `subject.problem` / `subject.state` on `states-key`; `subject.role: 'font'`
  on `asset`.
- `RenderResult.document`, `.styles`, `.partStyles` — the expanded tree and
  the cascade `render()` drew with.
- `classifyVisibility(result)` — hidden / emptied / collapsed / shown, ported
  from uxml-author.
- `RenderOptions.resolveFont(path, form)` → family, or `{ family, faceInfo }`,
  or `null`. `TextContext` gains `fontFamily`, `faceInfo`, `letterSpacing`,
  `wordSpacing`, `paragraphSpacing`, `textGenerator`.
- `textHeight`, `EDITOR_DEFAULT_FACE_INFO`, `FaceInfo`.

### For consumers

- A `states-key` warning no longer always means "this key is unusable":
  read `subject.problem` (absent = unusable selector). uxml-author master
  assumes the 0.5.1 meaning.
- `aspect-ratio`, `letter-spacing`, `word-spacing` and
  `-unity-paragraph-spacing` are now laid out, so they no longer raise a
  `not-rendered` warning with `affectsLayout`. Tests that used one of them as
  the example of a layout gap need another; `-unity-text-auto-size` still is
  one. Against this build, uxml-author master fails 16 tests (states keys,
  the `aspect-ratio` layout-gap fixtures, its bundle-size note) and
  vscode-uxml-preview main fails 1 (`letter-spacing` as the layout-gap
  fixture); its typecheck is clean. All are consumer-side updates, none a
  core regression. Neither consumer picks up 0.6.0 automatically
  (uxml-author bundles its core; the extension depends on `^0.5.1`).
- **A new `reason`, `font-fallback`.** `reason` is an open set and this is the
  first value added to it. uxml-author master sends any `reason` it does not
  know to `other`, which fails the run (exit 1), so a Korean UXML with no
  font set would fail there until the skill learns it. It is not
  `not-rendered`, so it never meets the skill's exit-3 condition
  (`not-rendered` + `affectsLayout`). `docs/backlog.md` has the skill-side
  note.
- Messages changed for the inline unsupported unit and `linear-gradient()`;
  match on `reason`/`subject`, not text.

### Tools

- `pnpm test:text` runs the text cohort in a real Chromium
  (`UXML_TEXT_CHROMIUM`, `UXML_TEXT_FONTS`); it fails, never skips, when it
  cannot run. `playwright-core` is a new devDependency.

### Playground and documentation

- The playground shows each warning's `reason` as a badge and what its
  `subject` says — the Unity versions an `unityEffect` was measured on, the
  missing script, the property to write instead, whether coordinates may
  differ. New examples: Unity text height and spacing with a fallback-font
  warning, `aspect-ratio`, and values Unity cannot apply.
- README split into `README.md` and `README.ko.md`, with absolute links (npm
  shows the README without `docs/`). Its figures are checked against a live
  recomputation, as `docs/accuracy.md`'s are.
- New `docs/api.md` / `docs/api.en.md`; the warning contract moved there from
  `docs/supported.md`. The Korean and English pages of `supported`,
  `accuracy` and `uss-vs-css` now carry the same content.

## 0.5.1 — 2026-10-13

A cleanup release: nothing drawn changes except where a Unity dump said it was
wrong, and things that used to be dropped without a word are now said.

### Behavior changes

- **More warnings.** Raised where there used to be silence: undocumented property
  names, documented properties this preview does not draw, state pseudo-classes
  Unity's pseudo-class page does not list (`:selected`, `:first-child`, made-up names), `@media` and
  `@keyframes` blocks, and `display` values other than `flex`/`none`. A screen
  that passed silently in 0.5.0 may now list warnings; it is drawn the same.
- **`reason` and `subject` on `Warning`.** Both optional, both **open sets** —
  give unknown values a `default` branch. `WarningKind` does not grow and no
  field was removed. See "For consumers" below.
- **`engines.node` is `>=22`** (was `>=18`). CI and Pages already ran on 22.
- A `background-image` that is not an asset reference (`linear-gradient()`)
  is `unsupported-property` with `reason: 'not-uss'`, no longer
  `asset-unresolved`, so a host stops looking for a file that cannot exist.
- Warning text says what the renderer did; facts about Unity moved to
  `reason`/`subject`. No message points at a source file any more.
  `:root` keeps `kind: 'version-dependent'` but has `reason: 'matches-unity'`.

- **Every USS property now has one handling path.** Whether a property exists,
  inherits and is drawn is read from a registry transcribed from Unity's USS
  property reference (95/99/102 rows for 6000.0/6.3/6.6, checked 2026-10-13).
  New `unsupported-property` warnings where there used to be silence:
  - 24 documented properties this preview does not draw (`text-shadow`,
    `transition*`, `-unity-text-outline*`, `-unity-font`, `all`, ...) —
    `reason: 'not-rendered'`; properties newer than 6000.0 say so
    (`filter (Unity 6.3+)`).
  - any name Unity does not document (`font-family`, `colour`, `transform`,
    `-unity-foo`, ...) — `reason: 'not-uss'`, with the USS properties to
    write instead in `subject.replacements` for eleven common CSS names.
- **Corrected warnings.** `filter`/`backdrop-filter` are USS since 6.3/6.6
  and are reported as not drawn rather than as non-USS. `gap`, `row-gap`,
  `column-gap`, `overflow-wrap` and `word-break` are in no Unity USS reference
  table up to 6.6 and are reported as not USS rather than version-dependent.
  The reference version is Unity 6.3 LTS; Unity 6.7 (beta) adds some of these
  and is not supported in this release.
  `background-size`/`-position`/`-repeat` are in 6000.0 and no longer warn.
  `aspect-ratio` is reported as a 6.3+ property this preview does not lay out.
- **`<Bindings>` and `<ui:Columns>` are no longer laid out.** The only
  change in this release that moves anything drawn, and it moves it to where
  Unity puts it: dumps on 6000.0.40f1 and 6000.3.25f1 show neither element in
  the visual hierarchy, while the preview drew each as a zero-height box that
  shifted `space-between`/`space-around` siblings. Their two
  `unsupported-control` warnings are replaced by one notice per document
  that data bindings are not evaluated (`reason: 'not-rendered'`). A
  `<ui:Column>`'s name still counts toward `duplicate-name-in-tree`, because
  Unity gives it to the header column it builds.
- **One warning per declaration.** Property warnings are raised once where
  the declaration is written, with `at` — including in rules that match
  nothing — instead of once per element the value reached. An inherited
  value is never reported again on descendants. Value-level warnings
  (`width: 2em`, an unresolved image) also collapse to one per declaration.
  A consumer counting occurrences will count fewer.
- Inheritance now follows Unity's USS reference table. Five properties that
  Unity marks inherited and this package did not now inherit:
  `text-shadow`, `-unity-editor-text-rendering-mode`, `-unity-text-generator`,
  `-unity-material` (6.3+) and `-unity-text-auto-size` (6.3+).
  `isInherited()` returns `true` for them, and `resolveStyles()` hands them to
  descendants with an `inherited` origin. Nothing drawn changes: none of the
  five is drawn by this preview.

### Added

- `WarningReason`, `WarningSubject` types.
- `USS_STATES` (and `UssState`): the seven states Unity sets, from Unity's
  pseudo-class page — without `:root` and `:selected`.
- `TEMPLATE_DEPTH_LIMIT` (32): how deep template expansion goes, for hosts
  that prefetch template files.

### For consumers

- **Read `subject`, not the message.** The failed URL is `subject.url`, the
  asset path `subject.path` (with `form`), a refused states key `subject.key`,
  a property `subject.property`/`value`. Seven message texts consumers match
  on today are kept byte for byte in this release, but are not an API.
- **Use `reason` to separate the author's mistakes from the tool's limits.**
  `not-uss` and `invalid-value` are the author's; `not-rendered` is this
  preview's; `version-dependent` needs checking; `matches-unity` is not a
  defect. Failing a screen on every `unsupported-property` would now fail
  valid USS this preview merely does not draw.
- **A `not-rendered` warning with `subject.affectsLayout: true` means this
  preview's coordinates may differ from Unity's.** In that case, do not treat
  a coordinate-based finding (zero size, overflow) as settled. `affectsLayout`
  comes from a new registry column judging what each property can do in Unity
  (box or pixels), kept apart from what this preview does with it.
  `subject.applied: 'paint'` marks a property drawn here but not laid out as
  Unity would (`letter-spacing`, `word-spacing`: drawn, left out of text
  measurement), which now raises a `not-rendered` warning of its own.
- Replace copied constants with `USS_STATES` and `TEMPLATE_DEPTH_LIMIT`.

### Deferred to 0.6.0

`:enabled` applied automatically, `states` key warnings, the unused
`unsupported-unit` kind, and value-level checks (`hsl()`, `cubic-bezier()`,
`space-evenly`, `linear-gradient()` per Unity version, USS-only `cursor`
values). Listed in `docs/backlog.md`.

## 0.5.0 — 2026-08-26

### Known limitations

- Slots are deliberately unsupported this release. **Slots — measured alive in
  6000.0.40f1. Out of this release scope and reported with
  `template-slot-unsupported`.** Slot children are not placed in an arbitrary
  location.
- A `style` AttributeOverride is reported as `override-style-ignored` and is not
  applied, matching Unity's import behavior.
- Runtime `binding-path`, C# `makeItem`-selected `ListView`/`TreeView` item
  templates, per-instance pseudo-state control, cyclic-graph truncation,
  template editing, automatic extraction, and UI Builder reproduction remain
  outside the viewer-core scope.
- The external 14-document sample is not broad template validation: only **1
  document uses `<ui:Template>`**. Its former **31 → 0** figure counted
  diagnostic lines — 1 Template declaration + 15 Instances + 15
  AttributeOverrides — not 31 opened subtrees.
- An embedded package UXML physically present at
  `<projectRoot>/Packages/<name>/` resolves through
  `project://database/Packages/...`, as measured in Unity 6000.0.40f1. The core
  and host still do not search `Library/PackageCache`; a registry-package
  template available only there reports `package-path-not-searched`.

### Added

- **Template / Instance expansion.** `<ui:Template>` declarations are resolved
  through the existing `resolveImport(url, from)` host hook, and
  `<ui:Instance>` expands to an opaque `TemplateContainer`. Instance `name`,
  `class`, and inline `style` attach to that container; nested expansion is
  capped at 32 levels.
- `collectDependencies(source)` returns template `src` URLs in source order so a
  synchronous host can prefetch the transitive input before rendering.
- `WarningKindMap<T>` is exported so consumers can make their diagnostic
  classifier exhaustive.
- `AttributeOverrides` reaches every duplicate `element-name` target and reports
  `override-target-missing` with the requested and available names when it finds
  none. A `style` override reports `override-style-ignored` with the target name
  and value; Unity ignores it during import, so it is not applied. Template source
  provenance is kept separate from the derived render tree.
- The public `WarningKind` union grows from **8 to 17**. Consumers must update
  their warning classifiers. The nine new template diagnostics are:
  `template-src-unresolved`, `template-not-declared`, `template-cycle`,
  `template-depth-exceeded`, `override-target-missing`,
  `duplicate-name-in-tree`, `package-path-not-searched`,
  `template-slot-unsupported`, and `override-style-ignored`.

### Changed

- Template stylesheet attachments remain scoped to the generated
  `TemplateContainer` subtree. `Packages/...` is declaring-document-relative;
  an embedded package UXML physically present at
  `<projectRoot>/Packages/<name>/` resolves through the project-root-fixed
  `project://database/Packages/...` form, as measured in Unity 6000.0.40f1.
  `Library/PackageCache` is not searched, so a registry-package template
  available only there reports `package-path-not-searched`.
- Cyclic templates fail closed with the complete cycle path. The source AST is
  still round-tripped unchanged; expansion exists only in the render tree.

### Verified

- Unity 6000.0.40f1 template cohort: **200 / 220 coordinate values**, 55
  elements, and 11 rendered cases with 11/11 rendered baselines. The 20
  mismatches classify as (a) known font/text metrics 20, (b) 1px 0, and (c) new
  cause 0; axes are height 14, width 4, x 1, y 1.
- G3-11 has no layout baseline because Unity `CloneTree` overflows the stack on
  the cyclic input; the preview reports `template-cycle` and fails closed.
- This cohort is separate from the v0.4.0 base-control figure of **660 / 676**
  for 169 elements. The figures are not combined.

## 0.4.0 — 2026-08-12

### Added

- The Unity golden dumper can run from the command line, records the Unity
  revision, editor scale, accessible font settings, and timestamp beside each
  measurement, rejects `-nographics` and `-quit` up front, and exits non-zero
  unless it writes exactly one JSON file per discovered case.

### Changed

- Relative `@import` requests are deduplicated by `(url, from)`, matching Unity's
  parent-relative loading. Root-fixed imports (`project://…` or a path beginning
  with `/`) are globally deduplicated, and nested `<Style>` attachments now keep
  their Unity subtree scope. The rule comes from five Unity measurement cases,
  including the otherwise surprising split between `Packages/...` (relative)
  and `/Packages/...` (root-fixed).

- **Issue #1: `resolveImport` now receives a second argument,
  `from: string | null`** —
  the URL of the stylesheet containing the import being resolved, `null` for
  a `<Style src="…">` reference. Without it, a relative `@import` inside an
  imported sheet was unresolvable in principle: `a.uss` importing `"b.uss"`
  means a path relative to `a.uss`, and the host had no way to learn `a.uss`'s
  own URL at the point it resolved `b.uss`. `from` is always the exact string
  this hook received as `url` for the containing sheet, never reconstructed —
  matters most for nested imports, where it is the immediate parent, not the
  original sheet. **Non-breaking**: existing one-argument callbacks keep
  working unchanged, same as `resolveAsset`'s `form` argument in 0.3.0.
- With this, `resolveImport` joins `resolveAsset` at two positional arguments.
  Per the "코어에 무언가를 더하기 전에" rule in CLAUDE.md, the next argument
  either hook would need is the point to switch to an options object instead
  of adding a third positional one.

### Fixed

- **Issue #2: inline `style="…"` asset URLs reach `resolveAsset`
  XML-entity-decoded**,
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
