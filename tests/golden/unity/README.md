# Unity ground truth

Drop the JSON produced by `tools/UxmlLayoutDump.cs` here, one file per case,
named after the case (`border-box.json`, `default-direction.json`, ...).

**These files are committed.** They are measurements, not build output — nothing
in this repo can regenerate them, and without them `pnpm test:golden` can only
say that our own output has not changed.

Each file looks like:

```json
{
  "panel": { "width": 400, "height": 300 },
  "elements": {
    "outer": { "x": 0, "y": 0, "width": 200, "height": 120 },
    "inner": { "x": 30, "y": 30, "width": 140, "height": 30 }
  }
}
```

The panel size is recorded so the web side lays the case out at exactly the
same size. A case with no file here is skipped and reported as unmeasured,
never as passing.

Steps are in `docs/accuracy.md`.
