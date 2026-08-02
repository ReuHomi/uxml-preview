/**
 * Selector specificity.
 *
 * USS orders selectors the way CSS does — `#name` beats `.class` beats a type
 * name — and breaks ties by source order, with the later rule winning. That
 * ordering is documented; the exact counting rule (a triple, summed over the
 * whole complex selector, pseudo-classes counted as classes) is inferred from
 * it and has not been checked against a running editor. If a golden test in
 * Phase 5 disagrees about a tie, look here first.
 */

import type { Selector } from '../model/types';

/** `[#name, .class + :pseudo, Type]`, compared left to right. */
export type Specificity = readonly [number, number, number];

export function specificityOf(selector: Selector): Specificity {
  let names = 0;
  let classes = 0;
  let types = 0;

  for (const part of selector.parts) {
    for (const simple of part.simple) {
      switch (simple.kind) {
        case 'name':
          names++;
          break;
        case 'class':
        case 'pseudo':
          classes++;
          break;
        case 'type':
          types++;
          break;
        case 'universal':
        case 'unknown':
          // `*` adds nothing; `unknown` never reaches a match at all.
          break;
      }
    }
  }
  return [names, classes, types];
}

/** Negative when `a` loses to `b`, positive when it wins, 0 on a tie. */
export function compareSpecificity(a: Specificity, b: Specificity): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}
