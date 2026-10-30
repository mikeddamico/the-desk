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

The pinned S3/Smithy transport has one attempt, no region redirects, single PUT/GET, one socket and a 15-second request deadline with a five-second settlement observation. JSON/error bodies are capped at 64 KiB, objects at the fixed corpus sizes, aggregate captured/downloaded objects at 12 MiB. Original buffers, downloaded buffers and stream copies are accounted for under the fixed 32 MiB allocation budget; this is not an OS RSS quota. Writer/reader action deadlines are 600/300 seconds, not hard real-time guarantees. SQL uses one connection, verified TLS, bounded connection/query/lock waits and the existing command transaction owner.

One initial real roundtrip is at most 33 R2 requests: eleven PUTs, eleven writer GETs and eleven fresh-reader GETs, with at most 12 MiB upload and 24 MiB download. Schema initialization, read-only binding checks and any explicitly requested reconciliation are separately accounted actions. Fault and concurrency tests use controlled adapters; they are not permission to repeat paid writes.

## Candidate checks and proposed execution

The twenty cases in `durable-pair.test.ts` cover independent vectors, the complete fresh-reader path, identity/concurrency, collisions, each interrupted PUT, uncertain COMMIT, corruption/deletion/JSON bounds, frozen resume/lost intent, the SQL transaction owner and the bounded SDK transport. Eleven independently named upload-position cases each retain the existing default five-second limit and the complete interruption/reconciliation assertions. Assessment is mocked from the accepted historical observation; transport and SQL seams prevent cloud access. These tests cannot establish real R2 durability or acoustic acceptance.

After actual-source/invocation review and fresh authentic source/tool bindings, the proposed pure command is:

```sh
/usr/bin/timeout --signal=TERM --kill-after=20s 900s /usr/bin/python3 -I -B test/support/p33-parity-supervisor.py guard durable-pair-pure
```

The preceding reviewed `technical-master-pure` regression passed ten pure groups and skipped its two real-media groups. The durable profile previously reported seven passes and three failures; the timed-out aggregate upload case established no complete subcase coverage. The corrected twenty-case durable profile awaits review and execution; this test-only correction does not require another technical regression. Real schema/storage proof requires the separately reviewed literal bindings/procedure and action-time credential/security authorization. No listener or production-quality claim follows from synthetic tone persistence.
