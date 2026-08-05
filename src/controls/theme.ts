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
 * The class names were a separate claim from the values, and are now measured
 * too. `unity-button` came from Unity's documented `Button.ussClassName`, which
 * the margin dumps said nothing about — they proved the spacing, not the
 * selector delivering it. The golden case `theme-class-hook` was written to
 * settle exactly that, and Unity answered on 2026-08-05: a `.unity-button` rule
 * in author USS reaches a bare `<ui:Button>`, sizing it 120×40 in both engines.
 * The selector below is therefore measured, not assumed.
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

/**
 * Width a visible vertical scrollbar takes from a ScrollView's viewport, in px.
 *
 * Measured, like everything else here: `scrollview-overflowing` has a 200px
 * ScrollView whose viewport comes back 187 wide once the content overflows.
 *
 * **It is conditional, and that is the part worth guarding.** When the content
 * fits, Unity reports the scroller as 0×0 and the viewport keeps the full 200 —
 * `scrollview-hierarchy` measures exactly that. A renderer that subtracted this
 * unconditionally would be wrong on every ScrollView that does not scroll,
 * which on a real screen is most of them. Read it through
 * `verticalScrollbarWidth`, never as a bare constant.
 */
const VERTICAL_SCROLLBAR_PX = 13;

/**
 * Purpose:      how much width a vertical scrollbar claims, given whether it shows.
 * Ensures:      0 when the content fits — Unity hides the scroller rather than
 *               shrinking the viewport for a bar nobody can see.
 */
export function verticalScrollbarWidth(overflows: boolean): number {
  return overflows ? VERTICAL_SCROLLBAR_PX : 0;
}
