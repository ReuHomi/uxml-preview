/**
 * 0.7.0 finding N3 (found 2026-10-21 while pinning review round 1.5 — outside the review's list): an author font
 * reaches a control's part text, as it reaches the control's own text.
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Source: tests/layout/unity/6000.3.25f1/probe-panel/g-settings-ko.json (PanelDump 0.7.0-r3, alone in its
 * Unity process), probe tests/layout/unity/probes-0.7.0/g-settings-ko.uxml/.uss, which sets
 * `-unity-font-definition` (Pretendard) once for the screen. Unity draws every text with it, part text
 * included: the field labels (`unity-base-field__label`), the TextField inner text
 * (`unity-text-element--inner-input-field-component`), the GroupBox title (`unity-group-box__label`) and the
 * ProgressBar title (`unity-progress-bar__title`) all report `unityFontDefinition: font=Pretendard-Regular` and
 * a Pretendard FaceInfo.
 *
 * The preview found fonts by the element's computed style only, so part text was measured with the default face
 * and painted in the browser's default family (seen in Chromium as Times New Roman, 2026-10-21). No test saw it:
 * the contract tests answer text sizes from the dump, and the golden harness measures with a fixed function.
 * Here every text the measurer is asked for, part text included, must carry the author's family and FaceInfo,
 * and every painted text must name the family.
 */

import { beforeAll, describe, expect, it } from 'vitest';

import { loadLayoutEngine, parse, render } from '../../src/index';
import type { FaceInfo, MeasureText, TextContext, Theme } from '../../src/index';

beforeAll(async () => {
  await loadLayoutEngine();
});

const FACE: FaceInfo = { pointSize: 90, ascentLine: 80, descentLine: -20, lineHeight: 110 };
const BODY = '<ui:UXML xmlns:ui="UnityEngine.UIElements"><ui:VisualElement name="screen">' +
  '<ui:GroupBox text="Group title"><ui:TextField label="Field label" value="Field value" />' +
  '<ui:ProgressBar title="Bar title" value="40" /><ui:Label text="Plain label" /></ui:GroupBox>' +
  '</ui:VisualElement></ui:UXML>';
const USS = '#screen { -unity-font-definition: url("project://database/Assets/Fonts/P.ttf"); }';
const TEXTS = ['Group title', 'Field label', 'Field value', 'Bar title', 'Plain label'];

for (const theme of ['runtime', 'editor'] as Theme[]) {
  describe(`N3 — ${theme} theme`, () => {
    it('every text, part text included, is measured and painted with the author font', () => {
      const seen = new Map<string, TextContext>();
      const measure: MeasureText = (text, context) => {
        seen.set(text, context);
        return { width: text.length * context.fontSize * 0.5, height: context.fontSize };
      };
      const r = render(parse(BODY, USS), document.createElement('div'), {
        theme, size: { width: 600, height: 400 }, measureText: measure,
        resolveFont: () => ({ family: 'P', faceInfo: FACE }),
      });
      try {
        for (const text of TEXTS) {
          const context = seen.get(text);
          expect(context, `${text} was measured`).toBeDefined();
          expect(context!.fontFamily, `${text} family`).toBe('P');
          expect(context!.faceInfo, `${text} FaceInfo`).toEqual(FACE);
        }
        for (const text of TEXTS) {
          const host = [...r.elements.values()].flatMap((e) => [e, ...Array.from(e.querySelectorAll<HTMLElement>('*'))])
            .find((e) => e.textContent === text && e.children.length === 0)
            ?? [...r.elements.values()].flatMap((e) => Array.from(e.querySelectorAll<HTMLElement>('*'))).find((e) => e.textContent === text);
          expect(host, `${text} was painted`).toBeDefined();
          // The family is set on the text host or on an element around it inside the control.
          let el: HTMLElement | null = host!;
          let family = '';
          while (el !== null && family === '') {
            family = el.style.fontFamily;
            el = el.parentElement;
          }
          expect(family, `${text} painted family`).toMatch(/"?P"?/);
        }
      } finally {
        r.dispose();
      }
    });
  });
}
