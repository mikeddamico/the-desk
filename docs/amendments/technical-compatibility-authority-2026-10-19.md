# Technical compatibility authority — 2026-10-19

Status: governing owner instruction recorded by dot; implementation and runtime remain subject to independent review. This is an additive amendment, not a rewrite of historical contracts.

## Authority

Mike, Sentinel_3c1355791b14819198a230c460924a30, October19 2026 12:49UTC: “Let's update the contract to cover instances like this. I have no qualifications to be determining whether this is a good or bad decision. You need to make these calls going forward.”

Dot replied: “Understood. I’ll update the contract so I own technical compatibility decisions like this, with independent review and a recorded rationale. I recommend proceeding with this fix and will carry it forward. Product choices, spending, deployment, security changes, destructive actions and your final merge stay with you.”

Mike, Sentinel_30beaf3009a08191891bcb112a41b8c9, October19 2026 12:49:38UTC: “Approved”. These transcript identities and exact text were supplied by dot in this delegation.

Technical implementation and compatibility tradeoffs belong to dot/the engineering lead, with documented rationale, explicit affected clauses, independent review and evidence. Mike retains product decisions, spending, deployment, security changes, destructive actions and merge. This supersedes the owner-only technical exception requirement for this case and comparable technical decisions; it does not delegate all product policy or weaken security/architecture boundaries.

## First adjudication: DESK-LEGACY-NATIVE-KILL-v1.0.0

Dot accepts the narrowly reviewed policy from decision record Library `libfile_49c7889bef4c8191b39775c56dc301e0` v1, 28931bytes, SHA256 `071474d5ab75e38d52ffcdbe5cedda6c1a731ce3a2d9ee4b5e6c9068d3dd80f8`. The established reviewer conditionally accepted that exact record; the owner's delegation and dot's adjudication now close its reserved-decision condition. This does not claim independent verification of supplied Node tag/hash/two-caller provenance: reviewer retrieval was DisabledError.

Affected clauses:126C §2 literal per-member invocation;126C §6 independent reference and P03/P05 exact baseline comparisons;126E unchanged-legacy requirements and profile/error wrapping;126G owner reservation and unchanged-literal mechanism; P33 execution amendment's no-extra-killSignal restriction. Replace only the per-member options with `{maxBuffer: maxBytes + 1, killSignal: "SIGKILL"}` uniformly, and compare against the expressly versioned independent reference with that sole algorithmic delta. Listing, maxBytes arithmetic/admission, native argv, optional-path routing/counts, original120character wrapper, independent pathname opens, assertions, case deadlines and integrity checks remain unchanged. Profile L permits no extra JavaScript probe/open.

The accepted difference covers configured termination wherever Node uses killSignal: native signal/status, catchable-handler behavior, cleanup/flush/side effects, timing, captured/emitted partial stdout/stderr, native error fields/code/message and thus the existing public error detail. It is not overflow-only permission. In pinned Node source Kill has overflow and timer callers; this invocation supplies no timeout and none is added. Unrelated differences remain failures. No synthetic error, normalized message, fabricated successful result or universal liveness promise is permitted.

Rationale: eliminate reliance on catchable SIGTERM when Node decides to terminate extraction, while retaining extraction and existing correctness checks. This may not fix the observed stall. Actual overflow/signal delivery and original CI root cause remain unproved. Historical performance failure, failed/hung runs and unchanged-original oracle remain historical evidence, not retroactively successful validation.

Preserve historical contracts/oracle and link this amendment. The versioned independent reference is `test/support/legacy-native-kill-v1-reference.ts`; historical literal is retained in `test/support/history/legacy-per-member-original.ts.txt`, with its prior source and hash bound by the review manifest. Its name does not imply unchanged legacy semantics.

## Gates

Independent review must accept actual implementation/reference/bindings and concrete launcher before any runtime. First release is once only:3seconds for the entire boxed-zero subject-then-reference operation, with capture/observation boundaries distinct and12seconds for settlement. Runner exit0 is separate from native unzip status. Timeout, missing real ENOBUFS evidence, capture loss or uncertain ownership is FAILURE/HOLD. Stop after one result for review; no retry/deadline escalation. Only reviewed success releases finite affected regressions; mandatory full validation/CI remains later. Mike alone merges. No deployment is commissioned.
