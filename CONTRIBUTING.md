# Contributing

Thank you for helping. This project renders Unity UI Toolkit (UXML/USS) in a browser and
claims accuracy against Unity, so the rules below are about keeping that claim true.

## Rules

- **Claim only what was measured.** The project states only what it measured against Unity.
  Pinned tests protect measured behavior. A pinned test says so in its header
  ("Pinned expectations: do not edit the expectations to match an implementation").
  If you think a pinned expectation is wrong, open an issue with your evidence instead of
  editing it.
- **Write the test first.** Then show that the test fails when you revert your change (or
  break the behavior on purpose). A test that never fails proves nothing.
- **Mark unmeasured Unity behavior as "unmeasured".** If you rely on documentation, source
  code or a guess, write "unmeasured" next to it. You do not need Unity to contribute: the
  maintainer helps with Unity measurements.
- **Do not hide a guess or an element the preview cannot draw.** Show a warning instead.
  One unsupported element must never stop the whole render.
- **USS is not CSS.** Check `docs/uss-reference.md` before you reason from CSS.
- **AI tools are welcome.** If you used them, say so in the pull request. CI must pass
  (`pnpm typecheck`, `pnpm test`, `pnpm build`).
- **License.** Contributions use the repository license (Apache-2.0). A sign-off
  (`git commit -s`) is recommended. It is not mandatory.

## Where a change belongs

This package (the core) has several consumers: the VS Code extension
([vscode-uxml-preview](https://github.com/ReuHomi/vscode-uxml-preview)), a CLI and the agent
skill ([uxml-author](https://github.com/ReuHomi/uxml-author)). The **core** holds what every
consumer needs and what must have one answer: parsing and round trips, styles, layout,
painting, Unity measurements, warnings, and pure readers of Unity files such as
`readFontAsset`. The **extension** holds editor work: files, watching, the webview, settings,
and finding assets in a project. The **skill** holds authoring work: prompts, checks for
generated UI, and its own reports. If only one consumer needs something, it goes in that
consumer. If a consumer can work around a missing core feature cheaply, it is not yet core work.

## Good first task: the font asset reader (0.8.0)

`readFontAsset` in `src/unity-project/index.ts` is a stub. The contract, fixtures and pinned
tests are ready: see "Font asset reader (0.8.0)" in `docs/backlog.md`.
