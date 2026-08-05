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
import { isNonVisual, resolveControl } from '../controls/registry';
import type { ControlPart } from '../controls/registry';
import { THEME_UNITY_VERSION, verticalScrollbarWidth } from '../controls/theme';
import { expandShorthand } from '../style/properties';
import type { ComputedValue } from '../style/resolve';
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
  box: LayoutBox;
  /** Fixed styling, with `builtin-theme` provenance on every value. */
  style: ComputedStyle;
}

export interface LayoutTree {
  /** Computed box per element, in panel coordinates. */
  boxes: ReadonlyMap<NodeId, LayoutBox>;
  /**
   * Parts each element's control built, outermost first. The element's own
   * children were laid out inside the last one.
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
 * Deps/Effects: creates Yoga nodes; the returned tree owns them until disposed.
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
  let created = 0;
  let disposed = false;
  /** Version warning for control parts, raised once per document. */
  let themeReported = false;

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

  function build(node: ElementNode, parent: YogaNode | null): void {
    if (isNonVisual(node)) return;
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
      const captions = captionsOf(node);
      warnings.push({
        kind: 'unsupported-control',
        message:
          `<${node.name.local}> has no renderer in this version and is drawn as a ` +
          `plain VisualElement` +
          (captions.length === 0
            ? ''
            : `; its ${captions.join(' and ')} attribute${captions.length > 1 ? 's are' : ' is'} ` +
              'not drawn, because Unity draws that through a child element'),
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

    // `<Style src="…">` names a stylesheet; it is not something on screen.
    // Laying it out would add a phantom box to the flow and report it as an
    // unsupported control, which names the wrong problem — the stylesheet is
    // handled in `parse`, and if it could not be loaded that is what warns.
    // A control's own parts go between it and the file's children, so the
    // children are built into the innermost part rather than into the element.
    // Skipping this is exactly the bug that puts every descendant of a
    // ScrollView in the wrong place.
    let host = yg;
    if (spec.parts.length > 0) {
      // A part's styling and the scrollbar width beside it are both measured on
      // one Unity version, exactly like the Button margin — but neither goes
      // through the cascade, so neither reached the warning the cascade raises.
      // A ScrollView-only document was using version-specific geometry in
      // silence, and a document that happened to contain a Button got the
      // warning for an unrelated reason. Reported here, once, where it applies.
      if (!themeReported) {
        themeReported = true;
        warnings.push({
          kind: 'version-dependent',
          message:
            `<${node.name.local}> is drawn with the implicit child elements Unity ` +
            `builds for it, and their geometry was measured on Unity ${THEME_UNITY_VERSION}. ` +
            'Other versions may differ; see src/controls/theme.ts.',
          node: node.id,
        });
      }
      const chain: LayoutPart[] = [];
      const nodes: YogaNode[] = [];
      const resolvedParts = partStyles.get(node.id);
      for (const part of spec.parts) {
        // Falls back to nothing rather than to the registry defaults: if the
        // cascade did not resolve this part, styling it from a second source
        // here is exactly the divergence this refactor removed.
        const style: ComputedStyle = resolvedParts?.get(part.name) ?? new Map();
        const partNode = yoga!.Node.create();
        created++;
        liveNodes++;
        applyStyle(partNode, style, node);
        host.insertChild(partNode, host.getChildCount());
        host = partNode;
        nodes.push(partNode);
        // Box filled in by `collect`, once layout has actually run.
        chain.push({
          name: part.name,
          owner: node.id,
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
      const want = verticalScrollbarWidth(overflows);
      if ((reserved.get(owner) ?? 0) === want) continue;

      reserved.set(owner, want);
      nodes[viewport]!.setMargin(Edge.Right, want);
      changed = true;
    }
    if (!changed) break;
    rootNode.calculateLayout(options.size.width, options.size.height, Direction.LTR);
  }

  // Yoga reports each box relative to its parent; the painter wants panel
  // coordinates, so offsets accumulate on the way down — through the parts as
  // well, since a child sits inside the innermost one.
  function collect(node: ElementNode, offsetX: number, offsetY: number): void {
    const yg = yogaOf.get(node);
    if (yg === undefined) return;
    const box = yg.getComputedLayout();
    let left = offsetX + box.left;
    let top = offsetY + box.top;
    boxes.set(node.id, { left, top, width: box.width, height: box.height });

    const chain = parts.get(node.id);
    const nodes = partNodes.get(node.id);
    if (chain !== undefined && nodes !== undefined) {
      chain.forEach((part, index) => {
        const partBox = nodes[index]!.getComputedLayout();
        left += partBox.left;
        top += partBox.top;
        part.box = { left, top, width: partBox.width, height: partBox.height };
      });
    }

    for (const child of node.children) collect(child, left, top);
  }
  collect(root, 0, 0);

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
}
