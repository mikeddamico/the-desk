# ADR-002 — Application Runtime: TypeScript on Node.js

**Status:** ACCEPTED  
**Date:** September 26, 2026  
**Decision owner:** Mike  
**Scope:** Build 1 onward

## Context

The Desk's first implementation is primarily a typed orchestration and artifact-lineage system: immutable JSON-like contracts, Postgres persistence, workflow state, provider adapters, canonical hashing, schema validation, retries, cost controls, and eventually a small operator/admin surface.

The architecture deliberately does not depend on a Python-native ML stack. Model and TTS providers are external adapter boundaries, and FFmpeg remains an external media-processing boundary.

The final implementation-readiness red team identified the application language/runtime as the only unmade Build-1 platform decision.

## Decision

The primary application runtime is:

```text
TypeScript
Node.js 24 LTS
TypeScript strict mode
```

The repository must pin the Node major/runtime line in developer and CI tooling. Exact patch/minor versions and the exact TypeScript compiler version are dependency-management decisions and are locked by repository tooling/lockfiles.

TypeScript is the default language for:

- application services;
- workflow functions;
- schema/runtime validation;
- Postgres access and migrations;
- canonical serialization/hashing;
- provider/model/TTS adapters;
- artifact and gate contracts;
- tests and CI-facing tooling;
- a future lightweight operator/admin interface where appropriate.

## Why

The core problem is not model training. It is safely moving strongly structured, versioned artifacts through a workflow without losing lineage or letting provider behavior leak into editorial contracts.

TypeScript gives the implementation one strongly typed language across the backend and likely future operator UI while still requiring runtime validation at trust boundaries.

This reduces the chance that a coding agent silently creates parallel contract shapes between:

```text
Evidence Package
Showrunner Brief
Script Version
Performance Direction
Gate Result
Render Manifest
Render Take
Take Selection
Assembly Map
```

## What this does not decide

ADR-002 does **not** choose:

- web/admin framework;
- ORM or query builder;
- migration library;
- workflow vendor;
- hosting provider;
- package manager;
- test framework;
- logging library;
- schema-validation library.

Those are implementation choices to be proposed during the coding-agent dry run and reviewed before code is committed when they materially affect structure.

## Python

Python is not prohibited.

A later bounded analytical/statistical task may use Python if the requirement is genuinely Python-shaped and the boundary is explicit. Python does not become a second application runtime merely because AI or statistics are involved.

## Consequences

- Build 1 may now choose TypeScript/Node-specific tooling without inventing the runtime.
- CI must run TypeScript type checking in strict mode.
- Canonical hashing behavior must be implemented and tested independently of JavaScript's default object enumeration behavior.
- External/process boundaries such as FFmpeg must have typed adapters and validated outputs.
- A future runtime change would require a new ADR; it is not an incidental refactor.
