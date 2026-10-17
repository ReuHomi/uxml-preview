/**
 * 0.7.0 — judging rule 2 as a test: a drawn control carries Unity's classes, and so
 * does every part it builds (human decision 2026-10-17, after bundle C).
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * For every dump file in tests/layout/unity/<version>/{probe-panel,probe-editor-070}/
 * whose probe is in tests/layout/unity/probes-0.7.0/ (with its .uss when there is one),
 * both versions and both themes, every named element of a type in CONTROLS is compared
 * with Unity's:
 *   - the element's own classes: the file's `class` plus the preview's implicit ones,
 *     against the dump's `classes`, as sets;
 *   - each part the preview built, against the dump element it stands for (Unity's
 *     name, or for an unnamed part the class the preview names it by), as sets;
 *   - and the other way: every element Unity built inside the control that is not one
 *     of the file's children must be one of the preview's parts.
 * Only elements the file names are judged: a TextField that Unity builds inside a Slider
 * (c07-Slider, `unity-text-field`) is that Slider's part, not a file element. A file child
 * without a name is matched to an unnamed Unity element of its type that no part claims.
 * The dumps cover every state they were taken in (enabled="false", placeholder, value,
 * multiline, password, label, forced hover/focus in c07-states).
 *
 * The classes compared are the ones the cascade matches selectors against: written
 * classes plus `implicitClassesOf` for an element, the part's `classes` for a part.
 * Add each newly drawn control to CONTROLS (bundles D-F).
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { loadLayoutEngine, parse, resolveStyles } from '../../src/index';
import type { ElementNode, Theme } from '../../src/index';
import { implicitClassesOf, resolveControl } from '../../src/controls/registry';
import { layoutDocument } from '../../src/layout/yoga';

const CONTROLS = ['GroupBox', 'Box', 'TextField'];

const UNITY = join(process.cwd(), 'tests', 'layout', 'unity');
const PROBES = join(UNITY, 'probes-0.7.0');
const FOLDER: Record<Theme, string> = { runtime: 'probe-panel', editor: 'probe-editor-070' };
const VERSIONS = ['6000.0.40f1', '6000.3.25f1'];

interface DumpElement { path: string; name: string; type: string; classes: string[] }

beforeAll(async () => {
  await loadLayoutEngine();
});

const written = (node: ElementNode): string[] =>
  (node.attributes.find((a) => a.name === 'class')?.value ?? '').split(/\s+/).filter((c) => c.length > 0);
const elementClasses = (node: ElementNode): string[] => [...written(node), ...implicitClassesOf(node)];
const sorted = (xs: readonly string[]): string[] => [...new Set(xs)].sort();

function named(root: ElementNode): Map<string, ElementNode> {
  const out = new Map<string, ElementNode>();
  const walk = (n: ElementNode): void => {
    const name = n.attributes.find((a) => a.name === 'name')?.value;
    if (name !== undefined && name !== '') out.set(name, n);
    n.children.forEach(walk);
  };
  walk(root);
  return out;
}

/** Every dump that has its probe here: [version, theme, file]. */
function dumps(): Array<[string, Theme, string]> {
  const out: Array<[string, Theme, string]> = [];
  for (const version of VERSIONS) {
    for (const theme of ['runtime', 'editor'] as const) {
      const dir = join(UNITY, version, FOLDER[theme]);
      for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
        const probe = f.slice(0, -'.json'.length);
        if (existsSync(join(PROBES, `${probe}.uxml`))) out.push([version, theme, probe]);
      }
    }
  }
  return out;
}

describe('classes — the controls this preview draws carry Unity\'s, parts included', () => {
  it('the dumps hold every control listed, on both themes and versions', () => {
    const seen = new Set<string>();
    for (const [version, theme, probe] of dumps()) {
      const els = (JSON.parse(readFileSync(join(UNITY, version, FOLDER[theme], `${probe}.json`), 'utf8').replace(/\bNaN\b/g, 'null')) as { elements: DumpElement[] }).elements;
      for (const e of els) if (CONTROLS.includes(e.type)) seen.add(`${version} ${theme} ${e.type}`);
    }
    for (const version of VERSIONS) for (const theme of ['runtime', 'editor']) for (const c of CONTROLS) expect(seen.has(`${version} ${theme} ${c}`), `${version} ${theme} ${c}`).toBe(true);
  });

  for (const [version, theme, probe] of dumps()) {
    it(`${version} ${theme} ${probe}`, () => {
      const els = (JSON.parse(readFileSync(join(UNITY, version, FOLDER[theme], `${probe}.json`), 'utf8').replace(/\bNaN\b/g, 'null')) as { elements: DumpElement[] }).elements;
      const ussPath = join(PROBES, `${probe}.uss`);
      const doc = parse(readFileSync(join(PROBES, `${probe}.uxml`), 'utf8'), existsSync(ussPath) ? readFileSync(ussPath, 'utf8') : undefined);
      const nodes = named(doc.root);
      const targets = els.filter((e) => CONTROLS.includes(e.type) && nodes.has(e.name));
      if (targets.length === 0) return;
      const resolved = resolveStyles(doc, { theme });
      const tree = layoutDocument(doc.root, resolved.styles, resolved.partStyles, {
        theme,
        size: { width: 800, height: 600 },
        measureText: () => ({ width: 0, height: 0 }),
      });
      try {
        for (const u of targets) {
          const node = nodes.get(u.name);
          expect(node, `${u.path}: no element named ${u.name}`).toBeDefined();
          expect(sorted(elementClasses(node!)), `${u.path} classes`).toEqual(sorted(u.classes));

          const inside = els.filter((e) => e.path.startsWith(`${u.path}/`));
          const spec = resolveControl(node!).spec.parts;
          const built = tree.parts.get(node!.id) ?? [];
          const used = new Set<string>();
          for (const part of built) {
            const classes = spec.find((p) => p.name === part.name)?.classes ?? [];
            const twin = inside.find((e) => !used.has(e.path) && (e.name === part.name || (e.name === '' && e.classes.includes(part.name))));
            expect(twin, `${u.path}: Unity has no part ${part.name}`).toBeDefined();
            used.add(twin!.path);
            expect(sorted(classes), `${u.path} part ${part.name} classes`).toEqual(sorted(twin!.classes));
          }
          // The file's own children (and everything under them) are not parts.
          const fileRoots: string[] = [];
          const fileWalk = (n: ElementNode): void => {
            for (const child of n.children) {
              const name = child.attributes.find((a) => a.name === 'name')?.value;
              const free = (e: DumpElement): boolean => !used.has(e.path) && !fileRoots.some((r) => e.path === r || e.path.startsWith(`${r}/`));
              const match = name !== undefined && name !== ''
                ? inside.find((e) => e.name === name)
                : inside.filter((e) => free(e) && e.name === '' && e.type === child.name.local)
                  .sort((a, b) => a.path.split('/').length - b.path.split('/').length)[0];
              if (match !== undefined) fileRoots.push(match.path);
              else fileWalk(child);
            }
          };
          fileWalk(node!);
          const unityParts = inside.filter((e) => !fileRoots.some((r) => e.path === r || e.path.startsWith(`${r}/`)));
          expect(unityParts.filter((e) => !used.has(e.path)).map((e) => e.path), `${u.path}: Unity parts the preview did not build`).toEqual([]);
        }
      } finally {
        tree.dispose();
      }
    });
  }
});
