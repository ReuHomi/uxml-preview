/**
 * The Yoga bridge.
 *
 * Three things about Yoga drive everything here.
 *
 * Nodes are WebAssembly handles and are not garbage collected. Every node this
 * module creates is owned by the LayoutTree that created it and freed by
 * `LayoutTree.dispose` (or freed here if construction throws). `liveNodeCount` exists so a test can prove that happens:
 * Yoga's own instance counter is not exposed by the JS bindings.
 *
 * Yoga's engine defaults are not USS's. `flex-direction` and `box-sizing`
 * happen to agree; `flex-shrink` does not (Yoga 0, USS 1). Rather than track
 * which is which, every supported property is written explicitly.
 *
 * Enum values are imported, never written as numbers. `PositionType.Absolute`
 * is 2 and `Align.Stretch` is 4, and a transposed digit here is a layout that
 * is wrong in a way no type checker can see.
 */

import { loadYoga, Align, Direction, Display, Edge, FlexDirection, Justify, MeasureMode, Overflow, PositionType, Wrap, BoxSizing } from 'yoga-layout/load';
import type { Node as YogaNode, Yoga } from 'yoga-layout/load';

import type { ElementNode, NodeId, Warning } from '../model/types';
import type { ComputedStyle } from '../style/resolve';
import { isNonVisual, partParentIndex, partTextOf, resolveControl } from '../controls/registry';
import type { Theme } from '../controls/theme';
import { DEFAULT_THEME, verticalScrollbarWidth } from '../controls/theme';
import type { ComputedValue, DeclarationLocator } from '../style/resolve';
import { INITIAL, parseLength, parseNumber } from '../render/values';
import type { Length } from '../render/values';
import { textHeight, EDITOR_DEFAULT_FACE_INFO } from '../render/measure';
import type { FaceInfo } from '../render/measure';
import { decodeEntities } from '../parser/entities';

let engine: Yoga | null = null;

/**
 * Purpose:      load the Yoga WebAssembly module.
 * Deps/Effects: caches the module; awaiting it more than once is harmless.
 *
 * Imported from `yoga-layout/load` rather than `yoga-layout`, whose default
 * entry uses top-level await. Going through `load` keeps this library's module
 * graph synchronous, which is what lets `render` stay a synchronous call.
 */
export async function loadLayoutEngine(): Promise<void> {
  engine ??= await loadYoga();
}

export function isLayoutEngineReady(): boolean {
  return engine !== null;
}

/** Yoga nodes created and not yet freed, across every tree. Tests read this. */
let liveNodes = 0;
export function liveNodeCount(): number {
  return liveNodes;
}

export interface LayoutBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface TextMetrics {
  width: number;
  height: number;
}

export interface TextContext {
  fontSize: number;
  /** `normal` | `bold` | `italic` | `bold-and-italic`. */
  fontStyle: string;
  whiteSpace: string;
  fontFamily?: string;
  faceInfo?: FaceInfo;
  letterSpacing?: number;
  wordSpacing?: number;
  paragraphSpacing?: number;
  textGenerator?: 'standard' | 'advanced';
}

export type MeasureText = (
  text: string,
  context: TextContext,
  availableWidth: number,
) => TextMetrics;

export interface LayoutOptions {
  /** Built-in theme; defaults to 'runtime'. */
  theme?: Theme;
  fonts?: ReadonlyMap<ComputedStyle, { family: string; faceInfo?: FaceInfo }>;
  size: { width: number; height: number };
  /**
   * Measures a control's text.
   *
   * Injectable because the default depends on a canvas, so results move with
   * the platform and the installed fonts — and Phase 5 cannot put a number on
   * accuracy if the measurement shifts underneath it.
   */
  measureText: MeasureText;
  /** Points a value-level warning at the declaration it came from. */
  locate?: DeclarationLocator;
}

/**
 * A laid-out element the file never mentioned, built by a control.
 *
 * Separate from `boxes` rather than sharing its keys: `NodeId` identifies
 * something in the document, and these have no document to be in. Giving them
 * borrowed ids would make "which node is this?" answerable with a lie, and an
 * editor asking that question needs to hear "this one is not yours".
 */
export interface LayoutPart {
  /** Unity's name, e.g. `unity-content-viewport`. */
  name: string;
  /** The element whose control built it. */
  owner: NodeId;
  /** Index in this owner’s laid-out parts, null for the owner itself. */
  parent?: number | null;
  /** Present for a measured text leaf; wrappers omit it. Text is entity-decoded. */
  text?: string;
  box: LayoutBox;
  /** Cascade output, including inheritance, theme and author rules. */
  style: ComputedStyle;
}

export interface LayoutTree {
  /** Computed box per element, in panel coordinates. */
  boxes: ReadonlyMap<NodeId, LayoutBox>;
  /**
   * Parts each element's control built, outermost first. The element's own
   * children were laid out inside the last wrapper; text parts are leading siblings.
   */
  parts: ReadonlyMap<NodeId, readonly LayoutPart[]>;
  /** Elements that were laid out, parents before children. */
  painted: readonly ElementNode[];
  warnings: readonly Warning[];
  /**
   * Deps/Effects: frees every Yoga node this tree owns.
   * Requires: `boxes` must not be read afterwards. Calling twice is harmless.
   */
  dispose(): void;
}

const ALIGN: Readonly<Record<string, Align>> = {
  auto: Align.Auto,
  'flex-start': Align.FlexStart,
  center: Align.Center,
  'flex-end': Align.FlexEnd,
  stretch: Align.Stretch,
  baseline: Align.Baseline,
  'space-between': Align.SpaceBetween,
  'space-around': Align.SpaceAround,
  'space-evenly': Align.SpaceEvenly,
};

const JUSTIFY: Readonly<Record<string, Justify>> = {
  'flex-start': Justify.FlexStart,
  center: Justify.Center,
  'flex-end': Justify.FlexEnd,
  'space-between': Justify.SpaceBetween,
  'space-around': Justify.SpaceAround,
  'space-evenly': Justify.SpaceEvenly,
};

const DIRECTIONS: Readonly<Record<string, FlexDirection>> = {
  column: FlexDirection.Column,
  'column-reverse': FlexDirection.ColumnReverse,
  row: FlexDirection.Row,
  'row-reverse': FlexDirection.RowReverse,
};

const WRAPS: Readonly<Record<string, Wrap>> = {
  nowrap: Wrap.NoWrap,
  wrap: Wrap.Wrap,
  'wrap-reverse': Wrap.WrapReverse,
};

const SIDES: ReadonlyArray<readonly [string, Edge]> = [
  ['left', Edge.Left],
  ['top', Edge.Top],
  ['right', Edge.Right],
  ['bottom', Edge.Bottom],
];

/**
 * Purpose:      build a Yoga tree, compute layout, hand back boxes in panel
 *               coordinates.
 * Deps/Effects: owns created Yoga nodes until returning the tree, which owns
 *               them until disposed; on any failure frees all roots and rethrows.
 *               Calls host measureText and appends measurement warnings.
 * Requires:     `loadLayoutEngine()` must have resolved.
 */
export function layoutDocument(
  root: ElementNode,
  styles: ReadonlyMap<NodeId, ComputedStyle>,
  /**
   * Style per control part, from the cascade.
   *
   * Taken rather than computed. This module used to build part styles itself
   * from the registry's fixed declarations, which meant author USS could never
   * reach them — `#unity-content-container { flex-direction: row }` had nowhere
   * to land, because the part did not exist until after the cascade had run.
   * Resolving parts alongside elements is what fixes that, and computing them
   * in two places would put the second cascade back.
   */
  partStyles: ReadonlyMap<NodeId, ReadonlyMap<string, ComputedStyle>>,
  options: LayoutOptions,
): LayoutTree {
  const theme = options.theme ?? DEFAULT_THEME;
  const yoga = engine;
  if (yoga === null) {
    throw new Error('loadLayoutEngine() must be awaited before rendering');
  }

  const warnings: Warning[] = [];
  const boxes = new Map<NodeId, LayoutBox>();
  const parts = new Map<NodeId, LayoutPart[]>();
  const painted: ElementNode[] = [];
  const yogaOf = new Map<ElementNode, YogaNode>();
  /** Yoga node per part, in the same order as `parts`, so `collect` can pair them. */
  const partNodes = new Map<NodeId, YogaNode[]>();
  const allocated: YogaNode[] = [];
  const measurementWarnings = new Map<NodeId, Set<string>>();
  let created = 0;
  let disposed = false;

  const read = (style: ComputedStyle, property: string): string =>
    style.get(property)?.value ?? INITIAL[property] ?? '';

  function warn(
    message: string,
    node: ElementNode,
    detail: Pick<Warning, 'reason' | 'subject'>,
    from?: ComputedValue,
  ): void {
    // Reported where it was declared, never again on each descendant.
    if (from?.origin.kind === 'inherited') return;
    warnings.push({
      kind: 'unsupported-property',
      message,
      node: node.id,
      ...detail,
      ...(from === undefined ? {} : (options.locate?.(from.origin) ?? {})),
    });
  }

  // Template clones retain inline origins, including their source document.
  // Measured 2026-10-15: tests/layout/unity/<version>/probe-editor/aspect.json
  // and inline-poison.json (6000.0.40f1, 6000.3.25f1).
  function warnValue(
    style: ComputedStyle,
    property: string,
    node: ElementNode,
    problem: string,
    reason: Warning['reason'],
    dropsFileInline: boolean,
  ): void {
    const from = style.get(property);
    const dropsInline = dropsFileInline && from?.origin.kind === 'inline';
    warn(
      `${property}: ${problem}${dropsInline ? '; Unity drops every inline style in that UXML file' : ''}`,
      node,
      {
        ...(reason === undefined ? {} : { reason: dropsInline ? 'invalid-value' : reason }),
        subject: { kind: 'property', property, value: read(style, property),
          ...(dropsInline ? { unityEffect: { kind: 'file-inline-dropped', versions: ['6000.0', '6000.3'] } } : {}),
        },
      },
      from,
    );
  }

  function length(style: ComputedStyle, property: string, node: ElementNode): Length | null {
    const text = read(style, property);
    if (text === '') return null;
    const { length: parsed, problem, reason, code } = parseLength(text);
    if (problem !== undefined) {
      warnValue(style, property, node, problem, reason, code === 'unsupported-unit');
    }
    return parsed;
  }

  /** Yoga's dimension setters take `auto`; the edge setters do not. */
  function dimension(value: Length | null): number | 'auto' | `${number}%` | undefined {
    if (value === null) return undefined;
    switch (value.kind) {
      case 'px':
        return value.value;
      case 'percent':
        return `${value.value}%`;
      case 'auto':
        return 'auto';
      case 'none':
        return undefined;
    }
  }

  function edge(value: Length | null): number | `${number}%` | undefined {
    if (value === null) return undefined;
    if (value.kind === 'px') return value.value;
    if (value.kind === 'percent') return `${value.value}%`;
    return undefined;
  }

  function applyStyle(yg: YogaNode, style: ComputedStyle, node: ElementNode): void {
    // USS width always includes padding and border, with or without a
    // declaration saying so.
    yg.setBoxSizing(BoxSizing.BorderBox);

    yg.setFlexDirection(DIRECTIONS[read(style, 'flex-direction')] ?? FlexDirection.Column);
    yg.setFlexWrap(WRAPS[read(style, 'flex-wrap')] ?? Wrap.NoWrap);
    yg.setJustifyContent(JUSTIFY[read(style, 'justify-content')] ?? Justify.FlexStart);
    yg.setAlignItems(ALIGN[read(style, 'align-items')] ?? Align.Stretch);
    yg.setAlignSelf(ALIGN[read(style, 'align-self')] ?? Align.Auto);
    yg.setAlignContent(ALIGN[read(style, 'align-content')] ?? Align.FlexStart);

    yg.setFlexGrow(parseNumber(read(style, 'flex-grow')) ?? 0);
    yg.setFlexShrink(parseNumber(read(style, 'flex-shrink')) ?? 1);
    yg.setFlexBasis(dimension(length(style, 'flex-basis', node)));

    const position = read(style, 'position');
    if (position === 'fixed' || position === 'sticky') {
      warn(`position: ${position} treated as relative`, node, {
        reason: 'not-uss',
        subject: { kind: 'property', property: 'position', value: position },
      }, style.get('position'));
    }
    yg.setPositionType(
      position === 'absolute' ? PositionType.Absolute : PositionType.Relative,
    );

    const display = read(style, 'display');
    if (display === 'none') yg.setDisplay(Display.None);
    else if (display !== 'flex' && display !== 'initial') {
      // USS has flex and none; anything else is laid out as flex, as before.
      warn(`display: ${display} laid out as flex`, node, {
        reason: 'invalid-value',
        subject: { kind: 'property', property: 'display', value: display },
      }, style.get('display'));
    }
    const overflow = read(style, 'overflow');
    if (overflow === 'hidden') yg.setOverflow(Overflow.Hidden);
    else if (overflow === 'auto' || overflow === 'scroll') {
      warn(`overflow: ${overflow} ignored; nothing scrolls`, node, {
        reason: 'not-uss',
        subject: { kind: 'property', property: 'overflow', value: overflow },
      }, style.get('overflow'));
    }

    yg.setWidth(dimension(length(style, 'width', node)));
    yg.setHeight(dimension(length(style, 'height', node)));
    // Measured 2026-10-15: tests/layout/unity/probes-0.6.0/aspect2.uxml;
    // dump: tests/layout/unity/6000.3.25f1/probe-editor/aspect2.json.
    // Unity passes a plain USS number directly to Yoga; auto leaves it unset.
    const aspectRatio = read(style, 'aspect-ratio').trim();
    if (aspectRatio !== 'auto' && aspectRatio !== 'initial') {
      const ratio = parseNumber(aspectRatio);
      if (ratio !== null && Number.isFinite(ratio)) yg.setAspectRatio(ratio);
      else warnValue(style, 'aspect-ratio', node, `cannot read "${aspectRatio}" as a number`, 'invalid-value', true);
    }
    yg.setMinWidth(edge(length(style, 'min-width', node)));
    yg.setMinHeight(edge(length(style, 'min-height', node)));
    yg.setMaxWidth(edge(length(style, 'max-width', node)));
    yg.setMaxHeight(edge(length(style, 'max-height', node)));

    for (const [side, e] of SIDES) {
      yg.setMargin(e, edge(length(style, `margin-${side}`, node)));
      yg.setPadding(e, edge(length(style, `padding-${side}`, node)));
      const border = edge(length(style, `border-${side}-width`, node));
      yg.setBorder(e, typeof border === 'number' ? border : undefined);
      yg.setPosition(e, edge(length(style, side, node)));
    }
  }

  function textOf(node: ElementNode): string | undefined {
    const text = node.attributes.find((a) => a.name === 'text')?.value;
    return text === undefined ? undefined : decodeEntities(text);
  }

  /**
   * Attributes that put words on screen in Unity but not in a fallback box.
   *
   * `text` is not the only one. Everything deriving from `BaseField` — TextField,
   * Toggle, Slider, DropdownField — names its caption `label`, and Foldout uses
   * `text`. A warning that looked at `text` alone would let a Toggle's caption
   * vanish without a word, which is the silent loss rule 6 exists to prevent.
   */
  const CAPTION_ATTRIBUTES = ['text', 'label'] as const;

  function captionsOf(node: ElementNode): string[] {
    return CAPTION_ATTRIBUTES.filter((name) =>
      node.attributes.some((a) => a.name === name && a.value.length > 0),
    );
  }

  /** The bindings notice is about the document, so it is raised once. */
  let bindingsReported = false;

  /** Deps/Effects: appends at most one measurement warning per property and element, including inherited values. */
  function warnMeasurement(node: ElementNode, style: ComputedStyle, property: string,
    reason: 'not-rendered' | 'invalid-value', message: string): void {
    const seen = measurementWarnings.get(node.id) ?? new Set<string>();
    if (seen.has(property)) return;
    seen.add(property);
    measurementWarnings.set(node.id, seen);
    warnings.push({
      kind: 'unsupported-property', reason, node: node.id, message,
      subject: { kind: 'property', property, value: read(style, property) },
    });
  }

  function measure(yg: YogaNode, text: string, style: ComputedStyle, node: ElementNode, partName?: string): void {
    const generator = read(style, '-unity-text-generator');
    const textGenerator = generator === 'standard' || generator === 'advanced'
      ? generator : theme === 'runtime' ? 'standard' : 'advanced';
    if (style.has('-unity-text-generator') && generator !== 'standard' && generator !== 'advanced') {
      warnMeasurement(node, style, '-unity-text-generator', 'invalid-value',
        `-unity-text-generator: ${generator} is invalid; measured as ${textGenerator}`);
    }
    // Measured: tests/layout/unity/<version>/{probe-panel,probe-editor-070}/c-whitespace.json.
    const whitespaceText = text.length > 0 && text.trim() === '' &&
      ['Label', 'Button', 'GroupBox'].includes(node.name.local);
    if (whitespaceText && (theme === 'runtime' || textGenerator === 'standard')) {
      yg.setMeasureFunc(() => ({ width: 0, height: 0 }));
      return;
    }
    const fontSize = length(style, 'font-size', node);
    if (style.has('font-size') && fontSize?.kind !== 'px') {
      warnMeasurement(node, style, 'font-size', 'not-rendered',
        `font-size: ${read(style, 'font-size')} is not measured; 12px is used`);
    }
    const context: TextContext = {
      fontSize: fontSize !== null && fontSize.kind === 'px' ? fontSize.value : 12,
      fontStyle: read(style, '-unity-font-style') || 'normal',
      whiteSpace: read(style, 'white-space') || 'normal',
      textGenerator,
    };
    // r15-tf-spaces: preserve significant spaces; ordinary single-space text
    // retains its existing host-measurer context (normal and pre-wrap agree).
    if (partName === 'unity-text-element--inner-input-field-component' && / {2}|^ | $/m.test(text)) {
      context.whiteSpace = context.whiteSpace === 'normal' ? 'pre-wrap' : 'pre';
    }
    const font = options.fonts?.get(style);
    if (font !== undefined) {
      context.fontFamily = font.family;
      const face = font.faceInfo;
      if (face === undefined && textGenerator === 'standard') {
        warnMeasurement(node, style, '-unity-font-definition', 'not-rendered',
          '-unity-font-definition: host font has no FaceInfo lineHeight; later Standard lines cannot be placed as Unity does');
      }
      if (face !== undefined) {
        if (Number.isFinite(face.pointSize) && face.pointSize > 0 &&
            Number.isFinite(face.ascentLine) && Number.isFinite(face.descentLine)) context.faceInfo = face;
        else warnMeasurement(node, style, '-unity-font-definition', 'invalid-value',
          '-unity-font-definition: invalid FaceInfo; measured without FaceInfo');
      }
    }
    for (const [property, field] of [
      ['letter-spacing', 'letterSpacing'], ['word-spacing', 'wordSpacing'],
      ['-unity-paragraph-spacing', 'paragraphSpacing'],
    ] as const) {
      const parsed = length(style, property, node);
      if (parsed?.kind === 'px') context[field] = parsed.value;
    }
    // probe-editor-070/*.json: Standard in 6000.0.40f1, Advanced in
    // 6000.3.25f1. The 0.6.0 text-spacing dumps show spacing beside spaces differs.
    let generatorOrigin = style.get('-unity-text-generator')?.origin;
    while (generatorOrigin?.kind === 'inherited') generatorOrigin = generatorOrigin.origin;
    const ownGenerator = generatorOrigin?.kind === 'rule' || generatorOrigin?.kind === 'inline';
    if (theme === 'editor' && !ownGenerator &&
        ((context.letterSpacing ?? 0) !== 0 || (context.wordSpacing ?? 0) !== 0)) {
      warnings.push({
        kind: 'version-dependent', reason: 'version-dependent', node: node.id,
        subject: { kind: 'property', property: '-unity-text-generator', value: '', affectsLayout: true },
        message: "Unity 6000.0.40f1's editor theme spaces this text with the standard text generator and 6000.3.25f1's with advanced; drawn as advanced",
      });
    }
    // Unity evidence: c07-TextField.json, both 6.3 themes: an empty input
    // retains a line box even though Unity's text measurement reports zero.
    if (text === '' && node.name.local === 'TextField') {
      yg.setMeasureFunc(() => ({ width: 0, height: textHeight(1, context.fontSize,
        context.faceInfo ?? EDITOR_DEFAULT_FACE_INFO, 0, 0, context.textGenerator) }));
      return;
    }
    yg.setMeasureFunc((availableWidth, widthMode, availableHeight, heightMode) => {
      const measured = options.measureText(
        text,
        context,
        Number.isFinite(availableWidth) ? availableWidth : 0,
      );
      // Measured: g-clamp.json — AtMost clips text except absolute elements and TextField inner text.
      const clip = widthMode === MeasureMode.AtMost && Number.isFinite(availableWidth) &&
        read(style, 'position') !== 'absolute' && partName !== 'unity-text-element--inner-input-field-component';
      // Measured: g-clamp-h.json — AtMost clips height, including TextField inner text, except absolute elements.
      const clipHeight = heightMode === MeasureMode.AtMost && Number.isFinite(availableHeight) &&
        read(style, 'position') !== 'absolute';
      return {
        width: clip ? Math.min(measured.width, availableWidth) : measured.width,
        height: clipHeight ? Math.min(measured.height, availableHeight) : measured.height,
      };
    });
    if (whitespaceText && theme === 'editor') {
      warnings.push({
        kind: 'version-dependent', reason: 'version-dependent', node: node.id,
        subject: { kind: 'control', type: node.name.local },
        message: `<${node.name.local}> ${node.name.local === 'GroupBox' ? 'title' : 'text'} of only spaces is 0px high on Unity 6000.0.40f1 and 15px on 6000.3.25f1 (editor theme); drawn as 6000.3.25f1`,
      });
    }
  }

  function build(node: ElementNode, parent: YogaNode | null): void {
    if (isNonVisual(node)) {
      if (node.name.local === 'Bindings' && !bindingsReported) {
        bindingsReported = true;
        warnings.push({
          kind: 'unsupported-control',
          message: 'Data bindings are not evaluated in this preview; bound values show as written',
          node: node.id,
          reason: 'not-rendered',
          subject: { kind: 'control', type: 'Bindings' },
        });
      }
      return;
    }
    const style = styles.get(node.id) ?? new Map();
    const yg = yoga!.Node.create();
    allocated.push(yg);
    created++;
    liveNodes++;
    yogaOf.set(node, yg);
    painted.push(node);
    applyStyle(yg, style, node);
    if (parent !== null) parent.insertChild(yg, parent.getChildCount());

    const { spec, fallback } = resolveControl(node);
    const text = textOf(node);
    const drawsText = spec.hasText && text !== undefined && text.length > 0;

    // probe-editor-070/c07-existing.json, col/button-empty: 4px vs 19px.
    if (theme === 'editor' && node.name.local === 'Button' && !drawsText) {
      warnings.push({
        kind: 'version-dependent', reason: 'version-dependent', node: node.id,
        subject: { kind: 'control', type: 'Button' },
        message: '<Button> with no text is 4px high on Unity 6000.0.40f1 and 19px on 6000.3.25f1 (editor theme); drawn as 6000.0.40f1',
      });
    }

    if (fallback) {
      // Drawn, not dropped — but say so. The one thing a preview must never do
      // is show a plausible screen that is missing part of the tree.
      const captions = captionsOf(node);
      warnings.push({
        kind: 'unsupported-control',
        message:
          `<${node.name.local}> has no renderer in this version and is drawn as a ` +
          `plain VisualElement` +
          (captions.length === 0
            ? ''
            : `; its ${captions.join(' and ')} attribute${captions.length > 1 ? 's are' : ' is'} not drawn`),
        node: node.id,
        reason: 'not-rendered',
        subject: { kind: 'control', type: node.name.local },
      });
    }

    // USS: rich text is enabled by default (tests/layout/unity/<version>/probe-editor/rich-text.json).
    const richText = node.attributes.find((attribute) => attribute.name === 'enable-rich-text')?.value ?? '';
    // Unity Manual 6000.3, Supported rich text tags: exact names, with optional tag arguments.
    const richTextTag = /<\/?(?:a|align|allcaps|alpha|b|br|color|cspace|font|font-weight|gradient|i|indent|line-height|line-indent|lowercase|margin|mark|mspace|nobr|noparse|pos|s|size|smallcaps|space|sprite|style|sub|sup|u|uppercase|voffset|width|link)(?:[=\s][^<>]*)?>/i;
    if (drawsText && richText.trim().toLowerCase() !== 'false' && richTextTag.test(text)) {
      warnings.push({
        kind: 'unsupported-property', reason: 'not-rendered', node: node.id,
        message: 'Unity interprets rich text tags here (enable-rich-text is on by default), while this preview draws them as plain characters, so size and position can differ. Use enable-rich-text="false" only if you want literal tags.',
        subject: { kind: 'property', property: 'enable-rich-text', value: richText, affectsLayout: true },
      });
    }

    if (drawsText && !style.has('-unity-font-definition') && !style.has('-unity-font')) {
      const first = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff]/u.exec(text);
      if (first !== null) {
        const code = first[0].codePointAt(0)!;
        const missingGlyphs = code >= 0x3040 && code <= 0x30ff ? 'kana'
          : (code >= 0x3400 && code <= 0x4dbf) || (code >= 0x4e00 && code <= 0x9fff) ? 'han' : 'hangul';
        const script = { hangul: 'Hangul', han: 'Han (CJK ideographs)', kana: 'Kana' }[missingGlyphs];
        warnings.push({
          kind: 'unsupported-property', reason: 'font-fallback', node: node.id,
          message: `The editor default font (Inter-Regular SDF) has no glyphs for ${script}; Unity draws it with a fallback font whose height can differ (measured 1–4px taller).` +
            (missingGlyphs === 'hangul' ? '' : " Unity's box width was measured 6–87px narrower than this preview's (10–32px font sizes); this preview's width depends on the device's fallback font."),
          subject: { kind: 'property', property: '-unity-font-definition', value: '', affectsLayout: true, missingGlyphs },
        });
      }
    }

    // Measured: f-states.json rb-child / te-child size from file children alone.
    const childrenSizeText = ['TextElement', 'RepeatButton'].includes(node.name.local) &&
      node.children.some((child) => !isNonVisual(child));
    if (drawsText && !childrenSizeText) {
      // Yoga refuses to measure a node that has children, and would not ask for
      // an intrinsic size anyway. Text wins; dropping it silently would be worse.
      if (node.children.some((child) => !isNonVisual(child))) {
        warn(
          `<${node.name.local}> has both a text attribute and children; children are not drawn`,
          node,
          { reason: 'not-rendered', subject: { kind: 'control', type: node.name.local } },
        );
      }
      measure(yg, text, style, node);
      return;
    }

    // `<Style src="…">` names a stylesheet; it is not something on screen.
    // Laying it out would add a phantom box to the flow and report it as an
    // unsupported control, which names the wrong problem — the stylesheet is
    // handled in `parse`, and if it could not be loaded that is what warns.
    // File children default to the last non-text part (ScrollView's content
    // container); controls can instead keep them directly under the owner.
    let host = yg;
    if (spec.parts.length > 0) {
      // golden and golden-panel dumps agree across 6000.0.40f1 and 6000.3.25f1:
      // measured ScrollView parts do not introduce a version difference.
      const chain: LayoutPart[] = [];
      const nodes: YogaNode[] = [];
      const resolvedParts = partStyles.get(node.id);
      const builtIndices = new Map<number, number>();
      for (const [index, part] of spec.parts.entries()) {
        const partText = partTextOf(node, part);
        if (part.kind === 'leading-text' && !partText) continue;
        // Falls back to nothing rather than to the registry defaults: if the
        // cascade did not resolve this part, styling it from a second source
        // here is exactly the divergence this refactor removed.
        const style: ComputedStyle = resolvedParts?.get(part.name) ?? new Map();
        const partNode = yoga!.Node.create();
        allocated.push(partNode);
        created++;
        liveNodes++;
        applyStyle(partNode, style, node);
        const parentIndex = partParentIndex(spec.parts, index);
        const parent = parentIndex === null ? null : builtIndices.get(parentIndex) ?? null;
        const partHost = parent === null ? yg : nodes[parent]!;
        partHost.insertChild(partNode, partHost.getChildCount());
        builtIndices.set(index, nodes.length);
        // c07-GroupBox: title is a sibling before file children, never a host.
        if (partText !== undefined) {
          measure(partNode, partText, style, node, part.name);
        } else if (spec.fileChildrenHost !== 'owner') host = partNode;
        nodes.push(partNode);
        // Box filled in by `collect`, once layout has actually run.
        chain.push({
          name: part.name,
          owner: node.id,
          parent,
          ...(partText !== undefined ? { text: partText } : {}),
          box: { left: 0, top: 0, width: 0, height: 0 },
          style,
        });
      }
      parts.set(node.id, chain);
      partNodes.set(node.id, nodes);
    }

    // Every child is built. A control this version does not know still gets a
    // node, so an unfamiliar tag costs its own appearance and nothing below it.
    for (const child of node.children) build(child, host);
  }

  try {
    // The `<ui:UXML>` element is the panel box itself. Styling it — `:root`
    // padding, say — therefore applies, which is what a preview should show.
    build(root, null);
    const rootNode = yogaOf.get(root)!;
    rootNode.setWidth(options.size.width);
    rootNode.setHeight(options.size.height);
    rootNode.setPositionType(PositionType.Relative);
    rootNode.calculateLayout(options.size.width, options.size.height, Direction.LTR);

    /**
     * Purpose:      reserve the width a visible vertical scrollbar takes, then lay
     *               out again.
     * Deps/Effects: mutates part nodes and re-runs `calculateLayout`.
     *
     * Two passes are needed because the question is circular: whether a scrollbar
     * shows depends on the content height, and narrowing the viewport for one can
     * change that height. Unity resolves the same circle the same way. The loop is
     * bounded, and settling is the normal case — a second change would mean the
     * content grew taller *because* it got narrower, which only wrapping text does.
     *
     * This is not a correction applied to Yoga's answer. It is the input Unity
     * gives its own layout, and the width comes from `theme.ts` with the version
     * it was measured on, not from a number typed here.
     */
    const reserved = new Map<NodeId, number>();
    for (let pass = 0; pass < 3; pass++) {
      let changed = false;
      for (const [owner, chain] of parts) {
        const nodes = partNodes.get(owner);
        if (nodes === undefined) continue;
        const viewport = chain.findIndex((p) => p.name === 'unity-content-viewport');
        const content = chain.findIndex((p) => p.name === 'unity-content-container');
        if (viewport === -1 || content === -1) continue;

        const viewportBox = nodes[viewport]!.getComputedLayout();
        const contentBox = nodes[content]!.getComputedLayout();
        // A hair of tolerance: equal heights are not an overflow, and floating
        // point should not decide whether a scrollbar exists.
        const overflows = contentBox.height > viewportBox.height + 0.01;
        const want = verticalScrollbarWidth(overflows, theme);
        if ((reserved.get(owner) ?? 0) === want) continue;

        reserved.set(owner, want);
        nodes[viewport]!.setMargin(Edge.Right, want);
        changed = true;
      }
      if (!changed) break;
      rootNode.calculateLayout(options.size.width, options.size.height, Direction.LTR);
    }

    // Measured: 6000.3.25f1/{probe-panel,probe-editor-070}/f-progress.json; AbstractProgressBar sets right after layout.
    for (const [node] of yogaOf) {
      if (node.name.local !== 'ProgressBar') continue;
      const chain = parts.get(node.id)!;
      const nodes = partNodes.get(node.id)!;
      const background = nodes[chain.findIndex((p) => p.name === 'unity-progress-bar__background')]!;
      const progress = nodes[chain.findIndex((p) => p.name === 'unity-progress-bar__progress')]!;
      const attr = (name: string, fallback: number): number => Number(node.attributes.find((a) => a.name === name)?.value ?? fallback);
      const low = attr('low-value', 0), high = attr('high-value', 100);
      const value = Math.min(high, Math.max(low, attr('value', 0)));
      const width = Math.floor(background.getComputedLayout().width - 2);
      const filled = value <= low ? 0 : width * value / high;
      progress.setPosition(Edge.Right, width - filled);
      if (theme === 'editor' && value <= low) {
        warnings.push({
          kind: 'version-dependent', reason: 'version-dependent', node: node.id,
          subject: { kind: 'control', type: 'ProgressBar' },
          message: '<ProgressBar> at or below low-value is 1px wide on Unity 6000.0.40f1 and 0px on 6000.3.25f1 (editor theme); drawn as 6000.3.25f1',
        });
      }
    }
    if ([...yogaOf.keys()].some((node) => node.name.local === 'ProgressBar')) {
      rootNode.calculateLayout(options.size.width, options.size.height, Direction.LTR);
    }

    // Yoga reports each box relative to its parent; the painter wants panel
    // coordinates, so offsets accumulate through the file-child host: the owner
    // when declared, otherwise the last non-text part.
    function collect(node: ElementNode, offsetX: number, offsetY: number): void {
      const yg = yogaOf.get(node);
      if (yg === undefined) return;
      const box = yg.getComputedLayout();
      let left = offsetX + box.left;
      let top = offsetY + box.top;
      boxes.set(node.id, { left, top, width: box.width, height: box.height });

      const chain = parts.get(node.id);
      const nodes = partNodes.get(node.id);
      const { spec } = resolveControl(node);
      if (chain !== undefined && nodes !== undefined) {
        chain.forEach((part, index) => {
          const partBox = nodes[index]!.getComputedLayout();
          const parentBox = part.parent === null || part.parent === undefined ? boxes.get(node.id)! : chain[part.parent]!.box;
          part.box = { left: parentBox.left + partBox.left, top: parentBox.top + partBox.top,
            width: partBox.width, height: partBox.height };
          if (part.text === undefined && spec.fileChildrenHost !== 'owner') {
            left = part.box.left;
            top = part.box.top;
          }
        });
      }

      for (const child of node.children) collect(child, left, top);
    }
    collect(root, 0, 0);

    // Unity evidence: 6000.3.25f1/{probe-panel,probe-editor-070}/d-slider*.json.
    // Depends on completed Yoga sizes. Translation affects paint only, never layout boxes.
    for (const [owner, chain] of parts) {
      const container = chain.find((p) => p.name === 'unity-drag-container');
      const dragger = chain.find((p) => p.name === 'unity-dragger');
      if (container === undefined || dragger === undefined) continue;
      const node = [...yogaOf.keys()].find((n) => n.id === owner)!;
      const attr = (name: string, fallback: number): number => Number(node.attributes.find((a) => a.name === name)?.value ?? fallback);
      const low = attr('low-value', 0), high = attr('high-value', 10);
      const t = Math.min(1, Math.max(0, high === low ? 0 : (attr('value', low) - low) / (high - low)));
      const vertical = node.attributes.some((a) => a.name === 'direction' && a.value === 'Vertical');
      const value = vertical ? `0px ${(1 - t) * (container.box.height - dragger.box.height)}px`
        : `${t * (container.box.width - dragger.box.width)}px 0px`;
      for (const part of chain.filter((p) => p.name === 'unity-dragger' || p.name === 'unity-dragger-border')) {
        const style = new Map(part.style);
        style.set('translate', { value, origin: { kind: 'builtin-theme', selector: `#${part.name}`,
          property: 'translate', unityVersion: '6000.3.25f1' } });
        part.style = style;
      }
    }

    return {
      boxes,
      parts,
      painted,
      warnings,
      dispose(): void {
        if (disposed) return;
        disposed = true;
        // Parts were inserted as children, so freeRecursive already covers them;
        // `created` counted them, so the live tally comes back to where it started.
        rootNode.freeRecursive();
        liveNodes -= created;
        yogaOf.clear();
        partNodes.clear();
      },
    };
  } catch (error) {
    // Collect roots before freeing: children become invalid handles afterwards.
    const roots = allocated.filter((node) => node.getParent() === null);
    for (const node of roots) node.freeRecursive();
    liveNodes -= created;
    throw error;
  }

}
