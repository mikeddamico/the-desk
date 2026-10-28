# The Desk: code style and review requirement

**Effective October 28, 2026, for coding and review instructions.** This requirement applies to all contributors and coding agents as part of the existing writing, review, and publishing process (see [CONTRIBUTING.md](../CONTRIBUTING.md)).

This document is an engineering-process requirement, not an amendment to the governing Lock (`Lock/00_INDEX/ACTIVE_SPECS_LOCKED_v1.2.7.md`), a new technical contract, or an expansion of permissions.

Examples come from the read-only audit of candidate `5b1e7d5c25ffd938e577c6c4741afee814f3c31e`. They illustrate the standard; they do not authorize broad rewrites or make historical style preferences retroactive blockers.

## The goal

Write for the engineer maintaining this in six months, not for the conversation that produced it. Prefer ordinary, precise code over cleverness or ceremony. Keep the existing safety and provenance guarantees; readability is not a reason to remove them.

## 1. Let the existing tools own formatting

Use the repository's pinned Prettier, ESLint, and TypeScript configuration. Do not introduce a competing formatter, disable strictness, or reformat unrelated files. Follow the surrounding import style and use type imports for type-only dependencies. Keep serialized/schema field names unchanged; use descriptive camelCase names for TypeScript implementation code and snake_case for Python.

Use one variable declaration or action per statement in new handwritten logic. Short guard clauses are fine; avoid packing a sequence of state changes onto one line. Python should follow PEP 8's readability conventions, without a mass rewrite of existing tooling. [Prettier distinguishes formatting from code-quality checks](https://prettier.io/docs/comparison); neither replaces review.

## 2. Comments explain a reason, rule, or boundary

Use `//` for implementation reasons and JSDoc for information callers need. State the invariant in plain English. Keep chronology, review transcripts, and acceptance history in linked documentation. Retain the behavioral restriction at the point where a maintainer could break it.

**Existing useful comment** (`src/identity/select.ts:79`):

```ts
// Unicode code-point order, never UTF-16 code-unit order.
```

**Less useful as the first explanation** (`src/runtime/writer-fixture-input.ts:1`):

```ts
// Accepted ROOT123 contract02, FINAL LOCK v1.2.7. Unwired historical fixture DATA.
```

**Better explanation, with provenance retained in its existing document:**

```ts
// Builds the fixed historical writer-input projection; never invokes a model.
// Contract and provenance: docs/g1-writer-fixture-input.md.
```

(See [docs/g1-writer-fixture-input.md](g1-writer-fixture-input.md).)

Do not delete meaningful safeguards to shorten prose. For example, the provider's reservation must commit before the side effect, and a timeout is ambiguous—not permission to retry. Say that directly. Avoid all-caps emphasis, decorative banners, and review IDs as substitutes for explanation. Do not require a comment on every obvious statement. [Google's TypeScript guide distinguishes caller documentation from implementation comments and discourages redundant type/name restatements](https://google.github.io/styleguide/tsguide.html#comments-documentation).

## 3. Document surprising public contracts

For a nontrivial exported operation, briefly explain input restrictions, output/ownership, side effects, and failure behavior. Link the detailed contract rather than copying it. Do not repeat TypeScript parameter types in JSDoc. Put the comment on the symbol it documents.

For example, `canonicalTimestamp` validates a UTC string but does not round or normalize its fractional digits. `canonicalJson` accepts a narrower numeric domain than ordinary JSON. Those details belong beside the exports, not only in tests.

**Suggested documentation for the existing `canonicalJson` boundary:**

```ts
/**
 * Serializes semantic JSON with NFC strings and code-point-ordered keys.
 * Numbers must be safe integers; exact decimals must be strings.
 * Throws TypeError for unsupported values, cycles or sparse arrays.
 */
```

For render planning (see [docs/frozen-render046-planning.md](frozen-render046-planning.md)), document that the public wrapper reads fixed inputs and actual safety settings, returns a deeply frozen synthetic-only result, and never calls TTS or grants production clearance. Document pure inspection/derivation exports separately: their results grant no authority (see [docs/identity-projection-authority.md](identity-projection-authority.md)).

## 4. Names and helpers should make the domain visible

Prefer `sources`, `mechanics`, `descriptor`, and `canonicallyEqual` over `s`, `m`, `d`, and `same` across substantial functions. Short loop indices and mathematical names are fine locally. Keep required contract vocabulary and wire keys unchanged.

Split functions at a meaningful boundary—acquire, validate, derive, persist—not to meet a line quota. Keep side effects separate from pure computation where the current design permits it. A helper should remove a real repeated concept, not create another layer to navigate.

Do not merge superficially similar helpers blindly. `writer-pass1.ts:sameJson` performs structural equality without normalization; `frozen-render046.ts:equal` compares canonical JSON. Those are different contracts. Likewise, independent output recomputation and input admission are deliberately different trust boundaries.

## 5. Types and errors preserve the contract

Validate untrusted input as `unknown`; narrow it before use. Use named domain types after validation when they clarify the next stage. Preserve discriminated result unions and explicit units. Do not replace validation with casts or broaden exports solely for test convenience.

Every catch should have an explainable policy: a known refusal, a sanitized boundary fault, cleanup, or propagation. Preserve the module's specified policy; do not turn unexpected failures into success or impose one generic catch policy everywhere. Comments and API docs should tell maintainers when details are deliberately withheld. [TypeScript strictness provides stronger static checks](https://www.typescriptlang.org/tsconfig/strict.html); runtime admission remains a separate project requirement.

## 6. Tests explain the behavior they protect

Use names stating condition and expected result. Keep useful vector IDs for traceability, but pair opaque IDs with human-readable intent. `canonical-json.test.ts` already does this well. For example, prefer “derivation input uniqueness (ROOT131)” over making `ROOT131` the primary subject of a suite.

Keep setup, the action, and the assertion easy to locate. Share setup when it genuinely clarifies the test. Preserve independent expected values and mutation controls; never calculate the expected answer through the same implementation being tested. Large fixed corpora are not a reason to remove assertions or alter exact-count gates.

## 7. Keep history accurate without rewriting it

Remove obsolete “proposed/not run” labels from live source only through a reviewed change. Preserve historical records, frozen sources, fixtures, and their byte identities. A historical hash in an activation record does not itself make an ordinary file permanently immutable: check current readers and contracts before deciding.

`AGENTS.md` and Lock sources are current Render046 pins. Do not edit them without an explicit contract and pin update. ZIP member `README` files inside frozen fixtures are likewise immutable.

## 8. Required author, review, and publishing checks

Apply this guide to new and touched handwritten code. Put comment-only maintenance in separate reviewed deltas; compare syntax/config semantics where useful. Do not mix cleanup into a candidate already under review.

### Before a draft commit or draft PR

- **Author:** read this guide; explain any necessary exception; check names, public contracts, comment truthfulness, and test intent. Run the applicable authorized, bounded local checks and record their results and any limitations against the reviewed source/tree. Verify that frozen boundaries remain unchanged.
- **Reviewer:** inspect the actual source/tree delta for understandable control flow, useful comments, appropriate helpers/types, and failure behavior. Check that tests protect the stated behavior and that cleanup has not weakened safety or independent validation. Record material findings and their resolution, not just test totals.
- **Draft publication:** confirm those author/reviewer checks and local validation are recorded for the source/tree being committed. Creating a reviewed draft commit or draft PR does **not** require full hosted CI or final-commit review to have happened first; publishing the draft may be necessary to run hosted CI. A draft is not approval to merge or deploy.

### Before merge

- Required hosted CI must pass on the exact final commit.
- Final independent review must pass on that same commit, including any later changes.
- Perform the existing fresh pre-merge check and preserve all required review gates. No unreviewed cleanup may be added after validation; a changed final commit needs the applicable checks and review again.

Material readability or maintainability defects—such as misleading contracts, unsafe abstraction boundaries, or control flow that cannot reasonably be maintained—must be resolved before merge. Personal preferences remain nits, not retroactive blockers. The checklist belongs within the existing thorough review, not in place of it. Efficient review means appropriate model selection and avoiding redundant work, not dropping needed independent scrutiny.

[Google's review guidance supports checking these qualities and separating broad style changes from functional changes](https://google.github.io/eng-practices/review/reviewer/looking-for.html). [PEP 8 prioritizes local consistency and warns against breaking compatibility merely for style](https://peps.python.org/pep-0008/).
