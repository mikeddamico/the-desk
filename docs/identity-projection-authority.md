# Identity projection authority map (A1 runtime hashing)

Authority: FINAL LOCK v1.2.6 (`Lock/00_INDEX/ACTIVE_SPECS_LOCKED_v1.2.6.md`): Hashing, Fingerprints & Text Spans v0.1.5 ("Hashing"), the Writing Build 1-2 Fixture-Profile Addendum v0.1 ("Addendum"), Contract Trace v0.5.5 (Layer B) and Fixture v0.4.6 (ZIP SHA-256 `7e1bb1108cdd84e47269b9ab2dab20ba934fcec64d44262f86d2b505616b0747`). The shipped Python validator is a comparison reference only and is never cited as authority; no TypeScript test substitutes for it or relies on it.

Every `src/identity` module is pure: no filesystem, database, network or provider call, no environment access. There is exactly one active rule per projection and no caller-selectable alternative. Input outside a declared closed profile throws `ProfileRejected` (a `TypeError`) carrying the stable `code` named below.

## Single active rules

| Authority                                                                                           | Implementation                                                                                                                                   | Rejection codes                                                                                                                                                                                                                                                                                                                                       | Tests                                                                                                                  |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Hashing 4.1.1 + Addendum A: prediction carriers (`prediction-candidate/1`)                          | `predictionCandidateProjection` / `scriptProjection` (`artifacts.ts`); `options.brief` is required when candidates exist                         | `prediction_candidate_not_object`, `prediction_anchor_supplied`, `prediction_unknown_field`, `prediction_missing_field`, `prediction_turn_unresolved`, `prediction_participant_conflict`, `prediction_topic_thread_unknown`, `prediction_outside_prediction_block`, `prediction_text_invalid`, `prediction_duplicate_id`, `script_turn_id_not_unique` | PC-01..PC-16 (`a1-authority-resolution`); `a1-artifacts` (script hashes, relabel, order); `a1-dependency-chain`        |
| Hashing 4.4.1 + Addendum B: writer-view nested profile, writer-only exposure                        | `writerDataObject` / `writerViewHash`                                                                                                            | `writer_view_claim_keys`, `writer_view_support_ref_keys`, `writer_view_evidence_keys`, `writer_view_non_writer_exposure`, `writer_view_context_keys`                                                                                                                                                                                                  | WV-01..WV-08; key lists equal the spec text (`a1-artifacts`)                                                           |
| Hashing 4.4.2 + Addendum D: addendum binding                                                        | `writerContextManifestHash` (`required_policy_refs`), `verifyAddendumBindings` (`addendum-binding.ts`, pure: caller supplies the addendum bytes) | `addendum_not_in_required_policy_refs`, `required_policy_refs_order`, `addendum_policy_not_in_map`, `addendum_source_hash_mismatch`, `addendum_component_missing`, `addendum_bound_to_ungoverned_role`                                                                                                                                                | AB-01..AB-08; dependency chain (manifest and semantic identities per role)                                             |
| Hashing 4.7 + Layer B 6: bounded `show-config/1`                                                    | `showConfigVersionHash` (`show-config.ts`)                                                                                                       | `show_config_schema_unsupported`, `show_config_keys_not_closed`, `show_config_runtime_keys_not_closed`, `show_config_column_payload_conflict`, `show_config_show_id_conflict`                                                                                                                                                                         | SC-01..SC-10; READY stage in the dependency chain                                                                      |
| Hashing 4.6.1: audit findings gate                                                                  | `semanticAuditResultHash`, `assertSupportedAuditFindings`                                                                                        | `audit_findings_unsupported`                                                                                                                                                                                                                                                                                                                          | AF-01..AF-03                                                                                                           |
| Hashing 4.8: Brief projection                                                                       | `showrunnerBriefProjection` / `showrunnerBriefHash` (exact selected, optional, excluded keys; child parent identity)                             | `brief_unknown_key`, `brief_missing_key`                                                                                                                                                                                                                                                                                                              | BR-01..BR-04                                                                                                           |
| Hashing 4.3, 4.7, Layer B 8: configuration identities (facts of this fixture only)                  | none (no binding is implemented)                                                                                                                 | -                                                                                                                                                                                                                                                                                                                                                     | CF-01..CF-03                                                                                                           |
| Hashing 7.1: pronunciation grouping, voice resolver, structural domain                              | `selectBaseRequestProjection` / `requestBaseHash`, `resolveVoiceReference` (`request.ts`)                                                        | `voice_binding_missing`, `unresolved_voice_reference`, `ambiguous_voice_reference`, `pronunciation_application_turn_unresolved`, `duplicate_pronunciation_application`                                                                                                                                                                                | PG-01..PG-13; all 132 base-request vectors, nine actual blocks, 23 `mechanical_sensitivity` labels (`a1-base-request`) |
| Hashing 7.1 / P&R 17, 18.2, 19: production ownership validation (kept separate from the projection) | `checkFixtureRequestOwnership` (`fixture-render-ownership.ts`; fixture-scoped, not a product validator)                                          | `RequestRejected` codes (27 rejection vectors incl. `OW027`)                                                                                                                                                                                                                                                                                          | `a1-base-request`                                                                                                      |

All other projections (canonical serializer, domains, stage fingerprints, knowledge hashes, complete prompt manifests, model semantic input, Layer B scope/context/correction digests, assembly recipe and map, render manifest, craft review, direction) are carried forward unchanged from Hashing v0.1.4 into v0.1.5 and keep their implementations and tests.

## Proof limits (not claimed as solved)

1. **Raw request specimens.** The rendered-request specimen bytes are shipped fixture-template data. TypeScript reads them as exact bytes, checks that each embeds the recomputed upstream hashes and that its raw hash is the manifest's `rendered_request_hash`, but does not regenerate them. The Python validator rebuilds them; that is not TypeScript coverage and is not claimed.
2. **Lexical JSON `1.0`.** `JSON.parse` cannot distinguish `1.0` from `1`. The one lexical float in the shipped vectors is vector CE-G05 step 2 (a cursor `event_sequence` of `1.0`, expected `cursor_sequence_type`; earlier text called it the `sequence_not_integer` vector, which is the append-side vector using `true` and `"1"`). A3 reads that source with a bounded lexical reader (see "A3 claim reducer and prefix freeze").
3. **Not part of A1:** the production fixture loader (delivered by A2), the claim reducer (delivered by A3), the workflow runner, persistence of any of these hashes, A5 durable event-retry convergence, READY/operator authorization and cross-manifest cached-take acceptance.
4. **Stage fingerprints keep their closed key sets**; the addendum is bound through model provenance, not through gate fingerprints. A future addendum change needs a fresh invalidation/version review (the dependency-chain tests show which identities move).
5. Fixture-scoped Layer B helpers (scope, context, correction, historical-null) and the ownership checks apply only to Fixture v0.4.6 content and are not product policy. The historical direction artifact is verified separately and the archived fixtures are never co-loaded.

## A2 fixture load

The loader reuses the A1 modules above (`scriptHash`, `showConfigVersionHash`, `verifyAddendumBindings`, `fingerprint`,
`requestBaseHash`, `checkFixtureRequestOwnership`) both on the shipped snapshot and on rows read back from the database.
All six stage projections are derived from rows and recomputed upstream identities (shipped projections and fingerprints
are comparison targets only); each gate result is checked against the stage its gate key governs, its declared
`fingerprint_stage` and that stage's derived fingerprint. Each render block's request record is rebuilt from the
render-block, speaker-map, turn, voice, pronunciation, intent and script rows, owned against the actual bound script, hashed
and compared to `base_request_hash`, and the shipped record is reconciled field by field. Fields no row carries (gate-set
label, model/adapter identities, generation settings, scene config, text-transform names, pronunciation placement
offsets, context recipe label) are shipped-sourced. Request specimens are verified as shipped bytes, not regenerated, and
the lexical JSON `1.0` reducer case remains open.

## A3 claim reducer and prefix freeze

Owners: Claims v0.1.2 section 4.4 (statuses, reducer table, order, append invariant), Evidence Package v0.2.2 section 9.3
(prefix freeze, cursor), Hashing v0.1.5 section 12.1 (the three-field `claim-frozen-state-v1`, reused unchanged from A1),
Fixture v0.4.6 `claim_event_conformance.json` (58 offline vectors).

- **Order and validation.** `src/knowledge/claim-state.ts` reduces by `event_sequence` only (never UUID, array order or
  `occurred_at`), validates the initial fields, every event row, claim locality and the accepted-log shape (first sequence 1,
  unique, gaps above the maximum allowed). A through-sequence reduction never replaces cursor validation.
- **Cursor and freeze.** `src/knowledge/state-cursor.ts` implements the cursor check with the shipped validator's error
  precedence and `freezeClaimPrefix`. `src/knowledge/claim-log.ts` reads claims AND events in ONE SQL statement (one
  snapshot; zero-event claims preserved; missing claims rejected; stored content hashes recomputed) and freezes all
  requested claims from it. Read-only: freeze creates no event and takes no lock.
- **Ceilings are required inputs.** A frozen entry is verified against an independently supplied frozen-time ceiling (or an
  explicit "unavailable", reported as a verification limit); the live reduction uses a separately supplied current ceiling. A
  stricter current permission is a material live difference and never invalidates a historically consistent entry. The
  ceiling is never inferred from an entry. No status, support, rights, exposure or sensitivity mapping and no permissions
  engine exists (authority gap: no active owner defines one).
- **Lexical boundary.** `src/knowledge/lexical-json.ts` reads RAW source: integer lexemes stay numbers; any other lexeme
  (`1.0`, `1e0`, fractions) and unsafe integers become frozen `LexicalNumber` markers (never rounded into acceptance;
  rejected by the canonical serializer, so they cannot be hashed). A value already produced by `JSON.parse` or node-pg has lost
  its lexeme: such a value is validated as an object (type and range), not as source. PostgreSQL `jsonb` keeps `1.0` in
  `::text` but normalizes `1e0` to `1`, so an exponent form is distinguishable only in file/byte sources. No global pg parser
  override is installed.
- **Payload number boundary.** `event_payload` numbers follow the governed JSON policy of the A1 serializer (semantic numbers are safe
  integers; exact decimals are strings). At the payload boundary, before the payload is copied, an integer-valued lexical marker
  (`1e0`, `1.0`, `-1E1`) becomes the number it denotes (identical to `JSON.parse` and jsonb for the same source), so
  raw-source and native-source events are equal and hash alike; any other number (`1.5`, an unsafe integer, `-0`, non-finite)
  and any non-JSON value is rejected as `invalid_payload`. A marker is never turned into an ordinary object. Sequence and cursor
  values are not normalized and stay strict. The A1 serializer is unchanged.
- **Runtime row validation.** `checkCursor` validates `accepted`, `visible` and `prefix` rows at runtime (TypeScript types are not
  guarantees): exact seven-key row and claim locality, then a strict positive integer sequence, with the shipped validator's
  `visible_*`/`prefix_*` codes and order (`accepted_*` is added for caller-supplied accepted rows), then a full parse
  (`*_row_invalid`).
- **UUIDs.** Event, claim, actor and cursor ids must be literal canonical UUIDs (lowercase, hyphenated 8-4-4-4-12). No version or
  variant restriction is imposed: no active requirement states one (the Trace's "canonical v4" remark describes Fixture content and the
  predecessor validator). The fixture loader's own v4 row check is unchanged.
- **Tamper detection is bounded.** The frozen-state hash excludes actor, time, reason and intermediate history. Cursor
  mismatches and changes to the resulting state or usage are detected; a reason-only edit, or an edit that preserves the
  reduction, is not (characterized in `test/integration/claim-freeze.test.ts`). Whether every event visible at the freeze
  instant was included cannot be proved after the fact from a cursor alone.
- **Not delivered (A5, unresolved):** sequence allocation, durable authored event identity and retry convergence. The offline
  vectors model retry identity but the database rejects retried identities and never converges
  (characterized, not solved). Package assembly/persistence, READY authorization and cached-take acceptance are also out of scope.

## A4 database read-back proof

Grounded in Handoff v0.5.5 Done-when 6-8, Hashing v0.1.5 section 14.1 (35+1 artifact registry, every row needs a resolvable
consumer) and the Fixture's `persistence_expectations.json` (deferred database proof: FK / privilege / immutable-trigger execution).
A2 already compares every persisted column to the shipped row and verifies the persisted rows; A4 adds row-derived checks (so
the SAME code proves the shipped snapshot and rows read back), an independent post-commit reader and database-behavior tests.

- **Row checks (`ledger.ts`, `assembly.ts`, `bindings.ts`, `obligations.ts`).** Provider ledger (15 calls / 15 events, one
  succeeded terminal event, cost text exactly `0.0000` USD, generated seconds as the exact decimal of the take frames, take/call/block
  request binding, rb06 reroll chain and causal timestamps), request-to-WAV mapping against the rows (the shipped mapping is a
  comparison target), assembly recipe/map/frame relationships and audio metadata, package support/evidence/rights snapshot
  (a package may only RESTRICT its rights version), artifact registry and governed consumers (kind-checked; includes the
  `revalidation_result` snapshot edge), script claim/evidence use rows against the script payload (spans, frozen state hash,
  documented use-mode restrictions, quotation/paraphrase permission), version/brief/direction/intent/manifest rows against their
  payloads, and typed obligations against the declared records. **Fixture-scoped** facts (counts, `0.0000`, the rb06 chain,
  causal timestamps, the 44-byte canonical WAV header) are labeled in the modules; none is product policy.
- **Declared obligation records.** `provenance/OBLIGATION_RECONCILIATION.json` records v0.4.5-era values; v0.4.6 supersedes some
  only through `provenance/v0.4.6/IDENTITY_TRANSITION.json`. A persisted value must equal the declared one or the value the
  transition inventory maps it to. Formats are field-specific (hex64, `v1:` tagged, `fixture_stub:op:hex`, `v1:hex:take`; a TTS
  `request_fingerprint` is `v1:`-tagged, a model one is bare hex). Nulls are allowed only at declared exact locations (never by
  leaf name); the historical direction keeps its exact row/path disposition. FORMAT, declared VALUE and independent RECOMPUTATION
  are distinct: nothing in `obligations.ts` recomputes a hash.
- **Exact numerics.** `numeric` compares as exact decimal text and `bigint` as exact integer digits (never `Number`); a bigint
  reaches the verifier as a number only when it is an exact safe integer. The A1 serializer is unchanged.
- **Post-commit reader.** `readFixtureRows` is the single reader (used inside A2's load transaction without nesting).
  `verifyPersistedFixture(pool)` pins ONE runtime-role connection and owns a REPEATABLE READ READ ONLY transaction (always
  ended and released); `verifyPersistedFixtureOnSnapshot(client)` requires an already-open consistent snapshot and never ends it. The
  reader takes only ACCESS SHARE locks. It verifies the LOADED BASE state: claim events appended after the load change the reduced
  claim state and are reported by the claim comparison (use the A3 freeze verifier for live differences).
- **Limits.** Gate RE-EXECUTION (GA-1) stays in the later workflow tranche; audio bytes are not in the database (only hashes and frame
  metadata are verified here); request specimens are shipped bytes, not regenerated; immutable-relation UPDATE/DELETE trigger execution is
  demonstrated only on relations that hold a loaded row (the empty ones are checked in the catalog only); the claim-use
  mode rules enforce only what Claims Policy v0.1.2 states (section 11 rule 1: a silent claim is linked with `relied_on_silent` only; section 25: a
  `hedged_only` claim cannot be `asserted`) and nothing is inferred beyond it, so this is not an exhaustive permission engine (authority gap
  GA-5: no active text enumerates the remaining pairs, e.g. a non-spoken `relied_on_silent` link on an assertable claim is not forbidden; hedge and
  attribution wording, rights and exposure are not row-checkable); A5 is untouched.

### A4 repair notes

- **Transaction-state enforcement.** `verifyPersistedFixtureOnSnapshot` proves an explicit open transaction with a `SAVEPOINT` /
  `RELEASE SAVEPOINT` probe: PostgreSQL raises `25P01` outside a transaction block (session defaults such as
  `default_transaction_isolation` / `default_transaction_read_only` cannot fake one) and `25P02` in an aborted block; a released savepoint
  leaves the caller's transaction, isolation level and snapshot untouched and never begins, commits or rolls back. The earlier
  `transaction_timestamp()` comparison could not distinguish statements inside one millisecond.
- **Evidence uses and the frozen package.** Each evidence use must resolve exactly one frozen `manifest.evidence` entry carrying the
  unit's rights version, and quotation/paraphrase must be allowed by BOTH that frozen entry and the governing rights ceiling; a unit that merely
  also supports a silent claim is NOT restricted: no active text clearly forbids an independent, permitted proposition from such a unit, so
  claim-specific evidence linkage and semantic-leakage validation belong to the later owning checks (Claims section 22 gates, semantic audit), and
  structural acceptance here does not prove the absence of leakage. Package membership is unique and
  exact (claims and evidence) against the durable rows. These are semantic-helper checks; an edited stored package also changes its
  hashed manifest and is caught by the artifact hash in the full pipeline (a separate layer).
