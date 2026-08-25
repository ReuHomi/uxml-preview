/**
 * UXML template declarations and render-time expansion.
 *
 * The parsed document remains the serialization source of truth.  This module
 * builds a second, render-only tree: `<ui:Instance>` becomes a derived
 * TemplateContainer and the template document's visual children are cloned
 * underneath it.  The loader is deliberately synchronous, matching
 * ParseOptions.resolveImport; hosts prefetch the dependency closure when they
 * need to avoid a cache miss during render.
 */

import { decodeEntities } from '../parser/entities';
import { parseUxml } from '../parser/uxml';
import type {
  Attribute,
  ElementNode,
  ElementName,
  NodeId,
  SheetItem,
  StyleSheet,
  UxmlDocument,
  Warning,
} from '../model/types';

export type TemplateResolver = (url: string, from: string | null) => string | null;
type TemplateDocumentParser = (source: string, resolver: TemplateResolver | undefined) => UxmlDocument;

let parseTemplateDocument: TemplateDocumentParser | undefined;

/** Internal registration avoids making the template loader depend on index.ts. */
export function registerTemplateParser(parser: TemplateDocumentParser): void {
  parseTemplateDocument = parser;
}

const resolvers = new WeakMap<UxmlDocument, TemplateResolver | undefined>();

/** Called by parse() so expansion can reuse the exact resolver the host passed. */
export function rememberTemplateResolver(
  document: UxmlDocument,
  resolver: TemplateResolver | undefined,
): void {
  resolvers.set(document, resolver);
}

/**
 * Purpose:      collect direct template dependencies without a regex pass.
 * Deps/Effects: parses `source`; no I/O and no model mutation.
 * Ensures:      returns decoded `<Template src>` values in source order.
 */
export function collectDependencies(source: string): string[] {
  const root = parseUxml(source).root;
  return root.children
    .filter((node) => node.name.local === 'Template')
    .flatMap((node) => {
      const src = attribute(node, 'src');
      return src === undefined || src.length === 0 ? [] : [decodeEntities(src)];
    });
}

export interface TemplateExpansion {
  /** Render-only document. The caller must keep the original for serialization. */
  document: UxmlDocument;
  warnings: readonly Warning[];
}

const MAX_TEMPLATE_DEPTH = 32;

interface TemplateDeclaration {
  name: string;
  src: string;
  node: ElementNode;
}

interface LoadedTemplate {
  url: string;
  from: string | null;
  document: UxmlDocument;
  declarations: Map<string, TemplateDeclaration>;
}

interface SourceMap {
  /** Source node id -> derived node id for this clone. */
  readonly nodes: Map<NodeId, NodeId>;
}

interface ExpansionContext {
  readonly resolver: TemplateResolver | undefined;
  readonly warnings: Warning[];
  readonly cache: Map<string, LoadedTemplate | null>;
  readonly sheetOffsets: WeakMap<UxmlDocument, readonly number[]>;
  readonly reportedWarnings: WeakSet<UxmlDocument>;
  readonly sheets: StyleSheet[];
  readonly styleRoots: Array<{ sheet: number; scope: NodeId }>;
  readonly sourceOffsets: WeakMap<UxmlDocument, number>;
  readonly sources: string[];
  sourceLength: number;
  readonly nextId: () => NodeId;
  /** Resolved declaration identities currently being expanded. */
  readonly stack: Array<{ key: string; label: string }>;
}

function attribute(node: ElementNode, name: string): string | undefined {
  return node.attributes.find((item) => item.name === name)?.value;
}

function decodedAttribute(node: ElementNode, name: string): string | undefined {
  const value = attribute(node, name);
  return value === undefined ? undefined : decodeEntities(value);
}

function templateDeclarations(document: UxmlDocument): Map<string, TemplateDeclaration> {
  const declarations = new Map<string, TemplateDeclaration>();
  for (const child of document.root.children) {
    if (child.name.local !== 'Template') continue;
    const name = decodedAttribute(child, 'name');
    const src = decodedAttribute(child, 'src');
    if (name === undefined || name.length === 0 || src === undefined || src.length === 0) continue;
    declarations.set(name, { name, src, node: child });
  }
  return declarations;
}

function cacheKey(url: string, from: string | null): string {
  return JSON.stringify([url, from]);
}

function packagePath(url: string): boolean {
  return /(?:^|\/)Packages\//i.test(url) || /PackageCache/i.test(url);
}

function addWarning(
  warnings: Warning[],
  kind: Warning['kind'],
  message: string,
  node?: ElementNode,
  sourceDocument?: string,
): void {
  warnings.push({
    kind,
    message,
    ...(node === undefined ? {} : { node: node.id }),
    ...(sourceDocument === undefined ? {} : { sourceDocument }),
  });
}

function cloneAttribute(
  attributeValue: Attribute,
  offset = 0,
  sourceDocument: string | null | undefined = undefined,
): Attribute {
  return {
    ...attributeValue,
    span: {
      start: attributeValue.span.start + offset,
      end: attributeValue.span.end + offset,
    },
    ...(sourceDocument === undefined ? {} : { sourceDocument }),
  };
}

function cloneName(name: ElementName): ElementName {
  return { prefix: name.prefix, local: name.local };
}

function emptySpan(): { start: number; end: number } {
  return { start: 0, end: 0 };
}

function shiftedSpan(span: { start: number; end: number }, offset: number): { start: number; end: number } {
  return { start: span.start + offset, end: span.end + offset };
}

function syntheticNode(
  id: NodeId,
  name: ElementName,
  attributes: Attribute[],
  children: ElementNode[],
  instance: NodeId | undefined,
): ElementNode {
  return {
    id,
    name,
    attributes,
    children,
    spans: { openTag: emptySpan(), inner: emptySpan(), closeTag: null },
    tagDirty: false,
    childrenDirty: false,
    ...(instance === undefined ? {} : { derived: { kind: 'template-container', instance } }),
  };
}

function cloneSheet(sheet: StyleSheet, offset: number, sourceDocumentFrom: string): StyleSheet {
  const items: SheetItem[] = sheet.items.map((item) => {
    if (item.kind !== 'import' || item.resolvedSheet === undefined) {
      return item.kind === 'rule'
        ? {
            ...item,
            rule: {
              ...item.rule,
              selectors: item.rule.selectors.map((selector) => ({
                ...selector,
                parts: selector.parts.map((part) => ({ ...part, simple: [...part.simple] })),
              })),
              declarations: item.rule.declarations.map((declaration) => ({ ...declaration })),
            },
          }
        : { ...item };
    }
    return { ...item, resolvedSheet: item.resolvedSheet + offset };
  });
  return { ...sheet, items, sourceDocumentFrom };
}

function ensureSheets(record: LoadedTemplate, context: ExpansionContext): readonly number[] {
  const existing = context.sheetOffsets.get(record.document);
  if (existing !== undefined) return existing;
  const offset = context.sheets.length;
  const offsets = record.document.sheets.map((_, index) => offset + index);
  const from = record.document.sheets.map(() => record.url);
  record.document.sheets.forEach((sheet, index) => {
    for (const item of sheet.items) {
      if (item.kind === 'import' && item.resolvedSheet !== undefined) {
        from[item.resolvedSheet] = sheet.origin ?? record.url;
      }
    }
  });
  context.sheetOffsets.set(record.document, offsets);
  record.document.sheets.forEach((sheet, index) =>
    context.sheets.push(cloneSheet(sheet, offset, from[index]!)),
  );
  return offsets;
}

function ensureSource(document: UxmlDocument, context: ExpansionContext): number {
  const existing = context.sourceOffsets.get(document);
  if (existing !== undefined) return existing;
  const offset = context.sourceLength + 1;
  context.sourceOffsets.set(document, offset);
  context.sources.push(`\n${document.source}`);
  context.sourceLength += document.source.length + 1;
  return offset;
}

function addScopedRoots(
  record: LoadedTemplate,
  offsets: readonly number[],
  sourceMap: SourceMap,
  container: ElementNode,
  context: ExpansionContext,
): void {
  for (const root of record.document.styleRoots ?? []) {
    const sheet = offsets[root.sheet];
    if (sheet === undefined) continue;
    // A stylesheet attached at the template document root is attached to the
    // generated container. Nested `<Style>` elements retain their clone scope.
    const scope = sourceMap.nodes.get(root.scope) ?? container.id;
    context.styleRoots.push({ sheet, scope });
  }
}

function descriptors(children: readonly ElementNode[]): string[] {
  return children.map((child) => {
    const name = decodedAttribute(child, 'name');
    const slot = decodedAttribute(child, 'slot');
    const tag = child.name.local;
    return `<${tag}${name === undefined ? '' : ` name="${name}"`}${slot === undefined ? '' : ` slot="${slot}"`}>`;
  });
}

function collectSlotDefinitions(node: ElementNode, out: Set<string>): void {
  const slot = decodedAttribute(node, 'slot-name');
  if (slot !== undefined && slot.length > 0) out.add(slot);
  for (const child of node.children) collectSlotDefinitions(child, out);
}

function reportSlots(
  instance: ElementNode,
  children: readonly ElementNode[],
  record: LoadedTemplate | null,
  sourceDocument: string | undefined,
  context: ExpansionContext,
): void {
  const defined = new Set<string>();
  if (record !== null) collectSlotDefinitions(record.document.root, defined);
  if (defined.size === 0 && children.length === 0) return;
  addWarning(
    context.warnings,
    'template-slot-unsupported',
    `Template slots are unsupported; defined slot names: ${
      record === null ? '(unavailable)' : defined.size === 0 ? '(none)' : [...defined].join(', ')
    }; children not placed: ${children.length === 0 ? '(none)' : descriptors(children).join(', ')}`,
    instance,
    sourceDocument,
  );
}

function collectNames(node: ElementNode, names: Map<string, number>): void {
  if (node.name.local !== 'Style' && node.name.local !== 'Template' && node.name.local !== 'AttributeOverrides') {
    const name = decodedAttribute(node, 'name');
    if (name !== undefined && name.length > 0) names.set(name, (names.get(name) ?? 0) + 1);
  }
  for (const child of node.children) collectNames(child, names);
}

function allNamed(node: ElementNode, name: string, out: ElementNode[]): void {
  if (decodedAttribute(node, 'name') === name) out.push(node);
  for (const child of node.children) allNamed(child, name, out);
}

function applyOverrides(
  container: ElementNode,
  overrides: readonly ElementNode[],
  sourceOffset: number,
  sourceDocument: string | null,
  context: ExpansionContext,
): void {
  if (overrides.length === 0) return;
  const available = new Map<string, number>();
  collectNames(container, available);
  for (const override of overrides) {
    const requested = decodedAttribute(override, 'element-name');
    const ignoredStyle = decodedAttribute(override, 'style');
    if (ignoredStyle !== undefined) {
      addWarning(
        context.warnings,
        'override-style-ignored',
        `AttributeOverrides style for element-name "${requested ?? '(missing)'}" was ignored with value "${ignoredStyle}"; Unity ignores style AttributeOverrides, so this matches Unity and is not a preview limitation.`,
        override,
        sourceDocument ?? undefined,
      );
    }
    if (requested === undefined || requested.length === 0) continue;
    const targets: ElementNode[] = [];
    allNamed(container, requested, targets);
    if (targets.length === 0) {
      const names = [...available.keys()];
      addWarning(
        context.warnings,
        'override-target-missing',
        `AttributeOverrides target "${requested}" matched no element; available names: ${
          names.length === 0 ? '(none)' : names.join(', ')
        }`,
        override,
        sourceDocument ?? undefined,
      );
      continue;
    }
    for (const target of targets) {
      for (const item of override.attributes) {
        if (item.name === 'element-name' || item.name === 'style') continue;
        const existing = target.attributes.find((candidate) => candidate.name === item.name);
        if (existing === undefined) {
          target.attributes.push(cloneAttribute(item, sourceOffset, sourceDocument));
        } else {
          existing.value = item.value;
          existing.sourceDocument = sourceDocument;
        }
      }
    }
  }
}

function hasTemplateSyntax(node: ElementNode): boolean {
  if (node.name.local === 'Template' || node.name.local === 'Instance') return true;
  return node.children.some(hasTemplateSyntax);
}

function makeContext(document: UxmlDocument, resolver: TemplateResolver | undefined): ExpansionContext {
  let next = 0;
  const visit = (node: ElementNode): void => {
    next = Math.max(next, Number(node.id) + 1);
    for (const child of node.children) visit(child);
  };
  visit(document.root);
  return {
    resolver,
    warnings: [],
    cache: new Map(),
    sheetOffsets: new WeakMap(),
    reportedWarnings: new WeakSet(),
    sourceOffsets: new WeakMap([[document, 0]]),
    sources: [document.source],
    sourceLength: document.source.length,
    sheets: [...document.sheets],
    styleRoots: [...(document.styleRoots ?? [])],
    nextId: () => next++ as NodeId,
    stack: [],
  };
}

function loadTemplate(
  declaration: TemplateDeclaration,
  from: string | null,
  context: ExpansionContext,
): LoadedTemplate | null {
  const key = cacheKey(declaration.src, from);
  if (context.cache.has(key)) return context.cache.get(key) ?? null;

  const text = context.resolver?.(declaration.src, from) ?? null;
  if (text === null) {
    context.cache.set(key, null);
    addWarning(
      context.warnings,
      'template-src-unresolved',
      `Template "${declaration.name}" src "${declaration.src}" could not be resolved from ${
        from === null ? 'the entry UXML' : `"${from}"`
      }; attempted resolveImport("${declaration.src}", ${from === null ? 'null' : `"${from}"`}); internal filesystem search paths: none`,
      declaration.node,
      from ?? undefined,
    );
    if (packagePath(declaration.src)) {
      addWarning(
        context.warnings,
        'package-path-not-searched',
        `Template src "${declaration.src}" was unresolved; the resolver returned no source and the core does not independently search Unity Packages/Library/PackageCache paths`,
        declaration.node,
        from ?? undefined,
      );
    }
    return null;
  }

  // Insert a sentinel before parsing nested declarations. The cache entry is
  // replaced after parse; recursive references are caught by `stack`, while a
  // resolver that returns the same text still only performs one I/O call.
  const parser = parseTemplateDocument;
  if (parser === undefined) {
    throw new Error('template parser is not registered; import parse from src/index before expansion');
  }
  // A <Style src> written in this UXML is relative to this UXML, while an
  // @import is relative to the stylesheet that contains it. parse() signals
  // the former with `from === null`, so supply the template URL there only.
  const parsed = parser(
    text,
    context.resolver === undefined
      ? undefined
      : (url, nestedFrom) => context.resolver!(url, nestedFrom ?? declaration.src),
  );
  const record: LoadedTemplate = {
    url: declaration.src,
    from,
    document: parsed,
    declarations: templateDeclarations(parsed),
  };
  context.cache.set(key, record);
  return record;
}

function addLoadedWarnings(
  record: LoadedTemplate,
  offsets: readonly number[],
  context: ExpansionContext,
): void {
  if (context.reportedWarnings.has(record.document)) return;
  context.reportedWarnings.add(record.document);
  for (const warning of record.document.warnings) {
    if (warning.at?.in === 'uss') {
      context.warnings.push({
        ...warning,
        at: { ...warning.at, sheet: offsets[warning.at.sheet] ?? warning.at.sheet },
        sourceDocument: record.document.sheets[warning.at.sheet]?.origin ?? record.url,
      });
    } else {
      context.warnings.push({ ...warning, sourceDocument: record.url });
    }
  }
}

function cloneSourceNode(
  source: ElementNode,
  context: ExpansionContext,
  sourceMap: SourceMap,
  containing: LoadedTemplate | null,
  preserveId: boolean,
  depth: number,
): ElementNode {
  const id = preserveId ? source.id : context.nextId();
  const sourceOffset = containing === null ? 0 : context.sourceOffsets.get(containing.document) ?? 0;
  const sourceDocument =
    sourceOffset === 0 || containing === null ? undefined : containing.url;
  const result: ElementNode = {
    id,
    name: cloneName(source.name),
    attributes: source.attributes.map((item) => cloneAttribute(item, sourceOffset, sourceDocument)),
    children: [],
    spans: {
      openTag: shiftedSpan(source.spans.openTag, sourceOffset),
      inner: shiftedSpan(source.spans.inner, sourceOffset),
      closeTag: source.spans.closeTag === null ? null : shiftedSpan(source.spans.closeTag, sourceOffset),
    },
    tagDirty: source.tagDirty,
    childrenDirty: source.childrenDirty,
    ...(sourceOffset === 0 || containing === null
      ? {}
      : {
          sourceDocument: containing.url,
          sourceDocumentFrom: containing.from,
          sourceNode: source.id,
        }),
  };
  sourceMap.nodes.set(source.id, result.id);
  for (const child of source.children) {
    if (child.name.local === 'Template' || child.name.local === 'Style') continue;
    if (child.name.local === 'Instance') {
      result.children.push(expandInstance(child, context, containing, sourceMap, depth + 1));
      continue;
    }
    if (child.name.local === 'AttributeOverrides') continue;
    if (decodedAttribute(child, 'slot') !== undefined) {
      // Slot children are handled by the owning Instance, not by ordinary
      // recursive cloning. Keeping this guard prevents accidental placement if
      // a malformed input puts one directly in a template document.
      continue;
    }
    result.children.push(cloneSourceNode(child, context, sourceMap, containing, preserveId, depth));
  }
  return result;
}

function cloneTemplateChildren(
  record: LoadedTemplate,
  container: ElementNode,
  context: ExpansionContext,
  depth: number,
): SourceMap {
  ensureSource(record.document, context);
  const sourceMap: SourceMap = { nodes: new Map([[record.document.root.id, container.id]]) };
  for (const child of record.document.root.children) {
    if (child.name.local === 'Template' || child.name.local === 'Style') continue;
    if (child.name.local === 'Instance') {
      container.children.push(expandInstance(child, context, record, sourceMap, depth + 1));
      continue;
    }
    if (child.name.local === 'AttributeOverrides') continue;
    if (decodedAttribute(child, 'slot') !== undefined) continue;
    container.children.push(cloneSourceNode(child, context, sourceMap, record, false, depth));
  }
  return sourceMap;
}

function expandInstance(
  instance: ElementNode,
  context: ExpansionContext,
  containing: LoadedTemplate | null,
  sourceMap: SourceMap,
  depth: number,
): ElementNode {
  const container = syntheticNode(
    context.nextId(),
    { prefix: instance.name.prefix, local: 'TemplateContainer' },
    instance.attributes
      .filter((item) => item.name !== 'template')
      .map((item) =>
        cloneAttribute(
          item,
          containing === null ? 0 : context.sourceOffsets.get(containing.document) ?? 0,
          containing === null || containing.url.length === 0 ? null : containing.url,
        ),
      ),
    [],
    instance.id,
  );
  if (containing !== null) {
    container.sourceDocument = containing.url.length > 0 ? containing.url : null;
    container.sourceDocumentFrom = containing.from;
  }
  sourceMap.nodes.set(instance.id, container.id);

  const templateName = decodedAttribute(instance, 'template');
  const slotChildren = instance.children.filter((child) => decodedAttribute(child, 'slot') !== undefined);
  const sourceDocument =
    containing === null || containing.url.length === 0 ? undefined : containing.url;
  const declaration = containing?.declarations.get(templateName ?? '');
  if (declaration === undefined) {
    reportSlots(instance, slotChildren, null, sourceDocument, context);
    addWarning(
      context.warnings,
      'template-not-declared',
      `Instance${templateName === undefined ? '' : ` template "${templateName}"`} has no matching Template declaration`,
      instance,
      sourceDocument,
    );
    return container;
  }

  const from = containing === null || containing.url.length === 0 ? null : containing.url;
  const pathEntry = {
    key: JSON.stringify([declaration.name, declaration.src, from]),
    label: `${declaration.name}@${declaration.src}`,
  };
  const cycleAt = context.stack.findIndex((entry) => entry.key === pathEntry.key);
  if (cycleAt >= 0) {
    const cached = context.cache.get(cacheKey(declaration.src, from)) ?? null;
    reportSlots(instance, slotChildren, cached, sourceDocument, context);
    const path = [...context.stack.slice(cycleAt), pathEntry]
      .map((entry) => entry.label)
      .join(' -> ');
    addWarning(
      context.warnings,
      'template-cycle',
      `Template cycle detected: ${path}`,
      instance,
      sourceDocument,
    );
    return container;
  }
  if (depth >= MAX_TEMPLATE_DEPTH) {
    reportSlots(instance, slotChildren, null, sourceDocument, context);
    addWarning(
      context.warnings,
      'template-depth-exceeded',
      `Template expansion exceeded the depth limit ${MAX_TEMPLATE_DEPTH}: ${[
        ...context.stack,
        pathEntry,
      ].map((entry) => entry.label).join(' -> ')}`,
      instance,
      sourceDocument,
    );
    return container;
  }

  const record = loadTemplate(declaration, from, context);
  if (record === null) {
    reportSlots(instance, slotChildren, null, sourceDocument, context);
    return container;
  }

  ensureSource(record.document, context);
  context.stack.push(pathEntry);
  const templateMap = cloneTemplateChildren(record, container, context, depth);
  context.stack.pop();
  const offsets = ensureSheets(record, context);
  addLoadedWarnings(record, offsets, context);
  addScopedRoots(record, offsets, templateMap, container, context);

  const overrides = instance.children.filter((child) => child.name.local === 'AttributeOverrides');
  reportSlots(instance, slotChildren, record, sourceDocument, context);
  applyOverrides(
    container,
    overrides,
    containing === null ? 0 : context.sourceOffsets.get(containing.document) ?? 0,
    containing === null || containing.url.length === 0 ? null : containing.url,
    context,
  );

  // A non-slot child is retained as ordinary instance content. Slot children
  // were intentionally omitted above; AttributeOverrides are instructions.
  for (const child of instance.children) {
    if (
      child.name.local === 'AttributeOverrides' ||
      child.name.local === 'Style' ||
      decodedAttribute(child, 'slot') !== undefined
    ) continue;
    container.children.push(cloneSourceNode(child, context, sourceMap, containing, false, depth));
  }
  return container;
}

/**
 * Expand all instances in a document into a derived tree.
 *
 * The entry UXML is represented as a tiny loaded record so the same recursive
 * path handles top-level and nested declarations. Its URL is null by contract.
 */
export function expandTemplates(document: UxmlDocument): TemplateExpansion {
  if (!hasTemplateSyntax(document.root)) return { document, warnings: [] };
  const context = makeContext(document, resolvers.get(document));
  const entryStyleRootCount = context.styleRoots.length;
  const entry: LoadedTemplate = {
    url: '',
    from: null,
    document,
    declarations: templateDeclarations(document),
  };
  const sourceMap: SourceMap = { nodes: new Map([[document.root.id, document.root.id]]) };
  const root: ElementNode = {
    id: document.root.id,
    name: cloneName(document.root.name),
    attributes: document.root.attributes.map((item) => cloneAttribute(item)),
    children: [],
    spans: {
      openTag: { ...document.root.spans.openTag },
      inner: { ...document.root.spans.inner },
      closeTag: document.root.spans.closeTag === null ? null : { ...document.root.spans.closeTag },
    },
    tagDirty: document.root.tagDirty,
    childrenDirty: document.root.childrenDirty,
  };
  for (const child of document.root.children) {
    if (child.name.local === 'Template' || child.name.local === 'Style') continue;
    if (child.name.local === 'Instance') {
      root.children.push(expandInstance(child, context, entry, sourceMap, 0));
      continue;
    }
    if (child.name.local === 'AttributeOverrides') continue;
    if (decodedAttribute(child, 'slot') !== undefined) continue;
    root.children.push(cloneSourceNode(child, context, sourceMap, entry, true, 0));
  }
  for (let index = 0; index < entryStyleRootCount; index++) {
    const styleRoot = context.styleRoots[index]!;
    const scope = sourceMap.nodes.get(styleRoot.scope);
    if (scope !== undefined) context.styleRoots[index] = { ...styleRoot, scope };
  }

  const names = new Map<string, number>();
  collectNames(root, names);
  for (const [name, count] of names) {
    if (count > 1) {
      addWarning(
        context.warnings,
        'duplicate-name-in-tree',
        `name "${name}" occurs ${count} times after template expansion`,
      );
    }
  }

  return {
    document: {
      ...document,
      root,
      source: context.sources.join(''),
      sheets: context.sheets,
      styleRoots: context.styleRoots,
    },
    warnings: context.warnings,
  };
}
