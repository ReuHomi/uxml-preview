/**
 * The Yoga bridge.
 *
 * Three things about Yoga drive everything here.
 *
 * Nodes are WebAssembly handles and are not garbage collected. Every node this
 * module creates is owned by the LayoutTree that created it and freed by
 * `LayoutTree.dispose`. `liveNodeCount` exists so a test can prove that happens:
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

import { loadYoga, Align, Direction, Display, Edge, FlexDirection, Justify, Overflow, PositionType, Wrap, BoxSizing } from 'yoga-layout/load';
import type { Node as YogaNode, Yoga } from 'yoga-layout/load';

import type { ElementNode, NodeId, Warning } from '../model/types';
import type { ComputedStyle } from '../style/resolve';
import { resolveControl } from '../controls/registry';
import { INITIAL, parseLength, parseNumber } from '../render/values';
import type { Length } from '../render/values';

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
}

export type MeasureText = (
  text: string,
  context: TextContext,
  availableWidth: number,
) => TextMetrics;

export interface LayoutOptions {
  size: { width: number; height: number };
  /**
   * Measures a control's text.
   *
   * Injectable because the default depends on a canvas, so results move with
   * the platform and the installed fonts — and Phase 5 cannot put a number on
   * accuracy if the measurement shifts underneath it.
   */
  measureText: MeasureText;
}

export interface LayoutTree {
  /** Computed box per element, in panel coordinates. */
  boxes: ReadonlyMap<NodeId, LayoutBox>;
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
 * Deps/Effects: creates Yoga nodes; the returned tree owns them until disposed.
 * Requires:     `loadLayoutEngine()` must have resolved.
 */
export function layoutDocument(
  root: ElementNode,
  styles: ReadonlyMap<NodeId, ComputedStyle>,
  options: LayoutOptions,
): LayoutTree {
  const yoga = engine;
  if (yoga === null) {
    throw new Error('loadLayoutEngine() must be awaited before rendering');
  }

  const warnings: Warning[] = [];
  const boxes = new Map<NodeId, LayoutBox>();
  const painted: ElementNode[] = [];
  const yogaOf = new Map<ElementNode, YogaNode>();
  let created = 0;
  let disposed = false;

  const read = (style: ComputedStyle, property: string): string =>
    style.get(property)?.value ?? INITIAL[property] ?? '';

  function warn(message: string, node: ElementNode): void {
    warnings.push({ kind: 'unsupported-property', message, node: node.id });
  }

  function length(style: ComputedStyle, property: string, node: ElementNode): Length | null {
    const text = read(style, property);
    if (text === '') return null;
    const { length: parsed, problem } = parseLength(text);
    if (problem !== undefined) warn(`${property}: ${problem}`, node);
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
      warn(`position: ${position} is not supported in USS; treated as relative`, node);
    }
    yg.setPositionType(
      position === 'absolute' ? PositionType.Absolute : PositionType.Relative,
    );

    if (read(style, 'display') === 'none') yg.setDisplay(Display.None);
    const overflow = read(style, 'overflow');
    if (overflow === 'hidden') yg.setOverflow(Overflow.Hidden);
    else if (overflow === 'auto' || overflow === 'scroll') {
      warn(`overflow: ${overflow} needs a ScrollView element in USS`, node);
    }

    yg.setWidth(dimension(length(style, 'width', node)));
    yg.setHeight(dimension(length(style, 'height', node)));
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
    return node.attributes.find((a) => a.name === 'text')?.value;
  }

  function build(node: ElementNode, parent: YogaNode | null): void {
    const style = styles.get(node.id) ?? new Map();
    const yg = yoga!.Node.create();
    created++;
    liveNodes++;
    yogaOf.set(node, yg);
    painted.push(node);
    applyStyle(yg, style, node);
    if (parent !== null) parent.insertChild(yg, parent.getChildCount());

    const { spec, fallback } = resolveControl(node);
    const text = textOf(node);
    const drawsText = spec.hasText && text !== undefined && text.length > 0;

    if (fallback) {
      // Drawn, not dropped — but say so. The one thing a preview must never do
      // is show a plausible screen that is missing part of the tree.
      warnings.push({
        kind: 'unsupported-control',
        message:
          `<${node.name.local}> has no renderer in this version and is drawn as a ` +
          `plain VisualElement` +
          (text !== undefined && text.length > 0
            ? '; its text attribute is not drawn, because Unity draws that through a child element'
            : ''),
        node: node.id,
      });
    }

    if (drawsText) {
      // Yoga refuses to measure a node that has children, and would not ask for
      // an intrinsic size anyway. Text wins; dropping it silently would be worse.
      if (node.children.length > 0) {
        warn(
          `<${node.name.local}> has both a text attribute and children; children are not drawn`,
          node,
        );
      }
      const fontSize = length(style, 'font-size', node);
      const context: TextContext = {
        fontSize: fontSize !== null && fontSize.kind === 'px' ? fontSize.value : 12,
        fontStyle: read(style, '-unity-font-style') || 'normal',
        whiteSpace: read(style, 'white-space') || 'normal',
      };
      yg.setMeasureFunc((availableWidth) =>
        options.measureText(
          text,
          context,
          Number.isFinite(availableWidth) ? availableWidth : 0,
        ),
      );
      return;
    }

    // Every child is built. A control this version does not know still gets a
    // node, so an unfamiliar tag costs its own appearance and nothing below it.
    for (const child of node.children) build(child, yg);
  }

  // The `<ui:UXML>` element is the panel box itself. Styling it — `:root`
  // padding, say — therefore applies, which is what a preview should show.
  build(root, null);
  const rootNode = yogaOf.get(root)!;
  rootNode.setWidth(options.size.width);
  rootNode.setHeight(options.size.height);
  rootNode.setPositionType(PositionType.Relative);
  rootNode.calculateLayout(options.size.width, options.size.height, Direction.LTR);

  // Yoga reports each box relative to its parent; the painter wants panel
  // coordinates, so offsets accumulate on the way down.
  function collect(node: ElementNode, offsetX: number, offsetY: number): void {
    const yg = yogaOf.get(node);
    if (yg === undefined) return;
    const box = yg.getComputedLayout();
    const left = offsetX + box.left;
    const top = offsetY + box.top;
    boxes.set(node.id, { left, top, width: box.width, height: box.height });
    for (const child of node.children) collect(child, left, top);
  }
  collect(root, 0, 0);

  return {
    boxes,
    painted,
    warnings,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      rootNode.freeRecursive();
      liveNodes -= created;
      yogaOf.clear();
    },
  };
}
