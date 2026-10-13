// @vitest-environment node
/**
 * Constants consumers used to copy, held to their sources.
 *
 * The values are typed here from outside the code — Unity's pseudo-class page
 * and the depth the template tests exercise — so a change to either export is
 * a decision someone has to make in two places, not a drift.
 */

import { describe, expect, it } from 'vitest';

import { TEMPLATE_DEPTH_LIMIT, USS_STATES } from '../../src/index';

describe('exported constants', () => {
  it('USS_STATES is Unity\'s state pseudo-classes, without :root and :selected', () => {
    expect([...USS_STATES]).toEqual(['hover', 'active', 'inactive', 'focus', 'disabled', 'enabled', 'checked']);
  });

  it('TEMPLATE_DEPTH_LIMIT is the depth the expansion stops at', () => {
    // tests/template/adversarial-regression.test.ts expands 32 and refuses 33.
    expect(TEMPLATE_DEPTH_LIMIT).toBe(32);
  });
});
