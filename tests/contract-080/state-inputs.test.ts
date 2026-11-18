/**
 * 0.8.0 — checks of this API's own state inputs (no Unity basis needed: `states` and `activeStates` are
 * preview options with no Unity counterpart).
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * The two cases uxml-author (src/check.js, "29 of 31") had to catch itself because the core was silent
 * (docs/backlog.md, 2026-11-18):
 *
 * 1. An unknown name in `activeStates` ("hovr"). Before: dropped without a word. Now: one warning per
 *    unknown name, kind `malformed`, reason `invalid-value`, no subject — the warning an unknown `theme`
 *    option value gives. Not the `unknown-state` warning of a `states` entry: that one carries
 *    `subject: { kind: 'states-key', key }`, and `activeStates` has no key; a consumer that matches
 *    `subject.key` against its own `states` map (uxml-author does) would misfile it. The name is still
 *    not applied.
 * 2. A `states` key that is not a complete USS selector ("#Use { x"). Before: the key went through
 *    `parseUss(key + ' {}')`, which read `#Use` and took the rest as the rule body, so `#Use` got the
 *    state. Now: the existing not-uss refusal — kind `unsupported-selector`, reason `not-uss`,
 *    subject `{ kind: 'states-key', key }`, the message prefix consumers read
 *    (tests/render/consumer-contract.test.ts) — and no state is set.
 */

import { beforeAll, describe, expect, it } from 'vitest';

import { loadLayoutEngine, parse, render, resolveStyles } from '../../src/index';
import type { Warning } from '../../src/index';

beforeAll(async () => {
  await loadLayoutEngine();
});

const UXML = '<ui:UXML xmlns:ui="UnityEngine.UIElements"><ui:Button name="Use" text="x" /><ui:Label name="Other" text="y" /></ui:UXML>';
const USS = '#Use:hover { color: rgb(255, 0, 0); } #Other:hover { color: rgb(0, 0, 255); }';
const doc = () => parse(UXML, USS);
const colorOf = (styles: ReadonlyMap<unknown, { get(p: string): { value: string } | undefined }>, d: ReturnType<typeof parse>, name: string) => {
  const node = d.root.children.find((c) => c.attributes.some((a) => a.name === 'name' && a.value === name))!;
  return styles.get(node.id)?.get('color')?.value;
};
const stateWarnings = (warnings: readonly Warning[]) =>
  warnings.filter((w) => w.subject?.kind === 'states-key' || /activeStates/.test(w.message));

describe('1. an unknown name in activeStates', () => {
  it('warns once per unknown name: malformed, invalid-value, no subject, the name in the message', () => {
    const d = doc();
    const r = resolveStyles(d, { activeStates: new Set(['hovr', 'hover', 'pressd']) });
    const named = (name: string) => r.warnings.filter((w) => w.message.includes(`'${name}'`) || w.message.includes(`"${name}"`));
    for (const name of ['hovr', 'pressd']) {
      const ws = named(name);
      expect(ws, name).toHaveLength(1);
      expect(ws[0]).toMatchObject({ kind: 'malformed', reason: 'invalid-value' });
      expect(ws[0]!.subject, name).toBeUndefined();
      expect(ws[0]!.message, name).toContain('activeStates');
    }
    expect(named('hover')).toEqual([]);
    expect(r.warnings.filter((w) => w.kind === 'malformed')).toHaveLength(2);
  });

  it('the unknown name is not applied; a known one still is', () => {
    const d = doc();
    const r = resolveStyles(d, { activeStates: new Set(['hovr']) });
    expect(colorOf(r.styles as never, d, 'Use')).not.toBe('rgb(255, 0, 0)');
    const known = resolveStyles(d, { activeStates: new Set(['hover']) });
    expect(colorOf(known.styles as never, d, 'Use')).toBe('rgb(255, 0, 0)');
  });

  it('only known names: no warning', () => {
    expect(stateWarnings(resolveStyles(doc(), { activeStates: new Set(['hover', 'focus']) }).warnings)).toEqual([]);
  });

  it('render() reports it once, not once per pass', () => {
    const container = document.createElement('div');
    const r = render(doc(), container, {
      size: { width: 400, height: 300 }, activeStates: new Set(['hovr']),
      measureText: (text, context) => ({ width: text.length * context.fontSize * 0.5, height: context.fontSize }),
    });
    try {
      expect(r.warnings.filter((w) => w.message.includes('hovr'))).toHaveLength(1);
    } finally {
      r.dispose();
    }
  });
});

describe('2. a states key that is not a complete USS selector', () => {
  for (const key of ['#Use { x', '#Use {', '#Use } x', '#Use; x']) {
    it(`${JSON.stringify(key)}: the not-uss refusal, and no state is set`, () => {
      const d = doc();
      const r = resolveStyles(d, { states: { [key]: ['hover'] } });
      const refused = r.warnings.filter((w) => w.subject?.kind === 'states-key');
      expect(refused).toHaveLength(1);
      expect(refused[0]).toMatchObject({ kind: 'unsupported-selector', reason: 'not-uss', subject: { kind: 'states-key', key } });
      expect(refused[0]!.subject).toEqual({ kind: 'states-key', key });
      expect(refused[0]!.message.indexOf(`states key "${key}"`)).toBe(0);
      expect(refused[0]!.message).toContain('is not a usable USS selector');
      expect(refused[0]!.at).toBeUndefined();
      expect(colorOf(r.styles as never, d, 'Use')).not.toBe('rgb(255, 0, 0)');
    });
  }

  it('complete selectors still work: "#Use", "#Use, #Other", "Button"', () => {
    for (const key of ['#Use', '#Use, #Other', 'Button']) {
      const d = doc();
      const r = resolveStyles(d, { states: { [key]: ['hover'] } });
      expect(stateWarnings(r.warnings), key).toEqual([]);
      expect(colorOf(r.styles as never, d, 'Use'), key).toBe('rgb(255, 0, 0)');
    }
    const d = doc();
    const both = resolveStyles(d, { states: { '#Use, #Other': ['hover'] } });
    expect(colorOf(both.styles as never, d, 'Other')).toBe('rgb(0, 0, 255)');
  });
});
