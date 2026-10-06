# G1-B dependent operational contract

Implementation candidate under ROOT's 2026-10-06 bounded D/L0/R0 commission. Not implementation acceptance, live-provider authority or G1/Build1/Build2/walking-skeleton closure. Mike alone merges.

Accepted proposal: revision03, 61,815 UTF-8 bytes, SHA256 f83ea6f2c3e28f6424d57805e2f57cf9f8b813b709b011dd8972beb4296f4824, libfile_8db938f9071881919ddace528d86be3b. Dependent adjudication libfile_0f823f6d0214819193ebc009d5f3d6a3 takes precedence over ambiguous proposal shorthand. The independent correction report's CONTRACT-READY verdict is not implementation acceptance or executed proof.

Provenance correction: ONLY the revision03 Markdown was created. Its companion/index/source/capture files were NOT written and no proposed collector ran. Unchanged revision02 sources/index are baseline source evidence, not new G1-B execution proof. G1-A's accepted991/54 CI is not G1-B proof.

Effects: one separately reviewed additive003 on the existing two ledger tables, six nullable call metadata columns and two nullable event columns; no production table/index/grant/default/backfill/dependency. Historical001/002/roles and frozen fixture/serializer/identities remain unchanged. The owner-only test evidence schema is an external simulator fixture, not a production ledger. L0 deliberately refuses ANY uncertified call population; R0 refuses all intentional rerolls. Production/staging/live remain blocked by G1-A.

## Phase and truth precedence (ROOT adjudication)

The certified path NEVER invokes generic finish: pure synchronous ReceiptPacket-to-EV/settlement projection is the only outcome source for execute and original-certificate reconciliation. Legacy finish remains unchanged. Timely acknowledged perform then cancellation before projection yields canceled ambiguity, performed fact and zero record attempts. Projection failure first retains its owned diagnostic despite later cancel/cleanup. Successful projection followed by cancel before record starts zero record commands. Once record starts, await unchanged runCommand: no cancellation/SQL race, active-connection release or fabricated rollback; acknowledged commit remains acknowledged, lost ACK unknown. Recorded recovery needs no lookup/current policy. Late values/rejections run ZERO verifier/projector/finish/lookup/connect/query/SQL/evidence append/event. No automatic reconciliation/background accounting.

Normalization accepts SQL NULL or representable malformed JSONB only; invalid JSON text, invalid canonical events and arbitrary DB/resource/internal errors are not swallowed. Original-attributed bad consumption retains monetary truth with exact durable violations; unrelated/tampered/contradictory receipts issue no event or invented global breach.

## Clock proof boundary

Production uses one DB clock sample after the installation lock per admitted row, reused for every equation and stored admission time. No clock override/GUC/backfill/trigger replacement. Tests extract the EXACT marked pure temporal SELECT bytes from003, refusing ambiguous layouts, and execute them unchanged over timestamp/population inputs and test-only relations. Independently authored microsecond UTC/year/timezone/rolling/spacing/watermark/history cases verify expressions; unmodified real-role triggers separately verify post-lock sampling and commit/rollback/multirow integration. This is not an induced OS-clock reversal, actual-midnight crossover or controlled per-row clock sequence claim. Only structural invoker admission is proved; coherent raw SQL can forge tariff/receipt assertions and is not operator authentication or external pricing compatibility.

## Closed profiles and predicates incorporated from accepted revision03

## 4. Closed versioned policy, certificate and request

### Scalar domains

H:64 lowercase hex. U:existing canonical lowercase UUID validation. A:[a-z0-9][a-z0-9._:/-]{0,127}. K:[a-z0-9][a-z0-9._:/-]{0,255}. N:JSON safe integer0..2147483647; positive N excludes0. Currency:explicit three uppercase ASCII letters, one per installation.

M:nonnegative decimal STRING, <=18 integer digits and <=6 fractional digits; no sign/exponent/space/leading zero. Normalize trailing fractional zeros/decimal point away; zero="0". Monetary ceilings positive. No JSON/JS floating-point money. Q exactly one of "1","0.1","0.01","0.001","0.0001","0.00001","0.000001"; ceilings multiples of Q. These are proposed simulation domains, not production currency rules. Existing final actual-cost domain/scale stays unchanged, including greater precision/amounts.

Every closed object rejects unknown/missing keys, wrong types, coercion, accessors/symbols/exotic instances and unsafe strings. Snapshot authored values once inside safe error classification. Existing canonicalJson/domainHash provides NFC/code-point ordering/compact UTF-8; never inspect/stringify raw thrown provider/SQL values.

### Policy g1-sim-admission-policy/1 — exact fields

| Field                                                                                                                                       | Type / meaning                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| schema                                                                                                                                      | "g1-sim-admission-policy/1"                                       |
| mode                                                                                                                                        | "trusted_non_network_simulation"                                  |
| policy_version                                                                                                                              | A                                                                 |
| scope                                                                                                                                       | "single_database_installation"                                    |
| currency                                                                                                                                    | Currency                                                          |
| accounting_quantum                                                                                                                          | Q                                                                 |
| attempt_cost_ceiling, run_cost_ceiling, utc_day_cost_ceiling                                                                                | positive M, Q multiples                                           |
| max_reservations_per_attempt, max_reservations_per_run, max_reservations_per_utc_day                                                        | positive N; physical reservations                                 |
| max_operational_retries_per_chain                                                                                                           | N <=2147483646; r retries means tries1..r+1                       |
| max_operational_retries_per_attempt, max_operational_retries_per_run, max_operational_retries_per_utc_day                                   | N                                                                 |
| max_intentional_rerolls_per_base, max_intentional_rerolls_per_attempt, max_intentional_rerolls_per_run, max_intentional_rerolls_per_utc_day | literal INTEGER0 in first profile R0; nonzero requires R1 below   |
| max_concurrent_global                                                                                                                       | positive N                                                        |
| global_rate                                                                                                                                 | {max_admissions:positive N,window_ms:positive N,min_spacing_ms:N} |
| provider_rule                                                                                                                               | one closed provider/model/operation rule, below                   |

provider_rule exactly:
{provider:A,operation:"g1_sim_text",model_identifier:A,max_concurrent:positive N,
rate:{max_admissions:positive N,window_ms:positive N,min_spacing_ms:N},
tariff:{schema:"g1-sim-byte-tariff/1",tariff_version:A,tariff_source_hash:H,
input_unit:"nfc_utf8_byte",output_unit:"utf8_byte",fixed_fee:M,input_price_per_byte:M,
output_price_per_byte:M,max_input_bytes:positive N,max_output_bytes:N}}.
Further cap both byte maxima at1048576 in /1. No tariff arrays, tiers, token estimator, tax/FX/vendor invoice semantics. Zero tariffs/output cap/spacing/retries are explicit values, never exemptions.

Tariff is INSIDE stable policy. Any rate/source/version/cap/limit/currency change changes policy hash and refuses NEW certified work once installation history pins a policy. First committed certified row pins consistency, NOT operator authority. No restart/child/provider alias/caller epoch resets it. No policy rotation in /1.

**R0 first-tranche limit:** all four reroll fields are exactly0, intentional_take_index/reroll_of/reroll_trigger_id must be NULL for NEW simulation. Explicit refusal is executable; no dormant nonzero quota is credited. Operational retries after positively governed retryable outcome remain testable. R1 nonzero rerolls require an owned TTS request/quantity profile bound to existing v1:base-request/trigger identity. Do not manufacture a synthetic TTS base hash or count this byte simulation as generated-seconds/per-block coverage. Those owned requirements remain OPEN.

### Request envelope and finite quantity authority

Exact request:{schema:"g1-sim-request/1",input_text:string,max_output_bytes:N}.
Validate Unicode, normalize text NFC once; compute actual UTF-8 bytes (positive, <=policy input cap). Output cap <=policy output cap. These quantities are computed from actual immutable request/cap, never a caller estimated_cost. Fingerprint=domainHash("provider-admission-request-v1",complete envelope), plain64-hex for operation g1_sim_text. Do NOT replace TTS v1:base_request_hash or model-semantic subjects.

Snapshot normalized text/cap and pass them with the committed certificate through an optional owned admission field on ProviderRequest. Adapter second AbortSignal argument and historical one-argument adapters remain compatible. Immediately before sole perform verify text byte hash/count/fingerprint against committed certificate and recheck cancellation. Never reread mutable caller policy/environment to reconstruct caps. Trusted non-network simulator consumes these exact bytes, enforces output cap and creates independently observable durable receipt with call/key/fingerprint/certificate hash/quantities. Positive tests must prove actual consumption. TypeScript objects and adapter construction are not authentication or a network sandbox.

### Certificate g1-sim-admission-certificate/1 — exact fields

- schema:"g1-sim-admission-certificate/1"; mode:"trusted_non_network_simulation";
- policy:FULL normalized policy above; policy_hash:H;
- provider_call_id:U, attempt_id:U, program_run_id:U (run derived from canonical attempt);
- provider:A, operation:"g1_sim_text", model_identifier:A;
- request_fingerprint:H, logical_request_key:K, operational_try_number:positive N;
- intentional_take_index:null, retry_of_provider_call_id:U|null, reroll_of_provider_call_id:null, reroll_trigger_id:null;
- input_text_hash:H (raw SHA256 of NFC input UTF-8);
- input_bytes:positive N, max_output_bytes:N;
- currency:Currency, accounting_quantum:Q;
- unrounded_bound:M, reserved_cost_upper_bound:M.

All scalar repetitions equal actual reservation/policy/request facts. Braw=fee+input_bytes*input_price+max_output_bytes*output_price. B=ceil(Braw/Q)\*Q. PG unconstrained numeric arithmetic; no floating point. Products/sum/bound must fit M; refuse overflow/extra precision, never silently round Braw or clip. Tariff6-place decimals times integers give <=6 fractional places. Actual receipt cost is never rounded to Q or reduced to M.

Proposed domain subjects:
policy_hash=SHA256("provider-admission-policy-v1"+LF+canonicalJson(policy)).
certificate_hash=SHA256("provider-admission-certificate-v1"+LF+canonicalJson(COMPLETE certificate)).
Request hash above. Hash fields are lowercase; certificate does not include its own hash. Server admission/record times, started_at, xmin/ctid/correlation/transport config, usage/response/cost are excluded from certificate. Existing started_at is separately compared by PG typed reservation equality.

These are dedicated OPERATIONAL profiles, not additions to Hashing§3's artifact table. ROOT accepted their dependent operational-contract ownership of low-level domainHash in the revision03 adjudication, without identity/domains.ts changes. This does not alter a frozen artifact domain, profile or shared serializer. Contract acceptance is complete; implementation acceptance, frozen gates and independent implementation review remain pending.

## 5. C1: durable observation and final receipt

These are the ONLY new simulation evidence shapes. All keys REQUIRED; nullable means explicit null, not omission. Unknown keys/accessors/exotic/coercive values refuse safe parsing. Every hash uses shared canonicalJson/domainHash, lowercase SHA256 of domain+LF+complete canonical UTF-8 JSON. Exact canonical bytes are retained; parse/re-serialize equality rejects duplicate keys, alternate JSON spelling and tampering. Body strings must be valid Unicode and already NFC where hash-bearing strings are supplied; actual consumed text is measured as raw valid UTF-8 BEFORE normalization can hide a difference.

Additional domains/types:
T = canonical RFC3339 UTC Z with EXACTLY six fractional digits, valid calendar. PG comparisons retain microseconds.
D64 = existing nonnegative finite decimal cost-text domain (<=64 characters, no sign/exponent/leading-zero/space), normalized by stripping fractional trailing zeros for receipt hash identity; NOT restricted to policy M/Q. Existing stored event scale remains untouched.
E = succeeded|retryable_failure|terminal_failure.
S = valid NFC string <=4096 UTF-8 bytes, internal receipt data, never operational diagnostic.
Nullable observed A/H/N may be null only for unavailable/invalid measurement; never coerce a malformed original value into a false fact.

### 5.1 Original attribution tuple AT — exact fields

{provider_call_id:U,attempt_id:U,program_run_id:U,provider:A,operation:"g1_sim_text",
model_identifier:A,logical_request_key:K,request_fingerprint:H,
admission_certificate_hash:H,admission_policy_hash:H}.

AT is attribution assigned from the ORIGINAL acknowledged committed reservation/certificate, before actual consumption. Compare ALL fields to stored original row/certificate and canonical run relation. It is NOT copied from current replacement policy and is NOT derived from actual consumption. Outer AdapterRecord's three bindings are necessary but insufficient. A receipt attributed to a different call/attempt/run/key/fingerprint/certificate/policy is wholly unrelated: do not attach it to the original event.

### 5.2 Actual consumption tuple CT — exact fields

{observation_state:"complete"|"incomplete",
input_text_hash:H|null,input_bytes:N|null,consumed_output_cap:N|null,
computed_request_fingerprint:H|null,consumed_certificate_hash:H|null,
consumed_provider:A|null,consumed_operation:A|null,consumed_model_identifier:A|null}.

complete requires every other CT field nonnull; incomplete requires at least one null. N includes0: fewer/zero actual input bytes are facts, not normalized up to admitted bytes. Record invalid/unavailable measurement as null+incomplete without raw value/error.

Measurements are produced from ACTUALLY consumed inputs by trusted simulator instrumentation:

- input_text_hash=raw SHA256 of actual valid UTF-8 input bytes; input_bytes=their exact length. No NFC conversion of observed bytes before hash/count. Same-length wrong content changes hash.
- consumed_output_cap=actual cap the simulator uses, not the attributed or supplied estimate.
- computed_request_fingerprint=domainHash("provider-admission-request-v1",{schema:"g1-sim-request/1",input_text:actual consumed valid text,max_output_bytes:actual cap}). Shared canonical NFC hashing still applies here; raw input hash/count independently detect noncanonical or wrong bytes.
- consumed_certificate_hash=recomputed domain hash of actual validated certificate object used by simulator, not a copied original label. Invalid/unavailable object =>null.
- provider/operation/model identify actual selected simulation inputs. Equality is structural consistency only, not vendor compatibility/authentication.

Input/cap/certificate measurements are immutable for this invocation. Final receipt MUST repeat CT exactly from its linked invocation observation. A contradictory final CT is receipt-integrity failure/no event, not durable consumption truth. Valid wrong consumption is recorded consistently at invocation AND final; this is what the wrong-consumption tests exercise.

### 5.3 Invocation observation IO — exact fields

{schema:"g1-sim-invocation-observation/1",observation_id:U,
kind:"invocation",attribution:AT,consumption:CT,work_ended:null}.

invocation_hash=domainHash("provider-sim-invocation-observation-v1",COMPLETE IO).
No final event/cost/ended evidence implied. Committed IO proves measured invocation evidence only, never completion/capacity release/actual price. observation_id participates in operational receipt identity by this explicit contract, not an artifact hash convention.

### 5.4 Final accounting receipt FR — exact fields

{schema:"g1-sim-final-receipt/1",receipt_id:U,kind:"final_accounting",
invocation_observation_hash:H,attribution:AT,consumption:CT,
work_ended:true|false|null,observed_output_bytes:N|null,
price_status:"known_final"|"unknown_final",event:EV}.

EV exactly:
{provider_call_id:U,event_type:E,ended_at:T,
usage:{input_bytes:N|null,output_bytes:N|null},
actual_cost:D64|null,currency:Currency|null,
response_artifact_id:U|null,response_reference:S|null}.

FR hashes COMPLETE FR under "provider-sim-final-receipt-v1". No omitted tail/self-hash. receipt_id is durable identity; IO hash links original immutable IO bytes. AT/CT must equal IO; EV.provider_call_id=AT.provider_call_id. EV.usage.input_bytes=CT.input_bytes; usage.output_bytes=FR.observed_output_bytes. Existing artifact reference must resolve if nonnull; no artifact is created here.

known_final iff actual_cost and currency both nonnull; currency may differ from accounting currency and amount may exceed bound. unknown_final iff BOTH null. Never infer known price from usage/tariff/output or unknown as zero. Work-ended proof is INDEPENDENT from price status/event_type: true means positively observed end of original attributed invocation; false means positively not ended at receipt observation; null means unknown. FR.kind="final_accounting" means this is the one immutable accounting statement, NOT proof work ended. false/null FR cannot later be replaced with a true FR under this profile; honest availability limitation.

observed_output_bytes is actual counted produced bytes, not expected/cap. Shorter output<=cap is legitimate. When work_ended=false/null, a known count may be observed-so-far and alone proves no end. If ended=true and output count unavailable, retain null, derive the specified permanent observation breach; do not fabricate cap-sized output. Unknown price with true end/known output is valid and may release capacity while retaining bound.

EV is a canonical INTERNAL receipt, not sanitized public text. It must satisfy existing event schema/causal constraints, including ended_at>=stored started_at. Work-ended/cost proof does not relax invalid IDs/date/usage/FK/immutable-event rules. Clock reversal of DB recorded_at is independent; a receipt with invalid existing ended_at cannot be fabricated or recorded by changing historical constraints.

Typed event agreement: compare every EV field to canonical immutable event using UUID/date microsecond/numeric/jsonb/text/null equality; usage is this closed two-key simulation object. Normalize actual cost only for receipt identity; return original stored event numeric scale. Equivalent numeric/timestamp spellings may converge on the event but do NOT authorize rewriting immutable receipt bytes. Receipt retrieval returns original canonical bytes/hash/IDs.

### 5.5 Receipt transport and verification

ReceiptPacket exact:
{schema:"g1-sim-receipt-packet/1",invocation_json:string,invocation_hash:H,
final_json:string,final_hash:H}.
These strings carry canonical UTF-8 JSON bytes: invocation<=16384 bytes, final<=32768 bytes. snapshot each own data property once; no getters. Hash actual stored bytes by parsing closed body then shared domainHash and requiring exact canonical reserialization byte equality. Reject surrogate/size/parse/key/type/hash/row-envelope mismatch safely.

Verify packet IO/FR hashes, link, AT/CT equality, EV binding/price/usage and original stored AT before any event write. Verify supplied expected hash against ORIGINAL certificate. Only then derive EV and normalized settlement from THAT receipt; execute and explicit reconciliation use the same pure verifier/projector. No arbitrary caller finish callback may override cost/consumption/work-ended for certified simulation.

Invalid packet/hash/tampered bytes/contradictory IO/FR OR unrelated AT =>safe owned evidence code, no event, no release, no global-breach claim inferred from untrusted data. In execute after acknowledged perform, return the existing ambiguous class with perform=performed and outcome_record=not_attempted; evidence failure never implies no effect. In explicit reconciliation, return unknown with no record attempt and no invocation. A valid event acknowledged committed before a cleanup failure retains acknowledged commit facts; no retrospective ambiguous/no-write rewrite. Existing reservation remains unfinished/occupied. Already recorded exact canonical event recovers independently of current policy; no new evidence writer/reperform.

### 5.6 Test evidence persistence / privileges / append

Prospective NEW support path test/support/g1-provider-admission-receipt.ts; do NOT edit a5-provider.ts. Existing A5 invocations at a5-provider.ts:42–104 prove effect/lookup but not C1 completion. Retain them unchanged.

Use isolated test schema g1_b_fixture_evidence, owner-created receipt table ONLY in disposable test database, NOT migrations/public/families. Exact storage fields:
evidence_id uuid PRIMARY KEY; provider_call_id uuid NOT NULL; record_kind text ("invocation"|"final");
canonical_bytes bytea NOT NULL; content_hash text NOT NULL64hex;
captured_at timestamptz NOT NULL DEFAULT clock_timestamp();
UNIQUE(provider_call_id,record_kind).
No production spend/status counter. Budget/capacity queries NEVER read this table. Body ID/call/kind/hash agree with storage envelope; SQL/body identities are independently checked by harness/verifier. Final references IO hash in FR, not a mutable completion flag.

Test owner pool has separate evidence privileges; runtime/operator/migrator have NO fixture schema/table access. No new login/production grant/function permission. Scoped test-schema revokes/immutable update-delete-truncate guards only, consistent with existing owner-only test-harness pattern. Privileged owner malicious bypass is outside authentication claim. Test child receives explicit synthetic owner/runtime targets only; no credentials discovered from files.

append IO once after actual input/cap measurement/durable invocation observation. append FR separately only when trusted fixture producer has the stated completion/price facts; absence of FR remains invocation-only. Retry append identical canonical bytes converges; any changed byte/hash/envelope conflicts. No UPDATE of IO/FR or second final receipt. Preserve observed server capture timestamps on retrieval, but they are operational table facts excluded from body hash and do not drive admission clocks.

retrieve after process restart by original call ID; return retained immutable bytes plus envelope IDs/hashes or invocation_only/missing. Parent independently SELECTs bytes/rows, rehashes and compares actual measured text/cap/output, not just helper assertions/counts. Runtime never receives SQL access to this test table: trusted test adapter/fixture source supplies Packet through its external-evidence interface.

No late/background SQL loophole: runtime completion/timeout handlers never append evidence or perform lookup. Late-promise tests precommit FR then hold acknowledgement; release late value/rejection executes ZERO finish/connect/query/SQL/event, including no test-adapter writer after timeout. Invocation-only timeout tests leave no FR. A later FR for restart/reconciliation is an EXPLICIT separate test fixture-producer/parent step, with independently observed completed simulator facts, not a detached runtime late handler. Count/report this test-only evidence write separately; never claim all-process zero writes during that explicit step. No automatic task or production evidence table added.

## 6. Recovery precedence and precise API

Keep executeProviderCall as sole perform entry/signature. Existing accepted controls remain; optional simulation_admission exact keys:
{schema:"g1-sim-invocation/1",policy,request,lock_timeout_ms:positive N,
statement_timeout_ms:positive N,expected_original_certificate_hash:H|null}.
Bounds<=30000ms, lock<=statement, explicit no defaults. Existing non_network absence preserves accepted unmetered NON-NETWORK testing only, never live exemption. No src/config.ts expansion. Optional controls are an authored invocation-context member, not an environment/config framework or fixture show-config extension.

Receipt adapter result for certified path is ReceiptPacket; lookup returns existing AdapterRecord<ReceiptPacket>, outer bindings from ORIGINAL AT. Optional admission member of ProviderRequest contains snapshotted normalized text/cap and stored certificate, no new second-argument convention. For certified execution/reconciliation, runtime verifier above supplies EV/settlement; legacy finish callbacks unchanged. On the certified path, NEVER invoke the caller's generic finish callback. The sole outcome source is the verified ReceiptPacket: the pure receipt projector supplies EV and normalized settlement for both execute and explicit reconciliation. Historical uncertified finish callbacks and receipts remain unchanged. No new real execute or CLI entry.

**Separate recovery-claim extraction, before broad controls/policy parsing:**

1. Validate observer/authored reservation with existing safe snapshots. Wrong immutable same-ID data =>existing conflict; do not perform.
2. Inspect only OWN DATA descriptors for controls.simulation_admission and its expected_original_certificate_hash; never invoke getters, toString, instanceof/prototype paths that can leak. Descriptor/enumeration traps caught safely.
3. controls absent or ordinary object with no own simulation_admission =>claim ABSENT. Own data value null/nonobject for simulation_admission =>claim INVALID. Accessor/exotic/throwing top or nested object preventing safe claim inspection =>INVALID (not silently ABSENT). Missing own expected_original_certificate_hash in a present simulation object =>INVALID. Explicit null=>no expected hash. Exact H=>HASH. Wrong type/hash/accessor/trap=>INVALID. Only read this claim subtree: unrelated policy getters/invalid enum/malformed NEW fields are not evaluated for recovery.
4. INVALID emits provider_admission_original_claim_invalid and NO DB/write/perform. HASH is retained independently of full controls parse; never dropped by policy validation failure.
5. In existing by-ID/slot classification: preserve original identity conflict first; for an exact completed same-ID OR held slot, enforce HASH against the STORED original certified hash. Different/missing certified hash=>provider_admission_certificate_conflict, no write/perform. Correct HASH, explicit-null or absent claim=>return existing original completed/unfinished semantics without NEW controls/policy/kill/day checks.
6. A HASH with no existing row/slot=>provider_admission_original_missing, no insertion. For NEW work with absent/null claim only, run full controls/profile/policy/request validation; no missing policy fallback when certified profile selected.

Claim failure preflight dominates lookup because it is unsafe explicit recovery input. On a safely extracted HASH, a real immutable reservation conflict stays conflict before HASH mismatch. held-slot receipt belongs to its stored owner; never use authored new candidate ID/current policy as its receipt attribution. Receipt recovery is original identity only, never execution of current request. Correct claim+invalid policy recovers; wrong claim+valid policy refuses for both same-ID and held-slot. Legacy rows lack certified hash: a supplied HASH refuses, absent controls retains accepted G1-A legacy behavior. Outer exotic controls now refuse rather than hide an explicit claim; ordinary absent/malformed policy fields with safely extracted absent/null/H do not weaken completed recovery.

After committed created, cancellation/request mismatch preserves unfinished occupied row; no “rejected means zero writes” label. Invoked throw/timeout/cancel remains ambiguous. Explicit reconcile loads original certificate independent of current policy, never perform/takeover, verifies retained Packet and writes original EV/settlement only if missing. Bound evidence failure stays unknown/no event. Recovery of already committed event returns stored receipt without new authorization or current evidence lookup.

## 7. C2: closed settlement and permanent SQL facts

Retain EXACT eight proposed nullable additions:
provider_calls: admitted_at timestamptz, reserved_cost_upper_bound numeric, admission_currency text,
admission_policy_hash text, admission_certificate jsonb, admission_certificate_hash text.
provider_call_events: recorded_at timestamptz, admission_settlement jsonb.
No ninth column/second production ledger/free-form usage tail.

Call envelope ALL NULL historical or complete consistent certified. Certified call input admitted_at must NULL; DB assigns. Historical event additions BOTH NULL, including fresh pinned load after003. Certified recorded_at input NULL; trigger supplies actual DB time. Certified admission_settlement OUTPUT is always the normalized closed shape below, even if INPUT missing/malformed. No both-present INPUT constraint that rejects otherwise valid monetary truth.

### 7.1 Normalized admission_settlement/1 — exact fields

{schema:"g1-sim-settlement/1",
verification_status:"attributed_receipt"|"unverified_assertion",
metadata_problem:"none"|"absent"|"malformed"|"attribution_mismatch"|"event_mismatch",
invocation_observation_hash:H|null,final_receipt_hash:H|null,
attribution:AT|null,consumption:CT|null,
work_ended:true|false|null,observed_output_bytes:N|null,
price_status:"known_final"|"unknown_final"|"asserted_known"|"asserted_unknown",
event_binding:EV|null,violations:V[]}.

V is a SET emitted in this fixed order (no duplicates/unknown literals):
metadata_unverified;
input_hash_unobserved,input_hash_mismatch;
input_count_unobserved,input_count_mismatch;
output_cap_unobserved,output_cap_mismatch;
request_fingerprint_unobserved,request_fingerprint_mismatch;
certificate_unobserved,certificate_mismatch;
provider_unobserved,provider_mismatch;
operation_unobserved,operation_mismatch;
model_unobserved,model_mismatch;
output_count_unknown_at_end,output_over_cap;
foreign_currency,actual_above_bound.
SQL DERIVES/replaces violations from normalized fields + original certificate + actual event columns; never trusts caller V[] or transient flag.

attributed_receipt requires complete closed metadata/hashes, AT matching ORIGINAL stored call/run/policy/certificate, event_binding typed-equal to EVERY existing event field, receipt price_status matching actual scalar pair, CT well-shaped, IO/FR link supplied as verifier-established evidence. CT incomplete is representable; work_ended false/null representable. Observed-consumption mismatches do NOT invalidate attribution or delete money; keep facts and derive V. SQL checks supplied normalized facts/links structurally; it cannot authenticate fixture source or retrieve canonical Packet. API/fixture verifier supplies rehashed evidence. Raw writer can forge internally consistent assertions; not authenticated universal work-ended proof.

event_binding is a closed projection of the SAME receipt EV, a consistency witness, not another cost source. ALL aggregates use authoritative event columns, never event_binding.actual_cost. Usage binding is only two measured count keys, not arbitrary usage data; refs remain canonical internal receipt values, not diagnostics.

### 7.2 Normalization branches (no hidden truth rejection)

For certified parent and canonical event passing existing001 constraints:

- Valid metadata + original AT + typed EV agreement =>retain facts, normalized attributed_receipt; V computed below. Above-bound/foreign/wrong-consumption remains this attributable state with its real cost/currency intact.
- Missing JSON=>unverified_assertion/absent.
- Malformed/unknown keys/types/cast-invalid metadata=>unverified_assertion/malformed.
- Well-shaped AT inconsistent with parent=>unverified_assertion/attribution_mismatch.
- Well-shaped metadata but EV/price/usage/ref/time scalar mismatch=>unverified_assertion/event_mismatch.

Every unverified branch stores schema/status/problem, NULL all receipt hashes/AT/CT/work_ended/output/event_binding, price_status=asserted_known iff event actual_cost nonnull else asserted_unknown, and V including metadata_unverified plus scalar foreign_currency/actual_above_bound as applicable. It preserves event_type/ended_at/usage/actual_cost/currency/refs UNMODIFIED and sets server recorded_at. No inference of consumed content/work end and no proof of any particular content mismatch in the malformed branch. metadata_unverified is durable permanent breach, capacity held. Unexpected DB/transport/internal failures are NOT swallowed as metadata malformed; only bounded recognized input parsing failures normalize. Existing invalid canonical event/FK/immutable conflict still refuses.

This compatibility branch permits original valid monetary ledger assertions even if metadata is absent/corrupt; it is NOT a path for attaching a wholly unrelated receipt. Certified APIs FIRST reject unattributable/tampered Packet with NO SQL. Raw ordinary INSERT can assert monetary truth on a valid parent; guard records it as unverified if evidence incomplete, blocks new starts and grants no work-ended/retry proof. SQL cannot establish provenance of arbitrary raw assertion. Do not describe raw wrong-parent insert as verified receipt truth.

### 7.3 Exact durable mismatch predicates

Let cert be original stored certificate; V from attributed metadata:

- input_hash_unobserved iff CT.input_text_hash null; input_hash_mismatch iff nonnull !=cert.input_text_hash. Equal byte length does NOT cure it.
- input_count_unobserved iff CT.input_bytes null; input_count_mismatch iff nonnull !=cert.input_bytes, both fewer and more.
- output_cap_unobserved/mismatch uses consumed_output_cap null / !=cert.max_output_bytes, including lower cap.
- request_fingerprint_unobserved/mismatch uses computed_request_fingerprint null / !=stored original fingerprint.
- certificate_unobserved/mismatch uses consumed_certificate_hash null / !=stored admission_certificate_hash.
- provider/operation/model unobserved/mismatch use null / !=stored scalar values; not external compatibility.
- output_count_unknown_at_end iff work_ended=true and observed_output_bytes null.
- output_over_cap iff output bytes nonnull >cert.max_output_bytes (original cap), OR >nonnull actually consumed cap. Legitimate shorter/equal output is NOT mismatch; do not require cap-sized output.
- foreign_currency iff actual_cost nonnull and event currency !=admission_currency.
- actual_above_bound iff event currency=admission_currency and actual_cost>reserved_cost_upper_bound.
  Unverified metadata always includes metadata_unverified; its scalar money V derived from authoritative columns too.

Permanent installation breach=EXISTS certified event with normalized V nonempty OR any certified event missing valid normalized output metadata/recorded_at. Under invoker guards ordinary inserts normalize; the latter is defensive for detected malformed retained state, not claimed privileged bypass prevention. Breach survives restart/day/child/policy changes and blocks every NEW certified admission even when aggregate sums fit. Cost above bound is full actual ONCE, not clipped or actual+bound.

SQL cannot derive actual content from an opaque hash alone; normalized CT supplies each observed fact/disposition. It cannot durably identify content discrepancies from an unverified/tampered/unrelated receipt never attached: guarantee is explicit UNKNOWN/no event/occupied, NOT global breach from unattributable evidence. This narrows revision02's overly broad “any binding violation persists” statement.

## 8. C3: capacity, retry and exact accounting

VerifiedEnded(c) iff immutable event normalized verification_status=attributed_receipt,
metadata_problem=none, original AT/hash binding true, typed EV agreement true,
work_ended=true, nonnull valid final_receipt_hash + invocation_observation_hash.
This is trusted original-attributed end assertion, not event_type/cost/IO marker. Consumption violation may coexist with end proof; permanent breach then prevents all new starts. Output count unavailable at end derives breach. Unverified metadata/tampered/unrelated evidence never ends capacity.

Occupied(c)=0 iff VerifiedEnded(c), else1. Independent committed IO without FR/ledger event, no-event/committed-not-invoked, timeout/cancel/throw/worker death and lookup unknown/not_performed remain occupied. Final unknown price with verified end+valid quantities may free capacity, but money bound remains. Known actual alone never frees. Null or false work-ended with correct consumption/ample headroom still blocks certified retry.

**Certified retry predicate, enforced API AND certified BEFORE ROW SQL:**
existing immutable causal guard must pass (same attempt/provider/operation/model/fingerprint/key/intentional index; prior try+1; unique retry_of; prior event retryable_failure);
AND VerifiedEnded(prior)=true;
AND installation breach=false;
AND same pinned policy/full normalized policy;
AND all new money/reservation/retry/global+provider concurrency/rate/spacing/clock limits pass.
Fail original end condition =>provider_admission_retry_work_not_ended, no row/effect. False AND null fail; neither known actual nor headroom overrides it. Gate this rule on NEW certified reservation only; legacy accepted retry semantics unchanged. No loop/overlapping retry/timer reclamation/takeover.

Population I=ALL provider_calls; C=certified simulations; L=uncertified calls. L0: ANY L blocks new C; zero/name/known fixture IDs never exempt. All C count, including zero-price/test/failed/noninvoked; fixture evidence table excluded entirely. One event maximum avoids double-count.

Known(c)=final actual nonnull in installation currency. Exposure:
Known=>actual once; no event OR final-null=>bound once.
Foreign=>new admissions blocked; do not convert/add foreign amount as base currency; unresolved bound may be shown conservatively, never used to authorize while breach exists.
AttemptSpend=SUM exposure all history of actual attempt.
RunSpend=SUM exposure all sibling/child attempts joined to actual run.
DaySpend(t)=SUM same-currency known actual for admissions in UTC day(t) + SUM bound for ALL no-known-price calls across ALL admission days.
Sets disjoint. Add candidate B once; equality passes/excess refuses. Yesterday settled actual drops from day, yesterday null/no-event bound carries. Unverified monetary assertions still use scalar final cost where known but permanent metadata breach blocks starts; no assumption that smaller asserted amount frees capacity.

Every committed physical reservation counts attempt/run/day (server admission date) even if no invoke/failure/zero. Retry rows count retry_of; r retries=>tries1..r+1 and aggregate retry/reservation ceilings. R0 disallows all take/reroll fields; nonzero render/reroll quotas OPEN.
Rolling global/provider counts (t-window_ms,t] include all committed C, candidate1; spacing t-last_admitted>=minimum; equality passes. Recovery/event writing consumes no new admission slots. Day rollover does not reset rate/occupancy/history pin.
Final-null price cannot be amended under one-event immutability; indefinite bound retention is honest. No FX, clipping, historical backfill, event replacement, new spend source or mutable policy reset.

## 9. SQL clock/locking, migration and exact fixture compatibility

D fixed installation transaction lock (182736456,1), independent of UUID/provider/policy/run.
Participating runtime reserve/record acquires before ANY ledger read; ordinary raw INSERT BEFORE STATEMENT acquires it; certified BEFORE ROW validates RC and uses separate subsequent VOLATILE queries AFTER acquisition, NOT combined lock+read with a prewait snapshot. Policy/hash/equation checks use original stored full normalized snapshots; first writer consistency is not authority.

ONE clock_timestamp sample per ADMITTED ROW after lock, supplying admitted_at/day/rate/spacing/backwards checks. Multirow INSERT samples separately per row; visible earlier processed rows count; do NOT assume VALUES order or deterministic first row. Mixed-policy/budget/rate excess rolls back statement (and command transaction as applicable), leaving no lasting partial pin/charge. Real raw INSERT bulk/commit/rollback controls required. No externally supplied time/current-policy reseed.

Refuse new sampled t<ANY retained certified admitted_at/recorded_at. Event recorded_at sampled DB actual clock while locked; reversal does not reject a valid original attributable event or clip time, but new starts stay blocked against watermark. Existing ended_at>=started_at still mandatory; no clock-based fabrication to bypass it. No forward-clock guarantee or general COMMIT/transport bound.

Request-content verification is deliberately split: SQL can recompute complete policy/certificate hashes from their restricted stored closed subjects, compare scalar equations and immutable reservation bindings, and compare measured consumption hashes/counts/caps in settlement. The call does NOT store raw input text, so SQL cannot independently reconstruct the request-envelope fingerprint from that text or authenticate its alleged consumption. The trusted adapter/verifier performs that byte-level comparison; a hostile credential holder can still forge coherent request/receipt assertions. This limitation does not weaken SQL's installation-lock, money, clock, pin and structural consistency checks and supplies no live authority.

Invokers/roles: no UPDATE/SELECT FOR UPDATE/new grants/extension/SECURITY DEFINER; new helper EXECUTE is not assumed because roles.sql revokes PUBLIC defaults. Dedicated trigger logic runs invoker rights using existing SELECT/INSERT/builtin functions; prove actual roles. Restricted ASCII operational policy/certificate canonical emitter reconstructs known keys/ints/decimals, shared canonical agreement; no general JSON/Unicode serializer rewrite or jsonb::text hashing.

003 candidate ONLY two tables/eight additions, nullable no-default/no-backfill, unchanged001/002/roles/checksums/guards. Historical call metadata ALL NULL, newly loaded AND retained historical events BOTH NULL. Certified call complete fields; event output normalized as section7. Failed003 transaction commits neither schema nor migration checksum. No down-delete/alter applied migration. Quiescent populated migration: existing migration lock->installation lock->table/DDL locks. Runtime never reverse-acquires migration lock. Raw table-lock-before-trigger transactions can deadlock with DDL; truthful bounded abort, no arbitrary online deadlock-free claim. Fresh001+002 before runtime traffic;003 locks before DDL.

Fixture loader under D must take installation coordination before existing all46 fixed table locks; otherwise loader table-lock vs runtime install-lock cycle. Keep old empty-only persistFixture isolation/semantics; no historical certified policy checks applied to legacy INSERTs.

**Exact fixture amendments, not weakening:**

1. Both setup reuse AND independent runtime snapshot retain EVERY shipped-column PG typed FULL JOIN check, artifact/run bindings, microseconds/numeric equivalence, all46 extra/missing/minted/advanced checks and atomic empty load/old duplicate refusal.
2. Add SQL any-nonnull checks for each six provider_calls fields and both provider_call_events fields. Any addition present =>complete_fixture_mismatch safe table identity/no mutation. No event-added time on new historical load.
3. Keep frozen families/JSON/ZIP/Hashing/show-config unchanged. fixture-load.test.ts:193–246 expected LIVE cols exactly frozen columns UNION {calls six additions; events two}; LIVE jsonb exactly frozen jsonb UNION admission_certificate(calls)/admission_settlement(events); all other families unchanged. Table/PK/FK exact assertions retained; ANY unknown extra column still fails. No subset/superset test.
4. New+retained398 tests BOTH tables, each metadata field/envelope, old empty-only duplicate negative/numeric/microsecond/advanced-state no-write controls. Constraints preventing isolated-column corruption require labelled valid envelope test setup, not disabling immutable guards.
5. L0 refuses certified admission in398/any-legacy DB. No fixture-populated integration credit. Exact offline provenance/authenticated history extension NOT part of first slice.

## Development evidence and retained limitations

ROOT independently reviewed and accepted the finite development proof matrix, with its stated limitations. The latest unfrozen focused runs against the retained synthetic PostgreSQL17 database at loopback55443 were:

| Run                                     | Actual result                                   | Raw log SHA256                                                   | Execution record SHA256                                          |
| --------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| g1-b-dev-migration-consumption-claim-01 | 65/65 tests, 1/1 file, exit0, no reported skips | cd939a7f09f8046cd5ab2ae6e10f85a409ffb832802861e3839e569e9663586b | 915e9577294bae77df7332d22c65ad487a6fb3790f715cceb96e0640d9644302 |
| g1-b-dev-runtime-consumption-claim-01   | 93/93 tests, 1/1 file, exit0, no reported skips | 98249c6b385ddc6f648393dd8bf39edf3a0bde07823fffb5dd756cc5ed3e54d1 | eca4274c284afde37d2319dcf84067102cabaa9f89b0ea25c251b75a9505572c |

The external raw pairs are under `/home/codespace/desk-codex-g1-20261005/`, with the run name plus `.log`/`.record`. Their durations were140.9113745859995s and259.8781232559995s respectively. Both before/after source windows and independently rehashed current18 paths matched; no timeout, cleanup, spawn or identity errors were recorded. These runs precede comment/documentation/format polish and do not establish a frozen candidate pass. Historical failed runs remain retained; a later pass does not rewrite them.

The current finite matrix covers real named installation-lock commit/rollback arbitration, ordinary SQL/API participation, mixed-policy and budget multirow statement rollback, explicit/default repeatable-read refusal, post-lock server-clock sampling, legal sibling/repair-child accounting populations, known/unknown money versus independent work-ended retry/capacity, count limits, exact actual precision, L0 legacy refusal, fresh-child permanent breach, retained original receipts after crashes/acknowledgement loss, phase/cancellation/first-error controls and late-zero work. Repair lineage is structural test setup, never repair-stage execution.

The final consumption additions measure the request and certificate actually used inside perform. They cover empty/fewer/more input, lower/higher consumed output caps, locally coherent different certificate/provider/model use, actually generated shorter and over-cap output, unknown output measurement at true end, and original-attributed wrong consumption with truthful foreign final money plus another unresolved bound. Independent literal text/request digests, byte counts and ordered violation lists are checked against retained IO/FR bytes and raw scalar events. An alternate operation is **not** a coherent certificate in the closed `g1_sim_text` profile: its actually invalid use is measured incomplete, with null consumed-certificate hash and `certificate_unobserved` plus `operation_mismatch`. These local use facts grant no other provider/model/operation execution authority.

Both same-ID and held-slot recovery are exercised with correct original hash despite invalid current scalar policy, actual `GENERATION_KILL_SWITCH`/`PROVIDERS_ENABLED` stop controls and invalid full controls; absent/null claims also recover. Malformed/accessor/descriptor-trapping explicit claims refuse before DB access. An explicit well-formed HASH for a missing original refuses before INSERT. Recovery checks original immutable receipts/metadata with zero new admission/temporal-clock/record/effect/evidence lookup; source ordering markers must be present exactly once before ordering comparisons. This is real recovery plus source-order proof, not an induced midnight/day-change test. Existing wrong-hash/valid-policy, policy-getter and immutable-conflict assertions remain intact.

Raw canonical monetary events with SQLNULL metadata, a representable wrong whole JSONB type or an unknown top-level key retain exact scalar money/usage/time/reference and original call values/xmin/ctid, normalize to unverified metadata and permanent breach, and grant no work-ended capacity. The unchanged temporal expression is exercised against copies of those real committed rows separately from the unchanged real trigger's new-start refusal. This does not normalize invalid JSON text, unrelated DB failures or invalid canonical events, or authenticate raw-writer truth. Unrelated/tampered/binding-invalid callable Packets retain unknown/no-record/occupied semantics and create no invented global breach.

Fixture compatibility retains fresh and001+002-to003 historical398 preservation and the accepted exact six-call/two-event schema unions. Metadata refusal setup uses valid guarded envelopes, never new replica-role/trigger bypass. Coupled event-envelope setup remains an explicit readback limitation: it is not proof of eight independently isolated nonnull metadata mutations/readback branches. L0 still blocks new certified admission in any uncertified historical population, including the shipped fixture; no populated-fixture certified execution credit.

Temporal microsecond, UTC/year/timezone, rolling/spacing/watermark and later-day permanent-breach cases use exact candidate SQL-expression oracles plus actual unmodified-trigger clock/lock integration. They do not induce OS-clock reversal, actual midnight or controlled production per-row clock sequences. Differing-provider scope oracles are not real multiple-provider populations under the single pinned rule. SIGKILL proves actual owned process death; releasing the test-only migration gate permits the server's next socket interaction before independently asserting backend disappearance and transactional rollback. Acknowledgement-loss proofs are not network-packet-loss proofs.

D remains structural invoker arbitration, not authentication of operator, tariff, receipt source or a hostile in-process caller. L0 and R0 remain strict; one database/currency/historical policy pin, no rotation or live/production/staging execution. G1-A still permits no automatic late verifier/projector/finish/lookup/connect/query/SQL/evidence append/event; explicit parent fixture completion is counted separately from runtime work. Local observation/owned timer bounds do not bound arbitrary SDK resources, pool checkout/transport/COMMIT/ROLLBACK or remote effects.

Final exact-candidate freeze, unfiltered real-PG regression with zero skips, format/lint/types/build, shipped anchored fixture validator/conformance, audit, candidate-scoped secret scan/container CI and fresh independent implementation review remain required separate gates. No G1/G5/Build1/Build2/CompletionA/B/walking-skeleton closure, live readiness, generated-seconds/per-block quotas, reroll, repair/revalidation/publication or deployment acceptance follows from this development evidence.
