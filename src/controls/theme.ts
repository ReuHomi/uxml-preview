/**
 * Unity's control defaults, as far as we have measured them.
 *
 * Unity supplies control spacing before author USS runs; omitting it once put
 * every Button 3px left and 1px high, compounding across a row. Only measured
 * values live here. Values copied from Unity's source could look just as
 * authoritative while being wrong without appearing in the unmeasured list.
 *
 * There are two measured themes: editor in an EditorWindow on 6000.0.40f1
 * (tests/layout/unity/6000.0.40f1/probe-editor-070/), runtime on a real runtime
 * panel on 6000.3.25f1 (tests/layout/unity/6000.3.25f1/probe-panel/), with
 * identical runtime values on 6000.0.40f1. Geometry comes from coordinate dumps.
 * `-unity-text-align` came from the Step 6 eye check: a glyph's position inside
 * its box does not move the box, so 368 matching coordinates could not reveal
 * that Unity centred Button text while this renderer put it at the top left.
 *
 * Opacity 0.5 was established by pixel arithmetic: Unity's disabled Drop button
 * is rgb(41,50,67); its base rgb(58,74,104) composited at half over the footer's
 * rgb(24,26,31) gives (41,50,67.5). It is measured, not chosen by appearance.
 * `nested-disabled` now places it on `.unity-disabled`, which Unity adds only
 * where enabled="false" was written. This replaces the earlier `:disabled`
 * rule that applied half opacity at every disabled level and dimmed twice.
 *
 * Two wrong turns preceded that result. The author's `Button:disabled` rule
 * was first blamed for not applying, but `#DropButton` outranks it in both
 * engines. Then state rules were thought to outrank specificity; `state-vs-id`
 * and `state-vs-inline` both returned 40 in Unity, refuting that explanation.
 * The dimming was never a cascade defect.
 *
 * Earlier omissions, superseded by c07-existing and c07-states:
 * - "Label has nothing" described only its measured editor margin; Label and
 *   Button spacing and flex-shrink are now measured for both themes.
 * - "Padding, border, font deliberately absent" is superseded by measured
 *   padding, borders, colours and font size; Label text alignment stays absent.
 *
 * Class hooks are a separate claim from values: margin dumps proved spacing,
 * not the selector delivering it. `unity-button` began with the documented
 * Button.ussClassName; `theme-class-hook` then confirmed on 2026-08-05 that
 * author `.unity-button` reaches a bare <ui:Button>, sizing it 120×40 in Unity
 * and this renderer. The hook is measured, not assumed.
 */

export type Theme = 'runtime' | 'editor';

export const DEFAULT_THEME: Theme = 'runtime';

/** Unity version used to measure the editor theme. */
export const THEME_UNITY_VERSION: string = '6000.0.40f1';

/** Unity measurement version for each theme. */
export const THEME_UNITY_VERSIONS: Readonly<Record<Theme, string>> = {
  editor: THEME_UNITY_VERSION,
  runtime: '6000.3.25f1',
};

/** Panel defaults inherited by the rendered elements. */
export const PANEL_TEXT_DEFAULTS_SELECTOR = 'UXML';

/**
 * Editor theme stylesheet; kept as the legacy editor-sheet export.
 * Parsed once and spliced in ahead of author sheets, so equal specificity lets
 * author rules win on order, as in Unity. Class selectors also preserve Unity's
 * specificity: `.unity-button` (0,1,0) beats an author `Button {}` (0,0,1).
 */
export const THEME_USS: string = `${PANEL_TEXT_DEFAULTS_SELECTOR} {
  font-size: 12px;
  color: #d2d2d2;
}
.unity-disabled { opacity: 0.5; }
.unity-label {
  margin: 0;
  padding: 0 2px 0 1px;
  flex-shrink: 0;
}
.unity-button {
  margin: 1px 3px;
  padding: 1px 6px;
  border-width: 1px;
  border-radius: 3px;
  background-color: #585858;
  color: #eeeeee;
  border-color: #303030;
  border-bottom-color: #242424;
  -unity-text-align: middle-center;
  flex-shrink: 0;
}
.unity-button:hover { background-color: #676767; }
.unity-button:hover:active {
  background-color: #46607c;
  border-color: #242424;
  border-top-color: #0d0d0d;
}
.unity-button:focus { border-color: #7baefa; }
`;

// probe-panel/*.json: Standard on both 6000.0.40f1 and 6000.3.25f1.
// Editor probe-editor-070/*.json changes Standard -> Advanced; retain the 6.3 default.
export const THEME_SHEETS: Readonly<Record<Theme, string>> = {
  editor: THEME_USS,
  runtime: `${PANEL_TEXT_DEFAULTS_SELECTOR} {
  font-size: 14px;
  color: #1b1b1b;
  -unity-text-generator: standard;
}
.unity-disabled { opacity: 0.5; }
.unity-label {
  margin: 4px 4px 2px 2px;
  padding: 4px 2px 4px 1px;
  flex-shrink: 0;
}
.unity-button {
  margin: 2px 4px;
  padding: 10px 12px;
  border-width: 1px;
  border-radius: 0;
  background-color: #bcbcbc;
  color: #1b1b1b;
  border-color: #959595;
  -unity-text-align: middle-center;
  flex-shrink: 0;
}
.unity-button:hover {
  background-color: #d1d1d1;
  border-color: #808080;
}
.unity-button:hover:active {
  background-color: #959595;
  border-color: #646464;
}
.unity-button:focus { border-color: #006aa6; }
.unity-button:disabled {
  background-color: #959595;
  border-color: #7e7e7e;
}
`,
};

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
// scrollview-overflowing: editor viewport 187/200px, runtime viewport 176/200px.
const VERTICAL_SCROLLBAR_PX: Readonly<Record<Theme, number>> = { editor: 13, runtime: 24 };

// nested-disabled.json (both themes/versions): only the element with its own
// enabled="false" carries unity-disabled and opacity 0.5. Descendants retain
// :disabled for control colours, but resolve opacity 1 unless disabled directly.

/**
 * Purpose:      how much width a vertical scrollbar claims, given whether it shows.
 * Ensures:      0 when the content fits — Unity hides the scroller rather than
 *               shrinking the viewport for a bar nobody can see.
 */
export function verticalScrollbarWidth(overflows: boolean, theme: Theme = DEFAULT_THEME): number {
  return overflows ? VERTICAL_SCROLLBAR_PX[theme] : 0;
}
