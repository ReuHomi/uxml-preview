/**
 * Playground entry point.
 *
 * Doubles as the public online demo, so keep it usable.
 *
 * The panel size is deliberately independent of the window. USS percentages and
 * stretching resolve against the panel, so a preview that silently resizes with
 * the browser cannot answer "how does this look at 1920x1080" — which is most of
 * what anyone wants a preview for. The panel is laid out at its true size and
 * only scaled for display.
 */

import { loadLayoutEngine, parse, render, serialize } from '../src/index';
import type { RenderResult, Warning } from '../src/index';
import { EXAMPLES } from './examples';

const uxmlEl = document.getElementById('uxml') as HTMLTextAreaElement;
const ussEl = document.getElementById('uss') as HTMLTextAreaElement;
const panelEl = document.getElementById('panel') as HTMLElement;
const scalerEl = document.getElementById('scaler') as HTMLElement;
const viewportEl = document.getElementById('viewport') as HTMLElement;
const warnEl = document.getElementById('warnings') as HTMLElement;
const metaEl = document.getElementById('meta') as HTMLElement;
const presetEl = document.getElementById('preset') as HTMLSelectElement;
const sizePresetEl = document.getElementById('size-preset') as HTMLSelectElement;
const widthEl = document.getElementById('panel-w') as HTMLInputElement;
const heightEl = document.getElementById('panel-h') as HTMLInputElement;
const zoomEl = document.getElementById('zoom') as HTMLSelectElement;
const swapEl = document.getElementById('swap') as HTMLButtonElement;
const shareEl = document.getElementById('share') as HTMLButtonElement;

/** Common Unity target resolutions, plus something small for quick tests. */
const SIZE_PRESETS: Array<{ label: string; width: number; height: number }> = [
  { label: '1920 x 1080', width: 1920, height: 1080 },
  { label: '1280 x 720', width: 1280, height: 720 },
  { label: '1024 x 768', width: 1024, height: 768 },
  { label: '800 x 600', width: 800, height: 600 },
  { label: '640 x 360', width: 640, height: 360 },
  { label: '400 x 300 (golden cases)', width: 400, height: 300 },
  { label: '390 x 844 (phone)', width: 390, height: 844 },
];

let panel = { width: 1280, height: 720 };
let result: RenderResult | null = null;

// --- sharing ----------------------------------------------------------------

interface SharedState {
  uxml: string;
  uss: string;
  w: number;
  h: number;
}

/**
 * base64 over UTF-8 bytes, not `btoa` directly: `btoa` throws on anything
 * outside Latin-1, and the examples contain Korean comments.
 */
function encodeState(state: SharedState): string {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeState(text: string): SharedState | null {
  try {
    const padded = text.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<SharedState>;
    if (typeof parsed.uxml !== 'string' || typeof parsed.uss !== 'string') return null;
    return {
      uxml: parsed.uxml,
      uss: parsed.uss,
      w: Number(parsed.w) || 1280,
      h: Number(parsed.h) || 720,
    };
  } catch {
    return null;
  }
}

function showWarnings(warnings: readonly Warning[]): void {
  warnEl.replaceChildren();
  for (const warning of warnings) {
    const line = document.createElement('div');
    line.textContent = `[${warning.kind}] ${warning.message}`;
    warnEl.appendChild(line);
  }
}

/**
 * Display scale only. Applied with a transform so the laid-out geometry stays
 * at the real panel size — reading coordinates off the DOM still gives the
 * numbers Unity would produce.
 */
function applyScale(): number {
  const choice = zoomEl.value;
  let scale: number;
  if (choice === 'fit') {
    const available = viewportEl.getBoundingClientRect();
    // A little slack so the drop shadow is not clipped against the edge.
    scale = Math.min(
      (available.width - 24) / panel.width,
      (available.height - 24) / panel.height,
      1,
    );
    scale = Math.max(scale, 0.05);
  } else {
    scale = Number(choice);
  }
  scalerEl.style.transform = `scale(${scale})`;
  return scale;
}

function update(): void {
  // Yoga nodes are WASM handles; skipping this leaks a tree per keystroke.
  result?.dispose();
  result = null;

  panelEl.style.width = `${panel.width}px`;
  panelEl.style.height = `${panel.height}px`;

  let roundTrip = '';
  try {
    const doc = parse(uxmlEl.value, ussEl.value);
    result = render(doc, panelEl, { size: panel });
    showWarnings([...doc.warnings, ...result.warnings]);

    // The headline claim, checked live on whatever the user just typed.
    //
    // It is meant to stay exact, including for text that does not parse:
    // untouched input is copied out of the original rather than regenerated,
    // so there is nothing for recovery to lose. That makes this a self-test
    // rather than a puzzle — if it ever reads DIFFERS, the bug is here, not in
    // the document.
    const out = serialize(doc);
    roundTrip =
      out.uxml === uxmlEl.value && out.uss === ussEl.value
        ? 'round-trip: exact'
        : 'round-trip: DIFFERS';
  } catch (error) {
    panelEl.replaceChildren();
    showWarnings([
      { kind: 'malformed', message: error instanceof Error ? error.message : String(error) },
    ]);
  }

  const scale = applyScale();
  const drawn = result?.boxes.size ?? 0;
  metaEl.textContent =
    `${panel.width} x ${panel.height} @ ${Math.round(scale * 100)}% - ` +
    `${drawn} element${drawn === 1 ? '' : 's'}` +
    (roundTrip === '' ? '' : ` - ${roundTrip}`);
  metaEl.classList.toggle('bad', roundTrip === 'round-trip: DIFFERS');
  metaEl.title =
    'Saving this document reproduces what you typed, byte for byte. It stays ' +
    'exact even for text that does not parse, because untouched input is ' +
    'copied out of the original rather than regenerated. DIFFERS would mean a ' +
    'bug in uxml-preview, not in your file.';
}

let timer: number | undefined;
function schedule(): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(update, 150);
}

function syncSizeInputs(): void {
  widthEl.value = String(panel.width);
  heightEl.value = String(panel.height);
  const match = SIZE_PRESETS.findIndex(
    (p) => p.width === panel.width && p.height === panel.height,
  );
  sizePresetEl.value = match < 0 ? 'custom' : String(match);
}

function setPanel(width: number, height: number): void {
  panel = {
    width: Math.max(1, Math.min(8192, Math.round(width))),
    height: Math.max(1, Math.min(8192, Math.round(height))),
  };
  syncSizeInputs();
  update();
}

// --- wiring -----------------------------------------------------------------

for (const [index, example] of EXAMPLES.entries()) {
  presetEl.add(new Option(example.name, String(index)));
}
sizePresetEl.add(new Option('custom', 'custom'));
for (const [index, preset] of SIZE_PRESETS.entries()) {
  sizePresetEl.add(new Option(preset.label, String(index)));
}

presetEl.addEventListener('change', () => {
  const example = EXAMPLES[Number(presetEl.value)];
  if (example === undefined) return;
  uxmlEl.value = example.uxml;
  ussEl.value = example.uss;
  if (example.panel !== undefined) {
    setPanel(example.panel.width, example.panel.height);
  } else {
    update();
  }
});

sizePresetEl.addEventListener('change', () => {
  const preset = SIZE_PRESETS[Number(sizePresetEl.value)];
  if (preset !== undefined) setPanel(preset.width, preset.height);
});

for (const input of [widthEl, heightEl]) {
  input.addEventListener('change', () => {
    setPanel(Number(widthEl.value), Number(heightEl.value));
  });
}

swapEl.addEventListener('click', () => setPanel(panel.height, panel.width));
zoomEl.addEventListener('change', update);
uxmlEl.addEventListener('input', schedule);
ussEl.addEventListener('input', schedule);

// Only the display scale depends on the window, so a resize re-fits rather than
// re-laying out.
new ResizeObserver(() => {
  if (zoomEl.value === 'fit') applyScale();
}).observe(viewportEl);

shareEl.addEventListener('click', () => {
  const url = new URL(window.location.href);
  url.hash = encodeState({
    uxml: uxmlEl.value,
    uss: ussEl.value,
    w: panel.width,
    h: panel.height,
  });
  history.replaceState(null, '', url.toString());
  void navigator.clipboard?.writeText(url.toString());
  const previous = shareEl.textContent;
  shareEl.textContent = 'copied';
  window.setTimeout(() => {
    shareEl.textContent = previous;
  }, 1200);
});

// A shared link wins over the default example: someone following a URL wants
// what was in it, not the inventory panel.
const shared = window.location.hash.length > 1 ? decodeState(window.location.hash.slice(1)) : null;
if (shared !== null) {
  uxmlEl.value = shared.uxml;
  ussEl.value = shared.uss;
  panel = { width: shared.w, height: shared.h };
  presetEl.value = '';
} else {
  const first = EXAMPLES[0]!;
  uxmlEl.value = first.uxml;
  ussEl.value = first.uss;
  if (first.panel !== undefined) panel = first.panel;
}
syncSizeInputs();

void loadLayoutEngine().then(update);
