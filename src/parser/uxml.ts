/**
 * UXML scanner.
 *
 * Records positions; it does not interpret. Entity references stay encoded,
 * element types are not classified, and anything it does not recognize is
 * stepped over rather than rejected — the spans still cover that text, so it
 * survives serialization.
 *
 * Written by hand because DOMParser exposes no source offsets, and span
 * re-emission needs one per tag part. See docs/architecture.md decision 3-b.
 */

import type {
  Attribute,
  ElementName,
  ElementNode,
  NodeId,
  Span,
  Warning,
} from '../model/types';

export interface UxmlParseResult {
  root: ElementNode;
  warnings: Warning[];
}

/** XML name characters, `:` included so a qualified name is read in one go. */
function isNameChar(c: string | undefined): boolean {
  return c !== undefined && (/[A-Za-z0-9_.:-]/.test(c));
}

function isNameStart(c: string | undefined): boolean {
  return c !== undefined && /[A-Za-z_]/.test(c);
}

function isSpace(c: string | undefined): boolean {
  return c === ' ' || c === '\t' || c === '\n' || c === '\r';
}

/**
 * Purpose:      UXML text -> element tree with the spans serialization needs.
 * Ensures:      never throws; malformed input yields warnings and whatever tree
 *               was recovered. Spans always stay within `source`.
 */
export function parseUxml(source: string): UxmlParseResult {
  const warnings: Warning[] = [];
  let pos = 0;
  let nextId = 0;

  const id = (): NodeId => nextId++ as NodeId;

  function warn(message: string, start: number, end: number): void {
    warnings.push({
      kind: 'malformed',
      message,
      at: { in: 'uxml', span: { start, end } },
    });
  }

  function skipSpace(): void {
    while (isSpace(source[pos])) pos++;
  }

  /**
   * Advance to the next `<` that opens an element or an end tag, stepping over
   * comments, CDATA, doctypes and processing instructions. Those are never
   * modelled — they ride along inside the surrounding gap spans.
   */
  function seekTag(): void {
    for (;;) {
      const lt = source.indexOf('<', pos);
      if (lt < 0) {
        pos = source.length;
        return;
      }
      const next = source[lt + 1];
      if (next === '!') {
        if (source.startsWith('<!--', lt)) {
          const end = source.indexOf('-->', lt + 4);
          pos = end < 0 ? source.length : end + 3;
        } else if (source.startsWith('<![CDATA[', lt)) {
          const end = source.indexOf(']]>', lt + 9);
          pos = end < 0 ? source.length : end + 3;
        } else {
          const end = source.indexOf('>', lt);
          pos = end < 0 ? source.length : end + 1;
        }
        continue;
      }
      if (next === '?') {
        const end = source.indexOf('?>', lt + 2);
        pos = end < 0 ? source.length : end + 2;
        continue;
      }
      pos = lt;
      return;
    }
  }

  function readName(): ElementName {
    const start = pos;
    while (isNameChar(source[pos])) pos++;
    const raw = source.slice(start, pos);
    const colon = raw.indexOf(':');
    return colon < 0
      ? { prefix: null, local: raw }
      : { prefix: raw.slice(0, colon), local: raw.slice(colon + 1) };
  }

  /** Returns null when `pos` is not on an attribute name, so the caller can recover. */
  function readAttribute(): Attribute | null {
    const start = pos;
    while (isNameChar(source[pos])) pos++;
    if (pos === start) return null;
    const name = source.slice(start, pos);

    const afterName = pos;
    skipSpace();
    if (source[pos] !== '=') {
      // Valueless attribute. Invalid XML, but dropping it would lose text.
      pos = afterName;
      warn(`attribute "${name}" has no value`, start, afterName);
      return { name, value: '', span: { start, end: afterName } };
    }
    pos++;
    skipSpace();

    const quote = source[pos];
    if (quote !== '"' && quote !== "'") {
      warn(`attribute "${name}" has an unquoted value`, start, pos);
      return { name, value: '', span: { start, end: pos } };
    }
    pos++;
    const valueStart = pos;
    const close = source.indexOf(quote, pos);
    if (close < 0) {
      warn(`attribute "${name}" has an unterminated value`, start, source.length);
      pos = source.length;
      return { name, value: source.slice(valueStart), span: { start, end: pos } };
    }
    pos = close + 1;
    return { name, value: source.slice(valueStart, close), span: { start, end: pos } };
  }

  /** Requires: `source[pos]` is `<` and the next character starts a name. */
  function parseElement(): ElementNode {
    const tagStart = pos;
    pos++;
    const name = readName();

    const attributes: Attribute[] = [];
    let selfClosing = false;
    for (;;) {
      skipSpace();
      const c = source[pos];
      if (c === undefined) {
        warn('unterminated open tag', tagStart, source.length);
        break;
      }
      if (c === '>') {
        pos++;
        break;
      }
      if (c === '/' && source[pos + 1] === '>') {
        pos += 2;
        selfClosing = true;
        break;
      }
      const attr = readAttribute();
      if (attr === null) {
        // Unrecognized byte inside the tag. Step over it; the span still covers it.
        pos++;
        continue;
      }
      attributes.push(attr);
    }
    const openTag: Span = { start: tagStart, end: pos };

    if (selfClosing) {
      return {
        id: id(),
        name,
        attributes,
        children: [],
        spans: { openTag, inner: { start: pos, end: pos }, closeTag: null },
        tagDirty: false,
        childrenDirty: false,
      };
    }

    const innerStart = pos;
    const children: ElementNode[] = [];
    for (;;) {
      seekTag();
      if (pos >= source.length) {
        warn(`unterminated element <${qualify(name)}>`, tagStart, source.length);
        break;
      }
      const next = source[pos + 1];
      if (next === '/') break;
      if (!isNameStart(next)) {
        // A stray `<` in text. Not a tag; leave it to the gap span.
        pos++;
        continue;
      }
      children.push(parseElement());
    }

    const innerEnd = pos;
    let closeTag: Span | null = null;
    if (source.startsWith('</', pos)) {
      const gt = source.indexOf('>', pos);
      const end = gt < 0 ? source.length : gt + 1;
      if (gt < 0) warn('unterminated end tag', pos, end);
      closeTag = { start: pos, end };
      pos = end;
    }

    return {
      id: id(),
      name,
      attributes,
      children,
      spans: { openTag, inner: { start: innerStart, end: innerEnd }, closeTag },
      tagDirty: false,
      childrenDirty: false,
    };
  }

  seekTag();
  if (pos < source.length && isNameStart(source[pos + 1])) {
    return { root: parseElement(), warnings };
  }

  // No root element. Empty spans at offset 0 make the whole file the epilogue,
  // so even this round-trips.
  warn('no root element', 0, 0);
  return {
    root: {
      id: id(),
      name: { prefix: null, local: '' },
      attributes: [],
      children: [],
      spans: { openTag: { start: 0, end: 0 }, inner: { start: 0, end: 0 }, closeTag: null },
      tagDirty: false,
      childrenDirty: false,
    },
    warnings,
  };
}

export function qualify(name: ElementName): string {
  return name.prefix === null ? name.local : `${name.prefix}:${name.local}`;
}
