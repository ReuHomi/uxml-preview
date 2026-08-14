# Unity ground truth

Drop the JSON produced by `tools/UxmlLayoutDump.cs` here, one file per case,
named after the case (`border-box.json`, `default-direction.json`, ...).

**These files are committed.** They are measurements, not build output — nothing
in this repo can regenerate them, and without them `pnpm test:golden` can only
say that our own output has not changed.

Each file looks like:

```json
{
  "metadata": {
    "unityVersion": "6000.0.40f1",
    "unityRevision": "6000.0.40f1 (157d81624ddf)",
    "pixelsPerPoint": 1,
    "editorSkin": "dark",
    "editorFont": { "name": "(builtin)", "size": 0, "style": "Normal" },
    "systemFont": {
      "smoothing": "2",
      "smoothingType": "2",
      "smoothingGamma": "1200",
      "appliedDpi": "96"
    },
    "dumpedAtUtc": "2026-08-12T00:00:00.0000000Z"
  },
  "panel": { "width": 400, "height": 300 },
  "elements": {
    "outer": { "x": 0, "y": 0, "width": 200, "height": 120 },
    "inner": { "x": 30, "y": 30, "width": 140, "height": 30 }
  },
  "resources": {
    "resource-probe": {
      "hasResolvedBackground": true,
      "type": "Sprite",
      "name": "icon_0",
      "assetPath": "Assets/Resources/icon.png"
    }
  }
}
```

`metadata` and `resources` are optional so measurements created by older dumper
versions remain readable. Metadata records the environment separately from the
compared coordinates; resource probes record the resolved background object and
its real asset path because a background image does not change layout geometry.

The panel size is recorded so the web side lays the case out at exactly the
same size. A case with no file here is skipped and reported as unmeasured,
never as passing.

Steps are in `docs/accuracy.md`.
