/**
 * Playground entry point.
 *
 * Phase 0: wires up the editors and echoes input. The render call is stubbed
 * until Phase 4 (see docs/ROADMAP.md).
 *
 * This page doubles as the public online demo in Phase 6, so keep it usable.
 */

const SAMPLE_UXML = `<ui:UXML xmlns:ui="UnityEngine.UIElements">
  <!-- Reminder: USS flex-direction defaults to column, unlike CSS. -->
  <ui:VisualElement name="root" class="panel">
    <ui:Label text="Inventory" class="title" />
    <ui:VisualElement class="row">
      <ui:Button text="Use" class="btn" />
      <ui:Button text="Drop" class="btn btn--danger" />
    </ui:VisualElement>
  </ui:VisualElement>
</ui:UXML>
`;

const SAMPLE_USS = `.panel {
  padding: 16px;
  background-color: rgb(40, 42, 48);
  border-radius: 6px;
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

.btn:hover {
  background-color: rgb(88, 93, 105);
}

.btn--danger {
  background-color: rgb(140, 62, 62);
}
`;

const uxmlEl = document.getElementById('uxml') as HTMLTextAreaElement;
const ussEl = document.getElementById('uss') as HTMLTextAreaElement;
const stageEl = document.getElementById('stage') as HTMLElement;
const warnEl = document.getElementById('warnings') as HTMLElement;

uxmlEl.value = SAMPLE_UXML;
ussEl.value = SAMPLE_USS;

function update(): void {
  warnEl.textContent = '';

  // Phase 4:
  //   const doc = parse(uxmlEl.value, ussEl.value);
  //   result?.dispose();
  //   result = render(doc, stageEl, { resolveAsset });
  //   showWarnings(doc.warnings);
  void stageEl;
}

let timer: number | undefined;
function schedule(): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(update, 150);
}

uxmlEl.addEventListener('input', schedule);
ussEl.addEventListener('input', schedule);
update();
