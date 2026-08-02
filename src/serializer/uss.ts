/**
 * USS serialization by span re-emission — the same technique as the UXML side.
 *
 * Items, and the gaps between them, are copied out of the sheet's own source.
 * Comments live in those gaps, which is why they need no representation in the
 * model to survive.
 */

import type { Rule, Selector, SheetItem, Span, StyleSheet } from '../model/types';

/**
 * Purpose:      stylesheet -> USS text.
 * Ensures:      with nothing marked dirty, the result equals `sheet.source`.
 */
export function serializeUss(sheet: StyleSheet): string {
  const source = sheet.source;
  const slice = (s: Span): string => source.slice(s.start, s.end);

  function renderSelector(selector: Selector): string {
    return selector.parts
      .map((part, i) => {
        const lead = i === 0 ? '' : part.combinator === 'child' ? ' > ' : ' ';
        const simple = part.simple
          .map((s) => {
            switch (s.kind) {
              case 'universal':
                return '*';
              case 'type':
                return s.name;
              case 'class':
                return `.${s.name}`;
              case 'name':
                return `#${s.name}`;
              case 'pseudo':
                return `:${s.name}`;
              case 'unknown':
                return s.text;
            }
          })
          .join('');
        return lead + simple;
      })
      .join('');
  }

  /**
   * Indentation taken from the first declaration's own line, used only when the
   * declaration list changed and the recorded gaps no longer line up.
   */
  function indentOf(rule: Rule): { between: string; before: string; after: string } {
    const first = rule.declarations[0];
    if (first === undefined) return { between: '', before: '', after: '' };
    const lineStart = source.lastIndexOf('\n', first.span.start);
    const indent = lineStart < 0 ? '' : source.slice(lineStart, first.span.start);
    const body = source.slice(rule.selectorSpan.end, rule.span.end);
    const tail = /\r?\n[ \t]*\}$/.exec(body)?.[0]?.replace(/\}$/, '') ?? '';
    return { between: `;${indent}`, before: indent, after: `;${tail}` };
  }

  function emitRule(rule: Rule): string {
    const head = rule.selectorDirty
      ? rule.selectors.map(renderSelector).join(', ')
      : slice(rule.selectorSpan);

    if (rule.declarations.length === 0) {
      return head + source.slice(rule.selectorSpan.end, rule.span.end);
    }

    const open = source.slice(rule.selectorSpan.end, rule.declarations[0]!.span.start);

    if (rule.declarationsDirty) {
      const { between, before, after } = indentOf(rule);
      const brace = open.slice(0, open.indexOf('{') + 1);
      const body = rule.declarations.map(emitDeclaration).join(between);
      return `${head}${brace}${before}${body}${after}}`;
    }

    let out = head;
    let cursor = rule.selectorSpan.end;
    for (const decl of rule.declarations) {
      out += source.slice(cursor, decl.span.start);
      out += emitDeclaration(decl);
      cursor = decl.span.end;
    }
    return out + source.slice(cursor, rule.span.end);
  }

  function emitDeclaration(decl: { property: string; value: string; span: Span; dirty: boolean }): string {
    return decl.dirty ? `${decl.property}: ${decl.value}` : slice(decl.span);
  }

  function emitItem(item: SheetItem): string {
    return item.kind === 'rule' ? emitRule(item.rule) : slice(item.span);
  }

  let out = '';
  let cursor = 0;
  for (const item of sheet.items) {
    const span = item.kind === 'rule' ? item.rule.span : item.span;
    out += source.slice(cursor, span.start);
    out += emitItem(item);
    cursor = span.end;
  }
  return out + source.slice(cursor);
}
