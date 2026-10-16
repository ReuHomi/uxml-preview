# uxml-preview

*English · [한국어](https://github.com/ReuHomi/uxml-preview/blob/main/README.ko.md)*

**Render Unity UI Toolkit UXML/USS in a browser, without the Unity Editor — laid
out by Yoga, the engine UI Toolkit itself uses, and measured against Unity.**

[![The playground: a screen, and under it each warning with its reason and what Unity does instead](https://raw.githubusercontent.com/ReuHomi/uxml-preview/main/docs/media/playground.png)](https://reuhomi.github.io/uxml-preview/)

### ▶ [Open the playground](https://reuhomi.github.io/uxml-preview/)

Paste your own `.uxml` and `.uss`, or open an example. Nothing is uploaded; it
all runs in the page.

[![CI](https://github.com/ReuHomi/uxml-preview/actions/workflows/ci.yml/badge.svg)](https://github.com/ReuHomi/uxml-preview/actions/workflows/ci.yml)
[![Pages](https://github.com/ReuHomi/uxml-preview/actions/workflows/pages.yml/badge.svg)](https://github.com/ReuHomi/uxml-preview/actions/workflows/pages.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](https://github.com/ReuHomi/uxml-preview/blob/main/LICENSE)

## How it is verified

- **Coordinates:** 660 / 676 element coordinate values identical to Unity 6000.0.40f1, over 40 layout cases including a complete screen. [Every difference, named →](https://github.com/ReuHomi/uxml-preview/blob/main/docs/accuracy.en.md)
- **Text:** drawn in a real browser and compared with Unity 6000.3.25f1 Label by Label — line count 60 / 60, height 52 / 60, width 60 / 60 within 1px or 1%. [The text cohort →](https://github.com/ReuHomi/uxml-preview/blob/main/docs/accuracy.en.md#text-cohort-separate-set-measured-2026-10-16)
- **Unity version:** the reference is Unity 6.3 LTS. A property is USS if Unity's official property table lists it, up to 6.6; 6.7 is not supported until it is an LTS. [What is supported →](https://github.com/ReuHomi/uxml-preview/blob/main/docs/supported.en.md)
- **What does not match is reported, not glossed over.** An unsupported control, property or value comes back as a warning that says why, and — where it was measured — what Unity does instead. [Warnings →](https://github.com/ReuHomi/uxml-preview/blob/main/docs/api.en.md#warnings)

## Three ways to use it

| If you are | Use |
|---|---|
| **Designing a screen** | The [playground](https://reuhomi.github.io/uxml-preview/) in the browser, or [UXML Preview for VS Code](https://github.com/ReuHomi/vscode-uxml-preview) beside your project files |
| **Having an AI agent write UI** | [uxml-author](https://github.com/ReuHomi/uxml-author) — a skill that writes UXML/USS, renders it with this library and checks the result before handing it over |
| **Building a tool** | This library: `npm install uxml-preview`, then the [API](https://github.com/ReuHomi/uxml-preview/blob/main/docs/api.en.md) |

## Install

```bash
npm install uxml-preview
```

Node 22 or later for tooling; rendering needs a DOM (a browser, or happy-dom /
jsdom in tests).

```ts
import { loadLayoutEngine, parse, render, serialize } from 'uxml-preview';

await loadLayoutEngine();                 // Yoga is WebAssembly: load once, up front

const doc = parse(uxmlText, ussText);     // text → model
const view = render(doc, container, {     // model → screen
  size: { width: 1280, height: 720 },     // the panel, not the window
  resolveAsset: (path, form) => myAssetUrl(path, form),  // project://… → a URL, or null
});

for (const w of view.warnings) console.log(w.reason ?? w.kind, w.message);

view.dispose();                           // Yoga nodes are not garbage collected
const { uxml, uss } = serialize(doc);     // unedited: byte-identical to the input
```

## Documentation

- [USS is not CSS](https://github.com/ReuHomi/uxml-preview/blob/main/docs/uss-vs-css.md) — the differences that make a ported stylesheet come out wrong, each with an example
- [Supported](https://github.com/ReuHomi/uxml-preview/blob/main/docs/supported.en.md) — controls, properties, states, versions, and how far each was checked
- [Accuracy](https://github.com/ReuHomi/uxml-preview/blob/main/docs/accuracy.en.md) — every number, how it was measured, every known difference
- [API](https://github.com/ReuHomi/uxml-preview/blob/main/docs/api.en.md) — `parse`, `render`, `serialize`, the hooks, warnings, `classifyVisibility`
- [Changelog](https://github.com/ReuHomi/uxml-preview/blob/main/CHANGELOG.md)
- [Visual check](https://github.com/ReuHomi/uxml-preview/blob/main/docs/visual-check.md) — the one side-by-side comparison of colour and texture with Unity (2026-08, Korean)

## Development

```bash
pnpm install
pnpm dev            # the playground
pnpm test           # everything that runs without a browser or Unity
pnpm test:text      # the text cohort, in a real Chromium (see docs/accuracy.en.md)
pnpm build
```

Reproducing the Unity side needs a Unity install; the procedure is in
[Accuracy](https://github.com/ReuHomi/uxml-preview/blob/main/docs/accuracy.en.md#producing-the-ground-truth).

## License

Apache-2.0
