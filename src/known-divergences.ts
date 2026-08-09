/**
 * Differences from Unity that measurement has confirmed and that fixing the
 * renderer cannot close. `docs/accuracy.md` describes 16 divergent values;
 * all but one class of them are listed below.
 *
 * The 1px cases (3 values) are excluded on purpose: they sit inside the
 * golden tests' own 0.5px-tighter-than-plan tolerance. That is a test
 * judgement parameter, not a rendering limitation — listing it here would
 * tell a host to worry about a difference the renderer did not actually make.
 *
 * If a fourth category is ever promoted here, extend this list and the
 * pinned entry count in tests/known-divergences.test.ts together — do not
 * let the list grow silently, since `id` is a contract hosts key off.
 */
export interface KnownDivergence {
  /** Stable identifier. Hosts may key off this; do not rename. */
  readonly id: string;
  /**
   * Why this cannot simply be fixed.
   *
   * 'unreproducible' — the difference comes from something we cannot
   *   reproduce at all, such as font metrics that move with the platform.
   * 'unspecified'    — Unity's own rule for this case is not specified,
   *   so there is no target to match yet.
   * 'upstream'       — the difference is fully reproducible and deterministic,
   *   but it lives in something this renderer depends on rather than in this
   *   renderer's own code — the place that would need to change is not this
   *   repository.
   */
  readonly kind: 'unreproducible' | 'unspecified' | 'upstream';
  /** One line, for a diagnostics list. */
  readonly summary: string;
  /** What is different and why, for someone deciding whether to care. */
  readonly detail: string;
}

export const KNOWN_DIVERGENCES: readonly KnownDivergence[] = [
  {
    id: 'text-metrics',
    kind: 'unreproducible',
    summary: 'Text-dependent layout can be a few pixels off Unity.',
    detail:
      'A browser measures text with its own font stack; Unity measures with its ' +
      "font asset. Both engines apply the same layout rule, so this is not a " +
      "layout defect — it is measured in docs/accuracy.md at 10 of 16 known " +
      'divergent values, all traced to this one cause.',
  },
  {
    id: 'wrap-container-height',
    kind: 'unspecified',
    summary: "A wrapping container's height can differ from Unity.",
    detail:
      "Unity's own rule for sizing a container whose children wrap is not yet " +
      'identified, so there is no confirmed target to match. Tracked in ' +
      'docs/accuracy.md as the one unresolved divergence.',
  },
  {
    id: 'yoga-percent-without-parent-size',
    kind: 'upstream',
    summary: 'A main-axis percentage against an unsized parent can resolve differently.',
    detail:
      'The yoga-layout version this package depends on resolves a main-axis ' +
      "percentage against an indefinite parent differently from the Yoga " +
      "vendored inside Unity 6000.0.40f1. Not configurable: no available " +
      "setting reproduces Unity's answer without breaking cases that currently " +
      'match. Fully deterministic and pinned to a case in docs/accuracy.md — ' +
      'this always reproduces the same way, it just cannot be fixed from ' +
      'inside this repository.',
  },
];
