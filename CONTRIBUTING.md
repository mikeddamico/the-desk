# Contributing to The Desk

All contributors and coding agents must follow the repository's engineering and review requirements. This guide is an entrypoint to existing standards and contracts; it does not amend the governing Lock (`Lock/00_INDEX/ACTIVE_SPECS_LOCKED_v1.2.7.md`), create a second technical specification, or expand execution permissions.

## Required reading

- **Code style and review requirement:** [docs/code-style.md](docs/code-style.md) defines the required standards for formatting, comments, public contracts, naming, error policies, tests, and the author/reviewer checks before draft publication and merge.
- **Repository instructions and pinned boundaries:** [AGENTS.md](AGENTS.md) defines current workspace rules. `AGENTS.md` and selected `Lock/` sources are byte-pinned in `src/runtime/frozen-render046-input.ts`; fixture archive pins are defined in `src/fixture/pins.ts`. Preserve these boundaries and immutable history; any authority change requires its own authorization and must not silently repin frozen sources.
- **Operations and local validation:** [docs/operations.md](docs/operations.md) and [README.md](README.md) describe environment setup, least-privilege database roles, and local validation commands.

## Working rules

1. **Follow the style guide on new and touched code.** Keep unrelated files untouched and never run broad write-format sweeps across the repository.
2. **Explain exceptions.** If a contract or boundary requires an exception to [docs/code-style.md](docs/code-style.md), state the reason in the change description or an adjacent implementation comment.
3. **Include readability and boundary truthfulness in review.** Code review must verify that comments, contracts, and test names accurately describe behavior and limits, alongside existing correctness, safety, and provenance checks.
4. **Respect draft versus merge gates.** Complete author/reviewer checks and applicable bounded local validation before creating a draft commit or draft PR. Full hosted CI and final independent review on the exact final commit are required before merge.
