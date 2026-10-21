// pngjs ships no types; the E2 test only decodes a PNG (tests/contract-070/e2-editor-checkbox.test.ts).
declare module 'pngjs' {
  export const PNG: { sync: { read(data: Buffer): { width: number; height: number; data: Buffer } } };
}
