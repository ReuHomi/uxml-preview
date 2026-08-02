/**
 * USS scanner.
 *
 * Same contract as the UXML scanner: record positions, judge nothing. Selector
 * syntax USS does not support is stored as `unknown` rather than rejected, so
 * the rule still round-trips; the resolver is what drops it and warns.
 *
 * Declaration spans deliberately exclude the trailing `;`. That makes the last
 * declaration in a block — which often has no semicolon — no different from any
 * other, and leaves the separator in the gap where the serializer slices it.
 */

import type {
  Declaration,
  Rule,
  Selector,
  SelectorPart,
  SheetItem,
  SimpleSelector,
  Span,
  StyleSheet,
  Warning,
} from '../model/types';

export interface UssParseResult {
  sheet: StyleSheet;
  warnings: Warning[];
}

const IDENT = /[A-Za-z0-9_-]/;

function isSpace(c: string | undefined): boolean {
  return c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f';
}

/**
 * Purpose:      USS text -> stylesheet with the spans serialization needs.
 * Ensures:      never throws; unterminated blocks and unknown at-rules become
 *               warnings plus an `unknown` item covering the remaining text.
 */
export function parseUss(
  source: string,
  origin: string | null = null,
  sheetIndex = 0,
): UssParseResult {
  const warnings: Warning[] = [];
  const items: SheetItem[] = [];
  let pos = 0;

  function warn(message: string, start: number, end: number): void {
    warnings.push({
      kind: 'malformed',
      message,
      at: { in: 'uss', sheet: sheetIndex, span: { start, end } },
    });
  }

  /** Whitespace and comments. Both live in gaps and are never modelled. */
  function skipTrivia(): void {
    for (;;) {
      while (isSpace(source[pos])) pos++;
      if (source.startsWith('/*', pos)) {
        const end = source.indexOf('*/', pos + 2);
        pos = end < 0 ? source.length : end + 2;
        continue;
      }
      return;
    }
  }

  /**
   * Scan forward to the first character in `stops` that is not inside a string,
   * a comment, or a bracket pair. Returns `source.length` if none is found.
   */
  function scanTo(from: number, stops: string): number {
    let i = from;
    let depth = 0;
    while (i < source.length) {
      const c = source[i]!;
      if (c === '"' || c === "'") {
        const close = source.indexOf(c, i + 1);
        i = close < 0 ? source.length : close + 1;
        continue;
      }
      if (c === '/' && source[i + 1] === '*') {
        const close = source.indexOf('*/', i + 2);
        i = close < 0 ? source.length : close + 2;
        continue;
      }
      if (c === '(' || c === '[') {
        depth++;
      } else if (c === ')' || c === ']') {
        if (depth > 0) depth--;
      } else if (depth === 0 && stops.includes(c)) {
        return i;
      }
      i++;
    }
    return source.length;
  }

  /** Requires: `source[from]` is `{`. Returns the index just past the matching `}`. */
  function endOfBlock(from: number): number {
    let i = from + 1;
    let depth = 1;
    while (i < source.length) {
      const c = source[i]!;
      if (c === '"' || c === "'") {
        const close = source.indexOf(c, i + 1);
        i = close < 0 ? source.length : close + 1;
        continue;
      }
      if (c === '/' && source[i + 1] === '*') {
        const close = source.indexOf('*/', i + 2);
        i = close < 0 ? source.length : close + 2;
        continue;
      }
      if (c === '{') depth++;
      else if (c === '}' && --depth === 0) return i + 1;
      i++;
    }
    return source.length;
  }

  function trimmedSpan(start: number, end: number): Span {
    let s = start;
    let e = end;
    while (s < e && isSpace(source[s])) s++;
    while (e > s && isSpace(source[e - 1])) e--;
    return { start: s, end: e };
  }

  // -------------------------------------------------------------------------
  // Selectors
  // -------------------------------------------------------------------------

  function readIdent(i: number): number {
    let j = i;
    while (j < source.length && IDENT.test(source[j]!)) j++;
    return j;
  }

  /** Requires: `source[i]` is `(` or `[`. Returns the index just past its partner. */
  function endOfBracket(i: number): number {
    const open = source[i];
    const close = open === '(' ? ')' : ']';
    let j = i + 1;
    let depth = 1;
    while (j < source.length) {
      const c = source[j]!;
      if (c === '"' || c === "'") {
        const q = source.indexOf(c, j + 1);
        j = q < 0 ? source.length : q + 1;
        continue;
      }
      if (c === open) depth++;
      else if (c === close && --depth === 0) return j + 1;
      j++;
    }
    return source.length;
  }

  function readCompound(i: number, limit: number): { simple: SimpleSelector[]; next: number } {
    const simple: SimpleSelector[] = [];
    let j = i;
    while (j < limit) {
      const c = source[j]!;
      if (isSpace(c) || c === '>' || c === '+' || c === '~' || c === ',') break;

      if (c === '*') {
        simple.push({ kind: 'universal' });
        j++;
      } else if (c === '.' || c === '#') {
        const end = readIdent(j + 1);
        simple.push(
          c === '.'
            ? { kind: 'class', name: source.slice(j + 1, end) }
            : { kind: 'name', name: source.slice(j + 1, end) },
        );
        j = end;
      } else if (c === '[') {
        const end = Math.min(endOfBracket(j), limit);
        simple.push({ kind: 'unknown', text: source.slice(j, end) });
        j = end;
      } else if (c === ':') {
        if (source[j + 1] === ':') {
          const end = readIdent(j + 2);
          simple.push({ kind: 'unknown', text: source.slice(j, end) });
          j = end;
        } else {
          const nameEnd = readIdent(j + 1);
          if (source[nameEnd] === '(') {
            // Functional pseudo-classes are all unsupported in USS.
            const end = Math.min(endOfBracket(nameEnd), limit);
            simple.push({ kind: 'unknown', text: source.slice(j, end) });
            j = end;
          } else {
            simple.push({ kind: 'pseudo', name: source.slice(j + 1, nameEnd) });
            j = nameEnd;
          }
        }
      } else if (IDENT.test(c)) {
        const end = readIdent(j);
        simple.push({ kind: 'type', name: source.slice(j, end) });
        j = end;
      } else {
        simple.push({ kind: 'unknown', text: c });
        j++;
      }
    }
    return { simple, next: j };
  }

  function parseSelector(start: number, end: number): Selector {
    const span = trimmedSpan(start, end);
    const parts: SelectorPart[] = [];
    let combinator: SelectorPart['combinator'] = 'descendant';
    /** Sibling combinators have no representation; they poison the rule instead. */
    let poison: string | null = null;
    let i = span.start;

    while (i < span.end) {
      const c = source[i]!;
      if (isSpace(c)) {
        i++;
        continue;
      }
      if (c === '>') {
        combinator = 'child';
        i++;
        continue;
      }
      if (c === '+' || c === '~') {
        poison = c;
        i++;
        continue;
      }
      const { simple, next } = readCompound(i, span.end);
      if (next === i) {
        i++;
        continue;
      }
      if (poison !== null) {
        simple.unshift({ kind: 'unknown', text: poison });
        poison = null;
      }
      parts.push({ combinator, simple });
      combinator = 'descendant';
      i = next;
    }

    return { parts, span };
  }

  function parseSelectorGroup(start: number, end: number): Selector[] {
    const selectors: Selector[] = [];
    let from = start;
    for (;;) {
      const comma = Math.min(scanTo(from, ','), end);
      selectors.push(parseSelector(from, comma));
      if (comma >= end) break;
      from = comma + 1;
    }
    return selectors;
  }

  // -------------------------------------------------------------------------
  // Declarations
  // -------------------------------------------------------------------------

  function parseDeclarations(blockStart: number, blockEnd: number): Declaration[] {
    const declarations: Declaration[] = [];
    const saved = pos;
    pos = blockStart;

    while (pos < blockEnd) {
      skipTrivia();
      if (pos >= blockEnd) break;
      if (source[pos] === ';') {
        pos++;
        continue;
      }
      const start = pos;
      const colon = scanTo(start, ':;}');
      if (colon >= blockEnd || source[colon] !== ':') {
        warn('declaration without a value', start, Math.min(colon, blockEnd));
        pos = Math.min(colon, blockEnd) + 1;
        continue;
      }
      const property = source.slice(start, colon).trim();
      const stop = Math.min(scanTo(colon + 1, ';}'), blockEnd);
      const value = trimmedSpan(colon + 1, stop);

      declarations.push({
        property,
        value: source.slice(value.start, value.end),
        span: { start, end: value.end },
        dirty: false,
      });
      pos = stop + 1;
    }

    pos = saved;
    return declarations;
  }

  // -------------------------------------------------------------------------
  // Top level
  // -------------------------------------------------------------------------

  function parseAtRule(): SheetItem {
    const start = pos;
    const nameEnd = readIdent(pos + 1);
    const name = source.slice(pos + 1, nameEnd);
    const brace = scanTo(nameEnd, '{;');

    if (brace < source.length && source[brace] === '{') {
      // A block at-rule. `@media` and friends are unsupported, so the whole
      // thing is kept verbatim and never looked inside.
      const end = endOfBlock(brace);
      pos = end;
      return { kind: 'unknown', span: { start, end } };
    }

    const end = brace < source.length ? brace + 1 : source.length;
    pos = end;

    if (name === 'import') {
      const text = source.slice(nameEnd, end);
      const quoted = /["']([^"']*)["']/.exec(text);
      if (quoted === null) {
        warn('@import without a quoted path', start, end);
        return { kind: 'unknown', span: { start, end } };
      }
      return { kind: 'import', url: quoted[1]!, span: { start, end } };
    }
    return { kind: 'unknown', span: { start, end } };
  }

  function parseRule(): SheetItem {
    const start = pos;
    const brace = scanTo(start, '{');
    if (brace >= source.length) {
      warn('rule without a block', start, source.length);
      pos = source.length;
      return { kind: 'unknown', span: { start, end: source.length } };
    }
    const selectorSpan = trimmedSpan(start, brace);
    const blockEnd = endOfBlock(brace);
    if (blockEnd > source.length || source[blockEnd - 1] !== '}') {
      warn('unterminated rule block', start, blockEnd);
    }

    const rule: Rule = {
      selectors: parseSelectorGroup(selectorSpan.start, selectorSpan.end),
      declarations: parseDeclarations(brace + 1, blockEnd - 1),
      span: { start: selectorSpan.start, end: blockEnd },
      selectorSpan,
      selectorDirty: false,
      declarationsDirty: false,
    };
    pos = blockEnd;
    return { kind: 'rule', rule };
  }

  for (;;) {
    skipTrivia();
    if (pos >= source.length) break;
    items.push(source[pos] === '@' ? parseAtRule() : parseRule());
  }

  return { sheet: { source, origin, items }, warnings };
}
