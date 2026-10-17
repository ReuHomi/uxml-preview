/**
 * No problem 0.5.0 reported is lost.
 *
 * 0.5.1 moved property warnings from "once per element" to "once per
 * declaration", corrected facts, and reworded text. Each of those can hide a
 * real loss behind a plausible diff, so every warning 0.5.0 raised on the
 * inputs in ./warning-inputs.ts is classified against what the current code
 * raises on the same input:
 *
 *   preserved   same target, same kind (text may be reworded)
 *   merged      same target and kind, now one warning per declaration
 *   reclassified same target, kind or reason changed
 *   deleted     gone — allowed only for the warnings whose fact was wrong
 *
 * 0.5.0's output is fixed in warnings-0.5.0.json. To regenerate it, bundle the
 * 0.5.0 source and point this file at it:
 *
 *   git archive v0.5.0 src | tar -x -C <dir>      (or the main branch at 8cbd5cb)
 *   NODE_PATH=node_modules esbuild <dir>/src/index.ts --bundle --format=cjs --platform=node --outfile=<core.cjs>
 *   WARNING_BASELINE_CORE=<core.cjs> vitest run tests/regression/warning-diff.test.ts
 *
 * CommonJS and Node's own require, because Vite will not import a file outside
 * the repository.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

import { beforeAll, describe, expect, it } from 'vitest';

import * as current from '../../src/index';
import type { Warning } from '../../src/index';
import { FIXED_MEASURE } from '../golden/harness';
import { warningInputs } from './warning-inputs';
import type { WarningInput } from './warning-inputs';

const HERE = join(process.cwd(), 'tests', 'regression');
const BASELINE = join(HERE, 'warnings-0.5.0.json');
const SUMMARY = join(HERE, 'warning-diff.summary.json');
const EMIT = process.env['WARNING_BASELINE_CORE'];
const UPDATING = process.env['GOLDEN_UPDATE'] === '1';

type Core = Pick<typeof current, 'parse' | 'render' | 'loadLayoutEngine'>;

/** What is kept of a warning: everything but fields 0.5.0 did not have. */
type Recorded = Pick<Warning, 'kind' | 'message' | 'node' | 'at' | 'sourceDocument' | 'reason' | 'subject'>;

function record(w: Warning): Recorded {
  const out: Recorded = { kind: w.kind, message: w.message };
  if (w.node !== undefined) out.node = w.node;
  // 0.6.0 added url/from to a USS location; 0.5.0 had neither, so they are not compared.
  if (w.at !== undefined) out.at = w.at.in === 'uss' ? { in: 'uss', sheet: w.at.sheet, span: w.at.span } : w.at;
  if (w.sourceDocument !== undefined) out.sourceDocument = w.sourceDocument;
  if (w.reason !== undefined) out.reason = w.reason;
  if (w.subject !== undefined) out.subject = w.subject;
  return out;
}

function run(core: Core, input: WarningInput): Recorded[] {
  const doc = core.parse(
    input.uxml,
    input.uss,
    input.resolveImport === undefined ? undefined : { resolveImport: input.resolveImport },
  );
  const container = document.createElement('div');
  const result = core.render(doc, container, {
    size: { width: 400, height: 300 },
    measureText: FIXED_MEASURE,
    ...(input.asset === undefined ? {} : { resolveAsset: () => input.asset ?? null }),
    ...(input.states === undefined ? {} : { states: input.states }),
  });
  const warnings = [...doc.warnings, ...result.warnings].map(record);
  result.dispose();
  return warnings;
}

describe.runIf(EMIT !== undefined)('emit the 0.5.0 baseline', () => {
  it('records every warning the given core raises', async () => {
    const core = createRequire(join(process.cwd(), 'package.json'))(EMIT!) as Core;
    await core.loadLayoutEngine();
    const out: Record<string, Recorded[]> = {};
    for (const input of warningInputs()) out[input.id] = run(core, input);
    writeFileSync(BASELINE, JSON.stringify(out, null, 1) + '\n');
  });
});

// ---------------------------------------------------------------------------
// What a warning is about
// ---------------------------------------------------------------------------

/**
 * 0.5.0 had no `subject`, so its target is read back from its own text. Every
 * message shape 0.5.0 produced on these inputs is listed; an unrecognised one
 * fails the test rather than being guessed at.
 */
function target050(w: Recorded): string {
  const m = w.message;
  const quoted = (re: RegExp): string => {
    const hit = re.exec(m);
    if (hit === null) throw new Error(`0.5.0 message not recognised: ${w.kind}: ${m}`);
    return hit[1]!;
  };
  switch (w.kind) {
    case 'asset-unresolved':
      return `asset:${quoted(/^background-image: "(.*)" was not resolved$/)}`;
    case 'unsupported-control':
      return `control-fallback:${quoted(/^<([^>]+)> has no renderer/)}`;
    case 'import-unresolved':
      return `import:${quoted(/^(?:@import |<Style src=)"([^"]*)"/)}`;
    case 'template-src-unresolved':
      return `import:${quoted(/ src "([^"]*)"/)}`;
    case 'duplicate-name-in-tree':
      return `name:${quoted(/^name "([^"]*)"/)}`;
    case 'override-style-ignored':
      return `name:${quoted(/element-name "([^"]*)"/)}`;
    case 'override-target-missing':
      return `name:${quoted(/target "([^"]*)"/)}`;
    case 'template-slot-unsupported':
      return 'slot';
    case 'unsupported-selector':
      if (/ matched nothing\./.test(m)) return `fragment:${quoted(/^(.*) matched nothing\./)}`;
      return `fragment:${quoted(/^"(.*)" is not supported in USS/)}`;
    case 'version-dependent':
      if (m.startsWith(':root in USS')) return 'fragment::root';
      if (m.startsWith('Unity’s control defaults') || m.startsWith("Unity's control defaults")) return 'theme';
      if (/ is drawn with the implicit child elements/.test(m)) return `control-parts:${quoted(/^<([^>]+)>/)}`;
      return `property:${quoted(/^(\S+) depends on the Unity version/)}`;
    case 'unsupported-property':
      if (m.startsWith('-unity-slice-*')) return 'property:-unity-slice-*';
      if (/ has both a text attribute and children/.test(m)) return `control-children:${quoted(/^<([^>]+)>/)}`;
      return `property:${quoted(/^([-\w]+)(?::| does not exist| has no CSS| names a Unity)/)}`;
    default:
      throw new Error(`0.5.0 kind not expected on these inputs: ${w.kind}`);
  }
}

/** The same key, read from the structured fields 0.5.1 added. */
function targetNow(w: Recorded): string | null {
  const s = w.subject;
  if (s === undefined) {
    if (w.kind === 'version-dependent' && w.message.startsWith('Built-in control defaults')) return 'theme';
    if (w.kind === 'template-slot-unsupported') return 'slot';
    return null;
  }
  switch (s.kind) {
    case 'property':
      return `property:${s.property}`;
    case 'selector':
      return `fragment:${s.fragment ?? s.selector}`;
    case 'control':
      if (w.kind === 'unsupported-control') return `control-fallback:${s.type}`;
      if (w.kind === 'version-dependent') return `control-parts:${s.type}`;
      return `control-children:${s.type}`;
    case 'asset':
      return `asset:${s.path}`;
    case 'import':
      return `import:${s.url}`;
    case 'name':
      return `name:${s.name}`;
    default:
      return s.kind;
  }
}

/** 0.5.0's slice warning covered all four sides; 0.5.1 names the side written. */
const sameTarget = (old: string, now: string | null): boolean =>
  now !== null && (old === now || (old === 'property:-unity-slice-*' && now.startsWith('property:-unity-slice-')));

/** The reason a 0.5.0 message asserted, where its text asserted one. */
function impliedReason(w: Recorded): string | undefined {
  if (/ does not exist in USS/.test(w.message)) return 'not-uss';
  if (/ depends on the Unity version/.test(w.message)) return 'version-dependent';
  return undefined;
}

/**
 * Deletions that are corrections, each because the 0.5.0 warning asserted
 * something false: background-size/-position/-repeat are in Unity's 6000.0
 * reference table, so "depends on the Unity version" was wrong, and the
 * preview draws them, so there is nothing left to say. aspect-ratio (0.6.0):
 * the warning said this preview does not lay it out; it now does, matching
 * Unity 6000.3.25f1 52/52 (tests/contract-060/aspect-ratio.test.ts).
 */
const ALLOWED_DELETIONS = new Set([
  'property:background-size',
  'property:background-position',
  'property:background-repeat',
  'property:aspect-ratio',
  // 0.7.0 (decision 2026-10-17): "Built-in control defaults applied" claimed a version
  // difference the dumps do not show (theme values equal on 6000.0.40f1 and 6.3) and
  // a difference from Unity there is none of. Its fact was wrong.
  'theme',
  // Same decision: "<ScrollView> drawn with built-in child elements measured on Unity ..." -
  // the parts measured the same on both versions and both themes (golden, golden-panel).
  'control-parts:ScrollView',
  // 0.7.0 bundle C: TextField is drawn now (tests/contract-070/bundle-c.test.ts, from the
  // c07-TextField and c-textfield dumps), so "has no renderer" no longer holds — the same
  // kind of correction as aspect-ratio. The 0.5.0 fragment warning named four classes as
  // parts nothing builds; three are TextField's input classes and match now. Only
  // `.unity-text-input` still matches nothing (no Unity element carries that class), and
  // it is still warned, under its own fragment.
  'control-fallback:TextField',
  'fragment:.unity-text-input, .unity-text-field__input, .unity-base-text-field__input, .unity-base-field__input',
]);

type Verdict = 'preserved' | 'merged' | 'reclassified' | 'deleted';

interface Classified {
  input: string;
  target: string;
  verdict: Verdict;
  detail?: string;
  /** For a merge: the element 0.5.0 named, and the one the 0.5.1 warning names, if any. */
  node?: number;
  nodeNow?: number | null;
}

function classify(baseline: Record<string, Recorded[]>, now: Record<string, Recorded[]>): Classified[] {
  const out: Classified[] = [];
  for (const [input, old] of Object.entries(baseline)) {
    const current = now[input] ?? [];
    for (const w of old) {
      const target = target050(w);
      const candidates = current.filter((c) => sameTarget(target, targetNow(c)));
      if (candidates.length === 0) {
        out.push({ input, target, verdict: 'deleted' });
        continue;
      }
      const sameKind = candidates.filter((c) => c.kind === w.kind);
      if (sameKind.length === 0) {
        out.push({ input, target, verdict: 'reclassified', detail: `kind ${w.kind} -> ${candidates[0]!.kind}` });
        continue;
      }
      const implied = impliedReason(w);
      if (implied !== undefined && sameKind.every((c) => c.reason !== implied)) {
        out.push({ input, target, verdict: 'reclassified', detail: `reason ${implied} -> ${sameKind[0]!.reason}` });
        continue;
      }
      const exact = sameKind.find((c) =>
        w.node !== undefined ? c.node === w.node : JSON.stringify(c.at) === JSON.stringify(w.at),
      );
      if (exact !== undefined) {
        out.push({ input, target, verdict: 'preserved' });
        continue;
      }
      out.push({
        input,
        target,
        verdict: 'merged',
        ...(w.node === undefined ? {} : { node: w.node }),
        nodeNow: sameKind[0]!.node ?? null,
      });
    }
  }
  return out;
}

function summarise(results: readonly Classified[]) {
  const count = (v: Verdict): number => results.filter((r) => r.verdict === v).length;
  const tally = (rows: readonly Classified[], key: (r: Classified) => string): Record<string, number> => {
    const t: Record<string, number> = {};
    for (const r of rows) t[key(r)] = (t[key(r)] ?? 0) + 1;
    return Object.fromEntries(Object.entries(t).sort());
  };
  const merged = results.filter((r) => r.verdict === 'merged');
  return {
    total: results.length,
    preserved: count('preserved'),
    merged: count('merged'),
    reclassified: count('reclassified'),
    deleted: count('deleted'),
    deletedTargets: tally(results.filter((r) => r.verdict === 'deleted'), (r) => r.target),
    reclassifiedTargets: tally(
      results.filter((r) => r.verdict === 'reclassified'),
      (r) => `${r.target} (${r.detail})`,
    ),
    mergedTargets: tally(merged, (r) => r.target),
    /**
     * Which elements a merged warning reached is no longer fully recoverable
     * (0.6.0). A declaration-level warning points at the text and names no
     * element; a value-level one collapsed across elements names only the
     * first. Counted separately because a consumer handles them differently.
     */
    mergedNamesNoElement: merged.filter((r) => r.node !== undefined && r.nodeNow === null).length,
    mergedNamesAnotherElement: merged.filter(
      (r) => r.node !== undefined && r.nodeNow !== null && r.nodeNow !== r.node,
    ).length,
  };
}

describe.runIf(EMIT === undefined)('no warning 0.5.0 raised is lost', () => {
  beforeAll(async () => {
    await current.loadLayoutEngine();
  });

  it('classifies every 0.5.0 warning, deleting only the ones whose fact was wrong', () => {
    const baseline = JSON.parse(readFileSync(BASELINE, 'utf8')) as Record<string, Recorded[]>;
    const inputs = warningInputs();
    expect(inputs.map((i) => i.id).sort()).toEqual(Object.keys(baseline).sort());
    const now: Record<string, Recorded[]> = {};
    for (const input of inputs) now[input.id] = run(current, input);

    const results = classify(baseline, now);
    const forbidden = results.filter((r) => r.verdict === 'deleted' && !ALLOWED_DELETIONS.has(r.target));
    expect(forbidden, 'a warning was lost that was not a corrected fact').toEqual([]);

    const summary = summarise(results);
    if (UPDATING) writeFileSync(SUMMARY, JSON.stringify(summary, null, 1) + '\n');
    expect(summary).toEqual(JSON.parse(readFileSync(SUMMARY, 'utf8')));
  });
});
