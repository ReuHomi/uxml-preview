/**
 * Playground examples.
 *
 * Chosen to show the traps rather than to look pretty. Someone arriving from a
 * web background will hit these in their first hour with UI Toolkit, and seeing
 * one render live is worth more than a paragraph explaining it.
 */

import { CASES, PANEL } from '../tests/golden/cases';

export interface Example {
  name: string;
  uxml: string;
  uss: string;
  panel?: { width: number; height: number };
}

/**
 * The one asset the examples reference, inlined.
 *
 * 64×16 on purpose: the three `-unity-background-scale-mode` values are
 * indistinguishable on a square image, and judging that mapping by eye is what
 * this exists for. Byte-for-byte the same file Unity imports as
 * `tests/golden/assets/icon.png`, so both sides are looking at one picture.
 */
const ICON =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAQCAIAAAAphe5+AAAAM0lEQVR4nO3P' +
  'QQ0AAAzCwOlD1zRih6nYg6RNDdykvEli6W+t/wYAAAAAAAAAAADQD6juABdmAFJnsc7KAAAAAElFTkSuQmCC';

/**
 * Purpose:      stand in for the host application's asset resolution.
 * Ensures:      returns null for anything it does not know, so the placeholder
 *               and its warning stay reachable — that path is the interesting
 *               one for everybody whose project this playground is not.
 */
export function resolveAsset(path: string): string | null {
  return path.endsWith('/icon.png') ? ICON : null;
}

/**
 * The representative screen, taken from the golden set rather than retyped.
 *
 * This is the exact document Unity measured, which is the only reason a
 * screenshot of it is worth anything: a copy that drifted by one declaration
 * would put the two pictures out of step without either side saying so. The
 * panel size matches the dump's too, so the eye check compares like with like.
 */
const inventory = CASES.find((c) => c.name === 'inventory')!;

export const EXAMPLES: Example[] = [
  {
    name: 'Representative screen (compared against Unity)',
    panel: PANEL,
    uxml: inventory.uxml,
    uss: inventory.uss,
  },
  {
    name: 'Inventory panel',
    panel: { width: 640, height: 360 },
    uxml: `<ui:UXML xmlns:ui="UnityEngine.UIElements">
  <!-- USS flex-direction defaults to column, unlike CSS. -->
  <ui:VisualElement name="root" class="panel">
    <ui:Label text="Inventory" class="title" />
    <ui:VisualElement class="row">
      <ui:Button text="Use" class="btn" />
      <ui:Button text="Drop" class="btn btn--danger" />
    </ui:VisualElement>
  </ui:VisualElement>
</ui:UXML>
`,
    uss: `.panel {
  padding: 16px;
  margin: 24px;
  background-color: rgb(40, 42, 48);
  border-radius: 6px;
  border-top-width: 1px;
  border-right-width: 1px;
  border-bottom-width: 1px;
  border-left-width: 1px;
  border-top-color: rgb(66, 70, 80);
  border-right-color: rgb(66, 70, 80);
  border-bottom-color: rgb(66, 70, 80);
  border-left-color: rgb(66, 70, 80);
}

.title {
  font-size: 18px;
  color: rgb(224, 226, 232);
  -unity-font-style: bold;
}

.row {
  flex-direction: row;   /* required: column is the default */
  margin-top: 12px;
}

.btn {
  padding: 6px 14px;
  margin-right: 8px;
  background-color: rgb(70, 74, 84);
  border-radius: 4px;
  color: rgb(224, 226, 232);
}

.btn--danger {
  background-color: rgb(140, 62, 62);
}
`,
  },

  {
    name: 'Trap: flex-direction defaults to column',
    panel: { width: 640, height: 360 },
    uxml: `<ui:UXML xmlns:ui="UnityEngine.UIElements">
  <!--
    Delete "flex-direction: row" from .toolbar below.
    In CSS the buttons would stay side by side. In USS they stack,
    because column is the default. This is the single most common
    way a ported stylesheet comes out wrong.
  -->
  <ui:VisualElement class="toolbar">
    <ui:Button text="File" class="tab" />
    <ui:Button text="Edit" class="tab" />
    <ui:Button text="View" class="tab" />
  </ui:VisualElement>
</ui:UXML>
`,
    uss: `.toolbar {
  flex-direction: row;
  padding: 8px;
  background-color: rgb(38, 40, 46);
}

.tab {
  padding: 6px 16px;
  margin-right: 4px;
  background-color: rgb(58, 62, 72);
  color: rgb(220, 222, 228);
  border-radius: 3px;
}
`,
  },

  {
    name: 'Trap: overlap has no z-index',
    panel: { width: 640, height: 360 },
    uxml: `<ui:UXML xmlns:ui="UnityEngine.UIElements">
  <!--
    USS has no z-index. Whichever element comes later in the markup
    is drawn on top. Swap these two lines to swap the stacking.
  -->
  <ui:VisualElement class="card card--back" />
  <ui:VisualElement class="card card--front" />
</ui:UXML>
`,
    uss: `.card {
  position: absolute;
  width: 200px;
  height: 140px;
  border-radius: 8px;
}

.card--back {
  left: 60px;
  top: 60px;
  background-color: rgb(196, 74, 74);
}

.card--front {
  left: 150px;
  top: 110px;
  background-color: rgb(70, 120, 200);
}
`,
  },

  {
    name: 'Design tokens with var()',
    panel: { width: 640, height: 360 },
    uxml: `<ui:UXML xmlns:ui="UnityEngine.UIElements">
  <!-- Custom properties inherit, so :root is where tokens live. -->
  <ui:VisualElement class="stack">
    <ui:Label text="Primary" class="chip chip--primary" />
    <ui:Label text="Danger" class="chip chip--danger" />
    <ui:Label text="Muted" class="chip chip--muted" />
  </ui:VisualElement>
</ui:UXML>
`,
    uss: `:root {
  --radius: 6px;
  --pad: 10px;
  --fg: rgb(240, 242, 248);
  --primary: rgb(70, 120, 200);
  --danger: rgb(196, 74, 74);
  --muted: rgb(88, 92, 102);
}

.stack {
  padding: 20px;
  align-items: flex-start;
}

.chip {
  padding: var(--pad);
  margin-bottom: 8px;
  border-radius: var(--radius);
  color: var(--fg);
  -unity-font-style: bold;
}

.chip--primary { background-color: var(--primary); }
.chip--danger  { background-color: var(--danger); }
.chip--muted   { background-color: var(--muted); }
`,
  },

  {
    name: 'Layout: flex-grow and alignment',
    panel: { width: 800, height: 450 },
    uxml: `<ui:UXML xmlns:ui="UnityEngine.UIElements">
  <ui:VisualElement class="app">
    <ui:VisualElement class="bar">
      <ui:Label text="uxml-preview" class="brand" />
      <ui:VisualElement class="grow" />
      <ui:Button text="Settings" class="ghost" />
    </ui:VisualElement>
    <ui:VisualElement class="body">
      <ui:VisualElement class="sidebar">
        <ui:Label text="Items" class="side-title" />
      </ui:VisualElement>
      <ui:VisualElement class="content">
        <ui:Label text="flex-grow: 1 takes the rest" class="hint" />
      </ui:VisualElement>
    </ui:VisualElement>
  </ui:VisualElement>
</ui:UXML>
`,
    uss: `.app {
  flex-grow: 1;
  background-color: rgb(30, 32, 37);
}

.bar {
  flex-direction: row;
  align-items: center;
  height: 44px;
  padding: 0 12px;
  background-color: rgb(38, 40, 46);
}

.brand {
  color: rgb(230, 232, 238);
  -unity-font-style: bold;
}

.grow { flex-grow: 1; }

.ghost {
  padding: 5px 12px;
  color: rgb(200, 204, 212);
  background-color: rgb(56, 60, 70);
  border-radius: 3px;
}

.body {
  flex-direction: row;
  flex-grow: 1;
}

.sidebar {
  width: 180px;
  padding: 12px;
  background-color: rgb(35, 37, 43);
}

.side-title {
  color: rgb(150, 155, 165);
}

.content {
  flex-grow: 1;
  padding: 12px;
  justify-content: center;
  align-items: center;
}

.hint {
  color: rgb(120, 168, 254);
  font-size: 16px;
}
`,
  },

  {
    name: 'Unsupported controls: warned, not lost',
    panel: { width: 640, height: 360 },
    uxml: `<ui:UXML xmlns:ui="UnityEngine.UIElements" xmlns:custom="MyGame.UI">
  <!--
    VisualElement, Label, Button, Image and ScrollView have renderers of
    their own. The custom control below does not, so it is drawn as a plain
    box -- you should see one warning for it under the preview. Note that
    its contents would still be drawn: an unfamiliar tag costs its own
    appearance and nothing below it.

    What is missing from a fallback is only what makes that control look
    like itself. Compare it with the ScrollView above, which is reproduced
    properly: one tag, but four elements, because Unity builds a viewport
    and a content container inside it. Those decide where its children
    land, which is why a scroll region cannot be faked with one box.

    Nothing is lost, either. "round-trip: exact" in the corner means saving
    this document reproduces the text above byte for byte -- this comment
    and both unsupported controls included.

    Try to make it say otherwise. Delete a closing tag, drop a quote,
    empty the whole file: it stays exact. Untouched text is copied out of
    the original rather than regenerated, so there is nothing to lose.
  -->
  <ui:VisualElement class="pad">
    <ui:Label text="Drawn" class="ok" />
    <ui:ScrollView style="width: 260px; height: 70px;">
      <ui:Label text="inside a real viewport" class="ok" />
      <ui:Label text="taller than the view, so it clips" class="ok" />
      <ui:Label text="and this one is cut off" class="ok" />
    </ui:ScrollView>
    <custom:HealthBar value="0.8" />
    <ui:Label text="Drawn" class="ok" />
  </ui:VisualElement>
</ui:UXML>
`,
    uss: `.pad {
  padding: 20px;
  align-items: flex-start;
}

.ok {
  color: rgb(120, 200, 140);
  -unity-font-style: bold;
  margin-bottom: 6px;
}
`,
  },
];
