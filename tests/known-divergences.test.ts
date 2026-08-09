/**
 * KNOWN_DIVERGENCES is a stability contract: hosts key diagnostics off `id`,
 * so this pins the list itself rather than just its shape — an accidental
 * fourth entry (or a removed one) must fail here, not surface as a silent
 * behavior change for a host reading the list. `kind` is pinned per entry
 * too: which bucket an entry sits in is also part of the contract, and
 * changing it silently is itself a behavior change.
 */
import { describe, it, expect } from 'vitest';

import { KNOWN_DIVERGENCES } from '../src/index';

describe('KNOWN_DIVERGENCES', () => {
  it('has exactly the three documented entries', () => {
    expect(KNOWN_DIVERGENCES).toHaveLength(3);
  });

  it('has unique, stable ids', () => {
    const ids = KNOWN_DIVERGENCES.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([
      'text-metrics',
      'wrap-container-height',
      'yoga-percent-without-parent-size',
    ]);
  });

  it('marks the text-metrics divergence unreproducible', () => {
    const entry = KNOWN_DIVERGENCES.find((d) => d.id === 'text-metrics');
    expect(entry?.kind).toBe('unreproducible');
  });

  it('marks the wrap-container-height divergence unspecified', () => {
    const entry = KNOWN_DIVERGENCES.find((d) => d.id === 'wrap-container-height');
    expect(entry?.kind).toBe('unspecified');
  });

  it('marks the yoga-percent-without-parent-size divergence upstream', () => {
    const entry = KNOWN_DIVERGENCES.find((d) => d.id === 'yoga-percent-without-parent-size');
    expect(entry?.kind).toBe('upstream');
  });

  it('every entry has a non-empty summary and detail', () => {
    for (const entry of KNOWN_DIVERGENCES) {
      expect(entry.summary.length).toBeGreaterThan(0);
      expect(entry.detail.length).toBeGreaterThan(0);
    }
  });
});
