import type { NodeId, StyleOrigin, Warning } from '../model/types';
import type { ComputedStyle, DeclarationLocator } from '../style/resolve';
import type { FaceInfo } from './measure';
import { assetPath } from './css-map';

export type ResolvedFont = { family: string; faceInfo?: FaceInfo };
export type ResolveFont = (path: string, form: 'url' | 'resource') => string | ResolvedFont | null;

/**
 * Purpose:      resolve font assets for measurement and painting, applying Unity's
 *               documented but unmeasured -unity-font-definition precedence.
 * Deps/Effects: calls the host hook once per distinct (path, form) per invocation.
 *               Element and part styles share the cache and declaration warnings.
 * Ensures:      filters only not-rendered property warnings for processed font
 *               declarations, keyed by property, source document and offset
 *               (or node when no offset exists). Unresolved assets replace those
 *               warnings with one asset-unresolved warning per declaration.
 */
export function resolveFonts(
  styles: ReadonlyMap<NodeId, ComputedStyle>, warnings: readonly Warning[],
  locate: DeclarationLocator, resolve?: ResolveFont,
  partStyles: ReadonlyMap<NodeId, ReadonlyMap<string, ComputedStyle>> = new Map(),
): { fonts: Map<ComputedStyle, ResolvedFont>; warnings: Warning[] } {
  const fonts = new Map<ComputedStyle, ResolvedFont>();
  if (resolve === undefined) return { fonts, warnings: [...warnings] };
  const cache = new Map<string, ResolvedFont | null>();
  const declarations = new Map<string, Warning | null>();
  const keyFor = (property: string, origin: StyleOrigin, node: NodeId): string => {
    while (origin.kind === 'inherited') origin = origin.origin;
    const location = locate(origin);
    return JSON.stringify([property, location.sourceDocument, location.at,
      location.at === undefined ? origin.kind === 'inline' ? origin.node : node : null]);
  };
  const fontStyles: [NodeId, ComputedStyle][] = [...styles];
  for (const [node, parts] of partStyles) {
    for (const style of parts.values()) fontStyles.push([node, style]);
  }
  for (const [node, style] of fontStyles) {
    for (const property of ['-unity-font', '-unity-font-definition']) {
      const entry = style.get(property);
      if (entry === undefined) continue;
      const asset = assetPath(entry.value);
      if (asset === null) continue;
      const key = JSON.stringify([asset.path, asset.form]);
      if (!cache.has(key)) {
        const result = resolve(asset.path, asset.form);
        cache.set(key, typeof result === 'string' ? { family: result } : result);
      }
      const font = cache.get(key)!;
      let origin = entry.origin;
      while (origin.kind === 'inherited') origin = origin.origin;
      const declarationKey = keyFor(property, origin, node);
      if (!declarations.has(declarationKey)) {
        declarations.set(declarationKey, font === null ? {
          kind: 'asset-unresolved', message: `${property}: "${asset.path}" was not resolved`,
          node: origin.kind === 'inline' ? origin.node : node,
          subject: { kind: 'asset', ...asset, role: 'font' }, ...locate(origin),
        } : null);
      }
      // Unity documents font-definition precedence; unmeasured by the probes.
      if (property === '-unity-font-definition') fonts.delete(style);
      if (font !== null) fonts.set(style, font);
    }
  }
  const filtered = warnings.filter((warning) => {
    if (warning.reason !== 'not-rendered' || warning.subject?.kind !== 'property') return true;
    const key = JSON.stringify([warning.subject.property, warning.sourceDocument, warning.at,
      warning.at === undefined ? warning.node : null]);
    return !declarations.has(key);
  });
  return { fonts, warnings: [...filtered, ...[...declarations.values()].filter((w): w is Warning => w !== null)] };
}
