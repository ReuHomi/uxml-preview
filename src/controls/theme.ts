/**
 * Unity's control defaults, as far as we have measured them.
 *
 * Unity ships a theme stylesheet that gives controls their own margin, padding
 * and border before any author USS runs. This renderer supplied none of it, so
 * every Button sat 3px left and 1px high of where Unity puts it — invisible on
 * one button and compounding across a row.
 *
 * **Only measured values live here.** Every declaration below was derived from
 * a Unity layout dump in tests/golden/unity/, and adding `Button`'s margin
 * moved all five Button cases from 18 mismatched values to zero. Values read
 * from Unity's source instead would look identical in this file while being
 * wrong in a way no test could see: they would not appear in the unmeasured
 * list, so they would quietly pass for ground truth.
 *
 * What is deliberately absent, and why:
 *
 *   - `Label` — measured, and it has no default margin. `inherit-vs-direct`
 *     puts an explicitly-sized Label at the origin of a sized parent, and Unity
 *     reports x=0 y=0. Nothing to add is a result, not an omission.
 *   - padding, border, font — invisible to the cases we have. Every compared
 *     element is explicitly sized, and USS is border-box, so padding and border
 *     do not move the outer rectangle. They are unmeasured, so they are not here.
 *
 * Class names are a different kind of claim from the values. `unity-button` is
 * Unity's documented `Button.ussClassName`, not something our dumps prove, and
 * the selector matters because it decides which author rules win. The golden
 * case `theme-class-hook` exists to settle it: its USS targets `.unity-button`
 * directly, so the next Unity dump either confirms the class reaches the
 * element or shows it does not.
 */

/** Where every value in this file was measured. Theme values move between versions. */
export const THEME_UNITY_VERSION = '6000.0.40f1';

/**
 * Parsed once and spliced in ahead of author sheets, so an author rule of equal
 * specificity wins on order — which is how a theme stylesheet behaves in Unity.
 *
 * Class selectors rather than type selectors, also for Unity's reasons: a theme
 * rule at `.unity-button` (0,1,0) beats an author's `Button { }` (0,0,1), and
 * that is a real Unity gotcha worth reproducing rather than smoothing over.
 */
export const THEME_USS = `.unity-button {
  margin: 1px 3px;
}
`;
