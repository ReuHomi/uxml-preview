/**
 * 0.6.0 bundle 1 — states keys a caller passes that cannot do what was asked.
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Where the expected values come from (never from this renderer's output):
 *
 *   - The 19 rows below are uxml-author's section K table
 *     (github.com/ReuHomi/uxml-author, master, tests/conditions.mjs, added in
 *     1ef359b). `passes` is the skill's own verdict: `checkStates` from that
 *     tree's src/check.js, run on 2026-10-16. A key the skill refuses is one
 *     the core must now warn about, and one it passes must stay silent and be
 *     applied — the two sides must never disagree again.
 *   - Decision D1 (2026-10-16): the warnings stay `unsupported-selector` and
 *     carry `subject: { kind: 'states-key', key, problem }`; no new
 *     WarningKind. `reason` is `invalid-value`: the name is fine, the input
 *     cannot work. The message keeps the `states key "…"` prefix that
 *     consumers have read since 0.5.1 (tests/render/consumer-contract.test.ts).
 */

import { beforeAll, describe, expect, it } from 'vitest';

import { loadLayoutEngine, parse, resolveStyles } from '../../src/index';
import type { UxmlDocument, Warning } from '../../src/index';

beforeAll(async () => {
  await loadLayoutEngine();
});

const UXML_EN = `<ui:UXML xmlns:ui="UnityEngine.UIElements"><Style src="E.uss" />
<ui:VisualElement name="Panel">
  <ui:Button name="Use" text="Use" enabled="false" />
  <ui:VisualElement name="Parent" enabled="false"><ui:VisualElement name="Child" /></ui:VisualElement>
  <ui:VisualElement name="Free" />
</ui:VisualElement></ui:UXML>`;
const EN_USS = `#Panel { width: 380px; height: 280px; }
#Use, #Child, #Free { width: 80px; height: 20px; }
#Use:checked, #Child:checked, #Free:checked { width: 141px; }
*:checked { --applied: 1; }`;

// [key, activeStates, the skill's verdict]
const K: ReadonlyArray<readonly [string, readonly string[], 'passes' | 'refuses']> = [
  ['#Use', [], 'passes'],
  ['#Use:disabled', [], 'refuses'],
  ['#Use:disabled', ['disabled'], 'refuses'],
  ['#Child:disabled', [], 'refuses'],
  ['#Child:disabled', ['disabled'], 'refuses'],
  ['#Parent:disabled #Child', [], 'refuses'],
  ['#Parent:disabled #Child', ['disabled'], 'refuses'],
  ['#Free:disabled', [], 'refuses'],
  ['#Free:disabled', ['disabled'], 'refuses'],
  ['#Use:hover', [], 'refuses'],
  ['#Use:hover', ['hover'], 'refuses'],
  ['#Use:enabled', [], 'refuses'],
  ['#Free:enabled', [], 'refuses'],
  ['#Free:enabled', ['enabled'], 'refuses'],
  [':root', [], 'passes'],
  [':root', ['hover'], 'passes'],
  ['#Parent #Child', [], 'passes'],
  ['#Parent #Child', ['disabled'], 'passes'],
  ['Button', ['disabled'], 'passes'],
];

function doc(): UxmlDocument {
  return parse(UXML_EN, undefined, { resolveImport: (url) => (url === 'E.uss' ? EN_USS : null) });
}

function stateKeyWarnings(warnings: readonly Warning[]): Warning[] {
  return warnings.filter((w) => w.subject?.kind === 'states-key');
}

describe('section K: the core warns exactly when the skill refuses', () => {
  expect(K).toHaveLength(19);

  for (const [key, active, verdict] of K) {
    const label = `${key}${active.length > 0 ? ` with activeStates ${active.join(',')}` : ''} → ${verdict}`;
    it(label, () => {
      const result = resolveStyles(doc(), { activeStates: new Set(active), states: { [key]: ['checked'] } });
      const warned = stateKeyWarnings(result.warnings);
      const applied = [...result.styles.values()].some((m) => m.get('--applied')?.origin.kind === 'rule');

      if (verdict === 'passes') {
        expect(warned).toEqual([]);
        expect(applied).toBe(true);
      } else {
        expect(applied).toBe(false);
        expect(warned).toHaveLength(1);
        const w = warned[0]!;
        expect(w.kind).toBe('unsupported-selector');
        expect(w.reason).toBe('invalid-value');
        expect(w.subject).toEqual({ kind: 'states-key', key, problem: 'state-in-key' });
        expect(w.message.indexOf(`states key "${key}"`)).toBe(0);
        expect(w.at).toBeUndefined();
      }
    });
  }
});

describe('the other two problems', () => {
  it('a key that names no element is matches-nothing, not state-in-key', () => {
    const { warnings } = resolveStyles(doc(), { states: { '#Nope': ['hover'] } });
    const warned = stateKeyWarnings(warnings);
    expect(warned).toHaveLength(1);
    expect(warned[0]!.subject).toEqual({ kind: 'states-key', key: '#Nope', problem: 'matches-nothing' });
    expect(warned[0]!.reason).toBe('invalid-value');
    expect(warned[0]!.message.indexOf('states key "#Nope"')).toBe(0);
  });

  it('a state Unity never sets is unknown-state, once per name, and names it', () => {
    const { warnings } = resolveStyles(doc(), { states: { '#Free': ['hovr', 'hover', 'selected'] } });
    const warned = stateKeyWarnings(warnings);
    expect(warned.map((w) => w.subject)).toEqual([
      { kind: 'states-key', key: '#Free', problem: 'unknown-state', state: 'hovr' },
      { kind: 'states-key', key: '#Free', problem: 'unknown-state', state: 'selected' },
    ]);
    for (const w of warned) {
      expect(w.kind).toBe('unsupported-selector');
      expect(w.reason).toBe('invalid-value');
    }
  });

  it('a known state on a key that matches stays silent and is applied', () => {
    const { warnings, styles } = resolveStyles(doc(), { states: { '#Free': ['checked'] } });
    expect(stateKeyWarnings(warnings)).toEqual([]);
    expect([...styles.values()].some((m) => m.get('--applied')?.origin.kind === 'rule')).toBe(true);
  });

  it('an unusable selector keeps its 0.5.1 warning and gets no problem field', () => {
    const { warnings } = resolveStyles(doc(), { states: { '#a[x]': ['hover'] } });
    const warned = stateKeyWarnings(warnings);
    expect(warned).toHaveLength(1);
    expect(warned[0]!.subject).toEqual({ kind: 'states-key', key: '#a[x]' });
    expect(warned[0]!.reason).toBe('not-uss');
  });
});
