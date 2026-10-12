# Planner fixture consumer inspection snapshot (PC1)

This is an unwired implementation candidate for the accepted bounded PC1/05 contract. Its result is an inspection snapshot, not an execution-authorized Showrunner input, permission receipt, model request, Brief, persisted freeze, or completed G1/Build milestone. ROOT accepted the bounded offline05 raw/effects evidence dated 2026-10-11 only for the exact runtime/test/docs-before tuple recorded below. Whole independent implementation review, ROOT implementation adjudication and fresh exact-head PR CI remain pending. Historical focused01/focused02 and local-gate02/03/04 results remain bound to their earlier source bytes; the docs-only correction identity and any later authoring/format evidence are recorded externally, with final review and fresh CI still pending.

## Authority and API

FINAL LOCK v1.2.6 selects the unchanged owners. The accepted external contract is `contract-PC1-05.md`, 62,220 UTF8 bytes, SHA256 `625a9c6a7817c833cf4d98736df12efb80a6dbec54d6de10fc06b4b0386ecf5f`. Its historical preparation heading does not replace the later exact-byte ROOT adjudication (9,265 bytes, SHA256 `b6ba6dd5a82de5ea7209cc303bd4dbcb85a3f752ee53791d29e9a94f10fc59cf`). These docs describe the implementation; they are not a substitute for reading the complete accepted contract, its complete 82-record grammar, or its literal evidence.

ROOT's additive P7 clarification is 6,135 bytes, SHA256 `21dde8a5e867151f13c9c53e4fdec95ae16abf4b9575beb521f46c16d9c2232e`. Its adjudicated order and paired error tests are incorporated below. The worker received ROOT's exact order and source conclusions; this is not a claim that this repository contains the complete external clarification body.

The later union-prefix proposal is 9,118 bytes, SHA256 `1b2a72a66640c6a9590c9f96620f9dda10259cf846edc52f108a9331c411d48a`. ROOT's dependent authoring adjudication is 8,043 bytes, SHA256 `d01f56284d5dca5e0fdee3fe999a09a541929b124562d368f304a31f510dc92a`, with the complete rule7 refinement: selected-branch validation starts at its beginning and stops no later than the structural stopping event, so an earlier selected-branch semantic error wins. This resolves the ambiguity held by Review24; it does not retrospectively establish that the previous dispatch violated the unclarified contract. Frozen contract and Lock bytes are unchanged.

Only three new paths comprise this candidate: the runtime, corresponding unit test and this document. Existing parser, identity domains, Lock, schemas, dependencies, fixtures, workflows and wiring remain unchanged.

Runtime exports only:

```ts
PROFILE = "planner-fixture-consumer-snapshot/1";
materializePlannerFixtureConsumerSnapshot(input: unknown): PlannerFixtureConsumerResult;
```

The function is synchronous. Its only type exports are `PlannerFixtureConsumerView`, `PlannerFixtureConsumerResult`, `PlannerFixtureConsumerRejection` and `PlannerFixtureConsumerError`. Other record declarations and helpers are private. The compact descriptor table contains all 82 accepted records, not an open `Record<string, unknown>` output tail. Internal maps/records assist finite validation; they do not expand public grammar.

Input is a primitive canonical JSON string with exactly `schema`, `package_payload`, `material`. Schema is `planner-fixture-consumer-input/1`. Package is the complete existing nine-field payload. Material contains exactly the five arrays `claim_bases`, `rights_versions`, `evidence_bodies`, `support_carriers`, `derivations`. There are no reader callbacks, caller-object sandbox, implicit retrieval, hidden preparation store, DB/model interfaces or filesystem output.

## Phase order and safe refusals

Every refusal is recursively frozen and exactly `{kind:"rejected",profile:PROFILE,code,field,parser_code}`. New refusals have `parser_code:null`. There are no exception messages, input key names, private snippets, partial hashes or partial View. Unexpected errors propagate rather than being classified by message or caught as invalid source.

| Phase | Work and first refusal                                                                                                                                                                                                                                                      |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0    | Primitive type, empty text, UTF16 length. Codes `input_type_invalid`, `input_text_empty`, `input_resource_limit`; field `input`.                                                                                                                                            |
| P1    | Unpaired raw UTF16 surrogate scan, then UTF8 length. `input_unicode_invalid` or `input_resource_limit`.                                                                                                                                                                     |
| P2    | Quote/escape-aware resource-only delimiter scan. Opening root depth 1; over 32 refuses resource. Malformed syntax remains P3.                                                                                                                                               |
| P3    | Captured native JSON.parse without reviver. Only its SyntaxError becomes `input_json_invalid`.                                                                                                                                                                              |
| P4    | Owned JSON DFS, root container depth 1, scalar depth 0; count each value and each object key before its value. Over 32 depth or 32,768 nodes refuses resource.                                                                                                              |
| P5    | Source-matching semantic preflight, then unchanged canonicalJson and exact source-text equality. Unsafe/noninteger/-0 numbers, unpaired parsed string/key surrogate or NFC-key collision give `input_semantic_json_invalid`; text mismatch gives `input_text_noncanonical`. |
| P6    | Exact envelope, then once-only unchanged parsePayload. Envelope errors are `input_envelope_invalid`; known parser Rejection becomes `parser_rejected/package` with exact inherited code.                                                                                    |
| P7    | Complete manifest grammar first; created_at; frozen_at; five material roots in declared order; aggregate support/member count. Exact shape/value/version/resource refusals.                                                                                                 |
| P8    | Ten ordered consistency/exposure/calculation checks described below.                                                                                                                                                                                                        |
| P9a   | Exact logical canonical View UTF8 counting, inclusive 2MiB, before repeated copies/full View serialization/View hashing.                                                                                                                                                    |
| P9b   | Owned copy, unchanged canonical serializer, counter/actual-size invariant, separate observations and local View hash, recursive freeze.                                                                                                                                     |

Input transport has inclusive limits of 2,097,152 UTF16 code units and 2,097,152 UTF8 bytes. Each profile array has at most 256 entries; each ordinary profile string has at most 16,384 UTF16 code units, must be NFC and nonblank according to native trim. Aggregate claim supports plus beat members have at most 4,096 entries. UUID/hash syntax inherits the selected parser's lowercase grammar. Limits are selected profile admission/resource choices, not general product policy or fatal-OOM protection.

P5 examines/normalizes every object's keys and detects a normalized collision before traversing children; children then follow normalized Unicode-codepoint order. Arrays use index order. Known source-semantic conditions are explicit predicates, never TypeError-message matching. Impossible native-JSON cases and unexpected normalize/sort/Map/Set/serializer failures propagate. Duplicate raw keys cannot become an accepted last-key-wins snapshot because serialization must equal the exact supplied text.

P6 retains the exact 37-code union and actual parser precedence. `invalid_json` is invariant after P0–P5 owned bounded semantic JSON. `package_payload_shape` is invariant because P6 rejects a non-record package before assertJson/parsePayload. Neither is manufactured as a parser test. There are at most 35 remaining prospective reachable codes, not a claim of 35 PASS results or complete reachability proof. The explicit candidate table contains 35 intended cases; execution/source adjudication may establish further limits.

P7 walks each exact record's shape before children, in the accepted codepoint field order; arrays in index order. Missing/extra keys give `profile_shape_invalid`; wrong primitive/null/domain/bound gives `profile_value_invalid` at the fixed leaf. Well-typed unknown interpreted versions give `profile_version_unsupported` after ordinary validation. Same-keyset alternatives dispatch by declared types, not fixture IDs/answers. Opaque lens, rights registry, show/version and bookkeeping identities are preserved and bound rather than arbitrarily repinned.

Union selection keeps one structural cursor per declared alternative, in declaration order. Each cursor retains its whole descriptor across siblings and array entries. At each preorder event it checks primitive/container type or exact record keys, then removes contradicted candidates permanently. A bad descendant cannot resurrect a branch eliminated by earlier attribution/target types. Unions declared inside item descriptors are independent per item; whole-array alternatives remain correlated across the entire array. Selection only retains descriptor/data references and pending traversal state, not copied input subtrees, complete parse products or emitted View data.

If all current candidates fail an event, selection retains the first pre-event survivor. If complete structural matches tie, declaration order wins. Empty arrays provide no item discriminator. Semantic validation then walks the selected branch from its beginning in the unchanged predicate order, reaching an earlier semantic refusal or the structural stopping event. Semantics never select/eliminate/retry alternatives; enum labels, UUIDs/hashes, prose and fixture IDs never discriminate. Unexpected native/internal exceptions propagate rather than eliminating candidates. Record/type keyset checks and finite descriptor splitting are the only selection predicates.

Authored repair pairs cover the five reported claim value tails, nine signal nested tails and the separate signal null-time case, earlier attribution shape and selected-branch semantic defects, signal time before observation tail, genuine P6 priority and cross-branch hybrids. The support-array hybrid retains one claim branch across both entries; swapping two claims with matching base order checks genuinely per-item unions. Empty support-array prefixes remain ambiguous until later value keys distinguish them. The current grammar declares item unions, not unions between complete arrays; the latter cannot be exercised through this public profile. Complete multi-record matches are structurally distinguishable in the selected claim/base/evidence/signal/carrier alternatives; declaration-order complete ties therefore have no discriminating public vector here. These are source/reachability qualifications, not internal-helper or executed PASS claims.

Required P7 competition cases use P6-accepted, self-consistent package hashes: manifest error beats created offset; repairing it exposes created; created beats frozen offset; repairing created exposes frozen; frozen beats material error; repairing frozen exposes material. A genuine P6 error still precedes every P7 addition.

## Timestamp and identity ownership

The unchanged `command.ts:432–459` parser timestamp accepts Z/offsets with its existing calendar behavior and at most six fractional digits. Package created/frozen and evidence as_of retain its P6 priority. This helper does not alter Date.UTC behavior or those owner rules. Offset strings that survive P6 refuse at the later declared P7 Z-only leaf.

The profile's exact finite timestamp registry follows `canonical-json.ts:123–146`: four-digit year, Gregorian leap/calendar/time checks, Z, optional arbitrary positive fractional length, no leap seconds, original string returned. Year 0000 is allowed at those non-P6 sites because the owner does not prohibit it. The ordinary leaf cap permits 16,363 fractional digits there. Date-only source_document_date uses the separately declared YYYY-MM-DD profile predicate; attested_since_year is an integer 0..9999, not an inferred instant.

Owner `knowledge.ts:61–64` permits claim asserted_at null. This selected consumer grammar deliberately refuses it at `material.claim_bases[i].asserted_at`; it never fabricates an assertion time or changes immutable owner identity semantics. Required non-null dates/timestamps refuse before identity hashing/comparison. Null speaker/target columns and other declared nullable members are preserved; there is no generic null rewrite.

Chronology compares integer date/time components, then fractional ASCII digits with missing suffix treated as zeros. No Date.parse, binary float, millisecond rounding or whole-string lexicographic chronology. `.1Z`, `.10Z`, `.1000000Z` compare equal but retain different bytes/hashes. Exact copied proofs still require exact canonical/string equality, not equal instants.

Knowledge hashes use unchanged nine-field claim content, three-field frozen state, complete non-null derivation output and complete two-field carrier payload. P7 preflights their known shape/string/status/usage/enum refusals; unexpected internal failures remain invariant/runtime errors and propagate.

## P8 consistency and exposure

Checks visit the accepted family/index/field order:

1. Duplicate package and material identities, then per-beat/silent/signal/derivation duplicates.
2. Exact material IDs and first-occurrence order, including hidden rights but only necessary quote/derivation bodies. No extra supporter bodies or unrelated material.

   Test prerequisite closure is explicit: derivation duplicate control remains; a distinct-ID extra row retains the referenced derivation and its body set, while a missing-derivation vector removes the five now-extra input bodies and retains the quote body. Changing claim4's support kind to lore/prediction makes continuity the first remaining claim carrier target, followed by signal section targets. Those negatives reorder unchanged carriers to continuity then signal and recompute package identity; they do not change P8 runtime checks, carrier hashes, claim bases, rights or refusal expectations.

3. Base/package field binding, complete claim-content/frozen hashes and the fresh no-event-prefix subset. Usage cannot be promoted. The closed grammar admits null cursor only; EVERY parser-valid non-null cursor refuses P7 before P8. The later defensive P8 null-cursor refusal is unreachable through this public pipeline. Malformed cursors retain P6 parser ownership.
4. EVERY evidence's supplied rights source, acquisition, each consumer ceiling, quote/paraphrase grants, complete retention and synthetic/provider flags. A retained permitted_quote with planner mode other than exact_excerpt refuses immediately.
5. Supplied body bytes and exact locators, then exact_excerpt half-open Unicode-codepoint permitted span/text. Full canonical bodies never emit.
6. Four supported support kinds and full target hashes, then direct exact-evidence lore representation. Lore/prediction support KIND refuses; a lore CLAIM with valid evidence support remains allowed. All five roles are preserved, not promoted.
7. Signal count/order/four distinct source identities/complete recorded hashes and provenance, observation windows, tenor metadata and section targets.
8. Complete derivation proof equality, scope/window/schedule chronology, finite five-match body reproduction and output/claim agreement.
9. Complete synthetic continuity publication/withdrawal/topic proof. Occurrence strictly precedes publication, then publication is at or before selected proof as_of, then at or before frozen_at.
10. Context/beat refs, silent inverse and calibration restrictions, attribution, availability, coverage, no-incident sensitivity and finite provenance.

Signal material intentionally omits supporter observation bodies. Carrier/package recorded content_hash equality is checked; those missing bytes are NOT recomputed. Supplied necessary body rows remain fully hashed. The shipped full-row validator's supporter-body check is not this helper's coverage. Four distinct sources and consistent fabricated observations can still pass supplied-snapshot consistency.

Derivation interprets only the exact finite bodies `Previous match N: Northbridge conceded in minute M.` and `Previous match N: Northbridge did not concede after minute 80.`. N is 1..5/rank; M is canonical decimal 1..1440; only M>80 contributes. Parameters are after_minute 80/window_matches 5; output count/sample_size must reproduce the five supplied rows. This is synthetic authored data reproduction, not an independently verified schedule, NLP or sports truth.

Continuity keeps full supplied prior occurrence/publication proof. It establishes neither real publication nor current-use authorization. Its strict/as_of bounds follow the selected fixture validator; the frozen_at bound is this profile's additional admission choice.

## Emitted selection and ownership

The exact 22-field View contains schema/materialization/assurance, package identity and scope, finite family records, claims/evidence/support summaries and all eight limits. Family array order is preserved; no new ranking, selection or programming decision.

Each claim item has snapshot/value/value_status/consumption. Snapshot has exactly 17 fields:

```text
claim_id,claim_content_hash,frozen_state_hash,frozen_state,
effective_usage_class,state_event_cursor,support_refs,attribution_requirement,
initial_status,initial_usage_class,kind,origin,predicate,reduced_usage_class,
subject_domain,subject_ref,value_type
```

There is no approved_representation or value in that snapshot. Complete structured_text and analysis_text values are null/withheld_pending_representation. The other seven typed fixture values retain their validated records. All nine slots remain. Silent usage becomes silent_calibration_only; other usage remains ordinary_snapshot without a may_voice permission.

Each visible evidence item has snapshot/representation/representation_status/claim_representation_refs. Snapshot has exactly 23 fields:

```text
evidence_unit_id,content_hash,rights_version_id,evidence_type,source_identity,
source_item_identity,source_role,modality,language,entity_identity,
competition_identity,event_identity,as_of,consumer_exposure,quote_permission,
paraphrase_permission,locator,retention_class,rights_policy_version,
speaker_identity,acquisition_ref,origin,source_modality
```

Only the five declared locator fields and three consumer modes occur within those nested members. No permitted_quote metadata tail/text or injection specimen is spread into snapshot. Only validated exact_excerpt emits `{kind:"exact_permitted_span",text,span_start,span_end}`; other modes emit null representation. Six paraphrases remain unmaterialized. Lowering mode while retaining permitted_quote refuses before copying. Removing the quote on the finite lore alternative can refuse grammar earlier; no replacement prose is invented.

Support summaries preserve claim/support order and complete supplied derivation or carrier proof, not hash-only summaries. Evidence inspection is only its UUID/hash/rights/exposure. Repeated payloads are subject to the full output budget, never silently truncated/deduplicated. Bodies and rights registry do not escape.

Every result owns new ordinary recursively frozen records/arrays. Source parsed graphs are discarded, not cached. No caller object passes P0; no Buffer, Error, Map/Set, class or parsed alias escapes. Unexpected selected-realm failures are not swallowed.

Always-visible limits, exact order:

```text
authentic_persisted_freeze_not_verified
current_rights_and_current_use_not_verified
evidence_paraphrases_not_materialized
two_free_text_claim_values_withheld
approved_claim_representation_prose_not_emitted
complete_fixture_consumer_adequacy_not_established
support_sufficiency_and_semantic_truth_not_certified
planner_configuration_and_execution_not_included
```

## Exact output cap and independent literal evidence

P9a counts the ENTIRE logical canonical View, inclusive 2,097,152 UTF8 bytes, including every repeated carrier/derivation occurrence, all keys/quotes/escapes/commas/brackets and limits. The counting visitor retains parsed references and small finite metadata only; the copying visitor does not run until counting succeeds. Over cap gives only `profile_resource_limit/view.canonical_json`, before complete View serialization, local View hashing or success observations. P8 failures still win. Actual canonical byte length must equal the count after success as a source invariant.

String accounting matches canonical JSON escaping: quote/backslash and standard control escapes cost two bytes; other U+0000..001F cost six; valid remaining codepoints cost 1/2/3/4 UTF8 bytes, with literal U+2028/U+2029. Safe integer decimal/null/boolean and complete structural overhead are included. Input restrictions plus this budget are not universal VM/OOM protection.

Whole positive literal components are embedded as data in the test, not imported from private evidence at runtime:

| Component                            | UTF8 bytes | SHA256                                                             |
| ------------------------------------ | ---------: | ------------------------------------------------------------------ |
| Complete canonical package           |     40,713 | `62a5d00b86a7bd3661ff2b2542fdd1f31051c981098f519aa0965747a1c51ee5` |
| First-occurrence-normalized material |     37,600 | `67773b6917993ef1f644707d8559fb0a63834e6f5d87cd264783415b3de897af` |
| Expected View fields                 |     36,485 | `1f14246534ee2cf00d6c1d26bbb1562428eba519f03586927ff78ae4993d4e7f` |
| Expected complete support summaries  |     26,458 | `d3995d21abd1c67ec97340dad22c12284ce7084b10759af74471381c60e2539a` |
| Assembled expected canonical View    |     62,964 | `f00c6001ac059a75fc45d7d92c2d17e5ed5412d85974c99a37a7ffb6e861e05f` |

Expected local domain digest is `381b304c8291412614d1d4fb1378bac328e13546b730c6a4847ab9552fa646f6` over UTF8 `planner-fixture-consumer-snapshot-v1\n` plus canonical View. This LOCAL domain does not modify governed domain registration or V0 identity. Raw full input observation, canonical package-text observation, package/scope identity and View identity are distinct.

The independently calculated legal output-boundary construction changes the continuity carrier's exact_text to 16,000 ASCII x characters, repeats its complete proof in 116 distinct per-claim supports, and pads source_attribution display_name. It has 5,898 input graph nodes and 124 total supports, still bounded input/arrays/references.

| Case                   | Input bytes / SHA256                                                         | Expected View bytes / raw SHA256                                                        |
| ---------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Inclusive, padding 320 | 132,277 / `4a011be947a9ef1c956400aa22135b36aba007d4e0463f921d361bfb0e3bcb45` | 2,097,152 / `37106fc372462663f65abc3e4e4ef2c39461b2cba10845dc465c12f2b756a697`          |
| One over, padding 321  | 132,278 / `a9d12e4e0844eb64db60b602cc9f3dcb433101d17719c1c157ed4152856e5ba0` | Would be 2,097,153 / `4194509c2dc9b601acffeda77ebcc230f25e6914142386111c5f69938bffa991` |

The inclusive domain digest expectation is `e941b33a78600f35c1479db9dedb6b6b6bd1c6291be57f50e819e36e9bb2da28`. These are independent stdlib data calculations, NOT application execution or boundary PASS. Tests pin inputs and expected identities rather than calculating their expected lengths with the runtime counter. The +1 test observes no complete View canonicalJson call and no local View-domain hash; source review separately owns proof of copying order. A smaller repeated-proof case proves every occurrence remains complete/newly owned.

## Contract-to-test map (authored map; dated execution evidence below)

| Obligation                                                                                                              | Candidate test group / discriminators                                                                                                                                                                                |
| ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Whole positive literal, nine slots, seven typed/two withheld, six missing paraphrases, identities and freeze            | Independent complete fixture and exact owned snapshot                                                                                                                                                                |
| Primitive/coercion/proxy refusal, Unicode, raw duplicate/NFC keys, unsafe/-0, UTF16/UTF8/depth/node equality and excess | P0–P6 exact admission and real transport boundaries                                                                                                                                                                  |
| Exact inherited parser and competing errors                                                                             | 35 explicit intended parser cases; two source invariants described rather than fabricated                                                                                                                            |
| 82-record grammar transcription and exact record-tail fields                                                            | 306 concrete positive-fixture record sites, plus primitive/null/value and alternative controls; not a claim of 82 independently reachable branches                                                                   |
| Complete finite timestamp registry                                                                                      | 124 concrete fixture timestamp occurrences with invalid/null controls; calendar/Z/precision/owner-null/long-fraction and exact chronology cases                                                                      |
| P7 root order                                                                                                           | ROOT additive P7 envelope placement paired repair cases                                                                                                                                                              |
| Future finite versions and opaque identities                                                                            | Finite version table; malformed before future; changed opaque refs remain bound                                                                                                                                      |
| Supplied rights and exposure                                                                                            | Covered source; each ceiling; denied quote/paraphrase; whole retention; synthetic/provider; downgrade quote-leak refusals                                                                                            |
| Supports/proofs/calculation                                                                                             | All five roles/four supported kinds; unsupported kinds; target/hash/hidden controls; four distinct sources; recorded hash mismatch with body omission; finite minute80/81, full derivation and continuity chronology |
| Amplification and canonical escaping                                                                                    | Independently pinned exact cap/+1; repeated complete proof; earlier binding priority; escape/UTF8 counter equality                                                                                                   |
| Native/internal unexpected failures                                                                                     | Serial exact-descriptor restoration, key-collision priority and delegated P6/P8/P9 domain sentinels                                                                                                                  |
| Call boundary                                                                                                           | Throwing Client.connect/query and Pool.connect mocks restored in finally; no actual DB/network method can run via these sentinels                                                                                    |

The test's expected-output strings and record-site tables come from retained specified data. Tests do not read the implementation grammar to derive expected errors, use arbitrary caller objects as canonical duplicate-key proof, manufacture pipeline-invariant parser failures or claim absent supporter byte coverage.

## Imports, selected realm and source-reading limits

The runtime captures JSON.parse/SyntaxError and bound Buffer.byteLength; its unchanged serializer/identity helpers and other globals still have mutable transitive lookups. The guarantee is only an uncompromised selected realm through initialization/call. It is not a hostile-preload/prototype sandbox, universal loader-purity proof, native backend proof or continuous process/service-preservation proof.

Actual call imports: package-profile (parsePayload), command (isJsonObject/Rejection), canonical-json (serializer/domain hash), domains (body hash), knowledge (claim/state/derivation/full-carrier hashes), plus node:buffer and node:crypto. package-profile also imports artifacts/layer-b/select/profile-errors. command imports runtime pg, claim-state and observe; claim-state imports lexical-json. Those edges are real, not type-only omissions.

Read source confirms installed pg8.16.3 index eagerly requires client/defaults/connection/types/protocol/pool and reads its native-selection environment branch; defaults reads platform/user metadata. Connection modules contain socket operations and constructors. PC1 does not instantiate Pool/Client, call connect/query/runCommand or invoke a reader/provider. Throwing call-boundary mocks can test that finite claim after commissioning; they cannot prove no import effect.

Actual source inspection covered complete canonical-json/knowledge/select/domains and package-profile, selected command timestamp/JSON windows and import sites, and selected installed pg initialization/connection windows. Complete observe/claim-state/lexical-json/pg transitive bodies and native backends are not all read/proven. No app/module/native probe ran during this authoring. A bounded future closure packet must preserve those exact access limits rather than claim universal native closure.

Selected Node24.21.0 UTF8 byteLength and SHA256 update/digest usage is supported by the versioned [Buffer API](https://nodejs.org/download/release/v24.21.0/docs/api/buffer.html#static-method-bufferbytelengthstring-encoding) and [crypto API](https://nodejs.org/download/release/v24.21.0/docs/api/crypto.html#hashdigestencoding). Retained official source data is separate from docs and selected behavior tests. Versioned API/source reading does not certify native backend implementation or current security status. No dependency/toolchain version or configuration is changed.

## Local validation history and accepted offline05 evidence

Every gate must assert exact PC1 cwd before any relative effect, pin the current three files and preservation inputs, create exclusive stdout/stderr/timing/exit/source records, and retain all failures. Any new wrapper requires ROOT's full actual-source/name/pin inspection before execution. No automatic retry, broad formatting, dependency install or service action.

| Historical proposed command                                                                                                                                                            | Historical bound / expected effects; not current execution authority                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ./node_modules/.bin/prettier --write src/runtime/planner-fixture-consumer-snapshot.ts test/unit/planner-fixture-consumer-snapshot.test.ts docs/g1-planner-fixture-consumer-snapshot.md | 120s; only these three owned source bytes; inspect literal/semantic diff                                                                                  |
| npm test -- test/unit/planner-fixture-consumer-snapshot.test.ts                                                                                                                        | 600s; complete focused file including explicitly commissioned serial native/invariant group; local Vitest caches only                                     |
| npm test                                                                                                                                                                               | 900s; package script excludes test/integration/\*\*; serial file config and owned Vitest caches                                                           |
| npm run format:check                                                                                                                                                                   | 120s; check only                                                                                                                                          |
| npm run lint                                                                                                                                                                           | 180s; no autofix                                                                                                                                          |
| npm run typecheck                                                                                                                                                                      | 180s; noEmit                                                                                                                                              |
| npm run build                                                                                                                                                                          | 180s; ignored dist in this new isolated worktree                                                                                                          |
| npm audit --audit-level=high                                                                                                                                                           | HELD / NOT_EXECUTED; names/versions permission exists; selected metadata fallback/redirect transport has unproven sole-HTTPS registry destination closure |

The table and order above are HISTORICAL proposals, retained for chronology rather than current execution authority. That historical order was owned-only formatting, ROOT review of the actual formatting delta/pins, one focused file run including the explicit serial controls, then applicable nonintegration/static checks. Actual offline05 used the separately commissioned five-command order and bounds below. There is no redundant native-only second run. Vitest cache effects are confined to this PC1 node_modules, including .vite-temp and .vite/vitest/.../results.json. They must be recorded as owned deltas, not reset/deleted or misrepresented as whole-copy equality. The original/oldG1/C0/V0 dependency inventories remain protected; V0's two historical cache deltas stay qualified. Source tests are default sequential and repository fileParallelism is false. Exact descriptor mocks restore in finally. No background native probe, app invocation or local SQL is proposed.

Local integration, Postgres startup, local Gitleaks install, Docker/service mutation and live/paid provider calls remain uncommissioned. Existing foundation-ci definition owns a later new exact-head verify run with test:all/integration, format/lint/types/build/audit/Gitleaks and a container build. Definition and prior PR23 success are not new PC1 CI PASS. Freeze/normal additive commit, publication, fresh CI and review require later exact commissions.

## Source anchors and remaining work

Source ownership anchors are original lines, not proof of whole-parent/manual/native coverage:

- Evidence Package v0.2.2: §20.1/643–694 consumer materialization, 696–726 rights/purge boundary, 746–786 complete package binding.
- Showrunner Planning v0.1.3: 91–113 and 195–230 richer planner consumer/config obligations remain unmet.
- Claims Policy v0.1.2: 143–205/334–381/426–647/735–753 and 1147–1166 selected value/usage/support/attribution/security topics.
- Hashing v0.1.5: 12–43 canonical ownership; 495–521 claim/body/derivation/carrier identities.
- Existing parsePayload: package-profile403–512 actual parser priority and structural validation; command432–499 timestamp and owned JSON.
- canonical-json123–146 timestamp; knowledge52–119 immutable projections; select17–83 exact field selection.
- Handoff v0.5.5 Done when243–293 and Trace v0.5.5 §§5/7,202–311 keep actual staging/error correlation, master/READY/repair/drills/measurement/craft criteria open.

This helper supplies a deterministic finite inspection prerequisite beyond V0 references. It does not close authentic freeze/current rights, full planner consumer adequacy, trusted-reader/representation/configuration, producer/model provenance, Brief, C1/P1/G1-C, fourteen Showrunner gates, render/master/READY, craft/listening, production or deployment.

The malformed earlier partial type cleanup and all preparation failures remain retained in the command/history evidence. Complete declarations were restored, then only 16 whole unused types removed after transitive reference checks; all 82 runtime grammar records stayed unchanged. Source-text checks are not compilation/tests. No implementation acceptance, publication or new CI claim is made. Historical local results below remain bound to their exact earlier source tuples; the offline05 runtime/test/docs-before validation tuple is separately recorded.

Focused01 is preserved as FAILED_HOLD_NO_RETRY: 614 tests, 596 passed, 18 failed, no unknown/timeout/cleanup outcome. ROOT accepted the bounded protected postguard and only two PC1 cache changes (.vite-temp mtime and existing Vitest results.json); whole PC1 dependency-copy equality is false. The union ambiguity and three test-prerequisite issues led to the separately adjudicated correction authoring above. That failed run remains unchanged. Historical results are not current corrected-source PASS evidence.

Focused02 was separately commissioned and completed 641/641 tests in one file, with no skip/todo/unhandled summary, child exit0 and complete streams. Its exact pre-lint-correction source tuple was runtime116767B/SHA256 `2ca79ac144431ed0123d138ee3fe5e8d4178797182fcecee311efdc87101c466`, tests280967B/SHA256 `a247e5d3a9093fa75f5b0bd2b1d49e4663d9d4996a10c2027c489b4bf5f581df`, docs39672B/SHA256 `6bde0ef1804aa460e2ce6bb4ae3df4a6e1b35d77dcb56b146da0ade92b2ec4b7`. The bounded serial native/invariant cases were part of that focused file, not a separate probe or universal native/import proof. ROOT accepted only its bounded evidence; the empty-stderr editor Copy introduced a presentation LF, while actual member/stat/hash established raw0B. Result103367B/SHA256 `91cce2aedba75e0d1893bb3650b2685578a49dfb128d505d728fb41e8da361ad` is retained.

Local-gate02 ran once on that same source tuple: format:check exit0/PASS, then lint exit1 with74 errors/zero warnings. Typecheck, build and the full nonintegration npm test remained NOT_EXECUTED after the known first failure. There was no unknown/timeout/cap/cleanup/spawn failure. Result121416B/SHA256 `4da281a412fce6f8e2838b79153c91c7b258d4925294f25740ac35d7bab2205d` and all raw/effect records are preserved; no retry occurred. Protected before/after bytes matched the accepted guard, PC1 dependency inventory had zero additional cache deltas, workspace/source/session remained equal and dist stayed absent. This equality for gate02 does not undo the historical qualified cache differences or establish continuous OS/process preservation.

The subsequent authorized authoring converted69 private plain-object aliases to interfaces without changing bodies, readonly/optional fields, names, genuine unions or runtime grammar; applied two equivalent runtime expressions and explicit String(i) in three finite integer test fixtures. The later exact two-line type correction and one-line outer-array spelling correction are retained separately in their source chronology. The final runtime/test/docs-before tuple received only the bounded offline05 validation described below; it is not whole implementation acceptance. Failed gate02 and earlier malformed-cleanup/focused01/preparation history remain preserved; no policy/rule disable or autofix was used. Audit disclosure is authorized as stated below, while execution remains HELD / NOT_EXECUTED because installed selected metadata fallback/redirect transport has unproven sole-HTTPS registry destination closure. The original rejected six-gate preparation remains inert; no audit rejection was retried or bypassed.

## Dated offline05 record and remaining review boundary

Dated 2026-10-11. ROOT accepted offline05 raw/effects evidence after complete actual result/ledger/member/log/effects reads and independent lossless reconciliation. This is local validation acceptance for this exact tuple, not implementation/independent-review/PR/CI/milestone acceptance:

- Runtime `src/runtime/planner-fixture-consumer-snapshot.ts`: 116857B/SHA256 `919d6ab9eb2d51f48a379b2d6854421212853df29c9eab7df5fe43fbef910ddf`.
- Tests `test/unit/planner-fixture-consumer-snapshot.test.ts`: 280980B/SHA256 `3a48f3ab9abf81c6ffb04a149314485d9da938c1be51c4cd2f388eaeba619cba`.
- Docs BEFORE this proposed factual update: 42535B/SHA256 `0eab0396761b85cedad79a15686e469bf5a86b8ae111188299a9d6fefa5ba9bc`.

Offline05 validates the exact docs-BEFORE tuple above. This factual docs-only correction's identity and any later authoring/format-check evidence are recorded externally, without embedding a self-referential hash. Source-contract/API/grammar/phase/union/resource/import/product text remains unchanged by this evidence correction. Final review and fresh CI bind the resulting exact three-file tuple; no authoring or format PASS is inferred from offline05.

### Earlier failures remain immutable history

Local-gate03 ran on runtime116852B/SHA256 `dc1bfd96af7e388881f994d687e021a77ae8bc9b9f2c4cf283db2fd0fc017611`, tests280991B/SHA256 `4223f2c24cc949fcb36b41d93553066ebc28b618c608ba3a3c6f82ff58ce9d01`, docs42535B/SHA256 `0eab0396761b85cedad79a15686e469bf5a86b8ae111188299a9d6fefa5ba9bc`. Format/lint exited0; typecheck exited2; build/full nonintegration tests were NOT_EXECUTED. Result132531B/SHA256 `d1f46ae73fa74bba5286f374e352a0bf286bfd5b89962a424a439f0c437a5efd` remains FAILED_HOLD_NO_RETRY with all raw/effect records.

Local-gate04 ran on runtime116857B/SHA256 `919d6ab9eb2d51f48a379b2d6854421212853df29c9eab7df5fe43fbef910ddf`, tests280984B/SHA256 `817ac841bd1f4059a57419e4469d4ad61b2d93914a76320b1dd00358fb66755a`, the same42535B docs. Format exited0; lint exited1 at the outer ReadonlyArray spelling; types/build/full nonintegration tests were NOT_EXECUTED. Result122273B/SHA256 `7e368f9d01e0d85f9bae0a6391169afd25fa58eb0af25f9e77f8969e138e8279` remains FAILED_HOLD_NO_RETRY. The separately approved one-line outer spelling changed only tests to the exact offline05 tuple; no old result was promoted to current PASS.

The successful one-time native authoring and its separate original failed aggregate reporting check remain distinct: it incorrectly required historical candidate-source equality after the intended source change. Its checker was not edited/re-run; separate read-only diagnosis and ROOT acceptance admitted only the exact intended test change and immediate test/unit mtime. The original ARG_MAX preparation failure before process creation and malformed cleanup/failed focused01 histories remain retained; identifying administrative records stay in the private checkpoint.

### Actual offline05 commands, records and effects

The sole reviewed five-command sequence was `npm run format:check` (180s), `npm run lint` (300s), `npm run typecheck` (300s), `npm run build` (300s), `npm test` (600s). All five exited0. Full nonintegration stdout reports38 files/1453 tests passed, Vitest duration80.82s; no skip/todo/unhandled summary or stderr appeared. The full nonintegration suite includes the pinned owned file containing641 authored definitions; the raw summary reports aggregate totals, not a separate fresh focused641 result. No extra focused/native-only run occurred.

Actual child PIDs were136255/136445/136931/137179/137368 in that order; child durations were10.44574823900075/30.956924267999057/13.956758323000031/9.828994544001034/81.88710950899986 seconds. Collector elapsed179.14705975800098s. All185 command records are complete:183exit0 and two expected empty C0 hooksPath-absence exit1. No timeout, stream cap, spawn, cleanup, unknown-outcome, effect or postguard error was recorded. Reviewed read30s/guard600s/effects300s/collector5400s, stream/evidence/disk limits and owned TERM5/KILL5 controls were retained; no outer collector-killing timeout or retry was used.

The external E/g1-pc1-local-gates-05.result.json is155141B/SHA256 `180519db46968e856c7f61485a51ea5b9542d37b5e202d621a94a789fa81643b`; its execution.record.json is155010B/SHA256 `0e7d7250d13ff757fab51646be93653f325f415f6a8f1437b60408fa6ed4b937`. Unit stdout is315B/SHA256 `ba20777ef4c10ad74a52f50085847099ea039c98077805d593aab59760b33c23`; final unit effects are1507477B/SHA256 `112b6cb3a3442e3c1a4f85593d0fb2495fea3230556fc0a30aedc1d8c602cc2c`. The52 listed members plus execution/result/attempt are55 regular0600/nlink1 files with exact pins; raw private administrative content stays outside this docs file.

Protected guard before/after matches accepted10172B/SHA256 `12e807db5165142618a6b6e5542b722ec7672264128cdf82337c50514c014a90` byte-for-byte. Current source3 stayed unchanged. Dependencies retain5232 rows; only existing .vite-temp mtime and existing Vitest results.json changed (5101 to5127B). Final dependency snapshot1261593B/SHA256 `d8027ddf3420d7d6a6ee6a64e4aeaa77be936ac265e02bc5bbb585c4e6fab717`; noncache equality is TRUE, whole PC1 inventory equality FALSE. The two historical V0 cache deltas remain separate qualified history.

Build produced exactly174 approved files/seven directories; build/unit/final dist snapshots match, final50711B/SHA256 `86f790c1b931283acd951ce2f51c56b5a476a873e03ded1331e1a972ee92b817`. Fresh initial workspace98184B/SHA256 `df86294906dcd57a725576dbe94afc03ae20329783058e2d56843fdb4a8a3934` has330 rows; final98185B/SHA256 `97306beb95304e5041dd075f6f274a87c36bd714bde858932621791a9c92ba56` preserves all329 non-root rows and changes only root mtime/nlink9 to10 for dist creation. Relative gate04, only the earlier accepted two authoring rows plus that root qualification differ. Initial/posteach/final captures are actual evidence; no additional beforeeach full snapshots are invented. Five isolated offline npm caches contain only0700 root/\_logs directories with no files. Lossless embedded dependency/workspace/dist/npm/cache-delta objects match standalone snapshots exactly.

The existing worker and selected toolchain were retained after the separately approved resume. Continuity checks are bounded point-in-time evidence, not uninterrupted historical process preservation. Identifying session/process/settings evidence remains in the private checkpoint; no new worker or toolchain change follows from local validation.

A separate read-only reporting verification remains FAILED: expected `[git,config,--get,core.hooksPath]`; actual expected-absence records contain `[git,--no-pager,config,--get,core.hooksPath]`, exit1 with empty streams. No assertion/baseline edit or reporting rerun occurred. The earlier description that expected argv included --local was a dated transcription error, corrected in the private technical record; it is not a source or gate failure. Subsequent independently commissioned read-only reconciliation exited0 within90s/16MiB file caps and retained the original failed verification.

### Audit disclosure and outstanding acceptance

Mike authorized uncredentialed dependency NAMES/VERSIONS disclosure to https://registry.npmjs.org at07:05:36 EDT on2026-10-11. Audit is HELD / NOT_EXECUTED, not currently unauthorized. The installed npm11.19.0 selected metadata fallback/redirect transport has UNPROVEN sole-HTTPS registry destination closure; fetch-retries=0 does not establish that closure. This is an unresolved transport-boundary verification, not a confirmed unauthorized disclosure or a claim that bounded ordinary audit is universally impossible. No new authority requirement, permission expansion, custom audit replacement, tool/config change, online request or advisory result is inferred. Offline05 contains no audit command/cache06/online branch.

No local integration/Postgres/SQL, local Gitleaks scan/install, container build, paid/live provider, compiled-JS invocation, production or deployment was executed or accepted by offline05. Whole independent implementation review, ROOT implementation adjudication, later exact docs/format tuple, separately authorized publication and fresh exact-head verify/container CI remain pending. Historical PR23 CI and these local checks do not validate a future PR head. All eight snapshot limits and the broader full-consumer/model/Brief/G1/Build/craft obligations above remain unchanged; Mike alone merges.
