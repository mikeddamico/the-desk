export interface CodePointSpan {
  start: number;
  end: number;
}

export function normalizeSpokenText(text: string): string {
  return text.normalize("NFC");
}

export function sliceCodePointSpan(text: string, span: CodePointSpan): string {
  const points = Array.from(normalizeSpokenText(text));
  if (
    !Number.isInteger(span.start) ||
    !Number.isInteger(span.end) ||
    span.start < 0 ||
    span.end < span.start ||
    span.end > points.length
  ) {
    throw new RangeError(
      "Invalid zero-based, half-open Unicode code-point span",
    );
  }
  return points.slice(span.start, span.end).join("");
}

export function locateCodePointSpan(
  text: string,
  substring: string,
): CodePointSpan {
  const points = Array.from(normalizeSpokenText(text));
  const needle = Array.from(normalizeSpokenText(substring));
  for (let start = 0; start <= points.length - needle.length; start += 1) {
    if (needle.every((point, offset) => point === points[start + offset]))
      return { start, end: start + needle.length };
  }
  throw new RangeError("Substring is absent from canonical spoken text");
}
