import { Buffer } from "node:buffer";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { types } from "node:util";
import { describe, expect, it } from "vitest";

import * as api from "../../src/runtime/audio-measurements.js";
import {
  PROFILE,
  compareFrameCount,
  computeRelativeFrameCeiling,
  measureCanonicalPcm,
  type ArithmeticError,
  type CeilingField,
  type PcmError,
} from "../../src/runtime/audio-measurements.js";

const fixtures = [
  {
    frames: "0",
    header:
      "524946462400000057415645666d7420100000000100010080bb000000770100020010006461746100000000",
    payload: "",
    bytes: "44",
    hash: "531cd597b25052b4845ef2f3887dec2183240802a93b6e044960de8ba017caa0",
    n: "0",
    d: "1",
    diagnostics: ["zero_frames", "below_test_min_frames"],
  },
  {
    frames: "1",
    header:
      "524946462600000057415645666d7420100000000100010080bb000000770100020010006461746102000000",
    payload: "0100",
    bytes: "46",
    hash: "5def4207fc7f2942f4c2fc26b07179f2adce3648e9830e1785dd0fe7b22f559d",
    n: "1",
    d: "48000",
    diagnostics: ["below_test_min_frames"],
  },
  {
    frames: "2",
    header:
      "524946462800000057415645666d7420100000000100010080bb000000770100020010006461746104000000",
    payload: "0080ff7f",
    bytes: "48",
    hash: "07ec3078d251be398b1a78250245810b10af1e192e24ebdad79d5d1cc249ba51",
    n: "1",
    d: "24000",
    diagnostics: ["below_test_min_frames"],
  },
  {
    frames: "12000",
    header:
      "52494646e45d000057415645666d7420100000000100010080bb0000007701000200100064617461c05d0000",
    bytes: "24044",
    hash: "eca4d388a3695168ebd316e8e2094a2e1ffa5df4c37dbf6d8755dfe8ce5ed9a6",
    n: "1",
    d: "4",
    diagnostics: [],
  },
  {
    frames: "48000",
    header:
      "524946462477010057415645666d7420100000000100010080bb000000770100020010006461746100770100",
    bytes: "96044",
    hash: "0a8f76d89c709043814cb74f331a4578d17ff61256303bd0019a263d053f86e8",
    n: "1",
    d: "1",
    diagnostics: [],
  },
  {
    frames: "48001",
    header:
      "524946462677010057415645666d7420100000000100010080bb000000770100020010006461746102770100",
    bytes: "96046",
    hash: "45251f406edf34f09cca821afe4285a049c098eba1e535ff80ce949fc160ee37",
    n: "48001",
    d: "48000",
    diagnostics: ["above_test_max_frames"],
  },
  {
    frames: "4194282",
    header:
      "52494646f8ff7f0057415645666d7420100000000100010080bb0000007701000200100064617461d4ff7f00",
    bytes: "8388608",
    hash: "472d073d7f87a5fa49cb8e1e4e90bbcfefd97cd6c06f320e7354f6281ca1c88c",
    n: "699047",
    d: "8000",
    diagnostics: ["above_test_max_frames"],
  },
] as const;
function fixture(index = 1): Buffer {
  const f = fixtures[index];
  if (!f) throw new Error("test literal missing");
  const result = Buffer.alloc(Number(f.bytes));
  Buffer.from(f.header, "hex").copy(result);
  if ("payload" in f) Buffer.from(f.payload, "hex").copy(result, 44);
  return result;
}
function pcmReject(input: unknown, code: PcmError): void {
  expect(measureCanonicalPcm(input)).toEqual({
    kind: "rejected",
    profile: PROFILE,
    code,
  });
}
function ceiling(
  planned: unknown = { numerator: "1", denominator: "1" },
  multiplier: unknown = { numerator: "1", denominator: "1" },
): unknown {
  return { planned_seconds: planned, multiplier };
}
function arithmeticReject(
  input: unknown,
  code: ArithmeticError,
  field: CeilingField,
): void {
  expect(computeRelativeFrameCeiling(input)).toEqual({
    kind: "rejected",
    profile: PROFILE,
    code,
    field,
  });
}
function hostile(target: object): { proxy: object; count: () => number } {
  let calls = 0;
  const trap = () => {
    calls += 1;
    throw new Error("protected caller sentinel");
  };
  const proxy = new Proxy(target, {
    get: trap,
    getPrototypeOf: trap,
    ownKeys: trap,
    getOwnPropertyDescriptor: trap,
    has: trap,
    set: trap,
    defineProperty: trap,
    isExtensible: trap,
  });
  return { proxy, count: () => calls };
}
function accessor(target: object, key: PropertyKey, count: () => void): void {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    get() {
      count();
      throw new Error("protected accessor sentinel");
    },
  });
}

describe("physical PCM contract", () => {
  it("exports exactly the physical profile and three unwired functions", () => {
    expect(Object.keys(api).sort()).toEqual([
      "PROFILE",
      "compareFrameCount",
      "computeRelativeFrameCeiling",
      "measureCanonicalPcm",
    ]);
    expect(PROFILE).toBe("g1-pcm48k-measurement/1");
  });
  it.each(fixtures.map((f, i) => ({ f, i })))(
    "measures literal $f.frames frames without clamping",
    ({ f, i }) => {
      const input = fixture(i);
      const before = Buffer.from(input);
      expect(measureCanonicalPcm(input)).toEqual({
        kind: "measured",
        profile: PROFILE,
        format: "pcm_s16le",
        sample_rate_hz: 48000,
        channels: 1,
        bits_per_sample: 16,
        header_bytes: 44,
        byte_length: f.bytes,
        data_byte_length: String(Number(f.bytes) - 44),
        frame_count: f.frames,
        sha256: f.hash,
        duration_seconds: { numerator: f.n, denominator: f.d },
        diagnostics: f.diagnostics,
      });
      expect(input.equals(before)).toBe(true);
    },
  );
  it("zero is measured but empty input is malformed, not an end or valid-take result", () => {
    const result = measureCanonicalPcm(fixture(0));
    expect(result.kind).toBe("measured");
    expect(result).not.toHaveProperty("work_ended");
    expect(result).not.toHaveProperty("valid_take");
    pcmReject(new Uint8Array(0), "header_truncated");
  });
  it("resource one-byte excess refuses unknown before malformed header/cap inspection", () => {
    pcmReject(new Uint8Array(8388609), "input_resource_limit");
    const known = measureCanonicalPcm(fixture(5));
    expect(known.kind).toBe("measured");
    expect(known).toHaveProperty("frame_count", "48001");
  });
  const structural: readonly [string, number, number, PcmError][] = [
    ["RIFF", 0, 0, "riff_tag_invalid"],
    ["WAVE", 8, 0, "wave_tag_invalid"],
    ["fmt tag", 12, 0, "fmt_tag_invalid"],
    ["fmt size", 16, 18, "fmt_size_invalid"],
    ["codec", 20, 3, "codec_invalid"],
    ["channels", 22, 2, "channels_invalid"],
    ["sample rate", 24, 0, "sample_rate_invalid"],
    ["byte rate", 28, 1, "byte_rate_invalid"],
    ["block align", 32, 1, "block_align_invalid"],
    ["bits", 34, 8, "bits_per_sample_invalid"],
    ["data tag", 36, 0, "data_tag_invalid"],
  ];
  it.each(structural)(
    "rejects named header branch %s",
    (_name, offset, value, code) => {
      const input = fixture();
      input[offset] = value;
      pcmReject(input, code);
    },
  );
  it.each([0, 1, 43])("length %i rejects without header truth", (length) => {
    pcmReject(new Uint8Array(length), "header_truncated");
  });
  it("odd declared data beats overflow/mismatch", () => {
    const input = fixture();
    input.writeUInt32LE(4294967295, 40);
    input.writeUInt32LE(0, 4);
    pcmReject(input, "data_size_odd");
  });
  it("even unsigned overflow beats RIFF mismatch/short payload without declared-size allocation", () => {
    const input = fixture();
    input.writeUInt32LE(4294967294, 40);
    input.writeUInt32LE(0, 4);
    pcmReject(input, "riff_size_overflow");
  });
  it("RIFF mismatch beats exact data length mismatch", () => {
    const input = fixture();
    input.writeUInt32LE(0, 4);
    pcmReject(Buffer.concat([input, Buffer.from([0])]), "riff_size_mismatch");
  });
  it("matching header plus truncated payload or extra byte rejects exact length", () => {
    pcmReject(fixture().subarray(0, 45), "data_length_mismatch");
    pcmReject(
      Buffer.concat([fixture(), Buffer.from([0])]),
      "data_length_mismatch",
    );
  });
  it.each(["JUNK", "LIST"])(
    "does not search a later data chunk after %s at36",
    (tag) => {
      const input = Buffer.concat([fixture(), Buffer.from("data")]);
      input.write(tag, 36, "ascii");
      pcmReject(input, "data_tag_invalid");
    },
  );
  it.each(["RIFX", "RF64"])("rejects noncanonical RIFF variant %s", (tag) => {
    const input = fixture();
    input.write(tag, 0, "ascii");
    pcmReject(input, "riff_tag_invalid");
  });
  it("header truncation beats bad RIFF; RIFF beats WAVE; codec beats rate", () => {
    pcmReject(new Uint8Array(43), "header_truncated");
    const a = fixture();
    a[0] = 0;
    a[8] = 0;
    pcmReject(a, "riff_tag_invalid");
    const b = fixture();
    b[20] = 3;
    b[24] = 0;
    pcmReject(b, "codec_invalid");
  });
  it("data tag beats odd size, and trailing metadata fails exact length", () => {
    const input = fixture();
    input[36] = 0;
    input.writeUInt32LE(4294967295, 40);
    pcmReject(input, "data_tag_invalid");
    pcmReject(
      Buffer.concat([fixture(), Buffer.from("LISTmeta")]),
      "data_length_mismatch",
    );
  });
  it("nonzero-offset Uint8Array and pooled Buffer expose only their own view bytes", () => {
    const expected = fixtures[1];
    const surrounding = Buffer.allocUnsafe(200);
    surrounding.fill(99);
    fixture().copy(surrounding, 13);
    const b = surrounding.subarray(13, 59);
    const u = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
    for (const input of [b, u]) {
      const result = measureCanonicalPcm(input);
      expect(result).toHaveProperty("sha256", expected.hash);
      expect(result).toHaveProperty("byte_length", "46");
    }
    expect(surrounding[12]).toBe(99);
    expect(surrounding[59]).toBe(99);
  });
  it.each([
    "length",
    "buffer",
    "byteOffset",
    "byteLength",
    "constructor",
    "valueOf",
    "toJSON",
    "set",
    "slice",
    Symbol.iterator,
  ])("ignores own byte-view shadow %s", (key) => {
    const input = fixture();
    let calls = 0;
    accessor(input, key, () => {
      calls += 1;
    });
    expect(measureCanonicalPcm(input)).toHaveProperty(
      "sha256",
      fixtures[1].hash,
    );
    expect(calls).toBe(0);
  });
  it("retains frozen ordinary facts after input mutation; returns no exotic or snapshot alias", () => {
    const input = fixture();
    const result = measureCanonicalPcm(input);
    if (result.kind !== "measured")
      throw new Error("required measured result missing");
    input.fill(0);
    expect(result.sha256).toBe(fixtures[1].hash);
    expect(result.frame_count).toBe("1");
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.duration_seconds)).toBe(true);
    expect(Object.isFrozen(result.diagnostics)).toBe(true);
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(result.duration_seconds)).toBe(
      Object.prototype,
    );
    expect(Object.getPrototypeOf(result.diagnostics)).toBe(Array.prototype);
    expect(() =>
      Reflect.set(result.duration_seconds, "numerator", "999"),
    ).not.toThrow();
    expect(result.duration_seconds.numerator).toBe("1");
    expect(Reflect.set(result.diagnostics, 0, "changed")).toBe(false);
    for (const value of Object.values(result)) {
      expect(ArrayBuffer.isView(value)).toBe(false);
      expect(value instanceof ArrayBuffer).toBe(false);
      expect(value instanceof SharedArrayBuffer).toBe(false);
      expect(value instanceof Map).toBe(false);
      expect(value instanceof Set).toBe(false);
    }
  });
  it("rejects live and revoked proxies before reflection/brand traps", () => {
    const h = hostile(fixture());
    pcmReject(h.proxy, "input_proxy_refused");
    expect(h.count()).toBe(0);
    const r = Proxy.revocable(fixture(), {});
    r.revoke();
    pcmReject(r.proxy, "input_proxy_refused");
  });
  it.each([
    null,
    undefined,
    "pcm",
    [],
    {},
    new DataView(new ArrayBuffer(44)),
    new Uint16Array(44),
    new ArrayBuffer(44),
  ])("rejects non-Uint8 brand without coercion %#", (input) => {
    pcmReject(input, "input_type_invalid");
  });
  it("rejects subclass/cross-realm/input-instance and backing-instance prototypes", () => {
    class Sub extends Uint8Array {}
    pcmReject(new Sub(44), "input_prototype_unsupported");
    const foreign: unknown = runInNewContext("new Uint8Array(44)");
    pcmReject(foreign, "input_prototype_unsupported");
    const local = fixture();
    Object.setPrototypeOf(local, null);
    pcmReject(local, "input_prototype_unsupported");
    const ab = new ArrayBuffer(46);
    const v = new Uint8Array(ab);
    Object.setPrototypeOf(ab, null);
    pcmReject(v, "input_prototype_unsupported");
  });
  it("rejects shared and resizable backing, including fixed-length views", () => {
    pcmReject(
      new Uint8Array(new SharedArrayBuffer(46)),
      "shared_buffer_refused",
    );
    pcmReject(
      new Uint8Array(new ArrayBuffer(46, { maxByteLength: 100 }), 0, 46),
      "resizable_buffer_refused",
    );
  });
  it.each([0, 46])(
    "detached backing %i fails native attachment, unlike attached zero",
    (size) => {
      const input = new Uint8Array(size);
      structuredClone(input.buffer, { transfer: [input.buffer] });
      pcmReject(input, "input_bytes_unavailable");
    },
  );
  it("source order places resource refusal before temporary view/snapshot and raw hash", () => {
    const s = readFileSync(
      new URL("../../src/runtime/audio-measurements.ts", import.meta.url),
      "utf8",
    );
    const markers = [
      "if (length > 8388608)",
      "view = new Bytes(backing, offset, length)",
      "snapshot = new Bytes(length)",
      'rawHash("sha256", snapshot, "hex")',
    ];
    const positions = markers.map((m) => {
      expect(s.split(m)).toHaveLength(2);
      const i = s.indexOf(m);
      expect(i).toBeGreaterThanOrEqual(0);
      return i;
    });
    for (let i = 1; i < positions.length; i++) {
      const a = positions[i - 1],
        b = positions[i];
      if (a === undefined || b === undefined)
        throw new Error("source positions missing");
      expect(a).toBeLessThan(b);
    }
  });
});

describe("record/leaf priority and exact arithmetic", () => {
  const vectors: readonly [string, string, string, string, string][] = [
    ["0", "1", "1", "1", "0"],
    ["1", "48000", "1", "1", "1"],
    ["1", "96000", "1", "1", "0"],
    ["1", "48001", "1", "1", "0"],
    ["1", "3", "1", "1", "16000"],
    ["1", "10", "3", "2", "7200"],
    ["240", "1", "1", "80", "144000"],
    ["1999", "100000", "1", "1", "959"],
    [
      "999999999999999999999999999999999999",
      "1",
      "1",
      "1",
      "47999999999999999999999999999999999952000",
    ],
    [
      "999999999999999999999999999999999999",
      "1",
      "999999999999999999999999999999999999",
      "1",
      "47999999999999999999999999999999999904000000000000000000000000000000000048000",
    ],
  ];
  it.each(vectors)("literal floor %s/%s x%s/%s =>%s", (n, d, m, q, result) => {
    expect(
      computeRelativeFrameCeiling(
        ceiling(
          { numerator: n, denominator: d },
          { numerator: m, denominator: q },
        ),
      ),
    ).toEqual({
      kind: "computed",
      profile: PROFILE,
      planned_seconds: { numerator: n, denominator: d },
      multiplier: { numerator: m, denominator: q },
      sample_rate_hz: 48000,
      rounding: "floor",
      ceiling_frames: result,
    });
  });
  it.each([
    ["7199", "7200", "below", "0"],
    ["7200", "7200", "equal", "0"],
    ["7201", "7200", "above", "1"],
    ["0", "0", "equal", "0"],
    ["9".repeat(120), "9".repeat(120), "equal", "0"],
    ["9".repeat(120), "9".repeat(119), "above", "9" + "0".repeat(119)],
  ])("literal comparison %s/%s", (f, c, relation, excess) => {
    expect(compareFrameCount({ frame_count: f, ceiling_frames: c })).toEqual({
      kind: "compared",
      profile: PROFILE,
      frame_count: f,
      ceiling_frames: c,
      relation,
      excess_frames: excess,
    });
  });
  it.each([null, undefined, 1, () => 0, []])(
    "record type invalid without parsing %#",
    (input) => {
      arithmeticReject(input, "record_type_invalid", "input");
    },
  );
  it.each([new Date(), Object.create({}), runInNewContext("({})")])(
    "unsupported record prototype %#",
    (input: unknown) => {
      arithmeticReject(input, "record_prototype_unsupported", "input");
    },
  );
  it.each(["input", "planned_seconds", "multiplier"] as const)(
    "live/revoked proxy at %s has zero traps",
    (field) => {
      const h = hostile({ numerator: "1", denominator: "1" });
      const input =
        field === "input"
          ? h.proxy
          : field === "planned_seconds"
            ? ceiling(h.proxy)
            : ceiling(undefined, h.proxy);
      arithmeticReject(input, "record_proxy_refused", field);
      expect(h.count()).toBe(0);
      const rev = Proxy.revocable({}, {});
      rev.revoke();
      arithmeticReject(
        field === "input"
          ? rev.proxy
          : field === "planned_seconds"
            ? ceiling(rev.proxy)
            : ceiling(undefined, rev.proxy),
        "record_proxy_refused",
        field,
      );
    },
  );
  it.each(["extra", "missing", "symbol"] as const)(
    "outer shape %s beats accessors",
    (variant) => {
      const input: Record<PropertyKey, unknown> = {
        planned_seconds: { numerator: "1", denominator: "1" },
        multiplier: { numerator: "1", denominator: "1" },
      };
      let calls = 0;
      accessor(input, "planned_seconds", () => {
        calls += 1;
      });
      if (variant === "extra") input.extra = 1;
      else if (variant === "missing")
        Reflect.deleteProperty(input, "multiplier");
      else input[Symbol("extra")] = 1;
      arithmeticReject(input, "record_shape_invalid", "input");
      expect(calls).toBe(0);
    },
  );
  it("outer multiplier accessor beats planned proxy, regardless insertion order", () => {
    const h = hostile({});
    let calls = 0;
    const input = { multiplier: undefined, planned_seconds: h.proxy };
    accessor(input, "multiplier", () => {
      calls += 1;
    });
    arithmeticReject(input, "record_accessor_refused", "multiplier");
    expect(calls).toBe(0);
    expect(h.count()).toBe(0);
  });
  it("data-valued multiplier getter-object loses to planned proxy", () => {
    const h = hostile({});
    let calls = 0;
    const m = { numerator: "1", denominator: "1" };
    accessor(m, "numerator", () => {
      calls += 1;
    });
    arithmeticReject(
      ceiling(h.proxy, m),
      "record_proxy_refused",
      "planned_seconds",
    );
    expect(calls).toBe(0);
    expect(h.count()).toBe(0);
  });
  it.each(["planned_seconds", "multiplier"] as const)(
    "denominator accessor beats malformed numerator in %s",
    (field) => {
      let calls = 0;
      const p = { numerator: "invalid", denominator: "1" };
      accessor(p, "denominator", () => {
        calls += 1;
      });
      arithmeticReject(
        field === "planned_seconds" ? ceiling(p) : ceiling(undefined, p),
        "record_accessor_refused",
        `${field}.denominator`,
      );
      expect(calls).toBe(0);
    },
  );
  it("nested shape beats accessor and both accessors follow declared order", () => {
    let calls = 0;
    const p = { denominator: "1", numerator: "1", extra: 1 };
    accessor(p, "denominator", () => {
      calls += 1;
    });
    arithmeticReject(ceiling(p), "record_shape_invalid", "planned_seconds");
    expect(calls).toBe(0);
    const q = { denominator: "1", numerator: "1" };
    accessor(q, "denominator", () => {
      calls += 1;
    });
    accessor(q, "numerator", () => {
      calls += 1;
    });
    arithmeticReject(
      ceiling(q),
      "record_accessor_refused",
      "planned_seconds.numerator",
    );
    expect(calls).toBe(0);
  });
  it("outer declared first accessor wins over second and nested defects", () => {
    let calls = 0;
    const p = { multiplier: undefined, planned_seconds: undefined };
    accessor(p, "multiplier", () => {
      calls += 1;
    });
    accessor(p, "planned_seconds", () => {
      calls += 1;
    });
    arithmeticReject(p, "record_accessor_refused", "planned_seconds");
    expect(calls).toBe(0);
  });
  it("planned complete lexical precedes multiplier proxy; numerator lexical precedes denominator length", () => {
    const h = hostile({});
    arithmeticReject(
      ceiling({ numerator: "bad", denominator: "1" }, h.proxy),
      "integer_text_invalid",
      "planned_seconds.numerator",
    );
    expect(h.count()).toBe(0);
    arithmeticReject(
      ceiling({ numerator: "bad", denominator: "9".repeat(37) }),
      "integer_text_invalid",
      "planned_seconds.numerator",
    );
  });
  it.each([
    "",
    "-0",
    "+1",
    "01",
    "1e3",
    " 1",
    "1/2",
    "0.1",
    "١",
    "１",
    "\u0000",
  ])("bounded lexical %s refuses", (numerator) => {
    arithmeticReject(
      ceiling({ numerator, denominator: "1" }),
      "integer_text_invalid",
      "planned_seconds.numerator",
    );
  });
  it.each([0, -0, 0.1, 1n, Object("1"), Symbol("protected"), null, undefined])(
    "nonstring type refuses before length/coercion %#",
    (numerator: unknown) => {
      arithmeticReject(
        ceiling({ numerator, denominator: "1" }),
        "integer_text_invalid",
        "planned_seconds.numerator",
      );
    },
  );
  it.each(["0", "9", "x", "１"])(
    "overlong %s refuses length before grammar",
    (s) => {
      arithmeticReject(
        ceiling({ numerator: s.repeat(37), denominator: "1" }),
        "integer_text_too_long",
        "planned_seconds.numerator",
      );
      expect(
        compareFrameCount({ frame_count: s.repeat(121), ceiling_frames: "0" }),
      ).toEqual({
        kind: "rejected",
        profile: PROFILE,
        code: "integer_text_too_long",
        field: "frame_count",
      });
    },
  );
  it("coercion traps/iterator/toJSON on leaves never run", () => {
    let calls = 0;
    const leaf = {
      valueOf() {
        calls++;
        throw Error("protected");
      },
      toString() {
        calls++;
        throw Error("protected");
      },
      toJSON() {
        calls++;
        throw Error("protected");
      },
      [Symbol.iterator]() {
        calls++;
        throw Error("protected");
      },
    };
    arithmeticReject(
      ceiling({ numerator: leaf, denominator: "1" }),
      "integer_text_invalid",
      "planned_seconds.numerator",
    );
    expect(calls).toBe(0);
  });
  it.each([
    ["1", "0", "denominator_zero", "planned_seconds.denominator"],
    ["0", "7", "rational_not_reduced", "planned_seconds"],
    ["2", "2", "rational_not_reduced", "planned_seconds"],
  ] as const)("rational semantic %s/%s", (n, d, code, field) => {
    arithmeticReject(ceiling({ numerator: n, denominator: d }), code, field);
  });
  it("multiplier semantics order: denominator lexical/zero, then numeratorpositive, then gcd", () => {
    arithmeticReject(
      ceiling(undefined, { numerator: "0", denominator: "9".repeat(37) }),
      "integer_text_too_long",
      "multiplier.denominator",
    );
    arithmeticReject(
      ceiling(undefined, { numerator: "0", denominator: "0" }),
      "denominator_zero",
      "multiplier.denominator",
    );
    arithmeticReject(
      ceiling(undefined, { numerator: "0", denominator: "2" }),
      "multiplier_zero",
      "multiplier.numerator",
    );
    arithmeticReject(
      ceiling(undefined, { numerator: "2", denominator: "2" }),
      "rational_not_reduced",
      "multiplier",
    );
    arithmeticReject(
      ceiling({ numerator: "1", denominator: "bad" }),
      "integer_text_invalid",
      "planned_seconds.denominator",
    );
  });
  it("null-prototype records accepted and outputs retain owned immutable rationals", () => {
    const p: unknown = Object.assign(Object.create(null), {
      numerator: "1",
      denominator: "10",
    });
    const outer: unknown = Object.assign(Object.create(null), {
      planned_seconds: p,
      multiplier: { numerator: "3", denominator: "2" },
    });
    const result = computeRelativeFrameCeiling(outer);
    if (result.kind !== "computed") throw Error("computed result required");
    expect(result.ceiling_frames).toBe("7200");
    expect(result.planned_seconds).not.toBe(p);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.planned_seconds)).toBe(true);
    expect(Object.isFrozen(result.multiplier)).toBe(true);
  });
  it("36digit denominator endpoint accepted;37digit denominator rejected", () => {
    const result = computeRelativeFrameCeiling(
      ceiling({ numerator: "1", denominator: "9".repeat(36) }),
    );
    expect(result).toHaveProperty("ceiling_frames", "0");
    arithmeticReject(
      ceiling({ numerator: "1", denominator: "9".repeat(37) }),
      "integer_text_too_long",
      "planned_seconds.denominator",
    );
  });
  it("comparison outer capture precedes leaf, and first leaf precedes second", () => {
    let calls = 0;
    const input = { frame_count: "bad", ceiling_frames: "0" };
    accessor(input, "ceiling_frames", () => {
      calls += 1;
    });
    expect(compareFrameCount(input)).toEqual({
      kind: "rejected",
      profile: PROFILE,
      code: "record_accessor_refused",
      field: "ceiling_frames",
    });
    expect(calls).toBe(0);
    expect(
      compareFrameCount({
        frame_count: "9".repeat(121),
        ceiling_frames: "bad",
      }),
    ).toEqual({
      kind: "rejected",
      profile: PROFILE,
      code: "integer_text_too_long",
      field: "frame_count",
    });
    expect(
      compareFrameCount({ frame_count: "1", ceiling_frames: "bad" }),
    ).toEqual({
      kind: "rejected",
      profile: PROFILE,
      code: "integer_text_invalid",
      field: "ceiling_frames",
    });
  });
});

describe(
  "post-capture property controls (exact restoration)",
  { concurrent: false },
  () => {
    it("bypasses replaced actual-used properties without broad realm immunity claims", () => {
      const tp: unknown = Object.getPrototypeOf(Uint8Array.prototype);
      if (typeof tp !== "object" || tp === null)
        throw new Error("native typed-array prototype required");
      const slots: readonly [object, PropertyKey][] = [
        [types, "isProxy"],
        [types, "isUint8Array"],
        [types, "isArrayBuffer"],
        [types, "isSharedArrayBuffer"],
        [Object, "getPrototypeOf"],
        [Object, "getOwnPropertyDescriptor"],
        [Object, "hasOwn"],
        [Object, "freeze"],
        [Reflect, "ownKeys"],
        [Reflect, "apply"],
        [Array, "isArray"],
        [Number, "isSafeInteger"],
        [tp, "buffer"],
        [tp, "byteOffset"],
        [tp, "byteLength"],
        [ArrayBuffer.prototype, "byteLength"],
        [ArrayBuffer.prototype, "resizable"],
        [String.prototype, "charCodeAt"],
        [BigInt.prototype, "toString"],
        [tp, "set"],
        [tp, "slice"],
        [crypto, "hash"],
      ];
      const define = Object.defineProperty;
      const desc = Object.getOwnPropertyDescriptor;
      const saved = slots.map(([o, k]) => {
        const d = desc(o, k);
        if (!d) throw Error("native descriptor required");
        return { o, k, d };
      });
      const input = fixture();
      let calls = 0;
      let measured: unknown;
      let computed: unknown;
      let compared: unknown;
      try {
        for (const { o, k, d } of saved) {
          const trap = () => {
            calls++;
            throw Error("replaced property used");
          };
          define(
            o,
            k,
            "value" in d ? { ...d, value: trap } : { ...d, get: trap },
          );
        }
        measured = measureCanonicalPcm(input);
        computed = computeRelativeFrameCeiling({
          planned_seconds: { numerator: "1999", denominator: "100000" },
          multiplier: { numerator: "1", denominator: "1" },
        });
        compared = compareFrameCount({
          frame_count: "7201",
          ceiling_frames: "7200",
        });
      } finally {
        for (const { o, k, d } of saved) define(o, k, d);
      }
      for (const { o, k, d } of saved) expect(desc(o, k)).toEqual(d);
      expect(calls).toBe(0);
      expect(measured).toHaveProperty("sha256", fixtures[1].hash);
      expect(computed).toHaveProperty("ceiling_frames", "959");
      expect(compared).toHaveProperty("excess_frames", "1");
    });
    it("one exact Uint8Array prototype-parent mutation exercises native indices/getters; not arbitrary whole-realm containment", () => {
      const set = Object.setPrototypeOf;
      const original: unknown = Object.getPrototypeOf(Uint8Array.prototype);
      if (typeof original !== "object" || original === null)
        throw new Error("native typed-array parent required");
      const input = fixture();
      let result: unknown;
      try {
        set(Uint8Array.prototype, null);
        result = measureCanonicalPcm(input);
      } finally {
        set(Uint8Array.prototype, original);
      }
      expect(Object.getPrototypeOf(Uint8Array.prototype)).toBe(original);
      expect(result).toHaveProperty("sha256", fixtures[1].hash);
      expect(result).toHaveProperty("frame_count", "1");
    });
  },
);
