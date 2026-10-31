# Connected evaluation fixture

This fixed, fully disclosed fictional fixture connects actual deterministic Claims/Writing evaluation to persisted Performance Direction and a labelled audit-interface stub. It is conformance evidence only. H04/H13 semantic acceptance remains unestablished. Render, READY, production, models and audio remain outside the path. Source-only and UNRUN statements in the historical sections below describe their recorded preparation phase; current validation status follows.

## Current CI124 setup-readiness candidate (source preparation; UNRUN)

Accepted main is `8fd7ea16e0fa67c1e6708a6f3a845a19c22b3777`, tree
`70e5ae8849e8b909c1dccbebb2d39f5652bcda7c`. CI124's root variant in the live
capability-context case refused target admission before reaching its intended
package hook or root mutation. The failing predicate/backend was not captured.
Neither CI120 nor CI124 has an established historical cause.

This candidate closes one setup-handoff gap: awaited local `pool.end()` does
not itself establish that PostgreSQL has no remaining backend in the target.
Immediately after successful CREATE, the allocation retains a frozen identity
from the existing maintenance admin connection: exact name, OID text and UTC
server start. Missing or malformed identity fails registered setup cleanup.
After migrations/seeding and successful memoized setup-pool settlement,
`fresh()` awaits a fixed parameterized admin observation of that same target.
It requires one identity-matching row and counts all target backends, with no
backend-type/PID exclusions. Missing/replaced targets cannot count as ready.

Readiness permits at most 21 observations and an awaited 250 ms delay only
after a nonzero count when another observation remains. A monotonic 5,000 ms
budget is checked before each query and after completion; even a zero returned
after the deadline fails. Query rejection or invalid identity fails immediately,
with the original query error preserved. There is no runtime-operation retry,
repeated `pool.end()`, detached timer, session termination or maintenance filter.
Existing admin checkout/query limits of 10,000/20,000 ms and 120,000 ms native
case/hook limits remain unchanged. The five-second budget is not a hard return
bound: an already-started query can settle later and then fail the budget.
One verified zero is sufficient and does not guarantee future exclusion.

Five finite fake readiness groups run in the existing native `beforeAll`, after
the unchanged 20 observer groups. They cover immediate zero, positive then zero
with unchanged observations, observation/deadline exhaustion including a late
zero, original query rejection, and missing/replaced/malformed identities.
No standalone runner or new output marker is added. All five groups remain
UNRUN in this source preparation.

The existing setup-pool tracking case retains its failure-injection half and
adds one successful isolated allocation tracked by existing cleanup. Its real
setup owner is still connected when the first readiness query observes a
positive count. A narrow admin-query wrapper awaits memoized settlement, then
returns that original positive result unchanged; a later real query must
observe zero. The asserted order is positive, settled, zero, resolved. Cleanup
restores the query descriptor and closes the target/cluster while preserving
primary failures. Existing independent afterAll checks cover its database and
role allocations. Ambient activity is not replaced by a fabricated zero.

All 34 native cases, expected invocation lists, 3,781 rest tests and 8,689 total
tests remain unchanged. The held-client regression remains last, creates its
client after `fresh()`, and must still receive the strict isolation refusal.
No runtime SQL, settings, grants, receipts, CI selectors or route changes occur.
Future clients or autonomous maintenance can still fail the original runtime
predicate; this is readiness improvement, not an autovacuum policy or proven
root-cause fix. Actual-source review and existing bounded static gates precede
one separately authorized normal full acceptance through the unchanged route.
Any subsequent failure requires adjudication before another run.

## Historical normal-validation candidate (pending at source preparation)

[CI122, run 40801832684](https://github.com/mikeddamico/the-desk/actions/runs/40801832684)
passed all 20 observer fake groups and the one held-client native control at
[commit 4100d03e65b7a1a4e317850a5a29149e7c24b234](https://github.com/mikeddamico/the-desk/commit/4100d03e65b7a1a4e317850a5a29149e7c24b234),
tree `5658e7d08afceed8ac50d7fd8edc9ccaa27c200e`. Its 31 independent evidence
checks verified the controlled refusal, original hidden/inconclusive metadata,
later provisional client classification and cleanup. That intentionally
incomplete diagnostic run did not identify CI120's unexpected backend, prove
a historical fix or satisfy normal full acceptance.

This continuation restores the ordinary writer/rest acceptance workflow and
removes the temporary diagnostic stage and profile. Both jobs run their
aggregate stage and then `check all` under default success gating. Always-gated
full evidence collection, uploads, security retention and final joint proof
remain required. Guard limits, database feed restrictions and all strict
isolation and cleanup predicates remain unchanged. Ordinary successful guard
and wrapper exits must both be zero; the existing post-evidence HOLD remains
binding when required records are missing.

The 20 fake groups now run unconditionally at the start of native `beforeAll`,
once when the suite actually executes. A suite skipped without a database does
not claim their coverage. Fake output capture/restoration and the single
`fixture-target-selftest/2` groups 20/passed 20 marker stay unchanged. The groups
are assertions inside the hook, not 20 additional Vitest cases.

All 34 permanent native cases remain in their established order, with the
held-client control last. Its continuously owned client supplies control-only
corroboration; the original unknown metadata and later
`client/provisional/hidden_origin` classification remain truthful. Expected
inconclusive diagnostic metadata is not itself a failed test. Earlier scopes
may emit additional summaries during full execution. The held case requires
the shared maintenance latch to be unused. If an earlier genuine failure has
consumed it, preserve that failure and let the held precondition fail; never
reset the latch, repeat the observation or skip the assertion.

Normal required coverage remains 58 unit plus 34 native connected cases, 3,781
rest cases and 4,908 writer cases: 8,689 total, with 80 aggregate files and all
29 integration files. Require a complete 34-case native journal, every declared
invocation and receipt, no skipped/todo tests, settled cleanup, source
preservation, security checks and final joint proof on one exact candidate.
CI122's partial journal cannot substitute for that evidence.

This restored candidate has not run its static checks or normal full
validation. Actual-source review, bounded static checks and final binding
review precede publication and one separately authorized, naturally triggered
normal acceptance workflow. Diagnose any retained failure before a specific
reviewed correction; do not retry an unchanged candidate. A future full pass
would establish current candidate acceptance while CI120's cause remains
unknown. Merge requires independent exact-final-commit review and fresh checks.
Assembly design may proceed independently; assembly implementation, live audio,
genuine semantic admission and deployment remain outside this change.

## Subject, context and release

The fixture contains nine claims, thirteen evidence entries, five fictional matches, nineteen turns per script generation, sixteen claim uses and eighteen evidence uses per generation, three predictions and one nonempty Texture rewrite. Storage UUIDs match normalized use rows but do not enter semantic script projection. No historical fixture grant or material is consumed.

The zero-argument host reads validated configuration, requires test context and providers disabled before checkout, and owns its runtime-role pool. It checks database name/OID, login, server endpoint, non-elevated login, no other sessions, exact fixed setup configuration and empty relevant source/evidence populations. Configuration alone is insufficient. This is a sole cooperating writer assumption, not protection against malicious privileged SQL.

SOURCE-LEDGER.json, RELEASE.json and ADOPTION.json are later reviewed deployment bindings, not authored success receipts. Complete release-free sources and resources precede the ledger; the release binds that ledger and the fixed subject/effects; external adoption pins release and ledger bytes. The ledger excludes itself, release/adoption and files embedding those completed constants. Terminal inventories remain outside their preimages. Missing bindings refuse. Proposed bindings do not authorize execution.

## Observed construction and ownership

Program run/attempt creation reuses the existing owners. One construction transaction observes absence, inserts the fixed disclosed rows, captures complete populations, runs the actual claim freezer with rights-derived ceilings, calls the package owner, compares stored rows and persists the observation.

The package owner retains a private shared core. Its old Pool API keeps preflight, traces, validation, savepoints, collision handling and bounded reconciliation. The fixed borrower accepts only a live one-use construction capability: no caller package or transaction argument. It never begins, commits, rolls back or releases the host transaction. Fresh construction requires created, reused=false, completed_existing_artifact=false and exact IDs/hash; orphan completion does not qualify.

After acknowledged commit and settlement, a private target-specific receipt retains chronology and release/target/observation identity. Fresh read-only acquisition verifies this receipt and complete current rows. The original state verifier still reports historical_visibility_unprovable. The separate witness proves only this closed fixture construction, never real-world historical visibility.

## Actual evaluations and durable edge

Texture reuses all twelve ordered predicate steps before final fixed identity checks. Empty positive original surfaces mean inapplicability, not proven privacy. Negative guards use new fictional text.

Claims runs all eighteen actual checks, including roster proof and five-match reconstruction, and records full results including failures. Continuation requires zero row violations/proof gaps, successful preconditions and exact denominators. H04/H13 remain the only permitted required-unestablished entries; C13 retains its explicit historical limit. Soft/deferred coverage remains candid and the aggregate remains incomplete.

Checked-out read-only clients have scoped error listeners and one rollback/release path. Primary error identity survives secondary cleanup diagnostics, including unknown COMMIT classification. Context/release mismatch permanently stops the originating host; restoring configuration cannot revive a consumed token.

A failed Claims continuation retains full actual rows, findings, coverage, preconditions and warnings in a bounded private failure receipt, never a fourth artifact or semantic approval. Nested owner outcome kinds/codes are retained without stored bodies or SQL.

The private continuation is consumed before writing and closed on every exit, including an acquisition-cut await failure. Weak collections provide trusted-host process provenance, not hostile-code authentication. Durable one-operation behavior comes from exact immutable identities/readback.

Performance invokes existing candidate grammar and all seven evaluators. The sole new mode rule permits exactly one normal_post_event turn-scoped pace/slower/light/null intent. Empty-intent evasion and all other tuples refuse. The other six evaluators remain unchanged.

Under an advisory transaction lock the consumer repeats exact source, subject, definition and result comparisons. Direction artifact/version, intent, seven actual gate rows and operation artifact commit atomically. No upsert, partial repair, broad foreign-row subtraction or injected pass is used. Every governed normalized column and complete result projection is compared.

Fresh settled readback precedes a separate audit transaction. The audit is fixture_stub, binds the unchanged eight-key fingerprint, has null model_run_id and states semantic_acceptance=not_established. Return requires audit readback and pool closure.

## Recovery and validation boundary

Read-only reconciliation never constructs or reruns a producer. Exact completed state converges; exact direction with absent audit is reported as direction_durable_audit_absent, not full success. Partial/conflicting/foreign state or missing original receipt refuses. Unknown commit requires separately released reconciliation, never automatic replay. Render/READY and genuine semantic admission remain false.

Source, release bindings and runner require review before execution. First formatting is proposed as pinned stdout capture, not target writing. Static, focused unit, old-owner parity and disposable PostgreSQL native gates remain held. The focused component tests read pinned fixture files and are filesystem-backed; they do not establish hostile-filesystem or native transaction/settlement behavior. Native allocation tracking is suite-local, starts before allocation, and memoizes teardown outcomes without repeating pool.end. Private runtime receipts, review material and execution paths are excluded from publication.

## Historical owner and fixed Performance sibling

The historical `performance-direction.ts` remains byte-identical to its read-only implementation. Its imports, stop codes, entrypoints and historical source assertions are unchanged. The fixed `performance-direction-fixture105.ts` sibling calls the public seven-row evaluator, preserving all six non-M01 rows. Its sole nonempty M01 rule retains the unregistered-mode finding, both independent denominator predicates (including duplicate findings), and ordered intent violations. Missing or non-string intent families still count in the fixed rule's family set. No caller can select a rule table or substitute a result for write authority.

## External test execution evidence

The reviewed CI preparation owner runs only after its existing environment, Git and complete source prechecks succeed. It exclusively creates `desk-connected-fixture105` under its owned temporary root. The independent binding is retained in CI evidence and forwarded as the closed, non-secret `DESK_FIXTURE105_BINDING` field. An arbitrary `TMPDIR` or self-consistent marker alone is not admission. Native bootstrap validates the binding before allocating a cluster. Local operation requires an independently reviewed equivalent runner; ambient local settings are not a release.

The external root contains a marker, five immutable bindings, target journals and receipts. Complete source and installed-tool inventories precede the finite 61-path owner ledger, then the fixed release, adoption, marker and independent runner binding. Final retention is outside those preimages. Runtime bindings and receipts never enter the checkout. All source and immutable installed package files/links stay exact. Readers traverse ancestors through no-follow descriptors and verify ownership, bounds and before/after identity. Root or release drift permanently stops the original operation. These are cooperating-runner/process controls, not authentication against hostile same-user code.

After settled read-only target discovery and before construction writes, the host exclusively persists a target intent. A construction terminal is written only after acknowledged construction settlement and successful receipt persistence. Known pre-receipt refusal, unknown construction and later-phase failure are distinct. An unknown construction never gets an invented terminal; direction/audit uncertainty never erases an acknowledged construction receipt. Read-only re-entry requires the original intent, terminal, receipt and current durable subject. It never fills missing evidence or reruns a producer.

The native harness retains an independent manifest of actual initiated targets, observed phases and outcomes, including intentionally exercised refusal/unknown paths. Those labels are not test verdicts: ordinary assertions, complete case accounting and cleanup must also pass. A missing entire target, intent, terminal or expected receipt is detectable by cross-comparison. Partial failures retain evidence and cannot become success through directory enumeration. No fourth database artifact or new table is introduced.

## Tool-generated data and retention

Outer Vitest results use the validated external `tool-cache` directory. The existing P33 TypeScript child retains its handshake, selection, deadlines and `config:false`; its explicit fourth-argument cache override uses that same independently bound root and the actual 48-hex child nonce. The Python supervisor stays unchanged. Generated results are evidence of cache behavior, never the test verdict.

The pinned bundled loader still transiently uses `node_modules/.vite-temp`. Only its exact config timestamp filename class is admitted, under an exclusively prepared owned directory. All package nodes remain exact. At most one bounded regular loader leaf may be observed during a sequential command; settled success requires the directory empty. Extant bytes are captured, but observation of every transient bundle is not claimed. No generic cache exemption, loader change or cleanup to manufacture success is allowed. Unexpected `.vite`, `.cache`, escaping links, package mutations, missing expected cache output or surviving temporary files fail the gate.

CI retains raw and redacted-copy identities separately, complete bindings/journals/suite records, cache snapshots and extant loader observations. At most 128 targets, eight actual P33 nonce caches and 64 MiB total fixture/tooling retention are admitted. Collection or upload failure prevents success. Original evidence is not deleted by the host; local cleanup requires separate release.

The closed aggregate is 79 tracked test files, 78 selected files, 29 integration files and 8,559 expected cases, including exactly 58 connected component and 33 connected native cases. Compensating per-file count drift fails. These numbers are expected inventory, not executed results. Historical CI controls remain; separate Python witnesses cover the new preparation/retention boundary. Whole-tree formatting still includes supported public fixture JSON/Markdown. Any later formatting replacement must preserve decoded values and inner canonical strings exactly and rebind raw source/resource identities before release. All execution and publication gates remain separate.

### Evidence completeness and failure accounting

All five execution binding leaves are descriptor-read before preallocation. The adoption record must match the exact release and source-ledger byte counts and hashes, and the release must reference that ledger. The same checks apply at the host, outer tooling configuration and nested parity consumer. Restoration after an observed host binding mismatch cannot revive an acquisition.

The native harness declares each case and its operation expectations independently of host error classes, registers every invocation before host opening, and records whether the case assertions and invocation accounting completed. Pre-target failures are accounted separately. The host records observed construction and later-phase outcomes only. A work failure returned after an acknowledged rollback is not an unknown COMMIT; unacknowledged commit outcomes remain unknown. Collector correspondence never turns an unexpected host failure into an expected negative test.

Bounded, allowlisted cache and surviving loader bytes are copied to exclusive, fsynced mode0600 snapshots before semantic interpretation. Unsafe or over-bound entries produce retained error metadata rather than an unrestricted read. Failed stages whose normal post-check did not run receive separately labelled partial salvage; salvage never replaces a successful stage record. Successful stages require the exact snapshot population and raw hashes pinned in their completed post-check and verdict, including empty populations. Missing directories, missing leaves, extras and changed bytes prevent final acceptance. Partial and survivor evidence remains retained even when validation refuses it; no automatic cleanup or retry is implied.

Failure capture is immutable per collection scope and stage. A controls capture and a later full capture have distinct identities; a capture failure is recorded per stage and does not suppress later stage retention. Successful snapshots admit only the finite ancestor directories implied by their pinned leaves, with independent entry, directory and file bounds; empty or extra directories refuse.

The fixed host marks each direct program-run, program-attempt and package-binding owner call uncertain before awaiting it. Only a returned owner outcome clears that boundary. A thrown direct-owner error, unknown COMMIT or attached cleanup failure cannot borrow an acknowledgement from an earlier host transaction. Earlier acknowledged construction receipts remain unchanged when a later package-binding command is uncertain. The original owner APIs and transaction behavior are unchanged.

## Module initialization and deferred fixture writers

Fixed resource data, identity helpers and the shared refusal class live in an acyclic data module; the host preserves its existing re-exports. Synchronous evaluators do not import the host. The three asynchronous fixture writers import the host before consuming their capability. Token lookup, one-use consumption and current owner/context validation remain in the host and occur after that await, before any writer SQL. No capability is cached across the import. The existing native invalidation witness changes the context after invoking the package writer and before its import continuation; restoration must not revive the consumed token. Historical Performance source and all resource pins remain unchanged.

## Fixed configuration setup prerequisite

The existing test migrator installs only the pinned shows and show_config_versions rows before setup pools settle. The runtime role retains the Migration001 prohibition on configuration INSERT. The host compares both complete normalized populations with the fixed expected envelopes inside its initial transaction, refuses missing/changed/extra rows, and requires all other initial populations empty. It still creates accounts through its existing runtime path. Configuration is a disclosed pre-existing test input, not claimed as runtime-constructed source evidence or an observation receipt. No role, grant, migration, schema, credential, frozen fixture byte or resource pin changes.

The native positive checks both current and session roles lack configuration INSERT. The existing initial-population case now performs four independent invocations: foreign claim, missing configuration, changed show and extra show. Both invocation ledgers enumerate all four; the file still contains 33 cases. Each variant must refuse without construction receipt or later artifacts. These new witnesses require execution before acceptance.

The host's inventory count uses the same behavior-equivalent visited-count fast path as the nested P33 runner: each prior visit can add at most one own key, so full key enumeration is necessary only near the unchanged 20,000-key limit. Every original traversal, file read/hash, link, ownership and identity check remains; this is not cached admission.

## Measured Claims blocker and profile binding correction

CI102 reached actual evaluation but its frozen package produced incident_witness_missing: it does not explicitly declare serious-incident availability or a none sensitivity witness. This is an additional factual proof gap on that package, not one of the permitted H04/H13 semantic gaps. Continuation remains refused. An empty sensitivity list, fictional status or missing incident claims is not silently promoted into absence evidence. Clearing this requires a separately reviewed successor package with explicit typed state/reason/source and coherently recomputed dependent immutable identities; the current package history remains intact.

The connected writer-context check now binds the actual canonical writer hash to both the supplied context and the independently pinned fixed context's serialized_input_hash. The historical evaluator still uses PASS1_PIN.w_raw_sha256. Changing writer and context self-consistently, or changing only the context hash, must refuse. This binding correction does not clear the incident proof gap or confer semantic/audio/production clearance.

## Explicit successor input revision

The active corpus is connected-fixture151, loaded through connected-fixture151-data.ts with immutable active/predecessor identifiers and exact new package identity assertions. Original connected-fixture105 files and its data reader are unchanged and remain independently loadable; its incident proof gap is not retroactively cleared. The fixture105 host interface, schema and governed content-hash domains describe the same test protocol, not the input revision.

The successor adds explicit authored-fiction absent serious-incident state and a none sensitivity witness with typed reasons and assessment source. No checkIncidentStatus predicate is changed. The package manifest otherwise stays exact. Source/config rows, rights, all spoken text, semantic anchors and prediction labels are retained; 129 descendant/storage UUIDs are remapped under the disclosed successor namespace. Package, Brief, script, direction, writer and context identities, canonical preimages and authored row bounds are recomputed. SUCCESSOR-PROVENANCE.json records the exact predecessor/current bindings and ID map. Private generated storage/result IDs now bind the fixed attempt under version2 domains; no success instances are authored.

The new package is fabfeb44-c361-5e82-9b8f-3a960d211cfa with content hash 288664c91f63508197091e4d2522a62962e6c8eb8484e7f4359dc1d2be01b8ae. All existing semantic, audio and production limits remain. Generation and component diagnostics do not establish native transaction behavior or full CI acceptance.

The successor uses the explicitly named connectedFixture151ArtifactHash entry point with its own private embedded closed schemas. The original connectedFixture105ArtifactHash remains bound to predecessor constants. Both share the unchanged private structural/row validation and hash-domain implementation; neither accepts caller schemas or unions of old/new subjects. Cross-corpus construction subjects must refuse. This corrects the CI103 stale embedded-validator binding without weakening validation or rewriting the predecessor contract.

Release validation performs two fresh complete execution-root/inventory checks bracketing each synchronous release/adoption/ledger read. Every binding leaf and all 61 owner files retain their independent descriptor reads and hash/identity checks. Start/end root, root hash and complete marker must agree; current-context observations use that final check rather than repeat a third scan. All guard callsites across awaits and SQL remain; no inventory or authority is cached across calls. These are cooperating-runner checks, not detection of every transient mutation or authentication against hostile same-user code. Timeouts and teardown requirements are unchanged.

The traversal preparation restores a fresh kernel no-follow open of every absolute component for each acquired child. It retains once-only FD ownership and private primary-error identity, with permanent cleanup poison checked before graph, execution-root and release filesystem entry. It does not retain the rejected descriptor-reuse algorithm's whole-duration directory snapshots or claim that `lstat` reproduces fresh-open ACL/permission failures. The ten remapped controls cover the original acquisition/read/inventory protections and the retained cleanup boundary. Their proposed execution is held; the original four-owner native case, all 58 markers/assertions and 120000 ms case limit are unchanged. The hosted wrapper remains 1200 seconds and the inner supervisor 900 seconds.

The temporary diagnostic workflow step, connected-only/bail profile, diagnostic wrapper branches and P33 timing prints are removed before final validation. Normal prerequisite/focused/all routing, original aggregate deadline, complete case accounting, retention, audit and security gates are restored. CI105 supplied representative native evidence: the first 13 cases passed, including the complete handoff in 79.051 seconds under its original 120-second deadline. Its 600-second diagnostic envelope then interrupted the remaining run; process containment settled without residuals, but the suite was incomplete. These partial results are not final aggregate acceptance.

## CI155: isolated writer/rest validation

The CI106 serial aggregate reached its unchanged 7,200-second limit after 14
completed files (6,680 cases). The writer file alone completed 4,908 cases in
4,150.007 seconds. This was incomplete coverage, not aggregate acceptance.

The validation harness now proposes two isolated standard-runner jobs with the
same limits: writer (one file, 4,908 cases) and rest (77 files, 3,651 cases,
including all 29 integration files). File execution remains serial within each
job. Both jobs retain the original static, source, cleanup, evidence, upload,
audit and secret-scanning checks. Physical stage names remain prerequisite,
focused and all; the partition identity is bound separately and is not a
caller-selected test filter. Only rest receives database credentials in the
aggregate child. Writer must prove an empty private connected-fixture journal
population; rest must prove the complete original 33-case connected journal.

The final verify job requires both jobs and the container build. It checks
bounded proof outputs against the current checkout, source inventory, run and
attempt, and requires the disjoint original 78-file / 8,559-case union. One
passing partition does not establish acceptance. New verifier negative tests
remain in the Python harness, outside the frozen TypeScript test inventory.
Complement duration is not yet proven. No test deadline, semantic assertion,
fixture content, application admission or audio clearance is changed.

## CI156: fixture compatibility corrections

The first rest partition completed all 3,651 cases within its unchanged limit,
with four failures. The correction keeps the collision test on the current
independently derived observation ID, validates connected Claims findings
against the pinned successor anchor population while preserving the historical
anchor grammar, distinguishes direct-query error identity from the unchanged
savepoint normalization contract, and constructs private Performance findings
without adding them to the public command outcome catalog. Existing case counts,
fixture bytes, historical command/package/Performance owners, scanner rules and
execution limits remain unchanged. Failed Claims findings remain honest failed
results, never semantic or audio admission. Native receipts and full acceptance
remain subject to the complete hosted checks.

The pinned secret-scanner action generates `results.sarif` in the checkout.
After scanning, the harness moves that bounded, regular, single-link report into
an exclusive private evidence directory, preserves its bytes and source/run
binding, and uploads it under a partition-specific name. The action's duplicate
built-in upload is replaced, not its scan or failure status. Final acceptance
requires the unchanged successful report, its successful upload and the original
strict source snapshot with no report exemption or untracked-file whitelist.

### CI108–CI110 diagnostic disclosure

CI108's native unknown-construction case stopped before target admission with
`fixture_target_isolation`; the rejected predicate was not captured. The same
selected case passed in CI109 and CI110 (76.698s and 99.653s), with all ten target
observations reporting valid predicates and zero other sessions. Neither result
establishes the intermittent cause or proves it fixed. A capped, failure-only
predicate observation remains in that test; it performs no additional query,
wait, retry, session termination or admission change.

The P33 standalone child now uses pinned Node24 native TypeScript stripping,
rather than preloading `tsx`; the original independent validation, Vitest case,
hooks, completion checks, two-second deadline and descendant settlement remain.
Observed child exit improved from 1566.2ms (CI109) to 1290.6ms (CI110), and the
Vitest import interval from 622.9ms to 175.5ms despite a slower validation interval.
These are separate hosted observations, not a controlled benchmark or a guarantee
against future deadline failures. Bounded lifecycle/resource-type and deadline
exit/EOF observations are diagnostic only, never acceptance evidence on their own.

Both selected CI110 runs have settled, reaped, no-children guard evidence without
cleanup errors. Diagnostic selection did not establish full-suite acceptance.
Temporary diagnostic selections and holds have been removed; the original full
writer/rest partitions, count gates, security/artifact requirements and final
joint proof remain required on the final independently reviewed commit.

### Historical CI120 bounded diagnostic candidate (temporary, HOLD only)

CI120 retained one extra backend at unknown-construction target observation 2,
with all other predicates true. Its backend identity is unknown; the preseed
missing-config failure's rejected predicate was not observed. Unbound server
log autovacuum messages establish no cause. Neither CI119 nor nonrecurrence
proves a fix.

TARGET_SQL now proposes one materialized population with the unchanged
current-database/other-PID predicate, full integer count and a PID-ordered sample
limited to 8 before JSONB aggregation. Categories are client, autovacuum,
other_backend (13 fixed PG17 types), or unknown. The default pg JSONB parser
returns parsed data. The original isolation predicates, target identity and
refusal behavior are unchanged. Count and sample share captured rows; this is
not a globally instantaneous or freshly reset transaction statistics guarantee.
PG17 may hide backend_type for other users/background sessions. Hidden and
unrecognized types remain unknown; no monitoring grant is added.

The native TargetObserver validates closed own-data row/sample shapes, positive
ordered unique int32 PIDs, full count/sample/truncation consistency, then buffers
owned primitive failure vectors. Nine fixed first-invocation scopes cover four
preseed variants, unknown construction and its three direct-owner variants, and
the original acquisition-cut invocation. Each observer caps observations at 64
(passing observations included). An original captured failure vector survives
malformed, hidden, truncated or overlength supplemental detail. Each line is
bounded to 1024 bytes, with at most 576 vectors and 9 summaries across native
scopes. Markers FIXTURE_TARGET_DIAGNOSTIC and
FIXTURE_TARGET_DIAGNOSTIC_SUMMARY carry version 2 schemas. No SQL, names, URLs,
credentials, raw types or error objects are emitted. Unknown/capped/incomplete
records are inconclusive, never admission authority.

The observer captures D and installs O(D), then each COMMIT witness installs
W(O). W's intentional acknowledgement-loss rejection remains intact. The inner
cleanup restores O; the outer cleanup restores D before emitting. Cleanup/output
failure preserves the primary work error. Added async/observation overhead can
perturb timing. The original 120000ms case limits/assertions remain unchanged.

Only guard profile target-diagnostic runs 12 test-local selftest groups before
native allocation. Fake-driver output is intercepted; only one separately
counted FIXTURE_TARGET_DIAGNOSTIC_SELFTEST completion record reaches evidence.
These JS controls operate on already-mapped categories, not executed SQL CASE
or real autovacuum evidence. Existing 58 unit and 33 native cases remain unchanged
in count, and no case selector is accepted from callers.

Temporary workflow steps invoke run-stage.sh diagnostic120 in both jobs. Writer
returns HOLD 78 without launching tests. Rest aliases STAGE=all but selects only
the two connected files through target-diagnostic. Existing all precheck, fresh
bindings, controls, DB pipe, 7200s ceiling, 20s TERM/KILL grace and capture limits
remain. The actual guard exit is retained at all/exit, while the diagnostic
wrapper returns 78. Default success gating skips the original aggregate step;
one always-gated rest check all captures post-source/native state, followed by
existing full collection/upload and final HOLD. ci.py is unchanged: its 3780/full
file/one-P33 requirements intentionally reject 91 tests and zero P33 cases.
Those expected coverage errors must not be "fixed" by weakening validators.

Independent retained-evidence inspection must account for exact 58+33 file/test
populations, zero skips/todos/unhandled errors, 12/12 selftests once, one guard
attempt/zero P33 case directories, settled/reaped/no-children cleanup, the full
33-case invocation journal, source/cache preservation and bounded diagnostic
records. Preserve reproduced assertion failures and censoring as findings; do
not rerun until green. A passing 91-case nonrecurrence proves no cause or fix.
Normal full CI requires separate review restoring this temporary route.

This candidate is source preparation only. No execution, installation, provider,
privilege/logging change, assembly, READY or publication authority follows. The
seven changed source owners and exact invocation need review before execution;
source/release/root bindings must be generated freshly from that candidate.

### Historical failure-triggered maintenance observation: source-only candidate

Based on published PR39 head `92455173d1301a91a2b2ef0d427a5c6447d85b94`.
CI121's 91/91 diagnostic was nonreproduction, not a fix. CI120's unexpected
backend remains unidentified, and the preseed failure's rejected predicate was
not observed. Assembly remains held. This source candidate is unexecuted.

The original target statement adds only private server-start and sampled
backend-start UTC microsecond strings. The same materialized population,
full count, database/own-PID filter, LIMIT 8, strict other_sessions-zero check,
identity projection and runtime errors remain. Existing version2 output still
selects PID/category only; private names, OIDs and timestamps never escape.

A suite-local latch reserves at most one maintenance observation for the first
valid positive-count failure with all other target predicates true. Passing,
rejected or unbound observations and subsequent failures issue no read. After
work settles and both driver wrappers are restored, exactly one awaited query
uses the suite's ALREADY existing cluster.admin pool on its maintenance database.
No target connection, new pool/grant, timer, listener, manual release, cancellation
or termination machinery is added. Original result/failure remains primary.

Existing admin `connectionTimeoutMillis=10000` and `query_timeout=20000` govern
checkout/query. Scheduling may exceed nominal timers; there is no strict wall
claim. Pool owns its listener/release path and cluster teardown stays unchanged.
Success is cleanup=driver_handoff; a rejected query is cleanup=unknown with
fixed reason=error, without inspecting raw error text. Neither label, query
settlement nor pool.end proves the remote backend/socket has terminated.

The fixed statement requests at most 8 captured PIDs, limits to 9 rows before
JSONB aggregation and compares exact target name/OID and server-start binding.
Visible equal backend-start strings support a later same-lifetime observation,
never causation. Hidden original start permits only provisional classification.
Wrong database/PID, vanished row, hidden result or changed lifetime stays
unknown. No timestamp plausibility or unrelated server log supplies certainty.

One separate FIXTURE_TARGET_MAINTENANCE line is capped at 2048 UTF-8 bytes. Its
fixture-target-maintenance/1 record has exact scope/ordinal/status/reason/cleanup
and bounded PID/category/binding/reason entries; no raw SQL, errors, usernames,
addresses, credentials, database names, OIDs or timestamps. Original same-query
vectors/summaries survive supplemental faults. The existing pool's behavior
remains qualified; no remote-termination claim is introduced.

Eight fake control groups are appended to the existing 12. All 20 groups are
UNRUN in this candidate. They remain in the native beforeAll and are skipped
without TEST_DATABASE_URL; no fake-only launcher is created. A future completed
invocation would emit the single fixture-target-selftest/2 groups 20/passed 20
record only after all controls, with all fake output intercepted. The 58 unit +
33 native case counts stay unchanged. Fakes establish no actual SQL CASE, PostgreSQL
visibility, timeout or remote-termination behavior.

The approved local Python harness passed all 153 controls after a comment-spacing
witness correction. The restoration-order assertion is scoped to the actual
around cleanup. Formatter, compiler and lint checks remain unrun because this
executor lacks the pinned Node/npm versions and project dependency tree; no
installation or fallback toolchain was used. No build, native/database tests,
CI, commit or publication ran. All 20 groups remain unrun, deferred to separately
justified and reviewed native validation. Do not start 91 tests to exercise
fake groups or seek reproduction.
The stopping condition is reviewed evidence improvement, never a claimed fix
or green full CI. Existing temporary HOLD workflow/launcher and ci.py are intact.

## Historical held-client control, revision 2 (source preparation; UNRUN)

This continuation adds the permanent native case `identifies a held client while
preserving target isolation refusal`, registered last with exactly one
`pre_target_failure` invocation. Original observer scopes retain the first opportunity
to consume the suite-wide maintenance latch. The control never resets that latch
or adds another read allowance; if a prior failure consumed it, the control
retains its fixed precondition failure rather than claiming success.
All 33 prior native cases and 58 unit cases stay
required. Current full counts become 34 native, 92 connected, 3,781 rest and 8,689
aggregate tests; file counts remain unchanged. The earlier counts and two-file
diagnostic route above describe the preceding proposal, not this invocation.

The temporary `target-diagnostic` profile now selects only the native file and
the anchored exact suite/case name. Existing workflow, prerequisites, focused
controls, database feed, evidence collection, time limits and unconditional
diagnostic HOLD 78 remain unchanged. Expected native output is one passing case
and 33 skipped cases, plus the separate selftest marker
`fixture-target-selftest/2` with groups 20/passed 20. All 20 fake groups and this
real control are UNRUN in this source preparation. No check or runtime release
is implied. The full checker must reject incomplete native coverage, skipped
cases, missing unit coverage and zero P33 cases. `suite_complete` is unchanged
and must remain false for the one-case invocation.

The case deliberately holds one owned client under `desk_runtime` through the
real runtime refusal and the existing failure-only admin read. Two fixed PID
reads on that same continuously held handle corroborate ownership and liveness;
they never alter diagnostic input or binding. Activity ownership belongs to the
session login, whereas observation runs as `desk_runtime`; membership is granted
to the login, not in reverse. Thus the original held-PID sample must retain
category `unknown` and private null start, supplement `inconclusive/unknown_type`
and summary `inconclusive=true`, with `observationFailed=false` and
`capReached=false`. The later admin entry must be
`client/provisional/hidden_origin`, status `observed`, reason `none`, cleanup
`driver_handoff`. It must never be promoted to `lifetime_match` by the control.

Only `noOtherSessions` may fail in the one observed target vector. The true
positive count can exceed one; additional ambient entries remain retained.
The held PID must be present in an untruncated sample and the admin entry must
be visible. Capping, missing/vanished PID, hidden admin data, an observation
fault or a different refusal fails this control. The genuine refusal object
must survive unchanged, with exact driver descriptor restoration before the
supplemental read. No grants, runtime SQL, privileges or isolation predicates
change. The suite-wide latch is consumed once and never reset.

Cleanup closes the holder once, retaining its error listener through end
settlement. Existing inspection helpers then require zero constructed rows and
unchanged receipts. The tracked owner performs ordinary DROP DATABASE, and one
existing-admin read checks the held PID is absent. There is no polling, forced
drop, termination, retry or new timer. Nested existing cleanup preservation
keeps primary and cleanup failures; afterEach and independent afterAll residual
verification remain binding. Driver handoff or client-end settlement alone is
not a remote-termination proof.

One bounded `FIXTURE_HELD_CLIENT_CONTROL` line uses schema
`fixture-held-client-control/1`, the fixed case name and only five boolean facts:
`rejectionIdentity`, `wrapperRestored`, `heldPidContinuity`,
`hiddenOriginProvisional`, `cleanupComplete`. It is capped at 1,024 UTF-8 bytes.
The existing PID-only vector/summary/maintenance lines remain authoritative and
unchanged. Across all ten fixed observer scopes the maximum is 640 vectors and
ten summaries, 64 observations/eight sample entries per observer; the suite
still allows at most one supplemental read. This one-case route expects one
vector, one summary and one maintenance record for `held_client_control`.

Independent source/invocation review and separately released static checks
precede any hosted execution. A subsequent release may authorize exactly one
bounded control run; no reproduction-seeking fallback or unchanged retry is
permitted. A successful result validates censored/provisional evidence, strict
refusal and owned cleanup. It cannot retrospectively identify CI120, establish
a root cause or fix, exercise live autovacuum/races/hidden-admin metadata, or
give full-suite acceptance. Restoring the temporary route and running normal
candidate acceptance are separate reviewed gates. Assembly implementation,
real audio, genuine semantic admission and publication remain unauthorized.
