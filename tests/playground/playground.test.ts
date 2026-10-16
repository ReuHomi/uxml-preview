/**
 * The playground shows what 0.6.0 says, not only that something was said.
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * User decision 2026-10-16 (B2): the playground is where most people first
 * meet a warning, and until now it printed `[kind] message` — so `not-uss`,
 * `invalid-value` and `font-fallback`, all `unsupported-property`, looked the
 * same, and nothing said what Unity would do. `describeWarning` is the one
 * place that turns a warning into what the page shows.
 *
 * Expected values come from Unity, not from this preview:
 *   - text height: tests/layout/unity/<version>/probe-editor/lines.json —
 *     the editor default font at 20px is 25 for one line, 73 for three
 *   - aspect-ratio: aspect2.json (6000.3.25f1) — `aspect-ratio: 2` gives a
 *     2:1 box (ar-w 94x47, ar-grow 200x100)
 *   - unityEffect / font-fallback: the 0.6.0 contract pinned in
 *     tests/contract-060/review-fixes.test.ts
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { loadLayoutEngine, parse, render, serialize } from '../../src/index';
import type { RenderResult, Warning } from '../../src/index';
import { EXAMPLES, resolveAsset, resolveExampleImport } from '../../playground/examples';
import { describeWarning } from '../../playground/warnings';

beforeAll(async () => {
  await loadLayoutEngine();
});

const U = (body: string) => `<ui:UXML xmlns:ui="UnityEngine.UIElements">${body}</ui:UXML>`;

function draw(uxml: string, uss = '', files?: Record<string, string>, size = { width: 640, height: 360 }): RenderResult & { all: Warning[] } {
  const doc = parse(uxml, uss, files === undefined ? undefined : { resolveImport: (url, from) => resolveExampleImport(files, url, from) });
  const r = render(doc, document.createElement('div'), { size, resolveAsset });
  return Object.assign(r, { all: [...doc.warnings, ...r.warnings] });
}

const byName = (r: RenderResult, name: string) => {
  let id: number | undefined;
  const walk = (n: { id: number; attributes: Array<{ name: string; value: string }>; children: unknown[] }) => {
    if (n.attributes.some((a) => a.name === 'name' && a.value === name)) id = n.id;
    (n.children as (typeof n)[]).forEach(walk);
  };
  walk(r.document.root as never);
  expect(id, `element #${name}`).toBeDefined();
  return r.boxes.get(id as never)!;
};

describe('describeWarning: what the page shows for one warning', () => {
  it('the badge is the reason; a warning without one shows its kind', () => {
    const r = draw(U('<ui:VisualElement name="a" />'), '#a { font-family: Arial; }');
    try {
      const w = r.all.find((x) => x.reason === 'not-uss')!;
      expect(describeWarning(w).badge).toBe('not-uss');
      expect(describeWarning(w).message).toBe(w.message);
    } finally {
      r.dispose();
    }
    expect(describeWarning({ kind: 'malformed', message: 'broken' }).badge).toBe('malformed');
    expect(describeWarning({ kind: 'malformed', message: 'broken' }).details).toEqual([]);
  });

  it('unityEffect says which Unity versions stop styling, and from where', () => {
    const r = draw(U('<ui:VisualElement name="a" />'), '#a { background-color: hsl(120, 100%, 50%); }');
    try {
      const w = r.all.find((x) => x.subject?.kind === 'property' && x.subject.unityEffect !== undefined)!;
      const details = describeWarning(w).details.join('\n');
      expect(details).toContain('6000.3');
      expect(details).toMatch(/every element after it/);
    } finally {
      r.dispose();
    }
  });

  it('font-fallback names the script and the fallback font; affectsLayout says coordinates may differ', () => {
    const r = draw(U('<ui:Label text="한글" />'));
    try {
      const w = r.all.find((x) => x.reason === 'font-fallback')!;
      const view = describeWarning(w);
      expect(view.badge).toBe('font-fallback');
      expect(view.details.join('\n')).toMatch(/Hangul/);
      expect(view.details.join('\n')).toMatch(/fallback font/);
      expect(view.details.join('\n')).toMatch(/coordinates may differ/);
    } finally {
      r.dispose();
    }
  });

  it('replacements and the number of elements a declaration reached are shown', () => {
    const r = draw(U('<ui:Label class="t" text="a" /><ui:Label class="t" text="b" />'), '.t { font-family: Arial; }');
    try {
      const w = r.all.find((x) => x.subject?.kind === 'property' && x.subject.property === 'font-family')!;
      const details = describeWarning(w).details.join('\n');
      expect(details).toContain('-unity-font-definition');
      expect(details).toMatch(/2 elements/);
    } finally {
      r.dispose();
    }
  });
});

describe('examples', () => {
  const find = (pattern: RegExp) => {
    const e = EXAMPLES.find((x) => pattern.test(x.name));
    expect(e, `an example named like ${pattern}`).toBeDefined();
    return e!;
  };

  it('names say what was compared: no "slots" (not supported), coordinates for the representative screen', () => {
    expect(EXAMPLES.some((e) => /slot/i.test(e.name))).toBe(false);
    expect(find(/^Representative screen/).name).toMatch(/coordinates/);
  });

  it('every example renders and round-trips exactly', () => {
    for (const e of EXAMPLES) {
      const doc = parse(e.uxml, e.uss, e.files === undefined ? undefined : { resolveImport: (url, from) => resolveExampleImport(e.files!, url, from) });
      const out = serialize(doc);
      expect(out.uxml, e.name).toBe(e.uxml);
      expect(out.uss, e.name).toBe(e.uss);
      const r = render(doc, document.createElement('div'), { size: e.panel ?? { width: 1280, height: 720 }, resolveAsset });
      r.dispose();
    }
  });

  it('Text: Unity line height (#one-line 25, #three-lines 73 at 20px) and one font-fallback warning for its Korean line', () => {
    const e = find(/^Text:/);
    const r = draw(e.uxml, e.uss, e.files, e.panel);
    try {
      expect(byName(r, 'one-line').height).toBe(25);
      expect(byName(r, 'three-lines').height).toBe(73);
      expect(r.all.filter((w) => w.reason === 'font-fallback')).toHaveLength(1);
      expect(e.uss).toMatch(/letter-spacing/);
    } finally {
      r.dispose();
    }
  });

  it('aspect-ratio: #ratio is laid out 2:1, as Unity measured', () => {
    const e = find(/aspect-ratio/);
    const r = draw(e.uxml, e.uss, e.files, e.panel);
    try {
      const box = byName(r, 'ratio');
      expect(box.width).toBeGreaterThan(0);
      expect(box.width).toBe(box.height * 2);
      expect(r.all.filter((w) => w.subject?.kind === 'property' && w.subject.property === 'aspect-ratio')).toEqual([]);
    } finally {
      r.dispose();
    }
  });

  it('Values Unity cannot apply: hsl(), cubic-bezier() with unityEffect; opacity % as invalid-value', () => {
    const e = find(/Unity cannot apply/);
    const r = draw(e.uxml, e.uss, e.files, e.panel);
    try {
      const effects = r.all.filter((w) => w.subject?.kind === 'property' && w.subject.unityEffect?.kind === 'unstyled-from-here');
      expect(effects.map((w) => (w.subject as { property: string }).property).sort()).toEqual(['background-color', 'transition-timing-function']);
      expect(r.all.some((w) => w.reason === 'invalid-value' && w.subject?.kind === 'property' && w.subject.property === 'opacity')).toBe(true);
    } finally {
      r.dispose();
    }
  });
});

describe('the page uses describeWarning', () => {
  it('main.ts renders warnings through describeWarning, not `[kind] message`', () => {
    const main = readFileSync(join(process.cwd(), 'playground', 'main.ts'), 'utf8');
    expect(main).toContain('describeWarning');
    expect(main).not.toMatch(/`\[\$\{warning\.kind\}\] \$\{warning\.message\}`/);
  });
});
