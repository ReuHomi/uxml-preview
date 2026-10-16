# API

*English · [한국어](api.md)*

The public API of `uxml-preview`. The type definitions (`dist/index.d.ts`) are the source; this
page records what they cannot show — call order, ownership, what the hooks receive, and how to
read a warning. What is supported is in [Supported](supported.en.md); how closely it matches is
in [Accuracy](accuracy.en.md).

## Order

```ts
import { loadLayoutEngine, parse, render, serialize } from 'uxml-preview';

await loadLayoutEngine();            // 1. once, first. Yoga is WebAssembly
const doc = parse(uxml, uss);        // 2. text → model (pure)
const view = render(doc, el, opts);  // 3. model → screen (replaces el's children)
view.dispose();                      // 4. always, before drawing again
const out = serialize(doc);          // back to text
```

- `render` is synchronous, because loading the engine was moved out of it. Calling it before
  `loadLayoutEngine()` fails (`isLayoutEngineReady()` tells you)
- **`dispose()` is the caller's responsibility.** Yoga nodes are WASM handles and are not garbage
  collected. Call it before drawing into the same container again. `liveNodeCount()` shows a leak
- Rendering needs a DOM (a browser; happy-dom or jsdom in tests). `parse` and `serialize` do not

## `parse(uxml, uss?, options?)`

Reads UXML and USS text into a model (`UxmlDocument`). It does not fail — broken input becomes a
`malformed` entry in `doc.warnings` and the rest is still read.

`options.resolveImport(url, from)` — the host returns the text of a stylesheet named by
`<Style src="…">` or `@import`, and of a document named by `<ui:Template src="…">`. Return `null`
when it cannot be found (a warning is recorded).

- `from` is the URL of the file containing the reference, exactly as this hook received it as
  `url` when that file was resolved. `null` for references in the entry UXML. A relative
  `@import` cannot be resolved without it
- An existing one-argument callback keeps working. If a third argument is ever needed, the hook
  becomes an options object and the major version goes up
- `collectDependencies(source)` returns template dependency URLs in source order, for prefetching

## `render(doc, container, options?)`

| Option | Meaning |
|---|---|
| `size` | Panel size in px. **The panel, not the window** — USS percentages and stretching resolve against the panel, so a preview that follows the window cannot answer "how does this look at 1920×1080". Defaults to the container's size |
| `resolveAsset(path, form)` | Turns a `background-image` `url("project://…")` or `resource("…")` into a URL the browser can load. `form` is `'url'` (a path) or `'resource'` (a Unity Resources name, no extension) — resolving both as the same kind of path silently produces the wrong picture. A disk-only host cannot resolve editor built-ins, so return `null` for those. On `null` a placeholder is drawn and a warning recorded |
| `resolveFont(path, form)` | The font for `-unity-font-definition`: a font family name (string), `{ family, faceInfo }`, or `null`. With `faceInfo` (the `pointSize`, `ascentLine` and `descentLine` Unity reports for that font) text height matches Unity's formula. Called once per distinct (path, form) per render |
| `measureText(text, context, availableWidth)` | Replaces text measurement. The default uses a canvas, so it moves with the platform and the installed fonts — supply your own where results must be reproducible (tests). `context` carries size, style, `whiteSpace`, font, FaceInfo, spacing and generator |
| `states` | Pseudo-class states per element, `{ '#UseButton': ['hover'] }`. Keys are USS selectors |
| `activeStates` | States switched on for every element, `new Set(['hover'])` |

The result (`RenderResult`):

| Field | Meaning |
|---|---|
| `warnings` | Everything the render could not honour (see "Warnings"). Separate from `doc.warnings`, which covers malformed input and unresolved `@import` |
| `boxes` | What Yoga computed, in panel coordinates. These are the numbers compared with Unity |
| `elements` | The painted DOM element per model node, to map a click back to the tree |
| `document` | The tree actually drawn, templates expanded |
| `styles`, `partStyles` | Computed styles of drawn elements and of control parts |
| `dispose()` | Frees the Yoga tree and removes the painted DOM |

Painted elements carry `NODE_ATTRIBUTE` (the model node id); control parts carry
`PART_ATTRIBUTE` and `PART_OWNER_ATTRIBUTE`.

## `serialize(doc)`

`{ uxml, uss }`. An unedited document is **byte-identical to the input** — comments, attribute
order, entity encodings and CRLF included. Only edited nodes are rewritten; the rest is sliced
from the original. `uss` is the stylesheet passed to `parse` only (`@import`ed files are separate).

## Warnings

Warnings are returned, never thrown. One failure does not take down the screen.

```ts
interface Warning {
  kind: WarningKind;           // 17 kinds; does not grow
  message: string;             // for people; may be reworded in any release
  reason?: WarningReason;      // why — what a consumer reads
  subject?: WarningSubject;    // about what — what a consumer reads
  at?: SourceRef;              // text location
  node?: NodeId;               // the representative element
  nodes?: NodeId[];            // every element the declaration's rule matched
  sourceDocument?: string | null;  // the document URL, for a warning from outside the entry UXML
}
```

**Read `reason` and `subject`, not `message`.** The seven messages consumers already match on are
kept byte for byte (`tests/render/consumer-contract.test.ts`), but they are not an API.

### `reason`

| `reason` | Meaning | Whose problem |
|---|---|---|
| `not-uss` | Something absent from USS as of Unity's reference up to 6.6 (a CSS property, an unknown pseudo-class, `@media`, `linear-gradient()`) | the author |
| `invalid-value` | A USS name with a value or target that cannot work (`width: wide`, `hsl()`, `cubic-bezier()`, `opacity: 50%`, `inherit`, a missing override target) | the author |
| `not-rendered` | Valid USS/UXML this preview does not draw | the tool |
| `font-fallback` | Drawn, but Unity draws some glyphs with a fallback font, so text size may differ | needs checking |
| `version-dependent` | The result may differ by Unity version | needs checking |
| `matches-unity` | Ignored, and Unity ignores it too | not a defect |

- **`reason` and `subject.kind` are open sets.** New values may arrive in a minor release
  (0.6.0's `font-fallback` is the first). Give unknown values a branch of their own — treating
  every unknown value as a failure makes one new warning fail every run
- Some warnings have no `reason`, when none applies (malformed input, a file the host could not
  supply)
- Property warnings are raised **once per declaration**, with that declaration's `at`, including
  in rules that match nothing. A value that arrived by inheritance is never reported again

### `subject`

| `subject.kind` | Fields |
|---|---|
| `property` | `property`, `value` (as written), and the optional fields below |
| `selector` | `selector`, `fragment` (the offending part) |
| `states-key` | `key`, `problem` (`matches-nothing` · `state-in-key` · `unknown-state`; absent = not a usable selector), `state` |
| `asset` | `path`, `form` (`url` · `resource`), `role` (`font` when it is one) |
| `import` | `url`, `from` — exactly the arguments the hook received, or would have |
| `control` | `type` |
| `name` | `name` (a duplicate name) |
| `at-rule` | `name` (without the `@`) |

Optional fields on `property`:

- `since` — the first Unity version whose reference lists the property (`6000.3`, …)
- `replacements` — the USS properties to write for a CSS name USS spells differently (11 names)
- `affectsLayout` — on `not-rendered` and `font-fallback`: whether this can change a box's size or
  position in Unity. When `true`, **the preview's coordinates may differ from Unity's**, so do
  not treat a coordinate-based finding (zero size, overflow) as settled. The judgement and its
  basis (measured, documented, inferred) are the registry's `unity`, `basis` and `inferred` columns
- `unityEffect` — what actually happens when Unity cannot apply the value, with the versions
  measured:
  - `unstyled-from-here` — that element and every element after it lose their style (earlier
    siblings keep theirs)
  - `file-inline-dropped` — every inline style in that UXML file is dropped
- `missingGlyphs` — on `font-fallback`: the script the default font (Inter) has no glyphs for
  (`hangul` · `han` · `kana`)
- `applied` — reserved. No registry row uses it at present

### `at`

`{ in: 'uxml', span }` or `{ in: 'uss', sheet, span, url, from }`. `span` is `start`/`end`
offsets into the original text. There is no line number — it can be counted from the offset, and a
stored one points at the wrong place after an edit. On a USS location, `url` and `from` are the
arguments `resolveImport` received for that sheet, so `sheet` can be mapped back to a file
without the expanded document.

## `classifyVisibility(result)`

For each drawn element, why it is not visible (or that it is). Ported from uxml-author's rules.

| `kind` | Meaning |
|---|---|
| `shown` | visible |
| `hidden` | `display: none` — `by` (the element it was set on), `origin` (which rule or inline style) |
| `emptied` | zero-sized, because every child is `hidden` or `emptied` |
| `collapsed` | zero-sized. `explicitZero` says whether the author wrote the zero |

Opacity and `visibility` are not part of the verdict — only whether there is a box.

## Text

- `textHeight(lines, fontSize, faceInfo, paragraphBreaks?, paragraphSpacing?)` — Unity's text height formula
- `EDITOR_DEFAULT_FACE_INFO` — the FaceInfo of the editor's default font (Inter-Regular SDF), as Unity reports it
- `createDefaultMeasureText(doc?)` — the default measurer, for wrapping in your own `measureText`

## Other exports

| Name | Meaning |
|---|---|
| `USS_STATES` | the seven states Unity puts on an element |
| `TEMPLATE_DEPTH_LIMIT` | the nested template expansion cap (32) |
| `expandTemplates(doc)` | template expansion on its own |
| `KNOWN_DIVERGENCES` | behaviours known to differ from Unity, and why (unreproducible · Unity's rule unspecified · upstream) |
| `supportedControlNames()` | controls with a renderer of their own |
| `resolveStyles`, `explainProperty` | the cascade result; every declaration that competed for one property on one element (what an editor asks before "edit the inline style, or the rule?") |
| `isInherited(property)` | whether a USS property inherits |
