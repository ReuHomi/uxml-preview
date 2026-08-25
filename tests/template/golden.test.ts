// @vitest-environment node

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadLayoutEngine } from '../../src/index';
import { runCase } from '../golden/harness';
import { CASES } from './cases';

interface UnityTemplateDump {
  panel: { width: number; height: number };
  elements: Record<string, { x: number; y: number; width: number; height: number }>;
}

const UNITY = join(import.meta.dirname, 'unity');
const measured = CASES.filter((item) => item.id !== 'G3-11');
const EXPECTED_TEMPLATE_DELTAS = [
  ['G3-1', 'g31-label', 'height', 12, 15, -3],
  ['G3-2', 'g32-label#1', 'height', 12, 15, -3],
  ['G3-2', 'g32-label#2', 'height', 12, 15, -3],
  ['G3-2', 'g32-label#3', 'height', 12, 15, -3],
  ['G3-3', 'g33-label', 'height', 12, 15, -3],
  ['G3-4', 'g34-instance', 'width', 140, 145, -5],
  ['G3-4', 'g34-template-root', 'width', 140, 145, -5],
  ['G3-4', 'g34-template-root', 'height', 20, 25, -5],
  ['G3-4', 'g34-internal-label', 'width', 140, 145, -5],
  ['G3-4', 'g34-internal-label', 'height', 20, 25, -5],
  ['G3-4', 'g34-outside-label', 'x', 140, 145, -5],
  ['G3-4', 'g34-outside-label', 'width', 150, 140, 10],
  ['G3-5', 'g35-inherited-label', 'height', 18, 22, -4],
  ['G3-7', 'g37-deep-label', 'height', 12, 15, -3],
  ['G3-8', 'g38-instance', 'height', 19, 23, -4],
  ['G3-8', 'g38-template-root', 'height', 19, 23, -4],
  ['G3-8', 'g38-label', 'height', 19, 23, -4],
  ['G3-9', 'g39-duplicate#1', 'height', 12, 15, -3],
  ['G3-9', 'g39-duplicate#2', 'y', 12, 15, -3],
  ['G3-9', 'g39-duplicate#2', 'height', 12, 15, -3],
] as const;
const KNOWN_TEXT_METRIC_DIVERGENCES = new Set(
  EXPECTED_TEMPLATE_DELTAS.map(([caseId, element, field]) => `${caseId}/${element}/${field}`),
);

beforeAll(async () => {
  await loadLayoutEngine();
});

describe('template expansion against Unity 6000.0.40f1', () => {
  it('makes the G3-10 package probe non-vacuous on the preview side', () => {
    const fixture = CASES.find((item) => item.id === 'G3-10')!;
    const ours = runCase({
      name: fixture.id,
      question: fixture.question,
      uxml: fixture.uxml,
      uss: fixture.uss,
      ...(fixture.files === undefined ? {} : { files: fixture.files }),
    });
    expect(ours.elements['g310-package-root']).toBeDefined();
    expect(ours.elements['g310-package-child']).toBeDefined();
    expect(ours.warnings.some((warning) => warning.includes('template-src-unresolved'))).toBe(false);
  });

  for (const fixture of measured) {
    it(`${fixture.id} — ${fixture.question}`, () => {
      const unity = JSON.parse(
        readFileSync(join(UNITY, `${fixture.id}.json`), 'utf8'),
      ) as UnityTemplateDump;
      const ours = runCase(
        {
          name: fixture.id,
          question: fixture.question,
          uxml: fixture.uxml,
          uss: fixture.uss,
          ...(fixture.files === undefined ? {} : { files: fixture.files }),
        },
        unity.panel,
      );
      const mismatches: string[] = [];
      const observedKnown = new Set<string>();
      expect(ours.warnings.some((warning) => warning.includes('<TemplateContainer>'))).toBe(false);
      for (const [name, expected] of Object.entries(unity.elements)) {
        // Slots are deliberately unsupported: Unity places this child, while
        // the preview omits it and emits template-slot-unsupported.
        if (fixture.id === 'G3-12' && name === 'slot-content') continue;
        const actual = ours.elements[name];
        if (actual === undefined) {
          mismatches.push(`${name}: missing`);
          continue;
        }
        for (const field of ['x', 'y', 'width', 'height'] as const) {
          if (Math.abs(actual[field] - expected[field]) > 1) {
            const key = `${fixture.id}/${name}/${field}`;
            if (KNOWN_TEXT_METRIC_DIVERGENCES.has(key)) observedKnown.add(key);
            else mismatches.push(`${name}.${field}: ours ${actual[field]}, Unity ${expected[field]}`);
          }
        }
      }
      expect(mismatches, mismatches.join('\n')).toEqual([]);
      const expectedKnown = [...KNOWN_TEXT_METRIC_DIVERGENCES].filter((key) =>
        key.startsWith(`${fixture.id}/`),
      );
      expect([...observedKnown].sort(), 'remove stale known text-metric divergences').toEqual(
        expectedKnown.sort(),
      );
    });
  }

  it('keeps the separate template accuracy figures in docs honest', () => {
    let elements = 0;
    let values = 0;
    let mismatches = 0;
    const actualDeltas: Array<readonly [string, string, string, number, number, number]> = [];
    const onePixelDeltas: string[] = [];
    const vacuousMatches: string[] = [];
    for (const fixture of measured) {
      const unity = JSON.parse(
        readFileSync(join(UNITY, `${fixture.id}.json`), 'utf8'),
      ) as UnityTemplateDump;
      const ours = runCase(
        {
          name: fixture.id,
          question: fixture.question,
          uxml: fixture.uxml,
          uss: fixture.uss,
          ...(fixture.files === undefined ? {} : { files: fixture.files }),
        },
        unity.panel,
      );
      for (const [name, expected] of Object.entries(unity.elements)) {
        if (fixture.id === 'G3-12' && name === 'slot-content') continue;
        elements++;
        const actual = ours.elements[name]!;
        if (
          (actual.width === 0 || actual.height === 0) &&
          (expected.width === 0 || expected.height === 0)
        ) vacuousMatches.push(`${fixture.id}/${name}`);
        for (const field of ['x', 'y', 'width', 'height'] as const) {
          values++;
          const delta = actual[field] - expected[field];
          if (delta === 0) continue;
          if (Math.abs(delta) <= 1) onePixelDeltas.push(`${fixture.id}/${name}/${field}`);
          else {
            mismatches++;
            actualDeltas.push([fixture.id, name, field, actual[field], expected[field], delta]);
          }
        }
      }
    }
    expect({ matching: values - mismatches, values, elements, cases: measured.length }).toEqual({
      matching: 200,
      values: 220,
      elements: 55,
      cases: 11,
    });
    expect(actualDeltas).toEqual(EXPECTED_TEMPLATE_DELTAS);
    expect(onePixelDeltas, 'classification (b) must be measured, not assumed').toEqual([]);
    expect(vacuousMatches, 'a zero-size match cannot enter the accuracy numerator').toEqual([]);
    for (const path of ['docs/accuracy.md', 'docs/accuracy.en.md']) {
      const doc = readFileSync(join(process.cwd(), path), 'utf8');
      expect(doc, path).toContain('200 / 220');
      expect(doc, path).toContain('55 elements');
      expect(doc, path).toContain('11 / 11');
      for (const [caseId, element, field, ours, unity, delta] of EXPECTED_TEMPLATE_DELTAS) {
        expect(doc, `${path}: ${caseId}/${element}/${field}`).toContain(
          `| \`${caseId}\` | \`${element}\` | ${field} | ${ours} | ${unity} | ${delta} |`,
        );
      }
    }
  });
});
