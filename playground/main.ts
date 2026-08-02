/**
 * Playground entry point.
 *
 * Doubles as the public online demo from Phase 6, so keep it usable.
 */

import { loadLayoutEngine, parse, render } from '../src/index';
import type { RenderResult, Warning } from '../src/index';

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

let result: RenderResult | null = null;

function showWarnings(warnings: readonly Warning[]): void {
  warnEl.textContent = '';
  if (warnings.length === 0) return;
  for (const warning of warnings) {
    const line = document.createElement('div');
    line.textContent = `[${warning.kind}] ${warning.message}`;
    warnEl.appendChild(line);
  }
}

function update(): void {
  // Yoga nodes are WASM handles; skipping this leaks one tree per keystroke.
  result?.dispose();
  result = null;

  try {
    const doc = parse(uxmlEl.value, ussEl.value);
    result = render(doc, stageEl, {});
    showWarnings([...doc.warnings, ...result.warnings]);
  } catch (error) {
    stageEl.replaceChildren();
    showWarnings([
      { kind: 'malformed', message: error instanceof Error ? error.message : String(error) },
    ]);
  }
}

let timer: number | undefined;
function schedule(): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(update, 150);
}

uxmlEl.addEventListener('input', schedule);
ussEl.addEventListener('input', schedule);
window.addEventListener('resize', schedule);

void loadLayoutEngine().then(update);
