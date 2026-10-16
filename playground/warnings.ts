import type { Warning } from '../src/index';

export interface WarningView {
  badge: string;
  message: string;
  details: string[];
}

/**
 * Purpose:      the one place a warning becomes what the page shows.
 */
export function describeWarning(w: Warning): WarningView {
  const details: string[] = [];
  const subject = w.subject;
  if (subject?.kind === 'property') {
    if (subject.unityEffect !== undefined) {
      const { kind, versions } = subject.unityEffect;
      details.push(`Unity ${versions.join(', ')}: ${kind === 'unstyled-from-here'
        ? 'this element and every element after it lose their style.'
        : 'every inline style in this file is dropped.'}`);
    }
    if (subject.missingGlyphs !== undefined) {
      const scripts = { hangul: 'Hangul', han: 'Han (CJK ideographs)', kana: 'Kana' };
      details.push(`The default font (Inter) has no ${scripts[subject.missingGlyphs]} glyphs; Unity draws them with a fallback font.`);
    }
    if (subject.replacements !== undefined) {
      details.push(`Write ${subject.replacements.join(', ')} instead.`);
    }
    if (subject.since !== undefined) details.push(`Unity ${subject.since}+ only.`);
    if (subject.affectsLayout === true) {
      details.push("Unity's coordinates may differ from this preview's.");
    }
  }
  if (subject?.kind === 'states-key' && subject.problem !== undefined) {
    details.push(`states key: ${subject.problem}`);
  }
  if (w.nodes !== undefined && w.nodes.length > 1) details.push(`${w.nodes.length} elements`);
  return { badge: w.reason ?? w.kind, message: w.message, details };
}
