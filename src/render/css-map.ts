/**
 * USS visual properties to CSS.
 *
 * Layout is Yoga's; this file only handles what a box looks like once its
 * rectangle is known. Two rules matter more than the rest:
 *
 *   - `z-index` is never emitted. USS has no such property, and overlap is
 *     decided by sibling order with later siblings on top. The painter nests
 *     elements in tree order, which reproduces that exactly. Emitting a
 *     z-index would silently diverge from Unity the moment anything overlaps.
 *   - `box-sizing: border-box` is emitted unconditionally, because USS behaves
 *     that way with or without a declaration.
 */

import type { NodeId, Warning } from '../model/types';
import type { ComputedStyle } from '../style/resolve';

export interface CssMapOptions {
  resolveAsset?: ((path: string) => string | null) | undefined;
}

export interface CssMapResult {
  declarations: Record<string, string>;
  warnings: Warning[];
}

/** Properties that exist in CSS but not in USS. Reported, never translated. */
const NOT_IN_USS = new Set([
  'box-shadow',
  'filter',
  'backdrop-filter',
  'mix-blend-mode',
  'background-blend-mode',
  'clip-path',
  'mask',
  'outline',
  'line-height',
  'text-transform',
  'text-decoration',
  'z-index',
  'float',
  'clear',
  'border-style',
]);

/** Supported by some Unity versions and not others. Passed through, and flagged. */
const VERSION_DEPENDENT = new Set([
  'gap',
  'row-gap',
  'column-gap',
  'aspect-ratio',
  'background-size',
  'background-position',
  'background-repeat',
  'overflow-wrap',
  'word-break',
]);

const SIDES = ['top', 'right', 'bottom', 'left'] as const;

const FONT_STYLE: Readonly<Record<string, { weight: string; style: string }>> = {
  normal: { weight: 'normal', style: 'normal' },
  bold: { weight: 'bold', style: 'normal' },
  italic: { weight: 'normal', style: 'italic' },
  'bold-and-italic': { weight: 'bold', style: 'italic' },
};

const VERTICAL: Readonly<Record<string, string>> = {
  upper: 'flex-start',
  middle: 'center',
  lower: 'flex-end',
};

const HORIZONTAL: Readonly<Record<string, string>> = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
};

/** `url("project://...")` or `resource("...")` to the bare path. */
function assetPath(value: string): string | null {
  const match = /^(?:url|resource)\(\s*(["']?)(.*?)\1\s*\)$/.exec(value.trim());
  return match === null ? null : match[2]!;
}

/**
 * Purpose:      one element's computed style -> CSS declarations.
 * Deps/Effects: calls `resolveAsset` for background images; warnings are
 *               returned rather than thrown so one bad property cannot take
 *               down the render.
 */
export function toCss(
  style: ComputedStyle,
  node: NodeId,
  options: CssMapOptions = {},
): CssMapResult {
  const out: Record<string, string> = {};
  const warnings: Warning[] = [];
  const value = (property: string): string | undefined => style.get(property)?.value;

  const warn = (kind: Warning['kind'], message: string): void => {
    warnings.push({ kind, message, node });
  };

  // USS sizes are always border-box, declaration or not.
  out['box-sizing'] = 'border-box';

  for (const [property] of style) {
    if (NOT_IN_USS.has(property)) {
      warn('unsupported-property', `${property} does not exist in USS and is ignored`);
    } else if (VERSION_DEPENDENT.has(property)) {
      warn(
        'version-dependent',
        `${property} depends on the Unity version; verify it in your project`,
      );
    }
  }

  const passthrough = [
    'background-color',
    'color',
    'opacity',
    'visibility',
    'letter-spacing',
    'word-spacing',
    'white-space',
    'text-overflow',
    'cursor',
    'font-size',
    'transform-origin',
  ];
  for (const property of passthrough) {
    const v = value(property);
    if (v !== undefined) out[property] = v;
  }

  if (value('display') === 'none') out['display'] = 'none';
  if (value('overflow') === 'hidden') out['overflow'] = 'hidden';

  for (const side of SIDES) {
    const width = value(`border-${side}-width`);
    if (width !== undefined && width !== '0') {
      out[`border-${side}-width`] = width.endsWith('px') ? width : `${width}px`;
      // USS draws solid borders only, so the style is not read from anywhere.
      out[`border-${side}-style`] = 'solid';
    }
    const color = value(`border-${side}-color`);
    if (color !== undefined) out[`border-${side}-color`] = color;

    const padding = value(`padding-${side}`);
    if (padding !== undefined && padding !== '0') out[`padding-${side}`] = padding;
  }

  for (const corner of [
    'top-left',
    'top-right',
    'bottom-right',
    'bottom-left',
  ] as const) {
    const radius = value(`border-${corner}-radius`);
    if (radius !== undefined) out[`border-${corner}-radius`] = radius;
  }

  const fontStyle = value('-unity-font-style');
  if (fontStyle !== undefined) {
    const mapped = FONT_STYLE[fontStyle];
    if (mapped === undefined) {
      warn('unsupported-property', `-unity-font-style: ${fontStyle} is not a USS value`);
    } else {
      out['font-weight'] = mapped.weight;
      out['font-style'] = mapped.style;
    }
  }

  const align = value('-unity-text-align');
  if (align !== undefined) {
    // USS combines both axes into one keyword, e.g. `middle-center`.
    const [vertical, horizontal] = align.split('-');
    const alignItems = VERTICAL[vertical ?? ''];
    const justify = HORIZONTAL[horizontal ?? ''];
    if (alignItems === undefined || justify === undefined) {
      warn('unsupported-property', `-unity-text-align: ${align} is not a USS value`);
    } else {
      out['align-items'] = alignItems;
      out['justify-content'] = justify;
    }
  }

  const transforms: string[] = [];
  const translate = value('translate');
  if (translate !== undefined) transforms.push(`translate(${translate.replace(/\s+/, ', ')})`);
  const rotate = value('rotate');
  if (rotate !== undefined) transforms.push(`rotate(${rotate})`);
  const scale = value('scale');
  if (scale !== undefined) transforms.push(`scale(${scale.replace(/\s+/, ', ')})`);
  if (transforms.length > 0) out['transform'] = transforms.join(' ');

  const image = value('background-image');
  if (image !== undefined && image !== 'none') {
    const path = assetPath(image);
    if (path === null) {
      warn('asset-unresolved', `background-image: cannot read "${image}" as an asset path`);
    } else {
      const url = options.resolveAsset?.(path) ?? null;
      if (url === null) {
        // A checkerboard rather than nothing: a missing image that leaves no
        // trace is indistinguishable from an element that was never drawn.
        out['background-image'] =
          'repeating-linear-gradient(45deg, rgba(255,0,255,0.35) 0 6px, ' +
          'rgba(0,0,0,0) 6px 12px)';
        warn('asset-unresolved', `background-image: "${path}" was not resolved`);
      } else {
        out['background-image'] = `url("${url}")`;
        out['background-size'] = value('background-size') ?? 'contain';
        out['background-repeat'] = value('background-repeat') ?? 'no-repeat';
        out['background-position'] = value('background-position') ?? 'center';
      }
    }
  }

  if (value('-unity-background-image-tint-color') !== undefined) {
    warn(
      'unsupported-property',
      '-unity-background-image-tint-color has no CSS equivalent and is not drawn',
    );
  }
  if (SIDES.some((s) => value(`-unity-slice-${s}`) !== undefined)) {
    warn('unsupported-property', '-unity-slice-* (9-slice) is not drawn in this preview');
  }
  if (value('-unity-font-definition') !== undefined) {
    warn(
      'unsupported-property',
      '-unity-font-definition names a Unity font asset; the browser default is used',
    );
  }

  return { declarations: out, warnings };
}
