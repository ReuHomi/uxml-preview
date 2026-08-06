# USS is not CSS

*English · [한국어](uss-vs-css.ko.md)*

Unity UI Toolkit styles look like CSS. They are not CSS, and the differences are
not the ones you would guess. A stylesheet ported by hand usually *almost*
works, which is worse than failing outright — you spend an afternoon looking for
a typo that is not there.

This page lists what actually differs, in the order it tends to bite. Every
example links to a browser playground where you can change it and watch the
result, so nothing here has to be taken on faith.

---

## The five that break first

### 1. `flex-direction` defaults to `column`

CSS says `row`. USS says `column`. Nothing warns you.

```css
/* CSS: buttons sit side by side */
.toolbar { display: flex; }

/* USS: the same markup stacks them vertically */
.toolbar { flex-direction: row; }  /* you must say this */
```

Every container you did not give an explicit direction is rotated ninety
degrees from what your CSS did. It is the single most common reason a ported
layout comes out wrong, and because each container is individually plausible,
the mistake hides in plain sight.

**[Try it][try-direction]** — delete the `flex-direction` line and watch the row
become a column.

![Deleting flex-direction: row makes the buttons stack](https://raw.githubusercontent.com/ReuHomi/uxml-preview/main/docs/media/demo-flex-direction.gif)

### 2. There is no `z-index`

Overlap is decided by document order. A later sibling draws on top of an earlier
one, and no property overrides that.

```css
/* CSS */
.modal { z-index: 100; }

/* USS: move the element later in the UXML instead */
```

Anything built on stacking contexts — a dropdown that must escape its parent, a
tooltip layered above a scrolling list — needs its markup reordered, not its
stylesheet edited.

**[Try it][try-zindex]** — swap the two lines in the UXML and the cards swap.

### 3. Everything is `border-box`, always

`width` includes padding and border. There is no `box-sizing` to set, and no way
to opt out.

```css
/* CSS, default content-box: total width 236px */
.card { width: 200px; padding: 10px; border: 8px solid; }

/* USS: total width 200px. The content box shrinks to 164px. */
```

If your CSS relied on `content-box` anywhere, every one of those boxes is now
smaller than you meant.

**[Try it][try-borderbox]**

### 4. There are no bare text nodes

`<div>Hello</div>` has no equivalent. All text is the `text` attribute of a
`Label`.

```html
<!-- HTML -->
<div class="title">Inventory</div>

<!-- UXML -->
<ui:Label class="title" text="Inventory" />
```

Text written between tags is not an error. It simply does not appear, which
makes it a slow thing to notice in a large file.

**[Try it][try-baretext]** — the first row is empty, the second is not.

### 5. Margins do not collapse

Adjacent vertical margins add up instead of merging.

```css
/* CSS: 20px and 30px collapse to a 30px gap */
/* USS: the gap is 50px */
```

Vertical rhythm tuned against collapsing margins comes out roughly one and a
half times too loose.

**[Try it][try-margin]**

---

## Properties with different names

The behaviour exists; the name does not. Searching for the CSS name finds
nothing, which reads as "unsupported" when it is not.

| CSS | USS |
|---|---|
| `font-family` | `-unity-font-definition` (a font asset, not a web font) |
| `font-weight` / `font-style` | `-unity-font-style`: `normal`, `bold`, `italic`, `bold-and-italic` |
| `text-align` | `-unity-text-align`, which sets both axes at once: `upper-left`, `middle-center`, `lower-right`, … |
| `text-shadow` | `-unity-text-outline-*` — an outline, so not the same effect |
| `border-image` (9-slice) | `-unity-slice-left` / `-right` / `-top` / `-bottom` |
| `transform: translate() / scale() / rotate()` | separate `translate`, `scale`, `rotate` properties |
| *(no equivalent)* | `-unity-background-image-tint-color` — genuinely useful, tints a background image |

`-unity-font-style` has four values and no numeric weights. There is no
`font-weight: 600`.

## Properties that do not exist

Not renamed — absent. Writing them does nothing.

`box-shadow` · `filter` · `backdrop-filter` · `mix-blend-mode` · `clip-path` ·
`mask` · `outline` · `line-height` · `text-transform` · `text-decoration` ·
`float` · `clear` · `z-index` · multiple backgrounds · `transform: skew()` ·
3D transforms

`display` only takes `flex` and `none`. There is no `block`, no `inline`, and
**no `grid`** — grid layouts have to be rebuilt as nested flex containers.

`overflow: auto` and `scroll` are not properties you set. Scrolling is a
different element, `ScrollView`, so a scrolling region is a markup change.

`border-style` is solid only. No dashed or dotted borders.

## Selectors

Supported: type (`Button`), class (`.foo`), name (`#foo`), descendant, child
(`>`), compound (`.a.b`), universal (`*`), and `@import`.

Pseudo-classes: `:hover`, `:active`, `:focus`, `:disabled`, `:checked`,
`:selected`, `:inactive`, `:root`.

Not supported: **sibling combinators** (`+`, `~`), `:nth-child`,
`:first-child` / `:last-child`, `:not()`, `:has()`, attribute selectors,
`::before` / `::after`, and `@media`.

Three consequences worth naming:

- **A type selector is a C# class name**, not a tag: `Label`, `Button`,
  `VisualElement`. It is case-sensitive, so `label` matches nothing.
- **`#foo` matches the UXML `name` attribute**, not an HTML id.
- **No sibling combinators means no CSS-only interactive patterns.** Accordions,
  tabs and toggles built on the checkbox hack do not port at all; they become
  a class toggled from C#. Sequential reveals written with
  `:nth-child(n) { transition-delay: … }` need a class per item.

`:root` also differs from CSS: it names the element the stylesheet was applied
to, not the document root, and does not match that element's children.

## Units

Supported: `px`, `%`, `deg`, `s`, `ms`, `auto`, `initial`, colours (`#hex`,
`rgb()`, `rgba()`, keywords), and custom properties with `var()`.

Not supported: `em`, `rem`, `vh`, `vw`, `vmin`, `vmax`, `pt`, `cm`, `in`, and
**`calc()`**. Anything computed has to be resolved to a fixed value, or computed
in C#.

Custom properties do work, and they inherit, so a design-token setup ports
almost unchanged:

```css
:root { --accent: rgb(110, 168, 254); }
.button { background-color: var(--accent); }
```

One trap: a percentage against a parent with no explicit size does not resolve.
It is not an error; the element is simply zero-sized.

## Animation

**There are no `@keyframes`. Transitions only.**

That single sentence decides most of it: *state A to state B* works, *moving on
its own forever* does not.

| Pattern | Ports? |
|---|---|
| `transition` on `:hover` / `:active` / `:focus` | yes, unchanged |
| `transition` driven by toggling a class | yes — the best pattern to target |
| `transition-delay` for staggered reveals | needs a class per item, since `:nth-child` is gone |
| `@keyframes` + `animation` | no |
| Infinite loops: spinners, pulses, shakes | no — C# or an animation asset |
| `steps()` sprite frames | no |
| Scroll-linked animation | no |

Two traps inside transitions themselves:

- **A transition from `auto` does not run.** Give the starting value a unit —
  `0px`, not `auto`.
- **`translate` starts at `0px`, so transitioning it to a `%` fails.** Match the
  units on both ends.

And a performance note that also applies to CSS but bites harder here:
transitioning `width`, `height`, `left`, `top` or `margin` re-runs layout every
frame. Move things with `translate`, `scale`, `rotate` and `opacity`.

## Images

`background-image` takes a Unity asset reference, not a web URL:

```css
background-image: url("project://database/Assets/UI/panel.png");
/* or */
background-image: resource("panel");
```

There is no way to point at an `https://` image. Assets have to exist in the
project.

## What was actually measured

The claims above are not from reading documentation. This repository lays out a
set of cases twice — once in Unity, once in the browser through the same Yoga
engine UI Toolkit uses — and compares every element's position and size.

Against **Unity 6000.0.40f1**: **532 of 548 coordinates identical**, across 31
cases and 137 elements. Of the sixteen that differ, ten are font metrics rather
than a layout defect — both engines shrink the same box the same way and only
the ruler differs — three are within 1px, two are a known `yoga-layout` version
difference, and one is unresolved. All sixteen, and the failed attempts to
reconcile the unresolved one, are written down in
[`accuracy.en.md`](accuracy.en.md).

Geometry rather than screenshots, deliberately: Unity draws text with its own
font asset and a browser does not, so a pixel comparison over anything
containing text measures the font rather than the layout.

## Trying your own file

The [playground](https://reuhomi.github.io/uxml-preview/) takes a `.uxml` and a
`.uss` and renders them. Nothing is uploaded; it runs in the page. The corner
reads `round-trip: exact` when serializing your document back out reproduces it
byte for byte, comments and unsupported controls included.

It is also a library, if you want a preview inside your own tooling:

```bash
npm install uxml-preview
```

Source, API and the full support matrix — including what has not been measured
against Unity — are at
[github.com/ReuHomi/uxml-preview](https://github.com/ReuHomi/uxml-preview).

[try-direction]: https://reuhomi.github.io/uxml-preview/#eyJ1eG1sIjoiPHVpOlVYTUwgeG1sbnM6dWk9XCJVbml0eUVuZ2luZS5VSUVsZW1lbnRzXCI-XG4gIDx1aTpWaXN1YWxFbGVtZW50IGNsYXNzPVwiYmFyXCI-XG4gICAgPHVpOkJ1dHRvbiB0ZXh0PVwiRmlsZVwiIGNsYXNzPVwidGFiXCIgLz5cbiAgICA8dWk6QnV0dG9uIHRleHQ9XCJFZGl0XCIgY2xhc3M9XCJ0YWJcIiAvPlxuICAgIDx1aTpCdXR0b24gdGV4dD1cIlZpZXdcIiBjbGFzcz1cInRhYlwiIC8-XG4gIDwvdWk6VmlzdWFsRWxlbWVudD5cbjwvdWk6VVhNTD5cbiIsInVzcyI6Ii8qIERlbGV0ZSB0aGUgZmxleC1kaXJlY3Rpb24gbGluZS4gSW4gQ1NTIHRoZSBidXR0b25zIHN0YXkgaW4gYSByb3cuXG4gICBJbiBVU1MgdGhleSBzdGFjaywgYmVjYXVzZSBjb2x1bW4gaXMgdGhlIGRlZmF1bHQuICovXG4uYmFyIHtcbiAgZmxleC1kaXJlY3Rpb246IHJvdztcbiAgcGFkZGluZzogMTBweDtcbiAgYmFja2dyb3VuZC1jb2xvcjogcmdiKDM4LCA0MCwgNDYpO1xufVxuXG4udGFiIHtcbiAgcGFkZGluZzogNnB4IDE2cHg7XG4gIG1hcmdpbi1yaWdodDogNHB4O1xuICBiYWNrZ3JvdW5kLWNvbG9yOiByZ2IoNTgsIDYyLCA3Mik7XG4gIGNvbG9yOiByZ2IoMjIwLCAyMjIsIDIyOCk7XG4gIGJvcmRlci1yYWRpdXM6IDNweDtcbn1cbiIsInciOjY0MCwiaCI6MzYwfQ
[try-zindex]: https://reuhomi.github.io/uxml-preview/#eyJ1eG1sIjoiPHVpOlVYTUwgeG1sbnM6dWk9XCJVbml0eUVuZ2luZS5VSUVsZW1lbnRzXCI-XG4gIDwhLS0gU3dhcCB0aGVzZSB0d28gbGluZXMgdG8gc3dhcCB3aGljaCBjYXJkIGlzIG9uIHRvcC4gLS0-XG4gIDx1aTpWaXN1YWxFbGVtZW50IG5hbWU9XCJyZWRcIiAvPlxuICA8dWk6VmlzdWFsRWxlbWVudCBuYW1lPVwiYmx1ZVwiIC8-XG48L3VpOlVYTUw-XG4iLCJ1c3MiOiIvKiBVU1MgaGFzIG5vIHotaW5kZXguIE1hcmt1cCBvcmRlciBkZWNpZGVzIG92ZXJsYXA6IGxhdGVyIGlzIG9uIHRvcC4gKi9cbiNyZWQsICNibHVlIHtcbiAgcG9zaXRpb246IGFic29sdXRlO1xuICB3aWR0aDogMTgwcHg7XG4gIGhlaWdodDogMTIwcHg7XG4gIGJvcmRlci1yYWRpdXM6IDhweDtcbn1cblxuI3JlZCB7XG4gIGxlZnQ6IDYwcHg7XG4gIHRvcDogNjBweDtcbiAgYmFja2dyb3VuZC1jb2xvcjogcmdiKDE5NiwgNzQsIDc0KTtcbn1cblxuI2JsdWUge1xuICBsZWZ0OiAxNDBweDtcbiAgdG9wOiAxMTBweDtcbiAgYmFja2dyb3VuZC1jb2xvcjogcmdiKDcwLCAxMjAsIDIwMCk7XG59XG4iLCJ3Ijo2NDAsImgiOjM2MH0
[try-borderbox]: https://reuhomi.github.io/uxml-preview/#eyJ1eG1sIjoiPHVpOlVYTUwgeG1sbnM6dWk9XCJVbml0eUVuZ2luZS5VSUVsZW1lbnRzXCI-XG4gIDx1aTpWaXN1YWxFbGVtZW50IG5hbWU9XCJib3hcIj5cbiAgICA8dWk6TGFiZWwgdGV4dD1cImNvbnRlbnRcIiAvPlxuICA8L3VpOlZpc3VhbEVsZW1lbnQ-XG48L3VpOlVYTUw-XG4iLCJ1c3MiOiIvKiB3aWR0aCBpcyAyMDBweCBpbmNsdWRpbmcgcGFkZGluZyBhbmQgYm9yZGVyLCBub3Qgb24gdG9wIG9mIHRoZW0uXG4gICBVU1MgYmVoYXZlcyB0aGlzIHdheSB3aXRoIG9yIHdpdGhvdXQgYSBib3gtc2l6aW5nIGRlY2xhcmF0aW9uLiAqL1xuI2JveCB7XG4gIHdpZHRoOiAyMDBweDtcbiAgaGVpZ2h0OiAxMjBweDtcbiAgcGFkZGluZzogMjBweDtcbiAgYm9yZGVyLXRvcC13aWR0aDogOHB4O1xuICBib3JkZXItcmlnaHQtd2lkdGg6IDhweDtcbiAgYm9yZGVyLWJvdHRvbS13aWR0aDogOHB4O1xuICBib3JkZXItbGVmdC13aWR0aDogOHB4O1xuICBib3JkZXItdG9wLWNvbG9yOiByZ2IoMTEwLCAxNjgsIDI1NCk7XG4gIGJvcmRlci1yaWdodC1jb2xvcjogcmdiKDExMCwgMTY4LCAyNTQpO1xuICBib3JkZXItYm90dG9tLWNvbG9yOiByZ2IoMTEwLCAxNjgsIDI1NCk7XG4gIGJvcmRlci1sZWZ0LWNvbG9yOiByZ2IoMTEwLCAxNjgsIDI1NCk7XG4gIGJhY2tncm91bmQtY29sb3I6IHJnYig0OCwgNTIsIDYwKTtcbn1cblxuTGFiZWwge1xuICBjb2xvcjogcmdiKDIyNCwgMjI2LCAyMzIpO1xufVxuIiwidyI6NjQwLCJoIjozNjB9
[try-baretext]: https://reuhomi.github.io/uxml-preview/#eyJ1eG1sIjoiPHVpOlVYTUwgeG1sbnM6dWk9XCJVbml0eUVuZ2luZS5VSUVsZW1lbnRzXCI-XG4gIDwhLS0gVGhlIGZpcnN0IGxpbmUgcmVuZGVycyBub3RoaW5nOiBVWE1MIGhhcyBubyBiYXJlIHRleHQgbm9kZXMuXG4gICAgICAgRXZlcnkgc3RyaW5nIGJlbG9uZ3MgdG8gYSBMYWJlbCdzIHRleHQgYXR0cmlidXRlLiAtLT5cbiAgPHVpOlZpc3VhbEVsZW1lbnQgY2xhc3M9XCJyb3dcIj5IZWxsbzwvdWk6VmlzdWFsRWxlbWVudD5cbiAgPHVpOlZpc3VhbEVsZW1lbnQgY2xhc3M9XCJyb3dcIj5cbiAgICA8dWk6TGFiZWwgdGV4dD1cIkhlbGxvXCIgLz5cbiAgPC91aTpWaXN1YWxFbGVtZW50PlxuPC91aTpVWE1MPlxuIiwidXNzIjoiLnJvdyB7XG4gIGhlaWdodDogNDBweDtcbiAgbWFyZ2luLWJvdHRvbTogOHB4O1xuICBwYWRkaW5nOiA4cHg7XG4gIGJhY2tncm91bmQtY29sb3I6IHJnYig0OCwgNTIsIDYwKTtcbn1cblxuTGFiZWwge1xuICBjb2xvcjogcmdiKDIyNCwgMjI2LCAyMzIpO1xufVxuIiwidyI6NjQwLCJoIjozNjB9
[try-margin]: https://reuhomi.github.io/uxml-preview/#eyJ1eG1sIjoiPHVpOlVYTUwgeG1sbnM6dWk9XCJVbml0eUVuZ2luZS5VSUVsZW1lbnRzXCI-XG4gIDx1aTpWaXN1YWxFbGVtZW50IG5hbWU9XCJ0b3BcIiAvPlxuICA8dWk6VmlzdWFsRWxlbWVudCBuYW1lPVwiYm90dG9tXCIgLz5cbjwvdWk6VVhNTD5cbiIsInVzcyI6Ii8qIENTUyB3b3VsZCBjb2xsYXBzZSAyMHB4IGFuZCAzMHB4IGludG8gb25lIDMwcHggZ2FwLlxuICAgVVNTIGFkZHMgdGhlbTogdGhlIGdhcCBpcyA1MHB4LiAqL1xuI3RvcCB7XG4gIGhlaWdodDogNjBweDtcbiAgbWFyZ2luLWJvdHRvbTogMjBweDtcbiAgYmFja2dyb3VuZC1jb2xvcjogcmdiKDE5NiwgNzQsIDc0KTtcbn1cblxuI2JvdHRvbSB7XG4gIGhlaWdodDogNjBweDtcbiAgbWFyZ2luLXRvcDogMzBweDtcbiAgYmFja2dyb3VuZC1jb2xvcjogcmdiKDcwLCAxMjAsIDIwMCk7XG59XG4iLCJ3Ijo2NDAsImgiOjM2MH0
