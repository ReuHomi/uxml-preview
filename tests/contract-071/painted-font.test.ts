/**
 * 0.7.1 — the font a text is painted in is the font it was measured in.
 * Pinned expectations: do not edit the expectations to match an implementation.
 *
 * Source: vscode-uxml-preview verification session, 2026-10-22 (Chromium 152, Windows). With no
 * `-unity-font-definition`, createDefaultMeasureText measures in `sans-serif` (fontList(undefined)) while the
 * painter set no font-family at all, so the text inherited the host page's font. In a VS Code webview
 * ("Segoe WPC", "Segoe UI", sans-serif) "Start Game 한글" measured 101.71px (runtime, 14px) and was drawn
 * 98.47px wide: the layout box and the drawn glyphs came from two different fonts.
 *
 * jsdom does not inherit font-family, so the effective family of a painted text is read the way CSS would
 * resolve it: the nearest inline `font-family` on the host or an ancestor, the host page's own font
 * (container and body, set to `serif` here) included. The measured family is whatever the measurer put in
 * `CanvasRenderingContext2D.font` when it measured that text (createDefaultMeasureText over a recording canvas).
 * Every element that holds a text node is checked, so a control part nobody listed cannot slip through.
 */

import { beforeAll, describe, expect, it } from 'vitest';

import { createDefaultMeasureText, loadLayoutEngine, parse, render } from '../../src/index';
import type { FaceInfo, Theme } from '../../src/index';

beforeAll(async () => {
  await loadLayoutEngine();
});

const FACE: FaceInfo = { pointSize: 90, ascentLine: 80, descentLine: -20, lineHeight: 110 };
const FONT = 'url("project://database/Assets/Fonts/P.ttf")';

// tests/layout/unity/probes-0.7.0/g-settings.uxml: every text-drawing control the preview has.
const BODY = `<ui:UXML xmlns:ui="UnityEngine.UIElements">
<ui:VisualElement name="settings" class="settings">
<ui:GroupBox name="graphics" text="Graphics">
<ui:Toggle name="fullscreen" label="Fullscreen" value="true" />
<ui:RadioButton name="res-1080" label="1920x1080" value="true" />
<ui:Slider name="brightness" label="Brightness" low-value="0" high-value="1" value="0.7" show-input-field="true" />
<ui:SliderInt name="fps" label="FPS limit" low-value="30" high-value="144" value="60" />
</ui:GroupBox>
<ui:Box name="account">
<ui:TextField name="player-name" label="Name" value="Player One" />
<ui:TextField name="player-tag" label="Tag" placeholder-text="Optional" />
<ui:TextElement name="note" text="Changes apply after a restart." />
<ui:ProgressBar name="download" title="Download" value="50" />
</ui:Box>
<ui:VisualElement name="footer">
<ui:Label name="plain" text="Plain label" />
<ui:Button name="apply" text="Start Game 한글" />
<ui:RepeatButton name="plus" text="+" />
</ui:VisualElement>
</ui:VisualElement>
</ui:UXML>`;

const SCENARIOS: Array<{ name: string; uss: string }> = [
  { name: 'no font anywhere', uss: '' },
  { name: 'one author font on the whole screen', uss: `.settings { -unity-font-definition: ${FONT}; }` },
  { name: 'author font on some controls only', uss: `#brightness, #apply, #download { -unity-font-definition: ${FONT}; }` },
];

const familyOf = (font: string): string => /^\S+ \S+ [\d.]+px (.*)$/.exec(font)?.[1]?.replace(/["'\s]/g, '') ?? font;

for (const theme of ['runtime', 'editor'] as Theme[]) {
  for (const { name, uss } of SCENARIOS) {
    describe(`painted font = measured font — ${theme} theme, ${name}`, () => {
      it('every painted text carries the family its measurement used, over a serif host page', () => {
        const log: Array<{ text: string; font: string }> = [];
        const context = {
          font: '', fontKerning: 'normal',
          measureText(text: string) {
            log.push({ text, font: context.font });
            return { width: text.length * 7, fontBoundingBoxAscent: 80, fontBoundingBoxDescent: 20 };
          },
        };
        const measureDoc = { createElement: () => ({ getContext: () => context }) } as unknown as Document;
        const host = document.createElement('div');
        host.style.fontFamily = 'serif';
        document.body.style.fontFamily = 'serif';
        document.body.replaceChildren(host);
        const r = render(parse(BODY, uss), host, {
          theme, size: { width: 800, height: 600 },
          measureText: createDefaultMeasureText(measureDoc),
          resolveFont: () => ({ family: 'P', faceInfo: FACE }),
        });
        try {
          // A text is split into spans (leading, letter spacing, CJK breaks); the unit that was measured is
          // everything under one node or part element, so group the text nodes by that owner.
          const owners = new Map<Element, Text[]>();
          const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
          for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) {
            if ((n.textContent ?? '') === '') continue;
            const owner = n.parentElement!.closest('[data-uxml-node],[data-uxml-part]')!;
            owners.set(owner, [...(owners.get(owner) ?? []), n as Text]);
          }
          expect(owners.size, 'text owners found').toBeGreaterThanOrEqual(15);
          for (const nodes of owners.values()) {
            const text = nodes.map((n) => n.textContent).join('');
            // Exact: a one-line text is measured whole, and a substring match would pick up "a" for "Download".
            const measured = new Set(log.filter((e) => e.text === text).map((e) => familyOf(e.font)));
            expect(measured.size, `"${text}" was measured in exactly one family`).toBe(1);
            for (const n of nodes) {
              let painted = '';
              for (let el: HTMLElement | null = n.parentElement; el !== null && painted === ''; el = el.parentElement) {
                painted = el.style.fontFamily;
              }
              expect(painted.replace(/["'\s]/g, ''), `"${text}" painted family`).toBe([...measured][0]);
            }
          }
          // An <input>/<textarea> would cut inheritance off; none is built, and if one ever is it names its family.
          for (const el of Array.from(host.querySelectorAll<HTMLElement>('input,textarea,select,button'))) {
            expect(el.style.fontFamily, `${el.tagName} names its own family`).not.toBe('');
          }
        } finally {
          r.dispose();
        }
      });
    });
  }
}
