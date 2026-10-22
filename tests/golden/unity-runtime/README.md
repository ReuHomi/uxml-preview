# Unity ground truth, runtime theme

The 46 golden cases (44 when 0.7.0 was designed; `settings` and `settings-ko` were added in bundle G) on a real runtime panel (PanelSettings + UIDocument in Play mode,
Unity's default runtime theme), Unity 6000.3.25f1, 400x300. 6000.0.40f1 gives the same
coordinates (`tests/golden/panel-dump.test.ts`).

Generated, never edited by hand:

```
node tools/panel-to-golden.mjs tests/layout/unity/6000.3.25f1/golden-panel tests/golden/unity-runtime
```

The editor-theme set in `../unity/` stays the source of the published editor figure.
The two are reported separately and never added together.
