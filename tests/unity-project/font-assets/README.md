# Font asset fixtures (0.8.0)

Unity Text Core font assets for the pinned tests of `readFontAsset`
(`uxml-preview/unity-project`). Do not edit these files by hand: they are
Unity output, and the tests compare against them byte for byte.

- Measured on: 2026-11-11
- Unity: 6000.0.40f1 and 6000.3.25f1, each in a new empty project in a scratch folder
- Menu command: `Assets/Create/Text Core/Font Asset/SDF` (default settings)
- Type: `UnityEngine.TextCore.Text.FontAsset`
- How: `FontProbe.cs` (in this folder). `FontProbe.Create` selects the font and runs the
  menu command, then the process exits. A new batchmode process runs `FontProbe.Dump`,
  which loads the asset and logs `FontAsset.faceInfo` with `ToString("R")`.

## Layout

```
<unity-version>/<font>/
  <font> SDF.asset     the font asset, as Unity wrote it
  <font>.ttf.meta      the .meta of the source font (its guid is the expected sourceFontGuid)
  measured.json        the Unity log line and faceInfo strings (step 2.5), and the
                       m_Script / m_Version / m_SourceFontFileGUID lines and the
                       document order read from the .asset file
  LICENSE.txt|OFL.txt  the font license, copied unchanged from the official source
```

`6000.3.25f1/tmp-inter/` is a TextMeshPro font asset (`Assets/Create/TextMeshPro/Font Asset/SDF`,
package `com.unity.ugui` 2.0.0 with TMP Essential Resources, installed in the scratch project only).
It has the same `m_Version: 1.1.0` and a different `m_Script`. Only its header is pinned;
its faceInfo was not logged at runtime.

## Fonts (provenance)

The font files themselves are not in the repository. Both fonts are under the SIL Open Font
License 1.1; the license file sits beside each fixture.

| Font | Source | Release / commit | Font file | SHA-256 of the font file |
|---|---|---|---|---|
| Inter | https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip | release `v4.1` | `extras/ttf/Inter-Regular.ttf` (static) | `40d692fce188e4471e2b3cba937be967878f631ad3ebbbdcd587687c7ebe0c82` |
| Noto Sans KR | https://github.com/google/fonts/tree/b38c5c93af322c45f633e17ac440ec1e6c94d489/ofl/notosanskr | google/fonts commit `b38c5c93af322c45f633e17ac440ec1e6c94d489` | `NotoSansKR[wght].ttf` | `194018e6b2b293a7964f037b25c0249ce1418bc9ab3c971060a03aa57861e252` |

**Noto Sans KR is a variable font** (one axis, `wght` 100–900). Unity's font asset was made from
the file as is, so Unity used the font's default instance, which is `wght` 100 (Thin) in this
file. The values below are for that instance.

## Measured values

| Unity | Font | pointSize | ascentLine | descentLine | lineHeight | .asset size | Document order |
|---|---|---|---|---|---|---|---|
| 6000.0.40f1 | Inter | 90 | 87.1875 | -21.7089844 | 108.896484 | 5,736 B | MonoBehaviour, Material, Texture2D |
| 6000.3.25f1 | Inter | 90 | 87.1875 | -21.7089844 | 108.896484 | 5,787 B | Material, MonoBehaviour, Texture2D |
| 6000.0.40f1 | Noto Sans KR | 90 | 104.4 | -25.92 | 130.32 | 5,727 B | Material, Texture2D, MonoBehaviour |
| 6000.3.25f1 | Noto Sans KR | 90 | 104.4 | -25.92 | 130.32 | 5,779 B | Material, Texture2D, MonoBehaviour |
| 6000.3.25f1 | Inter (TMP) | — | — | — | — | 7,710 B | Material, Texture2D, MonoBehaviour |

The faceInfo strings are Unity's `float.ToString("R")`. The .asset file writes the same float32
with fewer digits (`-21.708984`, not `-21.7089844`); both are the same float32 value.

Every Text Core asset has `m_Script: {fileID: 19001, guid: 0000000000000000e000000000000000, type: 0}`
and `m_Version: 1.1.0`. No .asset file has a number in exponent notation.

## What differs between 6000.0.40f1 and 6000.3.25f1

Measured on these fixtures (each file is 218 lines):

- `m_EditorClassIdentifier`: empty → `UnityEngine.dll::UnityEngine.TextCore.Text.FontAsset`
- `m_IsMultiAtlasTexturesEnabled`: 0 → 1
- `m_ClearDynamicDataOnBuild`: 0 → 1
- the order of the YAML documents (see the table; it differs between files of the same version too)

Both versions write `m_CreationSettings.sourceFontFileGUID`.

## Adding a Unity version

Repeat the measurement with `FontProbe.cs` in a new project, add one folder per font, and add
one row to `KNOWN_FONT_ASSET_FORMATS` only if the fixture proves it.
