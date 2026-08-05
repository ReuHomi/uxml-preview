/**
 * The golden case set.
 *
 * One module rather than eighty files, so a case cannot drift between the copy
 * the tests read and the copy Unity reads. `pnpm golden:emit` writes these out
 * as real .uxml/.uss under tests/golden/cases/ for loading into Unity.
 *
 * Cases use explicit sizes almost everywhere on purpose. Unity's font metrics
 * are not the browser's, so anything measured from text would compare font
 * choice rather than the USS-to-Yoga mapping this set exists to check. The two
 * cases that do measure text are flagged and reported separately.
 *
 * Every element carries a `name`, because that is the key the Unity dump joins
 * on. Unnamed elements cannot be compared.
 */

export interface GoldenCase {
  name: string;
  /** What the case is meant to settle. Shows up in docs/accuracy.md. */
  question: string;
  uxml: string;
  uss: string;
  /** Layout depends on text measurement, so Unity will not agree exactly. */
  measuresText?: boolean;
}

const wrap = (body: string): string =>
  `<ui:UXML xmlns:ui="UnityEngine.UIElements">\n${body}\n</ui:UXML>\n`;

export const PANEL = { width: 400, height: 300 };

export const CASES: GoldenCase[] = [
  // --- failure patterns, highest priority --------------------------------
  {
    name: 'default-direction',
    question: 'Is flex-direction column when nothing declares it?',
    uxml: wrap(
      '  <ui:VisualElement name="a" />\n' +
        '  <ui:VisualElement name="b" />\n' +
        '  <ui:VisualElement name="c" />',
    ),
    uss: '#a, #b, #c {\n  width: 60px;\n  height: 40px;\n}\n',
  },
  {
    name: 'sibling-overlap',
    question: 'Do later siblings sit on top, with no z-index anywhere?',
    uxml: wrap(
      '  <ui:VisualElement name="under" />\n' + '  <ui:VisualElement name="over" />',
    ),
    uss:
      '#under, #over {\n  position: absolute;\n  width: 80px;\n  height: 80px;\n}\n' +
      '#under {\n  left: 20px;\n  top: 20px;\n  background-color: rgb(200, 60, 60);\n}\n' +
      '#over {\n  left: 60px;\n  top: 60px;\n  background-color: rgb(60, 120, 200);\n}\n',
  },
  {
    name: 'percent-without-parent-size',
    // Settled, and the one case that does not match. Unity answers 0 on both
    // axes, so CLAUDE.md's flat rule is right and it is this renderer that is
    // wrong: yoga-layout 3.2.1 resolves a main-axis percentage against an
    // indefinite parent, and the Yoga inside UI Toolkit does not. Left as-is
    // rather than corrected by hand, because correcting it means reimplementing
    // layout. See KNOWN_DIVERGENCES in golden.test.ts and docs/accuracy.md.
    question:
      'Does a percentage resolve when the parent has no explicit size? (Unity: no, on both axes)',
    uxml: wrap(
      '  <ui:VisualElement name="sized">\n' +
        '    <ui:VisualElement name="pct-in-sized" />\n' +
        '  </ui:VisualElement>\n' +
        '  <ui:VisualElement name="unsized">\n' +
        '    <ui:VisualElement name="pct-in-unsized" />\n' +
        '  </ui:VisualElement>',
    ),
    uss:
      '#sized {\n  width: 200px;\n  height: 100px;\n}\n' +
      '#unsized {\n  align-self: flex-start;\n}\n' +
      '#pct-in-sized, #pct-in-unsized {\n  width: 50%;\n  height: 50%;\n}\n',
  },
  {
    name: 'no-margin-collapse',
    question: 'Are adjacent margins added rather than collapsed?',
    uxml: wrap(
      '  <ui:VisualElement name="top" />\n' + '  <ui:VisualElement name="bottom" />',
    ),
    uss:
      '#top {\n  height: 40px;\n  margin-bottom: 20px;\n}\n' +
      '#bottom {\n  height: 40px;\n  margin-top: 30px;\n}\n',
  },

  // --- layout basics ------------------------------------------------------
  {
    name: 'direction-row',
    question: 'Does flex-direction: row lay out along x?',
    uxml: wrap(
      '  <ui:VisualElement name="row">\n' +
        '    <ui:VisualElement name="r1" />\n' +
        '    <ui:VisualElement name="r2" />\n' +
        '  </ui:VisualElement>',
    ),
    uss:
      '#row {\n  flex-direction: row;\n  height: 50px;\n}\n' +
      '#r1, #r2 {\n  width: 70px;\n}\n',
  },
  {
    name: 'direction-reverse',
    question: 'Do the reverse directions start from the far edge?',
    uxml: wrap(
      '  <ui:VisualElement name="col">\n' +
        '    <ui:VisualElement name="c1" />\n' +
        '    <ui:VisualElement name="c2" />\n' +
        '  </ui:VisualElement>',
    ),
    uss:
      '#col {\n  flex-direction: column-reverse;\n  height: 200px;\n}\n' +
      '#c1, #c2 {\n  height: 40px;\n}\n',
  },
  {
    name: 'justify-content',
    question: 'Where does each justify-content value put the children?',
    uxml: wrap(
      '  <ui:VisualElement name="start"><ui:VisualElement name="s1" /></ui:VisualElement>\n' +
        '  <ui:VisualElement name="center"><ui:VisualElement name="m1" /></ui:VisualElement>\n' +
        '  <ui:VisualElement name="end"><ui:VisualElement name="e1" /></ui:VisualElement>\n' +
        '  <ui:VisualElement name="between">\n' +
        '    <ui:VisualElement name="b1" />\n' +
        '    <ui:VisualElement name="b2" />\n' +
        '  </ui:VisualElement>',
    ),
    uss:
      '#start, #center, #end, #between {\n  flex-direction: row;\n  height: 60px;\n}\n' +
      '#start {\n  justify-content: flex-start;\n}\n' +
      '#center {\n  justify-content: center;\n}\n' +
      '#end {\n  justify-content: flex-end;\n}\n' +
      '#between {\n  justify-content: space-between;\n}\n' +
      '#s1, #m1, #e1, #b1, #b2 {\n  width: 50px;\n  height: 20px;\n}\n',
  },
  {
    name: 'align-items',
    question: 'Where does each align-items value put the children on the cross axis?',
    uxml: wrap(
      '  <ui:VisualElement name="stretch"><ui:VisualElement name="s1" /></ui:VisualElement>\n' +
        '  <ui:VisualElement name="center"><ui:VisualElement name="m1" /></ui:VisualElement>\n' +
        '  <ui:VisualElement name="end"><ui:VisualElement name="e1" /></ui:VisualElement>',
    ),
    uss:
      '#stretch, #center, #end {\n  height: 60px;\n}\n' +
      '#stretch {\n  align-items: stretch;\n}\n' +
      '#center {\n  align-items: center;\n}\n' +
      '#end {\n  align-items: flex-end;\n}\n' +
      '#s1, #m1, #e1 {\n  height: 20px;\n  width: 80px;\n}\n',
  },
  {
    name: 'flex-wrap',
    question: 'Where does the second line start when children wrap?',
    uxml: wrap(
      '  <ui:VisualElement name="wrap">\n' +
        '    <ui:VisualElement name="w1" />\n' +
        '    <ui:VisualElement name="w2" />\n' +
        '    <ui:VisualElement name="w3" />\n' +
        '  </ui:VisualElement>',
    ),
    uss:
      '#wrap {\n  flex-direction: row;\n  flex-wrap: wrap;\n  width: 300px;\n  height: 200px;\n}\n' +
      '#w1, #w2, #w3 {\n  width: 160px;\n  height: 50px;\n}\n',
  },

  // --- sizing -------------------------------------------------------------
  {
    name: 'flex-grow-shrink',
    question: 'How is free space shared, and is flex-shrink 1 or 0 by default?',
    uxml: wrap(
      '  <ui:VisualElement name="grow">\n' +
        '    <ui:VisualElement name="g1" />\n' +
        '    <ui:VisualElement name="g2" />\n' +
        '  </ui:VisualElement>\n' +
        '  <ui:VisualElement name="shrink">\n' +
        '    <ui:VisualElement name="k1" />\n' +
        '    <ui:VisualElement name="k2" />\n' +
        '  </ui:VisualElement>',
    ),
    uss:
      '#grow, #shrink {\n  flex-direction: row;\n  width: 200px;\n  height: 60px;\n}\n' +
      '#g1 {\n  flex-grow: 1;\n}\n' +
      '#g2 {\n  flex-grow: 3;\n}\n' +
      // Both children want 150px inside a 200px row. Whether they shrink is
      // exactly the flex-shrink default this case exists to settle.
      '#k1, #k2 {\n  width: 150px;\n}\n',
  },
  {
    name: 'min-max-conflict',
    question: 'Which wins when width, min-width and max-width disagree?',
    uxml: wrap(
      '  <ui:VisualElement name="over-max" />\n' +
        '  <ui:VisualElement name="under-min" />\n' +
        '  <ui:VisualElement name="min-beats-max" />',
    ),
    uss:
      '#over-max {\n  width: 300px;\n  max-width: 100px;\n  height: 30px;\n}\n' +
      '#under-min {\n  width: 20px;\n  min-width: 120px;\n  height: 30px;\n}\n' +
      '#min-beats-max {\n  width: 50px;\n  min-width: 200px;\n  max-width: 100px;\n  height: 30px;\n}\n',
  },

  // --- box model ----------------------------------------------------------
  {
    name: 'border-box',
    question: 'Does width include padding and border?',
    uxml: wrap(
      '  <ui:VisualElement name="outer">\n' +
        '    <ui:VisualElement name="inner" />\n' +
        '  </ui:VisualElement>',
    ),
    uss:
      '#outer {\n  width: 200px;\n  height: 120px;\n  padding: 20px;\n' +
      '  border-top-width: 10px;\n  border-right-width: 10px;\n' +
      '  border-bottom-width: 10px;\n  border-left-width: 10px;\n}\n' +
      '#inner {\n  height: 30px;\n}\n',
  },

  // --- position -----------------------------------------------------------
  {
    name: 'absolute-offsets',
    question: 'Where do top/left/right/bottom put an absolute element?',
    uxml: wrap(
      '  <ui:VisualElement name="frame">\n' +
        '    <ui:VisualElement name="tl" />\n' +
        '    <ui:VisualElement name="br" />\n' +
        '    <ui:VisualElement name="stretched" />\n' +
        '  </ui:VisualElement>',
    ),
    uss:
      '#frame {\n  width: 200px;\n  height: 200px;\n}\n' +
      '#tl {\n  position: absolute;\n  left: 10px;\n  top: 10px;\n  width: 40px;\n  height: 40px;\n}\n' +
      '#br {\n  position: absolute;\n  right: 10px;\n  bottom: 10px;\n  width: 40px;\n  height: 40px;\n}\n' +
      '#stretched {\n  position: absolute;\n  left: 20px;\n  right: 20px;\n  top: 80px;\n  height: 30px;\n}\n',
  },
  {
    name: 'nested-absolute',
    question: 'Does an absolute child position against its absolute parent?',
    uxml: wrap(
      '  <ui:VisualElement name="p">\n' +
        '    <ui:VisualElement name="c">\n' +
        '      <ui:VisualElement name="gc" />\n' +
        '    </ui:VisualElement>\n' +
        '  </ui:VisualElement>',
    ),
    uss:
      '#p {\n  position: absolute;\n  left: 30px;\n  top: 30px;\n  width: 200px;\n  height: 200px;\n}\n' +
      '#c {\n  position: absolute;\n  left: 20px;\n  top: 20px;\n  width: 100px;\n  height: 100px;\n}\n' +
      '#gc {\n  position: absolute;\n  left: 10px;\n  top: 10px;\n  width: 30px;\n  height: 30px;\n}\n',
  },
  {
    name: 'padding-and-position',
    question: "Is an absolute child placed inside the parent's padding box?",
    uxml: wrap(
      '  <ui:VisualElement name="padded">\n' +
        '    <ui:VisualElement name="abs" />\n' +
        '    <ui:VisualElement name="flow" />\n' +
        '  </ui:VisualElement>',
    ),
    uss:
      '#padded {\n  width: 200px;\n  height: 200px;\n  padding: 25px;\n}\n' +
      '#abs {\n  position: absolute;\n  left: 0;\n  top: 0;\n  width: 40px;\n  height: 40px;\n}\n' +
      '#flow {\n  height: 40px;\n}\n',
  },

  // --- cascade ------------------------------------------------------------
  {
    name: 'specificity-tie',
    question: 'On a tie, does the later rule win?',
    uxml: wrap('  <ui:VisualElement name="tied" class="first second" />'),
    uss:
      '.first {\n  width: 100px;\n  height: 40px;\n}\n' +
      '.second {\n  width: 200px;\n}\n',
  },
  {
    name: 'inherit-vs-direct',
    question: 'Does a weak direct match still beat an inherited value?',
    uxml: wrap(
      '  <ui:VisualElement name="parent">\n' +
        '    <ui:Label name="child" text="x" />\n' +
        '  </ui:VisualElement>',
    ),
    uss:
      '#parent {\n  font-size: 30px;\n  width: 200px;\n  height: 100px;\n}\n' +
      '* {\n  font-size: 10px;\n}\n' +
      '#child {\n  width: 50px;\n  height: 50px;\n}\n',
  },
  {
    name: 'inline-override',
    question: 'Does an inline style beat a #name rule?',
    uxml: wrap('  <ui:VisualElement name="target" style="width: 150px;" />'),
    uss: '#target {\n  width: 60px;\n  height: 40px;\n}\n',
  },

  // --- text, measured -----------------------------------------------------
  {
    name: 'text-size',
    question: 'How large is a label that sizes itself to its text?',
    measuresText: true,
    uxml: wrap(
      '  <ui:VisualElement name="holder">\n' +
        '    <ui:Label name="label" text="Inventory" />\n' +
        '  </ui:VisualElement>',
    ),
    uss:
      '#holder {\n  align-items: flex-start;\n  width: 300px;\n  height: 100px;\n}\n' +
      '#label {\n  font-size: 20px;\n}\n',
  },
  {
    name: 'text-align',
    question: 'Where does -unity-text-align put text inside a fixed box?',
    measuresText: true,
    uxml: wrap(
      '  <ui:Label name="upper-left" text="A" />\n' +
        '  <ui:Label name="middle-center" text="B" />\n' +
        '  <ui:Label name="lower-right" text="C" />',
    ),
    uss:
      '#upper-left, #middle-center, #lower-right {\n  width: 120px;\n  height: 60px;\n  font-size: 16px;\n}\n' +
      '#upper-left {\n  -unity-text-align: upper-left;\n}\n' +
      '#middle-center {\n  -unity-text-align: middle-center;\n}\n' +
      '#lower-right {\n  -unity-text-align: lower-right;\n}\n',
  },

  // --- Button, which has zero golden cases otherwise -----------------------
  //
  // What these can and cannot settle, established by mutation:
  //
  // Against *this* renderer the explicitly-sized ones are near-redundant. Make
  // Button stop drawing its own text and only `button-sizes-to-text` notices;
  // break border-box and `button-border-box` and `button-absolute-in-border`
  // notice, but so do four VisualElement cases that already existed. Sized like
  // this, our Button and our VisualElement are the same code path.
  //
  // Their value is in the Unity comparison, and it is a specific suspicion:
  // Unity's default theme USS gives Button its own margin, padding and border,
  // and this renderer applies none of them. If that is so, these cases fail on
  // first contact with a Unity dump — which is the point of adding them.
  // Until that dump exists they are drift detection and nothing more.
  //
  // In Unity, Button derives from TextElement: it draws its own text and has
  // no child element of its own. Every case below gives width/height (or a
  // sized parent) explicitly so the layout does not depend on FIXED_MEASURE,
  // per the header note above. `text` is set on each Button for realism only
  // — it never drives geometry here because no dimension is left for Yoga to
  // measure.
  {
    name: 'button-border-box',
    question: 'Does a Button (a TextElement, not a VisualElement) still size border-box?',
    uxml: wrap('  <ui:Button name="button-border-box-btn" text="OK" />'),
    uss:
      '#button-border-box-btn {\n  width: 160px;\n  height: 80px;\n  padding: 20px;\n' +
      '  border-top-width: 10px;\n  border-right-width: 10px;\n' +
      '  border-bottom-width: 10px;\n  border-left-width: 10px;\n}\n',
  },
  {
    name: 'button-row-margins',
    question: 'Do margins between Buttons in a row add up the same way as between VisualElements?',
    uxml: wrap(
      '  <ui:VisualElement name="button-row-margins-row">\n' +
        '    <ui:Button name="button-row-margins-a" text="A" />\n' +
        '    <ui:Button name="button-row-margins-b" text="B" />\n' +
        '    <ui:Button name="button-row-margins-c" text="C" />\n' +
        '  </ui:VisualElement>',
    ),
    uss:
      '#button-row-margins-row {\n  flex-direction: row;\n  width: 400px;\n  height: 50px;\n}\n' +
      '#button-row-margins-a, #button-row-margins-b, #button-row-margins-c {\n' +
      '  width: 80px;\n  height: 40px;\n}\n' +
      '#button-row-margins-a, #button-row-margins-b {\n  margin-right: 10px;\n}\n',
  },
  {
    name: 'button-flex-grow',
    question: 'Does flex-grow expand a Button to fill remaining row space the same as a VisualElement?',
    uxml: wrap(
      '  <ui:VisualElement name="button-flex-grow-row">\n' +
        '    <ui:Button name="button-flex-grow-fixed" text="Fixed" />\n' +
        '    <ui:Button name="button-flex-grow-grow" text="Grow" />\n' +
        '  </ui:VisualElement>',
    ),
    uss:
      '#button-flex-grow-row {\n  flex-direction: row;\n  width: 300px;\n  height: 50px;\n}\n' +
      '#button-flex-grow-fixed {\n  width: 100px;\n}\n' +
      '#button-flex-grow-grow {\n  flex-grow: 1;\n}\n',
  },
  {
    name: 'button-absolute-in-border',
    question:
      "Does an absolutely positioned Button sit inside its bordered parent's border box, " +
      'the same as a VisualElement child would?',
    uxml: wrap(
      '  <ui:VisualElement name="button-absolute-in-border-frame">\n' +
        '    <ui:Button name="button-absolute-in-border-btn" text="X" />\n' +
        '  </ui:VisualElement>',
    ),
    uss:
      '#button-absolute-in-border-frame {\n  width: 200px;\n  height: 200px;\n' +
      '  border-top-width: 10px;\n  border-right-width: 10px;\n' +
      '  border-bottom-width: 10px;\n  border-left-width: 10px;\n}\n' +
      '#button-absolute-in-border-btn {\n  position: absolute;\n  left: 0;\n  top: 0;\n' +
      '  width: 50px;\n  height: 30px;\n}\n',
  },
  {
    name: 'button-align-items',
    question: 'Does align-items: center on the parent center a Button on the cross axis?',
    uxml: wrap(
      '  <ui:VisualElement name="button-align-items-row">\n' +
        '    <ui:Button name="button-align-items-btn" text="Center" />\n' +
        '  </ui:VisualElement>',
    ),
    uss:
      '#button-align-items-row {\n  flex-direction: row;\n  align-items: center;\n' +
      '  width: 200px;\n  height: 100px;\n}\n' +
      '#button-align-items-btn {\n  width: 60px;\n  height: 30px;\n}\n',
  },
  {
    name: 'theme-class-hook',
    // Written to make an assumption falsifiable, and it has since been judged.
    // src/controls/theme.ts targets `.unity-button` because that is Unity's
    // documented `Button.ussClassName`, but the margin dumps proved the spacing,
    // not the selector delivering it. Unity answered on 2026-08-05: 120×40, the
    // same as ours, so the class does reach a bare <ui:Button>. Kept as a
    // regression guard — if Unity ever stops putting that class on, this is
    // where it shows.
    question: 'Does a `.unity-button` rule in author USS reach a plain <ui:Button>?',
    uxml: wrap(
      '  <ui:VisualElement name="theme-class-hook-holder">\n' +
        '    <ui:Button name="theme-class-hook-btn" text="Hook" />\n' +
        '  </ui:VisualElement>',
    ),
    uss:
      '#theme-class-hook-holder {\n  align-items: flex-start;\n' +
      '  width: 300px;\n  height: 100px;\n}\n' +
      '.unity-button {\n  width: 120px;\n  height: 40px;\n}\n' +
      '#theme-class-hook-btn {\n  margin: 0;\n}\n',
  },
  {
    name: 'button-sizes-to-text',
    question: 'Does a Button with no declared size size itself to its text, the way a Label does?',
    measuresText: true,
    uxml: wrap(
      '  <ui:VisualElement name="button-sizes-to-text-holder">\n' +
        '    <ui:Button name="button-sizes-to-text-btn" text="Confirm" />\n' +
        '  </ui:VisualElement>',
    ),
    uss:
      '#button-sizes-to-text-holder {\n  align-items: flex-start;\n  width: 300px;\n  height: 100px;\n}\n' +
      '#button-sizes-to-text-btn {\n  font-size: 20px;\n}\n',
  },
];
