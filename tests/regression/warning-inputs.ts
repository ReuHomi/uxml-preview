/**
 * Every document the warning regression runs, from four sources:
 *
 *   - tests/fixtures (uxml paired with no stylesheet, uss paired with a plain box)
 *   - the golden, template and visual cases
 *   - the 14 real-world documents in tests/fixtures/external
 *   - the pre-check sweep: each property in its own rule, on a box and on a label
 *
 * Shared by the baseline emitter and the comparison, so both see exactly the
 * same inputs. Only data and a file resolver live here; no renderer.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix, relative } from 'node:path';

import { CASES as GOLDEN_CASES } from '../golden/cases';
import { caseResolver } from '../golden/harness';
import { CASES as TEMPLATE_CASES } from '../template/cases';
import { VISUAL_CASES } from '../render/visual-cases';

export interface WarningInput {
  id: string;
  uxml: string;
  uss?: string;
  resolveImport?: (url: string, from: string | null) => string | null;
  /** Absent: no asset hook at all. `null`: a hook that resolves nothing. */
  asset?: string | null;
  states?: Readonly<Record<string, readonly string[]>>;
}

// jsdom gives import.meta.url an http: URL; vitest runs from the repository root.
const TESTS = join(process.cwd(), 'tests');
const wrap = (body: string): string => `<ui:UXML xmlns:ui="UnityEngine.UIElements">${body}</ui:UXML>`;

function filesUnder(dir: string, extension: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...filesUnder(full, extension));
    else if (entry.endsWith(extension)) out.push(full);
  }
  return out.sort();
}

/**
 * Resolves a sample's references against its own source folder, the way the
 * VS Code extension does with `uxmlPreview.projectRoot` set there: query and
 * fragment dropped, percent-escapes decoded, `project://database/` and `/`
 * rooted at the folder. A package path the sample did not keep at its Unity
 * location is found by file name, the one liberty taken.
 */
function sampleResolver(root: string, entry: string): (url: string, from: string | null) => string | null {
  const toPath = (url: string, from: string | null): string => {
    const bare = decodeURIComponent(url.replace(/&amp;/g, '&').split(/[?#]/)[0]!);
    if (bare.startsWith('project://database/')) return bare.slice('project://database/'.length);
    if (bare.startsWith('/')) return bare.slice(1);
    const base = from === null ? posix.dirname(entry) : posix.dirname(toPath(from, null));
    return posix.normalize(posix.join(base, bare));
  };
  const byName = new Map<string, string>();
  for (const file of [...filesUnder(root, '.uss'), ...filesUnder(root, '.uxml')]) {
    byName.set(posix.basename(file.replace(/\\/g, '/')), file);
  }
  return (url, from) => {
    const path = toPath(url, from);
    const direct = join(root, path);
    if (existsSync(direct)) return readFileSync(direct, 'utf8');
    const named = byName.get(posix.basename(path));
    return named === undefined ? null : readFileSync(named, 'utf8');
  };
}

/** The pre-check sweep's declarations, unchanged (scratchpad sweep.mjs, 2026-10-13). */
const SWEEP: Readonly<Record<string, string>> = {
  'align-content': 'center', 'align-items': 'center', 'align-self': 'center', all: 'initial',
  'animation-play-state': 'paused', 'aspect-ratio': '2', 'backdrop-filter': 'blur(4px)',
  'background-color': 'red', 'background-image': 'url("project://database/Assets/a.png")',
  'background-position': 'left top', 'background-position-x': 'left 4px', 'background-position-y': 'top 4px',
  'background-repeat': 'repeat-x', 'background-size': '10px 10px', 'border-color': 'red',
  'border-radius': '4px', 'border-width': '3px', bottom: '5px', color: 'red', cursor: 'link',
  display: 'none', filter: 'blur(2px)', flex: '1 0 10px', 'flex-basis': '33px', 'flex-direction': 'row',
  'flex-grow': '1', 'flex-shrink': '0', 'flex-wrap': 'wrap', 'font-size': '20px', height: '37px',
  'justify-content': 'center', left: '5px', 'letter-spacing': '3px', margin: '7px', opacity: '0.5',
  overflow: 'hidden', padding: '7px', position: 'absolute', right: '5px', rotate: '10deg', scale: '2 2',
  'text-overflow': 'ellipsis', 'text-shadow': '2px 2px 1px red', top: '5px', 'transform-origin': 'left top',
  transition: 'opacity 1s', 'transition-delay': '1s', 'transition-duration': '1s',
  'transition-property': 'opacity', 'transition-timing-function': 'ease-in', translate: '5px 5px',
  '-unity-animation-clip': 'none', '-unity-background-image-tint-color': 'red',
  '-unity-background-scale-mode': 'scale-to-fit', '-unity-editor-text-rendering-mode': 'bitmap',
  '-unity-font': 'resource("f")', '-unity-font-definition': 'resource("f")', '-unity-font-style': 'bold',
  '-unity-material': 'none', '-unity-overflow-clip-box': 'content-box', '-unity-paragraph-spacing': '5px',
  '-unity-slice-bottom': '4', '-unity-slice-left': '4', '-unity-slice-right': '4', '-unity-slice-scale': '2px',
  '-unity-slice-top': '4', '-unity-slice-type': 'tiled', '-unity-text-align': 'middle-center',
  '-unity-text-auto-size': 'best-fit 10px 20px', '-unity-text-generator': 'advanced',
  '-unity-text-outline': '1px red', '-unity-text-outline-color': 'red', '-unity-text-outline-width': '1px',
  '-unity-text-overflow-position': 'start', visibility: 'hidden', 'white-space': 'nowrap', width: '37px',
  'word-spacing': '5px', 'max-height': '10px', 'max-width': '10px', 'min-height': '90px', 'min-width': '90px',
  gap: '5px', 'row-gap': '5px', 'column-gap': '5px', 'overflow-wrap': 'anywhere', 'word-break': 'break-all',
  'box-shadow': '1px 1px red', 'mix-blend-mode': 'multiply', 'background-blend-mode': 'multiply',
  'clip-path': 'circle()', mask: 'none', outline: '1px solid red', 'line-height': '20px',
  'text-transform': 'uppercase', 'text-decoration': 'underline', 'z-index': '3', float: 'left', clear: 'both',
  'border-style': 'dashed', 'font-family': 'Arial', 'font-weight': 'bold', 'font-style': 'italic',
  'text-align': 'center', transform: 'rotate(10deg)', border: '1px solid red', background: 'red',
  colour: 'red', '-unity-foo': '1', '--custom': '1', 'border-top': '1px solid red', 'margin-inline': '4px',
  inset: '0', 'place-items': 'center', 'box-sizing': 'content-box', content: '"x"',
  'grid-template-columns': '1fr', 'border-top-style': 'dashed', font: '12px Arial', 'text-indent': '4px',
  'vertical-align': 'middle', 'overflow-x': 'hidden', resize: 'both', 'pointer-events': 'none',
  animation: 'x 1s', 'animation-name': 'x', 'will-change': 'transform', 'user-select': 'none',
  '-unity-text-overflow': 'ellipsis', '-webkit-transform': 'none',
};
for (const side of ['top', 'right', 'bottom', 'left']) {
  Object.assign(SWEEP, {
    [`margin-${side}`]: '7px',
    [`padding-${side}`]: '7px',
    [`border-${side}-width`]: '3px',
    [`border-${side}-color`]: 'red',
  });
}
for (const corner of ['top-left', 'top-right', 'bottom-left', 'bottom-right']) {
  Object.assign(SWEEP, { [`border-${corner}-radius`]: '4px' });
}

const SWEEP_SCENES = {
  label: wrap('<ui:VisualElement style="width:200px;height:100px"><ui:Label name="t" text="Hello world" /></ui:VisualElement>'),
  box: wrap(
    '<ui:VisualElement name="t" style="width:200px;height:100px"><ui:VisualElement style="width:20px;height:20px" />' +
      '<ui:VisualElement style="width:20px;height:20px" /></ui:VisualElement>',
  ),
};

export function warningInputs(): WarningInput[] {
  const inputs: WarningInput[] = [];

  const fixtures = join(TESTS, 'fixtures');
  for (const file of filesUnder(join(fixtures, 'uxml'), '.uxml')) {
    inputs.push({ id: `fixture:${relative(fixtures, file).replace(/\\/g, '/')}`, uxml: readFileSync(file, 'utf8') });
  }
  for (const file of filesUnder(join(fixtures, 'uss'), '.uss')) {
    inputs.push({
      id: `fixture:${relative(fixtures, file).replace(/\\/g, '/')}`,
      uxml: wrap('<ui:VisualElement name="a" class="a b c" />'),
      uss: readFileSync(file, 'utf8'),
    });
  }

  for (const golden of GOLDEN_CASES) {
    inputs.push({
      id: `golden:${golden.name}`,
      uxml: golden.uxml,
      uss: golden.uss,
      ...(golden.files === undefined ? {} : { resolveImport: caseResolver(golden.files) }),
    });
  }
  for (const template of TEMPLATE_CASES) {
    inputs.push({
      id: `template:${template.id}`,
      uxml: template.uxml,
      uss: template.uss,
      ...(template.files === undefined ? {} : { resolveImport: caseResolver(template.files) }),
    });
  }
  for (const visual of VISUAL_CASES) {
    inputs.push({
      id: `visual:${visual.name}`,
      uxml: visual.uxml,
      uss: visual.uss,
      ...(visual.asset === undefined ? {} : { asset: visual.asset.resolvesTo }),
      ...(visual.states === undefined ? {} : { states: visual.states }),
    });
  }

  const external = join(fixtures, 'external');
  for (const source of readdirSync(external).filter((d) => statSync(join(external, d)).isDirectory()).sort()) {
    const root = join(external, source);
    for (const file of filesUnder(root, '.uxml')) {
      const entry = relative(root, file).replace(/\\/g, '/');
      inputs.push({
        id: `external:${source}/${entry}`,
        uxml: readFileSync(file, 'utf8'),
        resolveImport: sampleResolver(root, entry),
        asset: null,
      });
    }
  }

  for (const [property, value] of Object.entries(SWEEP)) {
    for (const [scene, uxml] of Object.entries(SWEEP_SCENES)) {
      inputs.push({
        id: `sweep:${scene}:${property}`,
        uxml,
        uss: `#t { ${property}: ${value}; }`,
        // The sweep resolved every asset, so positioning properties had an image to act on.
        asset: 'data:image/png;base64,AAAA',
      });
    }
  }

  return inputs;
}
