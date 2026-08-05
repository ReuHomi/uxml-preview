/**
 * XML entity decoding, for the moment a stored attribute becomes a real value.
 *
 * The parser deliberately keeps attribute values exactly as written — that is
 * what makes serialization byte-exact — so `&amp;` survives in the model. Any
 * consumer that means to *use* the value rather than re-emit it has to decode
 * first, and there are two: painted text, and paths handed to the host's
 * resolver hooks. A `<Style src="…?a=1&amp;b=2">` reaching `resolveImport`
 * undecoded gives the host `amp;b=2` to parse, which is not a thing.
 */

/**
 * Purpose:      turn stored attribute text into the value it stands for.
 * Ensures:      never throws. A numeric reference outside the Unicode range
 *               makes `String.fromCodePoint` raise a RangeError, and one bad
 *               character must not take down a render (CLAUDE.md rule 6).
 *               Unreadable references are left as written, which also
 *               round-trips.
 */
export function decodeEntities(text: string): string {
  const codePoint = (value: number, original: string): string => {
    if (!Number.isInteger(value) || value < 0 || value > 0x10ffff) return original;
    // Surrogate halves are not standalone characters.
    if (value >= 0xd800 && value <= 0xdfff) return original;
    return String.fromCodePoint(value);
  };

  return text
    .replace(/&#x([0-9a-f]+);/gi, (match, hex: string) => codePoint(parseInt(hex, 16), match))
    .replace(/&#(\d+);/g, (match, dec: string) => codePoint(Number(dec), match))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}
