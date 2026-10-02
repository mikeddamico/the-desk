/** Unicode code-point length of an NFC string (Hashing section 8: spans are zero-based half-open code-point offsets). */
export function codePointLength(text: string): number {
  let n = 0;
  for (const _ of text) n += 1; // eslint-disable-line @typescript-eslint/no-unused-vars
  return n;
}
