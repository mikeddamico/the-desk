import { describe, expect, it } from "vitest";
import {
  normalizeSpokenText,
  sliceCodePointSpan,
  locateCodePointSpan,
} from "../src/identity/spans.js";

describe("Unicode spoken-text boundaries", () => {
  it("rejects lone high/low surrogates in text and search needles", () => {
    for (const text of ["\ud800", "hello\udfff", "\ud800x"]) {
      expect(() => normalizeSpokenText(text)).toThrow(/surrogate/);
      expect(() => sliceCodePointSpan(text, { start: 0, end: 1 })).toThrow(
        /surrogate/,
      );
      expect(() => locateCodePointSpan("hello", text)).toThrow(/surrogate/);
      expect(() => locateCodePointSpan(text, "hello")).toThrow(/surrogate/);
    }
    expect(sliceCodePointSpan("e\u0301😀!", { start: 1, end: 2 })).toBe("😀");
  });
});
