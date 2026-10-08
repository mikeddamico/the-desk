# G1-C0 physical PCM measurement

This accepted dependent contract defines three unwired pure synchronous helpers. It is a physical observation and arithmetic foundation, not provider admission, receipt settlement, a valid take, work-ended proof, a reroll trigger or a canonical render identity. Full G1-C producer provenance, R1 and Build2 remain deferred. No existing runtime entry point imports these helpers.

The physical profile is `g1-pcm48k-measurement/1`. Its 12,000/48,000-frame thresholds are physical test diagnostics, not speaking-rate or product runtime limits. FINAL LOCK v1.2.6 remains the governing authority. The dependent contract does not change frozen fixture audio, the eleven-field render projection or the historical 398-row fixture.

## Public API and domains

Exports are only PROFILE and these three functions:

- measureCanonicalPcm(input:unknown): PcmResult
- computeRelativeFrameCeiling(input:unknown): CeilingResult
- compareFrameCount(input:unknown): ComparisonResult

PROFILE is the literal "g1-pcm48k-measurement/1". The naming describes physical measurement, never an accepted TTS adapter/version, frozen render identity or production profile. Fixed constants: sample rate48000Hz;1 channel;16 bits/sample;PCM little endian;44 header bytes; test minimum12000 and test maximum48000 frames; observation resource limit8388608 visible bytes. Constants may remain private; no writable exported setting/profile object.

Types below are readonly, exact own-field records. Outputs contain only listed fixed primitive fields, newly owned ordinary nested records and the newly owned ordinary diagnostic array, recursively frozen. No Uint8Array/Buffer/DataView/ArrayBuffer/SharedArrayBuffer/Map/Set/mutable exotic, caller reference or internal snapshot escapes. The ONLY array field is diagnostics, an owned frozen ordinary array of closed diagnostic strings. No bigint or number representing duration/quantity escapes. No global nullable legacy result extension.

Successful Rational = {numerator:Integer36,denominator:PositiveInteger36}. Unknown rational inputs first parse BOTH members as unsigned Integer36, including denominator"0"; PositiveInteger36 describes successful semantics, not an early lexical gate that hides denominator_zero.
Integer36 is ASCII "0" or [1-9][0-9]{0,35}. PositiveInteger36 excludes"0".
Counter120 is ASCII "0" or [1-9][0-9]{0,119}.
Hash is exactly64 lowercase hexadecimal SHA256.
JS numbers (including-0), bigint, boxed strings, symbols and coercible objects do not satisfy text domains. No sign, leading zeros, space, decimal point, exponent, separators, Unicode digits or coercion. Primitive-string TYPE precedes bounded UTF-16 code-unit LENGTH, then ASCII unsigned GRAMMAR, then semantic zero/gcd. Bounds precede grammar scanning and bigint construction. Rational denominator>0; gcd(numerator,denominator)=1; zero is ONLY0/1. Inputs that are mathematically reducible are rejected, not silently relabelled. Multiplier numerator must also be positive. Planned runtime can be zero. Output duration/ceiling metadata uses reduced rationals. Integer text is a type-domain claim checked at runtime, not a blind TypeScript cast.

Error records contain no messages, raw values, errors, provider data or callback output. Each function has its own closed error-code union:
PcmError =
"input_proxy_refused" | "input_type_invalid" | "input_prototype_unsupported" |
"shared_buffer_refused" | "resizable_buffer_refused" | "input_bytes_unavailable" |
"input_resource_limit" | "snapshot_resource_failure" | "header_truncated" |
"riff_tag_invalid" | "wave_tag_invalid" | "fmt_tag_invalid" | "fmt_size_invalid" |
"codec_invalid" | "channels_invalid" | "sample_rate_invalid" | "byte_rate_invalid" |
"block_align_invalid" | "bits_per_sample_invalid" | "data_tag_invalid" |
"data_size_odd" | "riff_size_overflow" | "riff_size_mismatch" | "data_length_mismatch".
ArithmeticError =
"record_proxy_refused" | "record_type_invalid" | "record_prototype_unsupported" |
"record_shape_invalid" | "record_accessor_refused" | "integer_text_invalid" |
"integer_text_too_long" | "denominator_zero" | "multiplier_zero" | "rational_not_reduced".

PcmResult =
{kind:"rejected",profile:PROFILE,code:PcmError} OR
{kind:"measured",profile:PROFILE,format:"pcm_s16le",sample_rate_hz:48000,channels:1,
bits_per_sample:16,header_bytes:44,byte_length:Counter120,data_byte_length:Counter120,
frame_count:Counter120,sha256:Hash,duration_seconds:Rational,
diagnostics:readonly PcmDiagnostic[]}.
PcmDiagnostic = "zero_frames" | "below_test_min_frames" | "above_test_max_frames".
Diagnostic order is zero_frames, then below_test_min_frames, then above_test_max_frames; include only applicable entries, no duplicates.

CeilingInput closed = {planned_seconds:Rational,multiplier:Rational}.
CeilingResult =
{kind:"rejected",profile:PROFILE,code:ArithmeticError,field:CeilingField} OR
{kind:"computed",profile:PROFILE,planned_seconds:Rational,multiplier:Rational,
sample_rate_hz:48000,rounding:"floor",ceiling_frames:Counter120}.
CeilingField = "input" | "planned_seconds" | "planned_seconds.numerator" |
"planned_seconds.denominator" | "multiplier" | "multiplier.numerator" | "multiplier.denominator".

ComparisonInput closed = {frame_count:Counter120,ceiling_frames:Counter120}.
ComparisonResult =
{kind:"rejected",profile:PROFILE,code:ArithmeticError,field:ComparisonField} OR
{kind:"compared",profile:PROFILE,frame_count:Counter120,ceiling_frames:Counter120,
relation:"below"|"equal"|"above",excess_frames:Counter120}.
ComparisonField = "input" | "frame_count" | "ceiling_frames".
No success/valid_take/admitted/work_ended/retry/trigger/audit flag is exported. The sole arithmetic relationship is the three-way relation. An equal comparison is within a numeric ceiling; it authorizes no effect.

## First-error and field rules

All proxy, getter, snapshot and captured-intrinsic promises assume an uncompromised selected Node realm at module initialization. Pre-initialization tampering, fatal OOM, VM termination and arbitrary resource exhaustion are excluded. This is not a hostile JavaScript sandbox. Inputs remain unknown until checked; no caller coercion, iteration, serialization or property getter is used.

For EVERY outer/nested arithmetic record separately, apply R1–R5 before validating its captured values. Expected string keys must match BEFORE any descriptor inspection. Inspect OWN descriptors in DECLARED order and capture ALL values before ANY nested or leaf validation. No spread/iteration/Object.assign/JSON serialization/propertyGet/valueOf/toJSON.

| Order | Exact condition/action                                                                                                                                | Code on first failure        | Public field                |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | --------------------------- |
| R1    | Native isProxy FIRST, before getPrototypeOf/ownKeys/descriptors; live/revoked Proxy refused with zero traps                                           | record_proxy_refused         | record path                 |
| R2    | Require non-null object, not array/function; primitive/null/array/function refuses                                                                    | record_type_invalid          | record path                 |
| R3    | Captured getPrototypeOf; exact captured local Object.prototype or null only                                                                           | record_prototype_unsupported | record path                 |
| R4    | Captured ownKeys EXACT expected STRING-key set; extra/missing/symbol key beats any accessor                                                           | record_shape_invalid         | record path                 |
| R5a   | OWN descriptors in declared order; absent descriptor refuses defensively, no re-read                                                                  | record_shape_invalid         | record path                 |
| R5b   | Each descriptor must be DATA; any getter/setter/accessor, including undefined get/set, refuses WITHOUT invocation; otherwise capture descriptor value | record_accessor_refused      | exact offending member path |

Record path is input for each outer record; planned_seconds or multiplier for nested compute rationals. Declared outer compute order: planned_seconds,multiplier. Declared compare order: frame_count,ceiling_frames. Each rational: numerator,denominator. Input insertion order never changes priority. No user callback can interleave safe ordinary-record capture under scoped no-proxy/realm assumptions; missing-descriptor handling is defensive. Own-key enumeration does not claim fixed RSS for arbitrary preallocated huge key sets.

After BOTH outer compute captures, COMPLETE planned_seconds, then COMPLETE multiplier. After BOTH compare captures, COMPLETE frame_count lexical checks, then COMPLETE ceiling_frames. For each rational, BOTH descriptors are captured first, then COMPLETE numerator lexical, COMPLETE denominator lexical, denominatornonzero, multipliernumeratorpositive (multiplier only), gcd. No nested safety may precede outer descriptor safety.

| Competing defects                                                         | Normative first result                                               |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Outer planned_seconds data proxy + outer multiplier accessor              | record_accessor_refused / multiplier; no proxy trap/getter           |
| Outer planned_seconds nested proxy + multiplier data-valued getter-object | record_proxy_refused / planned_seconds; multiplier subtree untouched |
| Malformed numerator text + denominator accessor in same rational          | record_accessor_refused / that rational.denominator                  |
| Extra outer key + required accessor                                       | record_shape_invalid / input                                         |
| Extra nested key + denominator accessor                                   | record_shape_invalid / that rational                                 |
| Both required fields accessor, reverse insertion order                    | record_accessor_refused / first DECLARED member                      |
| Malformed planned numerator + nested multiplier proxy                     | owned lexical code / planned_seconds.numerator                       |
| Malformed compare frame_count + ceiling_frames accessor                   | record_accessor_refused / ceiling_frames (outer safety first)        |
| Overlong compare frame_count + malformed bounded ceiling_frames           | integer_text_too_long / frame_count                                  |

### 4.2 Leaf precedence and semantic field table

| Order | Exact condition/action                                                                          | First code            | Public field                                          |
| ----- | ----------------------------------------------------------------------------------------------- | --------------------- | ----------------------------------------------------- |
| L1    | Primitive STRING only; number/-0/bigint/boxed/coercible/symbol/object refuse, no coercion       | integer_text_invalid  | exact leaf path                                       |
| L2    | String length>36 rational operand or>120 counter; UTF-16 code units; BEFORE grammar scan/BigInt | integer_text_too_long | exact leaf path                                       |
| L3    | Empty/bounded text notASCII0 or[1-9][0-9]\*; no sign/leadingzero/space/decimal/exponent/Unicode | integer_text_invalid  | exact leaf path                                       |
| L4a   | After BOTH rational leaves complete L1–L3: denominator=="0"                                     | denominator_zero      | planned_seconds.denominator or multiplier.denominator |
| L4b   | After denominatornonzero: multiplier numerator=="0" (multiplier only)                           | multiplier_zero       | multiplier.numerator                                  |
| L4c   | After zero checks: gcd(numerator,denominator)!=1, including0/7                                  | rational_not_reduced  | planned_seconds or multiplier                         |
| L4d   | Counters allowzero, no positive/gcd check; comparison only after BOTH complete L1–L3            | none                  | none                                                  |

Complete numerator lexical L1–L3 BEFORE denominator lexical L1–L3; malformed numerator grammar wins over denominator overlength. Both descriptor captures precede both lexical phases, so denominator accessor wins over malformed numerator. Denominator lexical overlength wins over semantic multiplierzero; denominatorzero wins over multiplierzero; multiplierzero wins over gcd. Successful plannedzero is0/1. PositiveInteger36 describes SUCCESS, not denominator lexical rejection.36/120 endpoints allowed ifcanonical;37/121 refuse. Overlong invalid/allzero/allnine/Unicode strings give too_long BEFORE grammar scan; bounded malformed gives invalid. A boxed value gives TYPE invalid even if coercion could produce a long string. Empty primitive string gives grammar invalid, not too_long. No leaf coercion or raw/native error output.

### 4.3 PCM native/backing/attachment/resource precedence

PCM rejected result has ONLY kind/profile/code: public field ABSENT for EVERY PCM row, with NO frame/byte/hash/duration truth. P1–P12 precede fixed-layout S1–S16 below.

| Order | Exact condition/action                                                                                                                                                               | First code                                                                                       |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| P1    | Native isProxy FIRST, before reflection/brand; live/revoked proxy zero traps                                                                                                         | input_proxy_refused                                                                              |
| P2    | Native isUint8Array brand required, includes genuine Buffer; other typedarray/DataView/ArrayBuffer/string/array/object refuses                                                       | input_type_invalid                                                                               |
| P3    | Captured getPrototypeOf: exact captured local Uint8Array.prototype or Buffer.prototype; unsupported input INSTANCE/subclass/crossrealm prototype refuses                             | input_prototype_unsupported                                                                      |
| P4    | Captured %TypedArray%.prototype buffer/byteOffset/byteLength getters via captured Reflect.apply; no own shadow/property/method lookup                                                | No caller rejection caused by getter lookup; unexpected intrinsic failure outside narrow mapping |
| P5    | Native shared-buffer brand check on backing BEFORE backing reflection                                                                                                                | shared_buffer_refused                                                                            |
| P6    | Backing exact captured local ArrayBuffer.prototype; unsupported backing INSTANCE/crossrealm prototype refuses                                                                        | input_prototype_unsupported (EXISTING code)                                                      |
| P7    | Captured native resizable getter true refuses, including fixed-length view on resizable backing                                                                                      | resizable_buffer_refused                                                                         |
| P8    | Captured native backing byteLength; offset/visible/backing lengths finite nonnegative SAFE integers; offset<=backing and visible<=backing-offset; invalid bounds refuse WITHOUT copy | input_bytes_unavailable                                                                          |
| P9    | Visible length>8388608; BEFORE temporary byte view/snapshot/hash                                                                                                                     | input_resource_limit                                                                             |
| P10   | Create OWN native temporary Uint8Array(backing,offset,length), checked primitive arguments; recognized native detached-buffer TypeError (including zero view)                        | input_bytes_unavailable                                                                          |
| P11   | Allocate OWN fresh Uint8Array(length); recognized recoverable allocation RangeError ONLY at this stage                                                                               | snapshot_resource_failure                                                                        |
| P12   | Numeric index copy0..length-1 from OWN temporary native view into OWN snapshot; no caller method/iterator/species/coercion; parser/hash use ONLY snapshot                            | Unexpected copy/internal/hash failure not falsely mapped                                         |

Exact exception scope: ordinary record/leaf/native type/backing/bounds/parser failures return table codes from explicit predicates, not catch-all heuristics. Only attachment-constructor native TypeError for detached backing after validated inputs maps to input_bytes_unavailable. Only snapshot-allocation recoverable RangeError maps to snapshot_resource_failure. Getter/reflection failures on correctly branded scoped-realm objects and unexpected constructor/copy/parser/hash/internal failures are NOT swallowed or renamed malformed/caprefusal/knownquantity. Their totality/containment is outside this guarantee; preserve failure honesty, no fabricated result or raw error in result. Fatal resource/runtime failure is not a supported negative-input result.

Own throwing/getter shadows on supported view length,buffer,byteOffset,byteLength,constructor,Symbol.iterator,valueOf,toJSON,set,slice are neither consulted nor invoked; their presence alone does not change native facts. Backing/prototype checks are distinct from broad global chain tampering below. After safe bounds, attachment is checked BEFORE short-header parsing. OWN temporary view aliases only checked offset/length; copy uses its native numeric indices, never caller-object methods. Accepted backing is nonshared/nonresizable; copy synchronous/no callback/yield. OWN snapshot then supplies all facts/hash, never returned. Later caller mutation cannot change retained outputs. Pooled/nonzero-offset views expose ONLY visible bytes. No header-directed allocation or Buffer.from(object/backing) snapshot shortcut.

EXACT8388608 visible bytes pass P9; canonical44+8388564 data yields4194282frames/fullbytehash/rational/over-cap diagnostic.8388609 refuses BEFORE temporary view/snapshot/hash. Resourceunknown means NO frame/byte/hash/duration truth, NOTzero, NOTafterfullinspection, NOTend/release. Known48001frames/96046bytes remains fulltruth+above_test_max_frames. Snapshot-resource refusal also has no quantity truth. Unknown capacity handling is outside this unwired scope, never an inferred release.

## Native dependencies and scoped mutation controls

The module captures the native brands, reflection, accessors, constructors, primitive parsing, hash and freeze functions it actually uses. The copy constructs an owned native view from checked backing/offset/length, then copies numeric indices into a newly allocated snapshot. It never calls a method on the supplied view. The hash uses captured one-shot `node:crypto.hash("sha256", snapshot, "hex")`, not a mutable public Hash instance. The snapshot never escapes.

Post-initialization replacement of the inspected getter/method property slots is tested separately from unsupported input/backing instance prototypes. General global prototype-chain or constructor-binding tampering has no whole-operation containment guarantee. One narrowly traced Uint8Array prototype-inheritance control may show the selected getter/index path continues; it proves neither arbitrary chain immunity nor a sandbox. Mutation tests run serially and restore the exact descriptors and prototypes in finally.

Selected-runtime evidence must combine actual sentinels with source inspection. [Node v24.21.0 util documentation](https://nodejs.org/download/release/v24.21.0/docs/api/util.html) describes the native brands; the [versioned crypto implementation](https://github.com/nodejs/node/blob/v24.21.0/lib/internal/crypto/hash.js) describes the chosen one-shot path. Documentation alone is not getter-free execution proof.

## Canonical layout and measurement

Offsets are bytes from the snapshot start; integers are unsigned little endian, parsed from fixed byte positions. Payload sample bit patterns may be any16-bit value. No speech/silence/fidelity inference.

| Offset |            Width | Required bytes/value                    |
| ------ | ---------------: | --------------------------------------- |
| 0      |                4 | ASCII RIFF                              |
| 4      |                4 | 36 + data_byte_length, unsigned32       |
| 8      |                4 | ASCII WAVE                              |
| 12     |                4 | ASCII fmt plus one space                |
| 16     |                4 | 16                                      |
| 20     |                2 | 1 (integer PCM)                         |
| 22     |                2 | 1                                       |
| 24     |                4 | 48000                                   |
| 28     |                4 | 96000                                   |
| 32     |                2 | 2                                       |
| 34     |                2 | 16                                      |
| 36     |                4 | ASCII data                              |
| 40     |                4 | data_byte_length, unsigned32            |
| 44     | data_byte_length | PCM mono signed16 little-endian payload |

ONLY this44-byte FIXED layout, no chunk traversal/search for laterdata. Deterministic check order after snapshot: length>=44; RIFF; WAVE; fmt tag;fmt length;codec;channels;sample rate;byte rate;block alignment;bits;data tag;even data length;36+data<=4294967295;stored RIFF length equality;actual snapshot length=44+data. Each failure uses the corresponding unique PcmError, no parsed quantity/hash/duration returned. Exact size equations use bigint; byte constants are fixed integers, never float timing. Truncated/odd payload and appended bytes fail exact length; alternate chunks/metadata/RF64/RIFX/floating PCM/extended fmt fail the first structural check. JUNK at36 gives data_tag_invalid even if laterdata exists; valid prior checks plus trailingextra gives data_length_mismatch. No new chunk error, tolerant decoding or header-trusted frame estimate.

Normative parser FIRST-ERROR table (PCM public field ALWAYS ABSENT):

| Order | Failed exact check on OWN snapshot        | Code                    |
| ----- | ----------------------------------------- | ----------------------- |
| S1    | actual length<44                          | header_truncated        |
| S2    | bytes0–3 notRIFF                          | riff_tag_invalid        |
| S3    | bytes8–11 notWAVE                         | wave_tag_invalid        |
| S4    | bytes12–15 notfmt plus space              | fmt_tag_invalid         |
| S5    | unsigned32 at16 !=16                      | fmt_size_invalid        |
| S6    | unsigned16 at20 !=1                       | codec_invalid           |
| S7    | unsigned16 at22 !=1                       | channels_invalid        |
| S8    | unsigned32 at24 !=48000                   | sample_rate_invalid     |
| S9    | unsigned32 at28 !=96000                   | byte_rate_invalid       |
| S10   | unsigned16 at32 !=2                       | block_align_invalid     |
| S11   | unsigned16 at34 !=16                      | bits_per_sample_invalid |
| S12   | bytes36–39 notdata                        | data_tag_invalid        |
| S13   | unsigned32 data length at40 odd           | data_size_odd           |
| S14   | exact36+data length>4294967295            | riff_size_overflow      |
| S15   | unsigned32 RIFF size at4 !=36+data length | riff_size_mismatch      |
| S16   | snapshot length !=44+data length          | data_length_mismatch    |

Competing defects:43bytes+badRIFF ->header_truncated; badRIFF+badWAVE ->riff_tag_invalid; badcodec+wrongrate ->codec_invalid; JUNKat36+odd/overflow data ->data_tag_invalid; odd+overflow/RIFF mismatch ->data_size_odd; even4294967294 data+RIFF mismatch/short actual ->riff_size_overflow; small even data+RIFF mismatch/trailingextra ->riff_size_mismatch; allpriorvalid+extra ->data_length_mismatch. Rejection exposes no partial measurement/hash. These are fixed-position checks, not a chunk scanner.

For canonical bytes:
frame_count=data_byte_length/2;
duration_seconds=reduce(frame_count/48000);
byte_length=44+data_byte_length;
sha256=lowercase raw SHA256(exact complete snapshot), with NO domain prefix or semantic serializer.
The profile is not in the raw byte-hash preimage; output identity/profile labels are not frozen artifact/request domains. There is no persisted carrier or replay/certificate equality. Equal snapshot bytes imply equal byte/hash/frame facts; mathematical rational output is normalized. No caller-supplied expected hash changes parsing or observed facts.

Return measured even when frames>48000, with full bytes/hash/rational and above_test_max_frames. Below12000 returns full facts+below_test_min_frames. Zero canonical frames returns0/1 and zero_frames+below_test_min_frames. Empty input is malformed header, different from canonical zero-frame WAV. Zero does NOT prove positive valid audio or work ended; over-cap is an observation, not refusal to record known generation. None can free capacity or trigger another take. Within resource domain, no clamp/round-away/hide. Beyond resource domain, refusal explicitly cannot claim full measurement; any future operational integration must conservatively handle unknown quantity, under separately owned rules.

## Relative ceiling and comparison

Both helpers have no byte/file/provider/request/render provenance input.
Let p/q be planned_seconds and m/n positive multiplier:
ceiling_frames=floor((p*48000*m)/(q\*n)), computed by positive bigint division.
Output echoes owned normalized input rationals and exact integer ceiling. Each operand is<=36digits; products have at most77digits numerator and72digits denominator; Counter120 covers them. No huge sample allocation or float calculation. Zero planned runtime gives zero ceiling. Fractions are exact; numerical milliseconds/decimal seconds are not accepted alternatives.

compareFrameCount parses both independent Counter120 fields, then compares bigint counts. below/equal yields excess_frames="0"; above yields frame_count-ceiling_frames. No implicit profile remeasurement or sum, and caller cannot promote an arbitrary counter into trusted observed generation. Planned runtime is ONLY caller arithmetic input, not a validated immutable Brief/runtime target. These helpers neither sum failed/rejected/retried generations nor inspect parent-child runs. Selection/cache cannot reset owned generation history in future work; C0 has no history to reset.

Owner-declared decimal precision remains deferred:6959/48000 and57119/48000 are exact frame rational examples, not decimal-input shortcuts. No duration_ms or rounded decimal is timing authority. Adding declared-precision validation later needs a separately closed helper/input contract, not silent widening.

## Independent literal vectors

These expected headers, payload recipes, hashes, durations and arithmetic results were fixed independently in the accepted contract. Fixture construction may use the header literal; expected facts must not be computed with the helper under test. They are reference data, not evidence that tests passed.

|  Frames | Header hex                                                                               | Payload                 |   Bytes | SHA256                                                           | Duration    |
| ------: | ---------------------------------------------------------------------------------------- | ----------------------- | ------: | ---------------------------------------------------------------- | ----------- |
|       0 | 524946462400000057415645666d7420100000000100010080bb000000770100020010006461746100000000 | empty                   |      44 | 531cd597b25052b4845ef2f3887dec2183240802a93b6e044960de8ba017caa0 | 0/1         |
|       1 | 524946462600000057415645666d7420100000000100010080bb000000770100020010006461746102000000 | 0100                    |      46 | 5def4207fc7f2942f4c2fc26b07179f2adce3648e9830e1785dd0fe7b22f559d | 1/48000     |
|       2 | 524946462800000057415645666d7420100000000100010080bb000000770100020010006461746104000000 | 0080ff7f                |      48 | 07ec3078d251be398b1a78250245810b10af1e192e24ebdad79d5d1cc249ba51 | 1/24000     |
|   12000 | 52494646e45d000057415645666d7420100000000100010080bb0000007701000200100064617461c05d0000 | 00 repeated24000bytes   |   24044 | eca4d388a3695168ebd316e8e2094a2e1ffa5df4c37dbf6d8755dfe8ce5ed9a6 | 1/4         |
|   48000 | 524946462477010057415645666d7420100000000100010080bb000000770100020010006461746100770100 | 00 repeated96000bytes   |   96044 | 0a8f76d89c709043814cb74f331a4578d17ff61256303bd0019a263d053f86e8 | 1/1         |
|   48001 | 524946462677010057415645666d7420100000000100010080bb000000770100020010006461746102770100 | 00 repeated96002bytes   |   96046 | 45251f406edf34f09cca821afe4285a049c098eba1e535ff80ce949fc160ee37 | 48001/48000 |
| 4194282 | 52494646f8ff7f0057415645666d7420100000000100010080bb0000007701000200100064617461d4ff7f00 | 00 repeated8388564bytes | 8388608 | 472d073d7f87a5fa49cb8e1e4e90bbcfefd97cd6c06f320e7354f6281ca1c88c | 699047/8000 |

Expected diagnostics respectively: [zero_frames,below_test_min_frames], [below_test_min_frames], [below_test_min_frames],[],[],[above_test_max_frames],[above_test_max_frames]. A visible view8388609bytes instead returns input_resource_limit with no measurement facts. All-zero payload proves format/frame measurement only, NOT silence validation; the min/max tests intentionally cannot be claimed valid takes.

Literal arithmetic:

- planned0/1,multiplier1/1 -> ceiling0.
- 1/48000,1/1 ->1;1/96000,1/1 ->0;1/48001,1/1 ->0.
- 1/3,1/1 ->16000;1/10,3/2 ->7200;240/1,1/80 ->144000.
- Non-half fractional floor:1999/100000,1/1 ->959. Exact pre-floor95952000/100000=23988/25=959.52, not a binary-float or half-tie example.
- planned999999999999999999999999999999999999/1,multiplier1/1 ->47999999999999999999999999999999999952000.
- same planned and multiplier999999999999999999999999999999999999/1 ->47999999999999999999999999999999999904000000000000000000000000000000000048000.
- compare7199/7200 ->below/excess0;7200/7200 ->equal/0;7201/7200 ->above/1.
- compare120-digit all9 counter with itself ->equal/0;compare same counter to119-digit all9 ->above/excess9 followed by119zeros. No audio allocation for these counters.
- 2/2,0/7 reject rational_not_reduced;1/0 rejects denominator_zero;multiplier0/1 rejects multiplier_zero.
- decimal string"0.1",number0.1,negativezero numeric-0,"-0","+1","01","1e3"," 1","1/2",Unicode digits,37-digit rationaloperand and121-digit counter reject the owned type/length code, not raw exceptions.

## Governing owners and deferred obligations

- P&R v0.1.4 §§30.1, 34 and 41: exact frame timing and generated-seconds ceilings relative to planned runtime. Relevant source anchors: lines 1138–1182, 1246–1278 and 1433–1460.
- Security v0.1.3-skeleton lines 115–140 and 312–330: exact semantics, immutable history and existing accounting authority.
- Hashing v0.1.5 lines 181–198, 335–338, 359–371 and 379–389: existing assembly/artifact identity and separate request ownership.
- Active Handoff v0.5.5 lines 328–347 and Trace v0.5.5 lines 258–277 distinguish mechanical measurement from subjective decisions.

P&R positive valid-take checks, declared decimal precision, speech fidelity and after-durable-storage hashing remain deferred. The raw in-memory hash is not a durable semantic artifact identity. Planned_seconds is caller arithmetic input, not an owner-approved Brief. No history aggregate, ledger debit, money ceiling, concurrency, day rollover, release, retry, selection/cache reset, provider termination or production authorization is inferred.

## Verification boundaries

Verification covers literal canonical fixtures; every fixed-layout refusal and competing-defect priority; offset/pool views; proxy/getter/coercion sentinels; shared/resizable/detached backing; exact rational/counter endpoints; resource equality and over-cap full truth; frozen outputs and no alias; captured property-slot controls and the separately scoped inheritance case. Independent expected values remain literal.

The snapshot-allocation RangeError branch has no deterministic execution claim unless it can be exercised without a production hook. Safe-bound predicates and defensive absent-descriptor branches are inspected even where genuine scoped native objects cannot produce them. Source ordering plus bounded controls does not establish full VM allocation behavior. Unexpected internal failures are not swallowed. Existing 1,175 tests are baseline evidence, not C0 coverage. New-tree source review, independent implementation review, applicable gates and CI are required before acceptance. No schema or fixture PASS is relabelled as a new C0 proof.
