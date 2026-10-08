/**
 * Unwired physical PCM measurement and exact caller-input arithmetic.
 * Accepted g1-pcm48k-measurement/1 contract; no take/end/admission authority.
 * Realm trust and native dependency limits are documented alongside this module.
 */
import { Buffer } from "node:buffer";
import { hash } from "node:crypto";
import { types } from "node:util";

export const PROFILE = "g1-pcm48k-measurement/1";

export type Rational = Readonly<{ numerator: string; denominator: string }>;
export type PcmError =
  | "input_proxy_refused"
  | "input_type_invalid"
  | "input_prototype_unsupported"
  | "shared_buffer_refused"
  | "resizable_buffer_refused"
  | "input_bytes_unavailable"
  | "input_resource_limit"
  | "snapshot_resource_failure"
  | "header_truncated"
  | "riff_tag_invalid"
  | "wave_tag_invalid"
  | "fmt_tag_invalid"
  | "fmt_size_invalid"
  | "codec_invalid"
  | "channels_invalid"
  | "sample_rate_invalid"
  | "byte_rate_invalid"
  | "block_align_invalid"
  | "bits_per_sample_invalid"
  | "data_tag_invalid"
  | "data_size_odd"
  | "riff_size_overflow"
  | "riff_size_mismatch"
  | "data_length_mismatch";
export type PcmDiagnostic =
  | "zero_frames"
  | "below_test_min_frames"
  | "above_test_max_frames";
export type PcmResult =
  | Readonly<{ kind: "rejected"; profile: typeof PROFILE; code: PcmError }>
  | Readonly<{
      kind: "measured";
      profile: typeof PROFILE;
      format: "pcm_s16le";
      sample_rate_hz: 48000;
      channels: 1;
      bits_per_sample: 16;
      header_bytes: 44;
      byte_length: string;
      data_byte_length: string;
      frame_count: string;
      sha256: string;
      duration_seconds: Rational;
      diagnostics: readonly PcmDiagnostic[];
    }>;
export type ArithmeticError =
  | "record_proxy_refused"
  | "record_type_invalid"
  | "record_prototype_unsupported"
  | "record_shape_invalid"
  | "record_accessor_refused"
  | "integer_text_invalid"
  | "integer_text_too_long"
  | "denominator_zero"
  | "multiplier_zero"
  | "rational_not_reduced";
export type CeilingField =
  | "input"
  | "planned_seconds"
  | "planned_seconds.numerator"
  | "planned_seconds.denominator"
  | "multiplier"
  | "multiplier.numerator"
  | "multiplier.denominator";
export type ComparisonField = "input" | "frame_count" | "ceiling_frames";
type Field = CeilingField | ComparisonField;
type Rejection<F extends Field> = Readonly<{
  kind: "rejected";
  profile: typeof PROFILE;
  code: ArithmeticError;
  field: F;
}>;
export type CeilingResult =
  | Rejection<CeilingField>
  | Readonly<{
      kind: "computed";
      profile: typeof PROFILE;
      planned_seconds: Rational;
      multiplier: Rational;
      sample_rate_hz: 48000;
      rounding: "floor";
      ceiling_frames: string;
    }>;
export type ComparisonResult =
  | Rejection<ComparisonField>
  | Readonly<{
      kind: "compared";
      profile: typeof PROFILE;
      frame_count: string;
      ceiling_frames: string;
      relation: "below" | "equal" | "above";
      excess_frames: string;
    }>;

// Capture at initialization in the supported, uncompromised selected realm.
// No source-object iteration/coercion/copy convenience APIs are used.
const isProxy = types.isProxy;
const isUint8Array = types.isUint8Array;
const isArrayBuffer = types.isArrayBuffer;
const isSharedArrayBuffer = types.isSharedArrayBuffer;
const getPrototype = Object.getPrototypeOf;
const descriptor = Object.getOwnPropertyDescriptor;
const ownKeys = Reflect.ownKeys;
const apply = Reflect.apply;
const hasOwn = Object.hasOwn;
const freeze = Object.freeze;
const isArray = Array.isArray;
const isSafeInteger = Number.isSafeInteger;
const integer = BigInt;
const bigintMethods: {
  readonly toString: (radix?: number) => string;
} = BigInt.prototype;
const integerToString = bigintMethods.toString;
const stringMethods: {
  readonly charCodeAt: (index: number) => number;
} = String.prototype;
const charCodeAt = stringMethods.charCodeAt;
const Bytes = Uint8Array;
const uint8Prototype = Uint8Array.prototype;
const bufferPrototype: unknown = Buffer.prototype;
const arrayBufferPrototype = ArrayBuffer.prototype;
const objectPrototype = Object.prototype;
const typeErrorPrototype = TypeError.prototype;
const rangeErrorPrototype = RangeError.prototype;
const rawHash = hash;

function nativeGetter(prototype: object, key: string): () => unknown {
  const accessor: { readonly get?: () => unknown } | undefined = descriptor(
    prototype,
    key,
  );
  const getter = accessor?.get;
  if (!getter) throw new Error("required native PCM accessor unavailable");
  return getter;
}
const typedPrototype: unknown = getPrototype(uint8Prototype);
if (typeof typedPrototype !== "object" || typedPrototype === null)
  throw new Error("required native typed-array prototype unavailable");
const getBuffer = nativeGetter(typedPrototype, "buffer");
const getOffset = nativeGetter(typedPrototype, "byteOffset");
const getLength = nativeGetter(typedPrototype, "byteLength");
const getBackingLength = nativeGetter(arrayBufferPrototype, "byteLength");
const getResizable = nativeGetter(arrayBufferPrototype, "resizable");

function text(n: bigint): string {
  const result: unknown = apply(integerToString, n, []);
  if (typeof result !== "string")
    throw new Error("native integer text unavailable");
  return result;
}
function gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a;
}
function reduced(n: bigint, d: bigint): Rational {
  const factor = gcd(n, d);
  return freeze({ numerator: text(n / factor), denominator: text(d / factor) });
}
function refuse<F extends Field>(
  code: ArithmeticError,
  field: F,
): Rejection<F> {
  return freeze({ kind: "rejected", profile: PROFILE, code, field });
}
function pcmRefusal(code: PcmError): PcmResult {
  return freeze({ kind: "rejected", profile: PROFILE, code });
}

type Captured = Readonly<{ kind: "record"; first: unknown; second: unknown }>;
function record<F extends Field>(
  input: unknown,
  field: F,
  first: string,
  second: string,
  firstField: F,
  secondField: F,
): Captured | Rejection<F> {
  if (isProxy(input)) return refuse("record_proxy_refused", field);
  if (typeof input !== "object" || input === null || isArray(input)) {
    return refuse("record_type_invalid", field);
  }
  const prototype: unknown = getPrototype(input);
  if (prototype !== objectPrototype && prototype !== null) {
    return refuse("record_prototype_unsupported", field);
  }
  const keys = ownKeys(input);
  if (
    keys.length !== 2 ||
    !(
      (keys[0] === first && keys[1] === second) ||
      (keys[0] === second && keys[1] === first)
    )
  )
    return refuse("record_shape_invalid", field);
  // BOTH descriptors, in declared order, before ANY value validation.
  const a = descriptor(input, first);
  if (!a) return refuse("record_shape_invalid", field);
  if (!hasOwn(a, "value")) return refuse("record_accessor_refused", firstField);
  const firstValue: unknown = a.value;
  const b = descriptor(input, second);
  if (!b) return refuse("record_shape_invalid", field);
  if (!hasOwn(b, "value"))
    return refuse("record_accessor_refused", secondField);
  const secondValue: unknown = b.value;
  return { kind: "record", first: firstValue, second: secondValue };
}
type IntegerValue = Readonly<{
  kind: "integer";
  value: bigint;
  spelling: string;
}>;
function unsigned<F extends Field>(
  input: unknown,
  limit: 36 | 120,
  field: F,
): IntegerValue | Rejection<F> {
  if (typeof input !== "string") return refuse("integer_text_invalid", field);
  if (input.length > limit) return refuse("integer_text_too_long", field);
  if (input.length === 0) return refuse("integer_text_invalid", field);
  for (let i = 0; i < input.length; i += 1) {
    const code: unknown = apply(charCodeAt, input, [i]);
    if (typeof code !== "number" || code < 48 || code > 57) {
      return refuse("integer_text_invalid", field);
    }
    if (i === 0 && code === 48 && input.length !== 1) {
      return refuse("integer_text_invalid", field);
    }
  }
  return { kind: "integer", value: integer(input), spelling: input };
}
type ParsedRational = Readonly<{
  kind: "rational";
  n: bigint;
  d: bigint;
  value: Rational;
}>;
function rational(
  input: unknown,
  field: "planned_seconds" | "multiplier",
): ParsedRational | Rejection<CeilingField> {
  const numeratorField = `${field}.numerator` as const;
  const denominatorField = `${field}.denominator` as const;
  const captured = record<CeilingField>(
    input,
    field,
    "numerator",
    "denominator",
    numeratorField,
    denominatorField,
  );
  if (captured.kind === "rejected") return captured;
  const n = unsigned(captured.first, 36, numeratorField);
  if (n.kind === "rejected") return n;
  const d = unsigned(captured.second, 36, denominatorField);
  if (d.kind === "rejected") return d;
  if (d.value === 0n) return refuse("denominator_zero", denominatorField);
  if (field === "multiplier" && n.value === 0n)
    return refuse("multiplier_zero", numeratorField);
  if (gcd(n.value, d.value) !== 1n)
    return refuse("rational_not_reduced", field);
  return {
    kind: "rational",
    n: n.value,
    d: d.value,
    value: freeze({ numerator: n.spelling, denominator: d.spelling }),
  };
}

export function computeRelativeFrameCeiling(input: unknown): CeilingResult {
  const captured = record<CeilingField>(
    input,
    "input",
    "planned_seconds",
    "multiplier",
    "planned_seconds",
    "multiplier",
  );
  if (captured.kind === "rejected") return captured;
  const planned = rational(captured.first, "planned_seconds");
  if (planned.kind === "rejected") return planned;
  const multiplier = rational(captured.second, "multiplier");
  if (multiplier.kind === "rejected") return multiplier;
  return freeze({
    kind: "computed",
    profile: PROFILE,
    planned_seconds: planned.value,
    multiplier: multiplier.value,
    sample_rate_hz: 48000,
    rounding: "floor",
    ceiling_frames: text(
      (planned.n * 48000n * multiplier.n) / (planned.d * multiplier.d),
    ),
  });
}
export function compareFrameCount(input: unknown): ComparisonResult {
  const captured = record<ComparisonField>(
    input,
    "input",
    "frame_count",
    "ceiling_frames",
    "frame_count",
    "ceiling_frames",
  );
  if (captured.kind === "rejected") return captured;
  const frames = unsigned(captured.first, 120, "frame_count");
  if (frames.kind === "rejected") return frames;
  const ceiling = unsigned(captured.second, 120, "ceiling_frames");
  if (ceiling.kind === "rejected") return ceiling;
  return freeze({
    kind: "compared",
    profile: PROFILE,
    frame_count: frames.spelling,
    ceiling_frames: ceiling.spelling,
    relation:
      frames.value < ceiling.value
        ? "below"
        : frames.value === ceiling.value
          ? "equal"
          : "above",
    excess_frames: text(
      frames.value > ceiling.value ? frames.value - ceiling.value : 0n,
    ),
  });
}

function byte(snapshot: Uint8Array, offset: number): number {
  const value = snapshot[offset];
  if (value === undefined) throw new Error("owned PCM byte unavailable");
  return value;
}
function u16(snapshot: Uint8Array, offset: number): number {
  return byte(snapshot, offset) + 256 * byte(snapshot, offset + 1);
}
function u32(snapshot: Uint8Array, offset: number): bigint {
  return (
    integer(byte(snapshot, offset)) +
    256n * integer(byte(snapshot, offset + 1)) +
    65536n * integer(byte(snapshot, offset + 2)) +
    16777216n * integer(byte(snapshot, offset + 3))
  );
}
function tag(
  snapshot: Uint8Array,
  offset: number,
  a: number,
  b: number,
  c: number,
  d: number,
): boolean {
  return (
    byte(snapshot, offset) === a &&
    byte(snapshot, offset + 1) === b &&
    byte(snapshot, offset + 2) === c &&
    byte(snapshot, offset + 3) === d
  );
}
export function measureCanonicalPcm(input: unknown): PcmResult {
  if (isProxy(input)) return pcmRefusal("input_proxy_refused");
  if (!isUint8Array(input)) return pcmRefusal("input_type_invalid");
  const prototype: unknown = getPrototype(input);
  if (prototype !== uint8Prototype && prototype !== bufferPrototype) {
    return pcmRefusal("input_prototype_unsupported");
  }
  const backing: unknown = apply(getBuffer, input, []);
  const offset: unknown = apply(getOffset, input, []);
  const length: unknown = apply(getLength, input, []);
  if (isSharedArrayBuffer(backing)) return pcmRefusal("shared_buffer_refused");
  if (
    !isArrayBuffer(backing) ||
    getPrototype(backing) !== arrayBufferPrototype
  ) {
    return pcmRefusal("input_prototype_unsupported");
  }
  if (apply(getResizable, backing, []) === true)
    return pcmRefusal("resizable_buffer_refused");
  const backingLength: unknown = apply(getBackingLength, backing, []);
  if (
    typeof offset !== "number" ||
    typeof length !== "number" ||
    typeof backingLength !== "number" ||
    !isSafeInteger(offset) ||
    !isSafeInteger(length) ||
    !isSafeInteger(backingLength) ||
    offset < 0 ||
    length < 0 ||
    backingLength < 0 ||
    offset > backingLength ||
    length > backingLength - offset
  ) {
    return pcmRefusal("input_bytes_unavailable");
  }
  if (length > 8388608) return pcmRefusal("input_resource_limit");
  let view: Uint8Array<ArrayBuffer>;
  try {
    view = new Bytes(backing, offset, length);
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      getPrototype(error) === typeErrorPrototype
    ) {
      return pcmRefusal("input_bytes_unavailable");
    }
    throw error;
  }
  let snapshot: Uint8Array<ArrayBuffer>;
  try {
    snapshot = new Bytes(length);
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      getPrototype(error) === rangeErrorPrototype
    ) {
      return pcmRefusal("snapshot_resource_failure");
    }
    throw error;
  }
  // Integer-indexed OWN views only. No header-controlled allocation or source methods.
  for (let i = 0; i < length; i += 1) snapshot[i] = byte(view, i);
  if (length < 44) return pcmRefusal("header_truncated");
  if (!tag(snapshot, 0, 82, 73, 70, 70)) return pcmRefusal("riff_tag_invalid");
  if (!tag(snapshot, 8, 87, 65, 86, 69)) return pcmRefusal("wave_tag_invalid");
  if (!tag(snapshot, 12, 102, 109, 116, 32))
    return pcmRefusal("fmt_tag_invalid");
  if (u32(snapshot, 16) !== 16n) return pcmRefusal("fmt_size_invalid");
  if (u16(snapshot, 20) !== 1) return pcmRefusal("codec_invalid");
  if (u16(snapshot, 22) !== 1) return pcmRefusal("channels_invalid");
  if (u32(snapshot, 24) !== 48000n) return pcmRefusal("sample_rate_invalid");
  if (u32(snapshot, 28) !== 96000n) return pcmRefusal("byte_rate_invalid");
  if (u16(snapshot, 32) !== 2) return pcmRefusal("block_align_invalid");
  if (u16(snapshot, 34) !== 16) return pcmRefusal("bits_per_sample_invalid");
  if (!tag(snapshot, 36, 100, 97, 116, 97))
    return pcmRefusal("data_tag_invalid");
  const dataLength = u32(snapshot, 40);
  if (dataLength % 2n !== 0n) return pcmRefusal("data_size_odd");
  if (36n + dataLength > 4294967295n) return pcmRefusal("riff_size_overflow");
  if (u32(snapshot, 4) !== 36n + dataLength)
    return pcmRefusal("riff_size_mismatch");
  if (integer(length) !== 44n + dataLength)
    return pcmRefusal("data_length_mismatch");
  const frames = dataLength / 2n;
  const diagnostics: readonly PcmDiagnostic[] = freeze(
    frames === 0n
      ? ["zero_frames", "below_test_min_frames"]
      : frames < 12000n
        ? ["below_test_min_frames"]
        : frames > 48000n
          ? ["above_test_max_frames"]
          : [],
  );
  return freeze({
    kind: "measured",
    profile: PROFILE,
    format: "pcm_s16le",
    sample_rate_hz: 48000,
    channels: 1,
    bits_per_sample: 16,
    header_bytes: 44,
    byte_length: text(integer(length)),
    data_byte_length: text(dataLength),
    frame_count: text(frames),
    sha256: rawHash("sha256", snapshot, "hex"),
    duration_seconds: reduced(frames, 48000n),
    diagnostics,
  });
}
