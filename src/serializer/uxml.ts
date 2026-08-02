/**
 * UXML serialization by span re-emission.
 *
 * Nothing is rendered from the model unless it was edited. Untouched text —
 * including every comment, the XML declaration, and the author's indentation —
 * is copied out of the original source, which is why an unedited document comes
 * back byte-identical without that being a special case.
 */

import type { ElementNode, Span } from '../model/types';
import { qualify } from '../parser/uxml';

/**
 * Purpose:      element tree -> UXML text.
 * Deps/Effects: reads `source`, which must be the exact text the spans were
 *               recorded against. Passing a different string yields garbage.
 * Ensures:      with no node marked dirty, the result equals `source`.
 */
export function serializeUxml(source: string, root: ElementNode): string {
  const slice = (s: Span): string => source.slice(s.start, s.end);

  function nodeEnd(node: ElementNode): number {
    if (node.spans.closeTag !== null) return node.spans.closeTag.end;
    return Math.max(node.spans.openTag.end, node.spans.inner.end);
  }

  function renderOpenTag(node: ElementNode): string {
    // Values are stored raw, so they need no escaping — only a quote character
    // that does not appear inside them.
    const attrs = node.attributes
      .map((a) => ` ${a.name}=${a.value.includes('"') ? `'${a.value}'` : `"${a.value}"`}`)
      .join('');
    const name = qualify(node.name);
    return node.spans.closeTag === null ? `<${name}${attrs} />` : `<${name}${attrs}>`;
  }

  /**
   * Leading and trailing whitespace of the original inner span, used as the
   * separator when the child list changed and the recorded gaps no longer line
   * up. Approximate by design: it reproduces the common case of one child per
   * line at a fixed indent.
   */
  function indentOf(node: ElementNode): { between: string; before: string; after: string } {
    const inner = slice(node.spans.inner);
    const lead = /^[ \t]*\r?\n[ \t]*/.exec(inner)?.[0] ?? '';
    const tail = /\r?\n[ \t]*$/.exec(inner)?.[0] ?? '';
    return { between: lead, before: lead, after: tail };
  }

  function emitInner(node: ElementNode): string {
    const { inner } = node.spans;
    if (node.children.length === 0) return slice(inner);

    if (node.childrenDirty) {
      const { between, before, after } = indentOf(node);
      return before + node.children.map(emit).join(between) + after;
    }

    let out = '';
    let cursor = inner.start;
    for (const child of node.children) {
      out += source.slice(cursor, child.spans.openTag.start);
      out += emit(child);
      cursor = nodeEnd(child);
    }
    return out + source.slice(cursor, inner.end);
  }

  function emit(node: ElementNode): string {
    const open = node.tagDirty ? renderOpenTag(node) : slice(node.spans.openTag);
    const close = node.spans.closeTag === null ? '' : slice(node.spans.closeTag);
    return open + emitInner(node) + close;
  }

  return source.slice(0, root.spans.openTag.start) + emit(root) + source.slice(nodeEnd(root));
}
