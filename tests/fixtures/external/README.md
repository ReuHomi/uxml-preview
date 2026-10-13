# External UXML samples (test fixtures)

The 14 UXML documents from vscode-uxml-preview `examples/external/` (commit
1a570fd), with the stylesheets they reference and each source's licence file.
Copied byte for byte; images and icons are left out because no test here
resolves an asset. They are not part of the npm package.

Used by `tests/regression/warning-diff.test.ts` to check that no warning 0.5.0
raised on real-world UXML was lost. Original sources, all at pinned commits:

| Folder | Source | Licence |
|---|---|---|
| `unity-royale` | Unity-Technologies/UIToolkitUnityRoyaleRuntimeDemo@9b5006d | MIT (`LICENSE.md`) |
| `world-at-war` | SBUplakankus/world-at-war-ui-toolkit@303ead2 | MIT (`LICENSE`) |
| `ui-toolkit-demos` | ccfoo242/unity-ui-toolkit-demos@dae35f1 | MIT (`LICENSE`, Kenney `License.txt`) |
| `debug-ui` | annulusgames/DebugUI@eadce6b | MIT (`LICENSE`) |
| `design-system` | sinanata/unity-ui-toolkit-design-system@76e4bb0 | MIT (`LICENSE`) |
| `uitoolkit-helpers` | spaghettioh/UIToolkitHelpers@8fac813 | Unlicense (`UNLICENSE`) |

The full manifest, with one original URL per file, is
`examples/external/README.md` in vscode-uxml-preview.
