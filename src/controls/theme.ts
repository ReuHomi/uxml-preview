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
 * Two kinds of measurement feed this file, and the second was a long time
 * coming. Geometry comes from the coordinate dumps. `-unity-text-align` cannot:
 * where a glyph sits inside a box does not move the box, so no dump can ever
 * see it. It came from the Step 6 eye check — Unity centres a Button's label
 * and this renderer had it at the top left, which is visible the moment the two
 * screenshots sit side by side and invisible in 368 compared numbers.
 *
 * `opacity` on `:disabled` came from the same screenshots, but by sampling
 * pixels rather than looking. Unity's disabled Drop button is rgb(41,50,67);
 * the base colour rgb(58,74,104) composited at half over the footer's
 * rgb(24,26,31) is (41, 50, 67.5) — all three channels exact. That arithmetic
 * is the evidence, and it is why the value is 0.5 and not a number that merely
 * looked about right.
 *
 * Getting there took two wrong turns worth recording. First the author's
 * `Button:disabled` rule was blamed for not applying — it genuinely does not,
 * because `#DropButton` outranks it, in both engines. Then Unity was accused of
 * ranking state rules above specificity, and `state-vs-id` and `state-vs-inline`
 * refuted that: Unity answers 40 to both, exactly as this cascade already did.
 * The dimming was never about the cascade at all.
 *
 * What is deliberately absent, and why:
 *
 *   - `Label` — measured, and it has no default margin. `inherit-vs-direct`
 *     puts an explicitly-sized Label at the origin of a sized parent, and Unity
 *     reports x=0 y=0. Nothing to add is a result, not an omission.
 *   - padding, border, font — invisible to the cases we have. Every compared
 *     element is explicitly sized, and USS is border-box, so padding and border
 *     do not move the outer rectangle. They are unmeasured, so they are not here.
 *   - `Label`'s text alignment — the eye check could not separate it from the
 *     box at this size. Unmeasured, so absent.
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
export const THEME_USS = `:disabled {
  opacity: 0.5;
}

.unity-button {
  margin: 1px 3px;
  -unity-text-align: middle-center;
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
 * **Unmeasured, and reachable: nested disabled elements.**
 *
 * `enabled="false"` puts a whole subtree into `:disabled` — measured, by
 * `disabled-inherits`. The rule above therefore hands every level its own
 * `opacity: 0.5`, and CSS multiplies them, so a disabled button inside a
 * disabled panel comes out at a quarter. Unity almost certainly dims once.
 *
 * Not guessed at, because the fix has a choice inside it — dim only where
 * `enabled="false"` was written, or suppress the inherited one — and picking
 * without evidence is how the `.unity-button` selector became a hypothesis
 * nobody noticed for a day. Opacity leaves no trace in a coordinate dump, so
 * settling it needs a screenshot of a nested case. Recorded in
 * `docs/backlog.md` and visible in `visual-nested-disabled`.
 */

/**
 * Purpose:      how much width a vertical scrollbar claims, given whether it shows.
 * Ensures:      0 when the content fits — Unity hides the scroller rather than
 *               shrinking the viewport for a bar nobody can see.
 */
export function verticalScrollbarWidth(overflows: boolean): number {
  return overflows ? VERTICAL_SCROLLBAR_PX : 0;
}
