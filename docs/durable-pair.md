# Private durable synthetic pair

This connection stores the fixed, separately authored 60-second synthetic master and its complete map/input provenance. It uses the existing artifact, audio, recipe and map tables. Its receipt records an immutable operation request; it grants no gate, attempt transition, VALIDATED/READY status or speech/listener clearance.

The governing preparation is the accepted durable-pair literal contract (122241 bytes, SHA256 `987e666eff40b98281c26bc9b98ad25edfa714ca2876d27e37511d177cc8fcca`) and operational amendment (15935 bytes, SHA256 `ba11589a74445afec406eed6b04c75cd1391b70ea3f54e64c4f4a1d8293b723e`). Their independent canonical vectors are retained in [vectors.json](../fixtures/durable-pair/vectors.json). Existing technical policy, fixture v3, recipe versions, six stage fingerprint projections and runtime measurement pins remain unchanged.

## Entry and ownership

`storeDurableSyntheticPair` accepts only an authored UUIDv4 and a canonical UTC timestamp with six fractional digits. A committed SQL receipt is checked first. Otherwise the pre-registered private operation namespace must recover the exact saved intent, or admit a genuinely new operation. A missing intent after assessment began is held; it cannot trigger remeasurement or timestamp replacement.

The internal assessor retains the original captured buffers and cleanup owner through upload/readback and SQL visibility. The public technical evaluator keeps its snapshot-only lifetime and result schema. New operations preflight fixed IDs and locators before assessment. Historical locator/hash collisions refuse rather than mutate old rows.

Eleven operation-owned objects are conditionally created with `If-None-Match: *`: source, two inputs, recipe, map, context, policy, inspection profile, assessment observation, receipt, then master. Every object is completely downloaded and checked against captured bytes before the short SQL transaction. No object I/O occurs inside that transaction. All four domain tables are addressed with literal `public.` qualification. Fresh readers and preflight opt into the existing command owner’s closed repeatable-read/read-only mode, which emits its complete `BEGIN` before the first query and validates both observed settings; the writer and existing callers keep the default transaction behavior. Exact immutable rows converge; incompatible rows conflict. The receipt artifact is inserted last and is the discovery boundary.

Pending PUT/COMMIT intent is saved before the side effect. An uncertain response does not authorize a replacement PUT, deletion, assessment or SQL replay. Explicit read-only reconciliation performs one bounded sweep; missing objects during an uncertain write remain unknown. Attributable partial objects and intent files are retained. Uncertain process/client cleanup holds one shared admission barrier across writer, reader and reconciliation entries, preserving the primary refusal and retained owners. A later entry refuses before SQL or R2 even when its operation ID differs; the barrier never clears automatically.

## Fresh reader

After the writer releases its captured artifacts, `readDurableSyntheticPair` opens a fresh SQL reader, resolves only the committed receipt and downloads all eleven objects through fresh authenticated requests. It verifies raw sizes/hashes, fixed source pins, input existence, recipe/map/Assembly/context/policy bindings and the captured assessment observation. Local source audio is never substituted for a missing object. Readback does not rerun acoustic inspection or mint a gate.

## Binding and resource limits

The deployment-owned registration is deliberately unconfigured. Callers cannot supply paths, URLs, credentials or policies. Enabling it requires a separately reviewed exact R2 origin/bucket/private prefix and secure credential reference; Postgres host/database/login, verified TLS/hostname and catalog; a migration-reader attestation; and the existing private operation namespace's canonical path, device/inode, caller ownership and owner-file hash. No credential is read while registration is absent. No default AWS credential chain, insecure TLS fallback or automatic resource provisioning is used.

The proposed fixed Smithy transport uses the existing pinned signer, checksum and Node HTTP handler, with application-owned serialization for only conditional PUT and complete GET. It has one attempt, no redirects, one socket and a 15-second request deadline through signing and body consumption, followed by five seconds of settlement observation. PUT takes its own byte snapshot before any await; signed headers, content length and payload hash bind that snapshot. IncomingMessage ownership precedes raw-header validation. Duplicate critical headers, ambiguous framing, unexpected encoding, incomplete EOF and byte/hash mismatch refuse. A response chunk over 64 KiB retains `resource_limit`; aggregate overflow retains `storage_readback_invalid`.

Checksum reset constructs a fresh pinned delegate from the owned original normalized key, including the supported JS fallback; it never relies on the delegate's reset. Explicit empty HMAC keys remain distinct from plain SHA256. A late signer remains owned, cannot dispatch after timeout, and has a terminal cache/reference cleanup observer. Uncertain signer, stream or socket settlement permanently holds the shared barrier. Public errors retain their existing sanitized code/phase; private traversal-native error identity is a different boundary. Underlying Agent destruction is attempted once, including when the handler destroys its external Agent.

JSON/error bodies are capped at 64 KiB, objects at the fixed corpus sizes, aggregate captured/downloaded objects at 12 MiB. For the fixed corpus, held original inputs/master occupy about 11.52 MB; the largest upload snapshot and largest readback add about 5.76 MB each, with bounded JSON/streams remaining inside the existing 32 MiB allocation budget. No additional snapshot per request is retained after settled ownership; pending owners remain bounded and stop further admission. This is not an OS RSS quota. Writer/reader action deadlines are 600/300 seconds, not hard real-time guarantees. SQL uses one connection, verified TLS, bounded connection/query/lock waits and the existing command transaction owner.

One initial real roundtrip is at most 33 R2 requests: eleven PUTs, eleven writer GETs and eleven fresh-reader GETs, with at most 12 MiB upload and 24 MiB download. Schema initialization, read-only binding checks and any explicitly requested reconciliation are separately accounted actions. Fault and concurrency tests use controlled adapters; they are not permission to repeat paid writes.

## Offline controls and execution boundary

The twenty cases in `durable-pair.test.ts` retain the durable protocol and interrupted-write controls. Eleven additional cases in `durable-pair-transport.test.ts` cover published signing vectors, reset/fallback, frozen wire expectations, immutable snapshots, framing, status/chunk bounds, deadlines, late signer cleanup, Agent ownership and normalized errors. Every case retains the default five-second limit; long-deadline controls use fake time and owned deferred promises. Assessment is mocked from the historical observation, and no transport seam connects a socket. These tests cannot establish real R2 durability or acoustic acceptance.

The repository remains unconfigured for external execution. Any bounded test command
must use the existing supervisor with fresh source/tool bindings. Adding the proof
CLI does not supply a registration, credentials, namespace or authorization.

## Optional transport diagnostics

The proof CLI can retain a terminal metadata snapshot when
`DESK_DURABLE_PAIR_DIAGNOSTICS_DIR` names an existing private canonical directory.
The sink does not create that directory, adopt an operation namespace, or change
permissions. It uses Linux `/proc` descriptor checks and publishes a new private
file exclusively. A collision or persistence/reporting failure does not replace
the action's original result or exit status; a failure may leave private partial
evidence for inspection. Process loss before terminal capture can leave no snapshot.

Records contain only allowlisted object names, method/stage, elapsed time, response
status, consumed response-byte count, sanitized error code and cleanup flag. They
never contain request headers, credentials, object bodies, URLs or raw error text.
A throwing error-code getter is represented as `OTHER`, preserving the event and
the primary transport outcome. Request and record limits remain bounded.

`complete` describes recorded event coverage, not successful cleanup, SQL commit,
artifact admission or enduring object availability. `saturated` and `dropped_records`
make capacity loss explicit. Counts are process-global observations, not an
operation journal. Byte counts measure inbound response bytes, not upload progress.

## Persistent namespace boundary

The admitted namespace path is fixed to
`/workspaces/the-desk-durable-pair-operations-v2`. A separately reviewed registration
must still bind its actual device/inode, UID and owner-file hash; repository
registration remains null. Callers cannot choose or initialize a replacement path.
Missing prior ownership or intent remains held, never evidence of a new operation.

A preserved workspace avoids the ephemeral `/tmp` location across ordinary
Codespace stop/start and rebuild. This is not a backup or a promise of survival
after Codespace deletion. Existing unresolved operations and their evidence must
not be deleted or reconstructed to regain first-entry status.

## Captured private result and remaining work

On November 4, 2026 UTC, a separately bound private development candidate completed
one synthetic writer and one fresh-reader invocation. Its eleven conditional PUTs
and twenty-two GETs succeeded, the SQL receipt committed, private operation evidence
was retained, and temporary database access was closed. Independent result review
accepted that captured outcome. It did not establish the earlier uncertain
operation's outcome or timeout cause.

That private candidate also included an independently reviewed database guard
variant not included in this diagnostics/namespace patch. Therefore this result is
not a claim that unconfigured repository main reproduces the private connection.
The result retains `authority=none`, synthetic-only scope, and false authoritative
gate, lifecycle VALIDATED, READY and production flags. Synthetic tones establish
neither spoken-content quality nor product audio thresholds.

The accepted durable-pair contract's next substantive step is separate review of
an authoritative technical-gate schema/projection bound to durable subject IDs,
the actual attempt/configuration/selection chain, transaction/idempotency rules and
guarded ASSEMBLED-to-VALIDATED transition. Existing transition machinery alone does
not establish those prerequisites. No additional synthetic live proof, deployment,
new spending or speech-provider call is released by this integration.
