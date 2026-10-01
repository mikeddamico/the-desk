// Rejection of input outside a declared closed profile (Hashing v0.1.5 section 1.1). Extends TypeError so existing
// shape-error handling keeps working; `code` is the stable, documented rejection code asserted by the vectors.
export class ProfileRejected extends TypeError {
  readonly code: string;
  constructor(code: string, detail = "") {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "ProfileRejected";
    this.code = code;
  }
}

/** Exact own-key equality with a profile list; a mismatch is rejected with the profile's code. */
export function requireProfileKeys(
  value: unknown,
  keys: readonly string[],
  code: string,
): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(value, key))
  )
    throw new ProfileRejected(code);
  return value as Record<string, unknown>;
}
