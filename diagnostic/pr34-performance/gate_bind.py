#!/usr/bin/python3
"""PR34 Performance Direction diagnostic: fixed source/control/tool/build binding, read-only database probe, verdict and evidence collection. Python standard library only.

PROPOSED (PR34 Zod 4.6.6 focused 725-case compatibility diagnostic on source 1a2ea5fe, derived from the executed Performance diagnostic binder of control dd2725c0 on source 568590e5, itself derived from the PR33 gate-diagnostic003 binder; this new proposal is unrun), NOT RUN, NOT PARSED, NOT SYNTAX-CHECKED by its author. Hosted ubuntu-24.04
only. Subcommands: pre | dbprobe | bind-build | precheck | post | validate | collect.
There are NO other arguments, options or environment-selected paths: every path, hash and identity below is a literal. GITHUB_SHA identifies the
diagnostic CONTROL commit and is recorded SEPARATELY from the tested SOURCE commit; it is never treated as the product head, and this file does not
reuse the required workflow's PR/merge identity acceptance. The job's final gate is a separate outcome-only workflow step; nothing here runs after the upload.
The only use of the runner-provided GITHUB_OUTPUT channel is `collect` publishing the fixed boolean `upload_ready=true`, and only after it has verified
ownership of the capture root and exclusively created the fresh upload directory; the upload step is conditioned on exactly that output.
The test outcome and the evidence completeness are reported SEPARATELY: `validate` exits 0 exactly when the retained evidence is complete, whatever the
case results were; the workflow's final gate additionally requires the real test step to have succeeded, so a failing case keeps the job red.
PROPOSAL002 (R1-R3 of the independent review): bind-build FAILS CLOSED before the test unless the freshly measured dist has the pinned 213-path membership (its full content digest is measured and retained, not pinned); the verbose
reporter's stdout (case records, final totals) and stderr (failure banners, FAIL references, diagnostic groups, dividers) are parsed separately; the 725 case names are an exact
bijection (file + " > " + relative name from the reviewed DATA; parameterized (.each) titles are the statically EXPECTED primitive %s renderings and an unexpected rendering makes the evidence incomplete, never a fabricated pass).
PROPOSAL003 (Zod 4.6.6 focused cohort): (1) eleven whole files / 725 identities, both the case records and the final `Test Files` / `Tests` summary rows are reconciled; (2) the installed node_modules/zod tree is measured before the build and
again after the test (version, locked integrity literals, bounded complete member size/hash/mode, owner) and must be equal; (3) stderr is classified, never blanket-suppressed: lines before the first failure banner are retained and counted as console output,
anything inside a failure section that is not part of an exact reference group is recorded as stray and refuses the evidence. The guard, launcher, caps, 300+20 ceiling and every other binding are unchanged from the executed Performance diagnostic.
REVISION002 (four review findings, binder only): R1 the selected parity file really runs the P33 case, so exactly one nonce case directory with its three records is validated (p33_case_evidence) instead of forbidden, and its
reaped pids join the post-ps absence check; R2 the pre-banner stderr classifier admits only known headers, five exact raw `unzip` lines and one complete five-line central-directory block under this run's capture TMPDIR (a header
grants no permission to later text); R3 the installed-Zod equality now includes every directory path/mode and the root mode/owner; R4 the 5,000-descendant budget is one global counter enforced while enumerating.
All expectations about test output are source-derived EXPECTATIONS, not runtime observations.
"""
import hashlib
import json
import os
import re
import shutil
import stat
import subprocess
import sys
import time
from pathlib import Path

SOURCE_SHA = "1a2ea5feba7c60ace55b6222d25fc946d55b0f52"
SOURCE_PARENT = "568590e537e221c44c8cb40614d82856821fadf6"
SOURCE_TREE = "8eaa142d2c4133a8327ac7273ab4568171ae47c1"
INVENTORY_SHA256 = "66801b6495d61dd18c4dce90c3f53086d3886d35a35095f47b4dd06c05b723f1"
EXPECTED_FILES = 360
PKG_SHA256 = "c7d11d0d7ea9d5691511c17e022b8f8d11f426070aafb22fb131bf0ccf784a1f"
LOCK_SHA256 = "2586ead4f2d636846c692f1f7a14426bbee8222eab29da4365f74c2832c942f7"
CI_REL = ".github/workflows/ci.yml"
CI_SHA256 = "8ada7fc271e4a1bc05980202775697f51e682f53079924903490b576c82803d4"
CI_BLOB = "5e087d1afe6df649575113c24d27140850e2da47"
NODE_VERSION = "24.21.0"
NPM_VERSION = "11.19.0"
VITEST_VERSION = "4.1.12"
# The installed Zod identity (measured before the build and after the test; see measure_zod): the exact reviewed lock literals and bounded traversal limits.
ZOD_VERSION = "4.6.6"
ZOD_RESOLVED = "https://registry.npmjs.org/zod/-/zod-4.6.6.tgz"
ZOD_INTEGRITY = "sha512-4UmzQUF5fxvfcYHlbjBmejU+w+hbDnWFx4aS8kBx7nPBHcO2SqPbpAG8snbdg+Xse4pRefR98hgjFgIMCI/UhA=="
ZOD_MAX_ENTRIES = 5000          # files plus directories under node_modules/zod
ZOD_MAX_DEPTH = 12
ZOD_MAX_FILE = 8 * 1024 * 1024
ZOD_MAX_TOTAL = 64 * 1024 * 1024
# The eleven selected test files in Vitest argv order: path -> (bytes, sha256, git blob). They are also members of the 360-row inventory.
GATE_FILES = (
    'test/config-logging.test.ts',
    'test/fixture-loader.test.ts',
    'test/fingerprints.test.ts',
    'test/fixture-conformance.test.ts',
    'test/unit/planner-fixture-input.test.ts',
    'test/unit/performance-direction-plan.test.ts',
    'test/integration/performance-direction.test.ts',
    'test/unit/fixture-pack-extraction-parity.test.ts',
    'test/a1-dependency-chain.test.ts',
    'test/p1-program-attempt-preflight.test.ts',
    'test/integration/p1-program-attempt-entry.test.ts',
)
GATE_PINS = {
    'test/config-logging.test.ts': (4839, '8a9defe6b6f179baefe98ae7ecacc12498cab0c3ea5a6cb7dba733df93a3697d', 'ce53e9392e6b61812722f235e19a0f2d34864b54'),
    'test/fixture-loader.test.ts': (16645, '58a96d8b3e5c9c3cefc328e5e8b2a730df12ffb8aae55f73651354f1c2086158', 'c65826f8f94b5593eaffe2607450b45066f9fc38'),
    'test/fingerprints.test.ts': (1933, '058d82ade1449e01f3399f4560f0fbd96948ecc01b479fed8dde4296e075493f', 'a59d00e746fdaf4c6530877e5e9344aa067f9ac9'),
    'test/fixture-conformance.test.ts': (3236, '8b34a65791aba739dda093015b7fa66d4483e184ce8fa700c64eab500e159bba', '2657e3953ff6f401d531a3a3a241b6fa7c7ed7cb'),
    'test/unit/planner-fixture-input.test.ts': (395840, 'b901f2b7f44c1d51b16513fe5ab63f8827c705d949511b246dfa49e47876940c', '4ae6e2014185dbab2bba46fb21884140d40297a3'),
    'test/unit/performance-direction-plan.test.ts': (138472, '7f4c8ddd17ca5c7dda0ab9db548da9dd48223f2b43591867d36028a9a975372b', '2c141b27870b8faf81cfbbd74e6293344bc12083'),
    'test/integration/performance-direction.test.ts': (24776, 'a7f815939c73a2f44cc88a712767a0853dc1713ab20104b31ac3ddac700c64cf', '922511caf790285936571c5c9d7a95587902c113'),
    'test/unit/fixture-pack-extraction-parity.test.ts': (61008, '45f5202f0a251352f99d31c87c215a233115d6b9a81ebffe73a9e4b05d24e34a', 'a8e268764b91dd1e7446960a3abc266c41a8d51f'),
    'test/a1-dependency-chain.test.ts': (38530, '1173339197bb87c5e8e9b42f77663d1eb6253177de3e9c5b4441d7ddf61735cc', 'ec83972f5637e658a76e8cd6bfbcec647f21b6cd'),
    'test/p1-program-attempt-preflight.test.ts': (6803, '607cf71515594ae133adf1044674cf7b207fb042c6b676956bba2389a4431d2f', 'a84d8e5470e19289389b3383bd72c17af6342e6d'),
    'test/integration/p1-program-attempt-entry.test.ts': (26423, 'b7bd919e1af72ba984f7f2f296a1ea3615e1ccf00df7fe9a9ce2be7538a8bf77', '8ee8bf8778c41b72f94d32fe6da6930a2da86385'),
}
CASE_COUNTS = (7, 19, 2, 5, 178, 20, 5, 432, 15, 21, 21)
CASE_TOTAL = 725
# Case identities: the complete 725-name ledger, NORMATIVE (reviewed DATA expected-expanded-725.json, SHA-256 de5ad752f91f56ea1da45f9d58db6e13b371e12970eb3fbca0626b2707fd5ec0; nothing was executed).
# Each full name is exactly "<file> > <describe titles> > <case title>", the form in which the verbose reporter joins them; IDENTITIES lists only the part after "<file> > ".
# Parameterized (.each) titles are the statically expected primitive %s renderings; an observed record must equal one of the 725 names exactly and every name must occur exactly once: a bijection.
IDENTITIES = {
    'test/config-logging.test.ts': (
        'environment and security foundation > validates optional provider observation bounds without enabling providers',
        'environment and security foundation > requires explicit identity and separate database credentials',
        'environment and security foundation > denies destructive production operations',
        'environment and security foundation > restricts the fixture load to development and test',
        'environment and security foundation > redacts protected logging fields',
        'runtime and migration configuration separation > starts health with runtime credentials alone',
        'runtime and migration configuration separation > requires a real full deployed commit in staging/production',
    ),
    'test/fixture-loader.test.ts': (
        'pack integrity (D3: existing unzip tooling, pinned and bounded) > opens the real pack: 133 members plus PACK_MEMBERS, hashes pinned externally',
        'pack integrity (D3: existing unzip tooling, pinned and bounded) > rejects a wrong ZIP hash, a wrong PACK_MEMBERS pin and a tampered member',
        'pack integrity (D3: existing unzip tooling, pinned and bounded) > rejects a missing member, an extra member, duplicate entries and unsafe names',
        'pack integrity (D3: existing unzip tooling, pinned and bounded) > requires exactly one active load',
        'pack integrity (D3: existing unzip tooling, pinned and bounded) > archival members are hashed for integrity but never parsed, exposed or loaded as rows',
        'active-load shape (Trace v0.5.5 section 10) > parses 398 rows in 40 families, 36 artifacts = 35 current + 1 historical, zero claim events',
        'active-load shape (Trace v0.5.5 section 10) > rejects a missing family, a wrong count, a non-v4 key, an unknown or missing column and a duplicate key',
        'active-load shape (Trace v0.5.5 section 10) > rejects a claim event even when the pinned counts are changed to match',
        'active-load shape (Trace v0.5.5 section 10) > a renamed historical artifact breaks the 35 + 1 split',
        'pre-insertion verification with the accepted A1 modules > accepts the real fixture; identical semantic anchors in the three script versions are legitimate (scoped per script)',
        'pre-insertion verification with the accepted A1 modules > rejects a tampered claim hash, a shipped-copy mismatch, a tampered WAV and a wrong stage fingerprint',
        'pre-insertion verification with the accepted A1 modules > rejects A1-profile violations that survive consistent re-hashing of the pack (retention_class exposed to the writer)',
        'pre-insertion verification with the accepted A1 modules > rejects canonically-duplicate semantic anchors inside one script version (NFC/NFD spellings)',
        'pre-insertion verification with the accepted A1 modules > historical disposition: pinned identity only, null with its disposition, never accepted as current',
        'pre-insertion verification with the accepted A1 modules > the verified snapshot is deep-frozen and digest-checked; verification cannot be bypassed by a caller report',
        'pre-insertion verification with the accepted A1 modules > FixtureIntegrityError carries a stable code',
        'insertion planning (pure, derived from the declared foreign-key graph) > orders all 398 rows so every foreign-key parent (composite targets included) precedes its child',
        'insertion planning (pure, derived from the declared foreign-key graph) > resolves the reroll cycle by row and honours the trigger-level dependencies',
        'insertion planning (pure, derived from the declared foreign-key graph) > rejects dangling references, references to unloaded tables and dependency cycles',
    ),
    'test/fingerprints.test.ts': (
        "exact stage projections > rejects missing, extra and another stage's fields for all six locked projections",
        'exact stage projections > validates the exact nested assembly lineage and hash types',
    ),
    'test/fixture-conformance.test.ts': (
        'Frozen Fixture v0.4.6 through the production loader > reproduces all six stage fingerprints from the shipped projections',
        'Frozen Fixture v0.4.6 through the production loader > validates Unicode serialization and code-point span vectors',
        'Frozen Fixture v0.4.6 through the production loader > binds the ten active policy sources to the exact locked bytes and the shipped copies',
        'Frozen Fixture v0.4.6 through the production loader > reproduces every audio artifact hash from the shipped WAV members',
        'Frozen Fixture v0.4.6 through the production loader > checks READY lineage identity without executing workflow',
    ),
    'test/unit/planner-fixture-input.test.ts': (
        'ROOT28 exact catalog projection without PC2 wiring > unexpected_failure projects only its declared code and stopped_code in an existing workflow',
        'ROOT28 exact catalog projection without PC2 wiring > input_resource_limit projects only its declared code and stopped_code in an existing workflow',
        'ROOT28 exact catalog projection without PC2 wiring > neighbor unexpected_failure_private remains omitted and unknown without private fields',
        'ROOT28 exact catalog projection without PC2 wiring > neighbor input_resource_limit_private remains omitted and unknown without private fields',
        'PC2 constructive source and competing-defect controls > uses the real default pinned reader and preserves full source literal bindings',
        'PC2 constructive source and competing-defect controls > Q3 compact preserves the independently calculated DATA and first refusal',
        'PC2 constructive source and competing-defect controls > Q3 body_null preserves the independently calculated DATA and first refusal',
        'PC2 constructive source and competing-defect controls > Q3 duplicate_and_null preserves the independently calculated DATA and first refusal',
        'PC2 constructive source and competing-defect controls > Q3 bad_id_and_null preserves the independently calculated DATA and first refusal',
        'PC2 constructive source and competing-defect controls > Q3 missing9_and_null3 preserves the independently calculated DATA and first refusal',
        'PC2 constructive source and competing-defect controls > Q3 superseded9_and_null3 preserves the independently calculated DATA and first refusal',
        'PC2 constructive source and competing-defect controls > Q3 superseded9 preserves the independently calculated DATA and first refusal',
        'PC2 constructive source and competing-defect controls > Q3 deleted_body_and_columns preserves the independently calculated DATA and first refusal',
        'PC2 constructive source and competing-defect controls > Q3 columns_control preserves the independently calculated DATA and first refusal',
        'PC2 constructive source and competing-defect controls > Q3 uninspectable_and_null preserves the independently calculated DATA and first refusal',
        'PC2 constructive source and competing-defect controls > Q3 superseded9_and_bodytype3 preserves the independently calculated DATA and first refusal',
        'PC2 constructive source and competing-defect controls > Q3 bodytype_control preserves the independently calculated DATA and first refusal',
        'PC2 constructive source and competing-defect controls > rights coverage has an independent byte witness and ordered repair',
        'PC2 constructive source and competing-defect controls > rights acquisition has an independent byte witness and ordered repair',
        'PC2 constructive source and competing-defect controls > rights planner_ceiling has an independent byte witness and ordered repair',
        'PC2 constructive source and competing-defect controls > rights paraphrase has an independent byte witness and ordered repair',
        'PC2 constructive source and competing-defect controls > rights retention has an independent byte witness and ordered repair',
        'PC2 constructive source and competing-defect controls > rights external has an independent byte witness and ordered repair',
        'PC2 constructive source and competing-defect controls > rights body_null_and_acquisition has an independent byte witness and ordered repair',
        'PC2 constructive source and competing-defect controls > rights coverage_and_ceiling has an independent byte witness and ordered repair',
        'PC2 constructive source and competing-defect controls > configuration publish closes source/row/hash and stage order',
        'PC2 constructive source and competing-defect controls > configuration review closes source/row/hash and stage order',
        'PC2 constructive source and competing-defect controls > configuration config_version closes source/row/hash and stage order',
        'PC2 constructive source and competing-defect controls > configuration config_extra closes source/row/hash and stage order',
        'PC2 constructive source and competing-defect controls > configuration config_name closes source/row/hash and stage order',
        'PC2 constructive source and competing-defect controls > configuration config_mode closes source/row/hash and stage order',
        'PC2 constructive source and competing-defect controls > configuration config_extra_and_publish closes source/row/hash and stage order',
        'PC2 constructive source and competing-defect controls > configuration external_and_publish closes source/row/hash and stage order',
        'PC2 constructive source and competing-defect controls > unchanged parent row-parser owns rows_shape',
        'PC2 constructive source and competing-defect controls > unchanged parent row-parser owns family_set',
        'PC2 constructive source and competing-defect controls > unchanged parent row-parser owns family_count',
        'PC2 constructive source and competing-defect controls > unchanged parent row-parser owns row_columns',
        'PC2 constructive source and competing-defect controls > unchanged parent row-parser owns primary_key',
        'PC2 constructive source and competing-defect controls > unchanged parent row-parser owns duplicate_primary',
        'PC2 constructive source and competing-defect controls > raw oversize precedence/pin',
        'PC2 constructive source and competing-defect controls > raw json precedence/pin',
        'PC2 constructive source and competing-defect controls > raw long_string precedence/pin',
        'PC2 constructive source and competing-defect controls > raw unicode precedence/pin',
        'PC2 constructive source and competing-defect controls > raw whitespace precedence/pin',
        'PC2 constructive source and competing-defect controls > source aliases remain unmodified and opaque rejection data is deeply owned',
        'accepted ROOT amendment06 exact specimens and every repair > old full-row extra, publication=false, retains exact recipes and complete repair chain',
        'accepted ROOT amendment06 exact specimens and every repair > old full-row extra, publication=true, retains exact recipes and complete repair chain',
        'accepted ROOT amendment06 exact specimens and every repair > new member-only extra, publication=false, discriminates Q5 surface and every repair',
        'accepted ROOT amendment06 exact specimens and every repair > new member-only extra, publication=true, discriminates Q5 surface and every repair',
        'remaining original02H and review10/11 boundary controls > original non-JSON anchor and complete repair',
        'remaining original02H and review10/11 boundary controls > original non-JSON archive and complete repair',
        'remaining original02H and review10/11 boundary controls > original non-JSON role and complete repair',
        'remaining original02H and review10/11 boundary controls > original non-JSON zip_too_large and complete repair',
        'remaining original02H and review10/11 boundary controls > original non-JSON unknown_parent and complete repair',
        'remaining original02H and review10/11 boundary controls > original non-JSON zod and complete repair',
        'remaining original02H and review10/11 boundary controls > original non-JSON member_type and complete repair',
        'remaining original02H and review10/11 boundary controls > original necessary body_deleted and raw restoration',
        'remaining original02H and review10/11 boundary controls > original necessary body_superseded and raw restoration',
        'remaining original02H and review10/11 boundary controls > original returned view_unknown_key and actual unmocked repair',
        'remaining original02H and review10/11 boundary controls > original returned claim_type and actual unmocked repair',
        'remaining original02H and review10/11 boundary controls > original returned silent_promotion and actual unmocked repair',
        'remaining original02H and review10/11 boundary controls > original returned registry_target and actual unmocked repair',
        'remaining original02H and review10/11 boundary controls > original returned registry_evidence and actual unmocked repair',
        'remaining original02H and review10/11 boundary controls > original returned registry_rights and actual unmocked repair',
        'remaining original02H and review10/11 boundary controls > original returned canonical_mismatch and actual unmocked repair',
        'remaining original02H and review10/11 boundary controls > original returned old_identity_as_domain and actual unmocked repair',
        'remaining original02H and review10/11 boundary controls > source depth32 boundary retains coarse source diagnostics',
        'remaining original02H and review10/11 boundary controls > source depth33 boundary retains coarse source diagnostics',
        'remaining original02H and review10/11 boundary controls > source array4096 cap and deliberately smaller config array surface',
        'remaining original02H and review10/11 boundary controls > source array4097 cap and deliberately smaller config array surface',
        'remaining original02H and review10/11 boundary controls > source graph nodes65536 inclusive/control',
        'remaining original02H and review10/11 boundary controls > source graph nodes65537 inclusive/control',
        'remaining original02H and review10/11 boundary controls > ordinary S length repair admits source graph before unsupported configuration version',
        'remaining original02H and review10/11 boundary controls > structural graph budget precedes a later tag defect and never gets an own accessor',
        'remaining original02H and review10/11 boundary controls > source bytes are privately copied before later member mutation; own length getter is never acquired',
        'remaining original02H and review10/11 boundary controls > constructor direct has independently specified five descriptors for every phase/invalid invocation',
        'remaining original02H and review10/11 boundary controls > constructor reflect has independently specified five descriptors for every phase/invalid invocation',
        'RESOURCE17/18 independent candidate arithmetic, repairs and finalization fence > RESOURCE17 independently pins logical DATA and the complete repaired control',
        'RESOURCE17/18 independent candidate arithmetic, repairs and finalization fence > RESOURCE18 independently pins logical DATA and the complete repaired control',
        'RESOURCE17/18 independent candidate arithmetic, repairs and finalization fence > positive ownership is per occurrence, not only a frozen top-level object',
        'renewal23 source18 admission and complete repairs > original oversize_and_utf8 removes leading x before UTF8 and complete RAW restoration',
        'renewal23 source18 admission and complete repairs > selected source3 policy_null uses independent DATA before helpers/hash',
        'renewal23 source18 admission and complete repairs > selected source3 policy_scalar uses independent DATA before helpers/hash',
        'renewal23 source18 admission and complete repairs > selected source3 policies_null uses independent DATA before helpers/hash',
        'renewal23 source18 admission and complete repairs > selected source3 policy_entry_scalar uses independent DATA before helpers/hash',
        'renewal23 source18 admission and complete repairs > selected source3 policy_digest_scalar uses independent DATA before helpers/hash',
        'renewal23 source18 admission and complete repairs > selected source2 support_null uses independent DATA before helpers/hash',
        'renewal23 source18 admission and complete repairs > selected source2 wrapper_missing uses independent DATA before helpers/hash',
        'renewal23 source18 admission and complete repairs > selected source2 wrapper_extra uses independent DATA before helpers/hash',
        'renewal23 source18 admission and complete repairs > selected source2 carrier_unresolved uses independent DATA before helpers/hash',
        'renewal23 source18 admission and complete repairs > selected source2 artifacts_object uses independent DATA before helpers/hash',
        'renewal23 source18 admission and complete repairs > selected source2 derivation_scalar uses independent DATA before helpers/hash',
        'renewal23 source18 admission and complete repairs > selected source2 carrier_null uses independent DATA before helpers/hash',
        'renewal23 source18 admission and complete repairs > selected source2 carrier_payload_scalar uses independent DATA before helpers/hash',
        'renewal23 source18 admission and complete repairs > selected source2 carrier_confidence_scalar uses independent DATA before helpers/hash',
        'renewal23 source18 admission and complete repairs > earlier necessary precedes both malformed wrappers through each RAW repair',
        'renewal23 source18 admission and complete repairs > earlier row_columns precedes both malformed wrappers through each RAW repair',
        'renewal23 source18 admission and complete repairs > aligned invalid carrier payload must be admitted before its domain helper',
        'renewal23 source18 admission and complete repairs > carrier structure precedes a primitive-string invalid derivation UUID through repairs',
        'renewal17 independently declared priority and repair controls > missing profile precedes a symbol extra; each repair stays in the declared diagnostic language',
        'renewal17 independently declared priority and repair controls > every present extra scoreline support resolves at a compiled leaf before the narrow empty-array rule',
        'renewal17 independently declared priority and repair controls > known repeated profiles check index2 then index10 versions before finite cardinality binding',
        'renewal17 independently declared priority and repair controls > unsigned observation 00 is rejected lexically without coercion, then repaired',
        'renewal17 independently declared priority and repair controls > unsigned observation 01 is rejected lexically without coercion, then repaired',
        'renewal17 independently declared priority and repair controls > unsigned observation +1 is rejected lexically without coercion, then repaired',
        'renewal17 independently declared priority and repair controls > unsigned observation -0 is rejected lexically without coercion, then repaired',
        'renewal17 independently declared priority and repair controls > unsigned observation 1.0 is rejected lexically without coercion, then repaired',
        'renewal17 independently declared priority and repair controls > unsigned observation 1e0 is rejected lexically without coercion, then repaired',
        'renewal17 independently declared priority and repair controls > unsigned observation 2097153 is rejected lexically without coercion, then repaired',
        'renewal17 independently declared priority and repair controls > unsigned observation 10000000 is rejected lexically without coercion, then repaired',
        'renewal17 independently declared priority and repair controls > unsigned observation 99999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999 is rejected lexically without coercion, then repaired',
        'renewal17 independently declared priority and repair controls > inclusive lexical observation 0 reaches its observation binding, then repaired',
        'renewal17 independently declared priority and repair controls > inclusive lexical observation 2097152 reaches its observation binding, then repaired',
        'renewal17 independently declared priority and repair controls > union-prefix admission stops before a late locator probe or later tag/getter defect',
        'renewal17 independently declared priority and repair controls > actual positive finalization observe delegates or fails only at sanitized phase8',
        'renewal17 independently declared priority and repair controls > actual positive finalization copy delegates or fails only at sanitized phase8',
        'renewal17 independently declared priority and repair controls > actual positive finalization canonical delegates or fails only at sanitized phase8',
        'renewal17 independently declared priority and repair controls > actual positive finalization hash delegates or fails only at sanitized phase8',
        'PC2 fixed fixture DATA boundary > matches complete independently specified P, M, registry, source meanings and raw identity',
        'PC2 fixed fixture DATA boundary > rejects arguments before I/O',
        'PC2 fixed fixture DATA boundary > does not acquire parent kind through a getter, or array elements through getters',
        'PC2 fixed fixture DATA boundary > sanitizes unexpected member/copy/digest faults at phase2, open faults at1',
        'PC2 fixed fixture DATA boundary > handles malformed/null returns without property access',
        'PC2 fixed fixture DATA boundary > tag_unknown_hash_type discriminates tag/common-surface/hash priorities',
        'PC2 fixed fixture DATA boundary > tag_unknown_hash_lex discriminates tag/common-surface/hash priorities',
        'PC2 fixed fixture DATA boundary > tag_known_hash_lex discriminates tag/common-surface/hash priorities',
        'PC2 fixed fixture DATA boundary > tag_unknown_missingid discriminates tag/common-surface/hash priorities',
        'PC2 fixed fixture DATA boundary > checks returned registered planner permission before budget',
        'PC2 fixed fixture DATA boundary > checks returned registered quote permission before budget',
        'PC2 fixed fixture DATA boundary > projects only SAFE parent profile_duplicate package.manifest.context_candidates[0].context_id',
        'PC2 fixed fixture DATA boundary > projects only SAFE parent profile_duplicate package.manifest.contexts[0].context_id',
        'PC2 fixed fixture DATA boundary > projects only SAFE parent profile_binding_mismatch material.claim_bases[0].subject',
        'PC2 fixed fixture DATA boundary > projects only SAFE parent profile_binding_mismatch material.claim_bases[0].subject.unknown',
        'PC2 fixed fixture DATA boundary > all aggregate headers precede invalid JSON and UTF8, with repair',
        'PC2 fixed fixture DATA boundary > admits inclusive total source then fixed identity; excess 0 crosses source[8]',
        'PC2 fixed fixture DATA boundary > admits inclusive total source then fixed identity; excess 1 crosses source[8]',
        'PC2 fixed fixture DATA boundary > RESOURCE17 retains original local proofs and actual metadata',
        'PC2 fixed fixture DATA boundary > RESOURCE18 retains original local proofs and actual metadata',
        'PC2 fixed fixture DATA boundary > constructor owns exactly five frozen data descriptors, never coerces invalid arguments',
        'review09 correspondence and first-error discrimination > admits nested own header DATA before comparisons: pin_getter',
        'review09 correspondence and first-error discrimination > admits nested own header DATA before comparisons: name_getter',
        'review09 correspondence and first-error discrimination > admits nested own header DATA before comparisons: pin_primitive',
        'review09 correspondence and first-error discrimination > captures headers and the member callable before any member effect',
        'review09 correspondence and first-error discrimination > untagged descendant selection never calls an accessor',
        'review09 correspondence and first-error discrimination > malformed SAFE rejection is unexpected fault6: extra',
        'review09 correspondence and first-error discrimination > malformed SAFE rejection is unexpected fault6: symbol',
        'review09 correspondence and first-error discrimination > malformed SAFE rejection is unexpected fault6: accessor',
        'review09 correspondence and first-error discrimination > malformed SAFE rejection is unexpected fault6: unknown_code',
        'review09 correspondence and first-error discrimination > malformed SAFE rejection is unexpected fault6: unknown_parser',
        'review09 correspondence and first-error discrimination > malformed SAFE rejection is unexpected fault6: wrong_field_type',
        'review09 correspondence and first-error discrimination > legal descriptive member5 description is deferred to source identity8',
        'review09 correspondence and first-error discrimination > legal descriptive member8 job is deferred to source identity8',
        'review09 correspondence and first-error discrimination > legal descriptive member6 job is deferred to source identity8',
        'review09 correspondence and first-error discrimination > legal descriptive member6 source_migration is deferred to source identity8',
        'review09 correspondence and first-error discrimination > show-version category precedes name binding and has a reconciled source/config control',
        'review09 correspondence and first-error discrimination > present evidence_duplicate must resolve uniquely before registry content faults',
        'review09 correspondence and first-error discrimination > present evidence_unresolved must resolve uniquely before registry content faults',
        'review09 correspondence and first-error discrimination > present beat_duplicate must resolve uniquely before registry content faults',
        'review09 correspondence and first-error discrimination > present context_unresolved must resolve uniquely before registry content faults',
        'review09 correspondence and first-error discrimination > present signal_unresolved must resolve uniquely before registry content faults',
        'review09 correspondence and first-error discrimination > present continuity_unresolved must resolve uniquely before registry content faults',
        'review09 correspondence and first-error discrimination > present silent_unresolved must resolve uniquely before registry content faults',
        'review09 correspondence and first-error discrimination > silent source support relation is checked before registry content',
        'review09 correspondence and first-error discrimination > nonregistry evidence refs bind the exact captured relationship',
        'review09 correspondence and first-error discrimination > nonregistry permission rights_version_id precedes rights_policy_version and content hash',
        'review09 correspondence and first-error discrimination > nonregistry permission rights_policy_version precedes source_identity and content hash',
        'review09 correspondence and first-error discrimination > nonregistry permission source_identity precedes consumer_exposure.planner and content hash',
        'review09 correspondence and first-error discrimination > nonregistry permission consumer_exposure.planner precedes consumer_exposure.writer and content hash',
        'review09 correspondence and first-error discrimination > nonregistry permission consumer_exposure.writer precedes consumer_exposure.auditor and content hash',
        'review09 correspondence and first-error discrimination > nonregistry permission consumer_exposure.auditor precedes quote_permission and content hash',
        'review09 correspondence and first-error discrimination > nonregistry permission quote_permission precedes paraphrase_permission and content hash',
        'review09 correspondence and first-error discrimination > nonregistry permission paraphrase_permission precedes retention_class and content hash',
        'review09 correspondence and first-error discrimination > nonregistry permission retention_class precedes locator and content hash',
        'review09 correspondence and first-error discrimination > nonregistry status and remaining sorted snapshot fields retain declared priority',
        'review09 correspondence and first-error discrimination > original summaries bind captured derivation DATA, changed returned control=false',
        'review09 correspondence and first-error discrimination > original summaries bind captured derivation DATA, changed returned control=true',
        'review09 correspondence and first-error discrimination > nonregistry locator priority precedes status after valid permission fields',
        'review09 correspondence and first-error discrimination > value quantity semantics precede otherwise valid registry content defects',
    ),
    'test/unit/performance-direction-plan.test.ts': (
        'performance direction seam, Scope A: candidate grammar, owned reader and refusal, evaluators, classifier (unit) > PU01 forged_and_foreign_plans_and_acquisitions_refuse_before_io',
        'performance direction seam, Scope A: candidate grammar, owned reader and refusal, evaluators, classifier (unit) > PU02 admission_algebra_over_closed_enums_and_exported_h04_h13_witness',
        'performance direction seam, Scope A: candidate grammar, owned reader and refusal, evaluators, classifier (unit) > PU03 candidate_grammar_keys_and_types',
        'performance direction seam, Scope A: candidate grammar, owned reader and refusal, evaluators, classifier (unit) > PU04 candidate_vocabulary_and_supported_subset',
        'performance direction seam, Scope A: candidate grammar, owned reader and refusal, evaluators, classifier (unit) > PU05 candidate_scope_shape_and_binding_refusals',
        'performance direction seam, Scope A: candidate grammar, owned reader and refusal, evaluators, classifier (unit) > PU06 projection_hash_order_and_envelope_stability',
        'performance direction seam, Scope A: candidate grammar, owned reader and refusal, evaluators, classifier (unit) > PU07 fingerprints_domain_separation_and_historical_and_synthetic_literals',
        'performance direction seam, Scope A: candidate grammar, owned reader and refusal, evaluators, classifier (unit) > PU08 gate19_intent_ref_integrity_pure_door',
        'performance direction seam, Scope A: candidate grammar, owned reader and refusal, evaluators, classifier (unit) > PU09 gate20_script_binding_pure_door',
        'performance direction seam, Scope A: candidate grammar, owned reader and refusal, evaluators, classifier (unit) > PU10 gate21_mode_intent_allowed_pure_door',
        'performance direction seam, Scope A: candidate grammar, owned reader and refusal, evaluators, classifier (unit) > PU11 gate22_protected_nonverbal_pure_door',
        'performance direction seam, Scope A: candidate grammar, owned reader and refusal, evaluators, classifier (unit) > PU12 gate23_overlap_protected_span_pure_door',
        'performance direction seam, Scope A: candidate grammar, owned reader and refusal, evaluators, classifier (unit) > PU13 gate24_no_spoken_text_mutation_pure_door',
        'performance direction seam, Scope A: candidate grammar, owned reader and refusal, evaluators, classifier (unit) > PU14 gate25_no_provider_syntax_pure_door',
        'performance direction seam, Scope A: candidate grammar, owned reader and refusal, evaluators, classifier (unit) > PU15 result_profile_closure_ordering_and_denominators',
        'performance direction seam, Scope A: candidate grammar, owned reader and refusal, evaluators, classifier (unit) > PU16 aggregate_and_row_outcome_algebra_including_proof_gap_only_fail',
        'performance direction seam, Scope A: candidate grammar, owned reader and refusal, evaluators, classifier (unit) > PU17 supplied_snapshot_classification_examples_not_convergence',
        'performance direction seam, Scope A: candidate grammar, owned reader and refusal, evaluators, classifier (unit) > PU18 performance_reader_normal_path_order_and_failure_settlement_bounds',
        'performance direction seam, Scope A: candidate grammar, owned reader and refusal, evaluators, classifier (unit) > PU19 admission_refusals_through_the_scripted_reader_zero_effects',
        'performance direction seam, Scope A: candidate grammar, owned reader and refusal, evaluators, classifier (unit) > PU20 audit_boundary_and_pure_fingerprint_arithmetic_not_readiness',
    ),
    'test/integration/performance-direction.test.ts': (
        'performance direction fixed fixture seam, Scope A refusals (disposable PostgreSQL 17, runtime role) > PI01 upstream_incomplete_is_refused_with_zero_effects',
        'performance direction fixed fixture seam, Scope A refusals (disposable PostgreSQL 17, runtime role) > PI02 gate_absent_is_refused_with_zero_effects',
        'performance direction fixed fixture seam, Scope A refusals (disposable PostgreSQL 17, runtime role) > PI03 current_chain_gate_failed_is_refused_with_zero_effects',
        'performance direction fixed fixture seam, Scope A refusals (disposable PostgreSQL 17, runtime role) > PI04 repeated_refusal_is_idempotent_with_zero_effects',
        'performance direction fixed fixture seam, Scope A refusals (disposable PostgreSQL 17, runtime role) > PI05 historical_performance_rows_retained_and_untouched',
    ),
    'test/unit/fixture-pack-extraction-parity.test.ts': (
        'P01 all 134 independent primary members > PACK_MEMBERS.json',
        'P01 all 134 independent primary members > ARTIFACT_INVENTORY.json',
        'P01 all 134 independent primary members > README.md',
        'P01 all 134 independent primary members > SOURCE_PROVENANCE.json',
        'P01 all 134 independent primary members > archive/ARCHIVE_ONLY_85.json',
        'P01 all 134 independent primary members > archive/HISTORICAL_DIRECTION_10.json',
        'P01 all 134 independent primary members > archive/V2_ARCHIVED_283.json',
        'P01 all 134 independent primary members > archive/i2a_source/assembly_recipe.json',
        'P01 all 134 independent primary members > archive/i2a_source/audit_result.json',
        'P01 all 134 independent primary members > archive/i2a_source/config/show.json',
        'P01 all 134 independent primary members > archive/i2a_source/deferred_hash_fields.json',
        'P01 all 134 independent primary members > archive/i2a_source/evidence_package.json',
        'P01 all 134 independent primary members > archive/i2a_source/evidence_store.json',
        'P01 all 134 independent primary members > archive/i2a_source/foundation_rows.json',
        'P01 all 134 independent primary members > archive/i2a_source/master_assembly_map.json',
        'P01 all 134 independent primary members > archive/i2a_source/mechanical_validation.json',
        'P01 all 134 independent primary members > archive/i2a_source/performance_direction.json',
        'P01 all 134 independent primary members > archive/i2a_source/prompt_payloads.json',
        'P01 all 134 independent primary members > archive/i2a_source/pronunciations.json',
        'P01 all 134 independent primary members > archive/i2a_source/ready_expectations.json',
        'P01 all 134 independent primary members > archive/i2a_source/render_manifest.json',
        'P01 all 134 independent primary members > archive/i2a_source/revalidation_result.json',
        'P01 all 134 independent primary members > archive/i2a_source/revalidation_snapshot.json',
        'P01 all 134 independent primary members > archive/i2a_source/scenarios.json',
        'P01 all 134 independent primary members > archive/i2a_source/script_craft_revision.json',
        'P01 all 134 independent primary members > archive/i2a_source/script_pass1.json',
        'P01 all 134 independent primary members > archive/i2a_source/script_pass2.json',
        'P01 all 134 independent primary members > archive/i2a_source/showrunner_brief.json',
        'P01 all 134 independent primary members > archive/i2a_source/support_payloads.json',
        'P01 all 134 independent primary members > archive/i2a_source/voice_profiles.json',
        'P01 all 134 independent primary members > archive/i2a_source/writer_context_manifest.json',
        'P01 all 134 independent primary members > archive/i2a_source/writer_view.json',
        'P01 all 134 independent primary members > archive/i2a_source/writing_craft_review.json',
        'P01 all 134 independent primary members > assembly_recipe.json',
        'P01 all 134 independent primary members > audit_result.json',
        'P01 all 134 independent primary members > authority/01_ARCHITECTURE_AND_ADRS/The_Desk_ADR_003A_BUILD_1_2_READY_and_Repair_Attempt_Semantics.md',
        'P01 all 134 independent primary members > authority/02_ACTIVE_SPECS/The_Desk_Character_Bible_v0.1.4.md',
        'P01 all 134 independent primary members > authority/02_ACTIVE_SPECS/The_Desk_Claims_Policy_v0.1.2.md',
        'P01 all 134 independent primary members > authority/02_ACTIVE_SPECS/The_Desk_Evidence_Package_v0.2.2.md',
        'P01 all 134 independent primary members > authority/02_ACTIVE_SPECS/The_Desk_Operator_Repair_v0.1.1.md',
        'P01 all 134 independent primary members > authority/02_ACTIVE_SPECS/The_Desk_Performance_and_Render_v0.1.4.md',
        'P01 all 134 independent primary members > authority/02_ACTIVE_SPECS/The_Desk_Showrunner_Planning_v0.1.3.md',
        'P01 all 134 independent primary members > authority/02_ACTIVE_SPECS/The_Desk_Writing_Build_1-2_Fixture_Profile_Addendum_v0.1.md',
        'P01 all 134 independent primary members > authority/02_ACTIVE_SPECS/The_Desk_Writing_Craft_and_Invisible_Comprehension_v0.1.md',
        'P01 all 134 independent primary members > authority/02_ACTIVE_SPECS/The_Desk_Writing_Spec_v0.2.3.md',
        'P01 all 134 independent primary members > authority/04_IMPLEMENTATION/The_Desk_Hashing_Fingerprints_and_Text_Spans_v0.1.5.md',
        'P01 all 134 independent primary members > authority_resolution_conformance.json',
        'P01 all 134 independent primary members > base_request_hash_conformance.json',
        'P01 all 134 independent primary members > claim_event_conformance.json',
        'P01 all 134 independent primary members > config/block_types.json',
        'P01 all 134 independent primary members > config/enum_registries.json',
        'P01 all 134 independent primary members > config/episode_modes.json',
        'P01 all 134 independent primary members > config/participant_profiles.json',
        'P01 all 134 independent primary members > config/policy_versions.json',
        'P01 all 134 independent primary members > config/rundown_template_post_event_launch_v2.json',
        'P01 all 134 independent primary members > config/show_config_version.json',
        'P01 all 134 independent primary members > config/show_config_version_v1_history.json',
        'P01 all 134 independent primary members > conformance_cases.py',
        'P01 all 134 independent primary members > conformance_index.json',
        'P01 all 134 independent primary members > evidence_package.json',
        'P01 all 134 independent primary members > fixture_audio/master.wav',
        'P01 all 134 independent primary members > fixture_audio/rb01_take0.wav',
        'P01 all 134 independent primary members > fixture_audio/rb02_take0.wav',
        'P01 all 134 independent primary members > fixture_audio/rb03_take0.wav',
        'P01 all 134 independent primary members > fixture_audio/rb04_take0.wav',
        'P01 all 134 independent primary members > fixture_audio/rb05_take0.wav',
        'P01 all 134 independent primary members > fixture_audio/rb06_take0.wav',
        'P01 all 134 independent primary members > fixture_audio/rb06_take1.wav',
        'P01 all 134 independent primary members > fixture_audio/rb07_take0.wav',
        'P01 all 134 independent primary members > fixture_audio/rb08_take0.wav',
        'P01 all 134 independent primary members > fixture_audio/rb09_take0.wav',
        'P01 all 134 independent primary members > fixture_audio/sting.wav',
        'P01 all 134 independent primary members > fixture_model_requests.json',
        'P01 all 134 independent primary members > fixture_persistence_conformance.json',
        'P01 all 134 independent primary members > foundation_rows_398.json',
        'P01 all 134 independent primary members > gate_fingerprint_inputs.json',
        'P01 all 134 independent primary members > master_assembly_map.json',
        'P01 all 134 independent primary members > mechanical_validation.json',
        'P01 all 134 independent primary members > model_semantic_input_conformance.json',
        'P01 all 134 independent primary members > performance_direction.json',
        'P01 all 134 independent primary members > performance_direction_corrected.json',
        'P01 all 134 independent primary members > persistence_expectations.json',
        'P01 all 134 independent primary members > prompt_manifest_conformance.json',
        'P01 all 134 independent primary members > prompt_payloads.json',
        'P01 all 134 independent primary members > provenance/BUILD330_RESULTS.json',
        'P01 all 134 independent primary members > provenance/CONFIG330_DISPOSITION_TABLE.json',
        'P01 all 134 independent primary members > provenance/CONFIG330_IDENTITY_TABLE.json',
        'P01 all 134 independent primary members > provenance/DEFERRED_RUNTIME_GAP.md',
        'P01 all 134 independent primary members > provenance/FAMILY_TOTALS.json',
        'P01 all 134 independent primary members > provenance/FIXTURE_AUDIT_REPORT.json',
        'P01 all 134 independent primary members > provenance/OBLIGATION_RECONCILIATION.json',
        'P01 all 134 independent primary members > provenance/PREEXEC_VERIFICATION.json',
        'P01 all 134 independent primary members > provenance/REJECTED_V3_DENYLIST.json',
        'P01 all 134 independent primary members > provenance/RUNTIME_BUDGET_RESOLUTION.md',
        'P01 all 134 independent primary members > provenance/SUCCESSOR_IDENTITY_REGISTRY.json',
        'P01 all 134 independent primary members > provenance/captured/model_semantic_inputs.json',
        'P01 all 134 independent primary members > provenance/captured/render_context_projections.json',
        'P01 all 134 independent primary members > provenance/captured/scope_projection.bytes',
        'P01 all 134 independent primary members > provenance/captured/writer_data_input.bytes',
        'P01 all 134 independent primary members > provenance/correction_provenance.json',
        'P01 all 134 independent primary members > provenance/frozen/correction_input_projection.json',
        'P01 all 134 independent primary members > provenance/frozen/i2b_v2/correction_input_projection_v1.json',
        'P01 all 134 independent primary members > provenance/frozen/i2b_v2/technical_resolution_record_v1.md',
        'P01 all 134 independent primary members > provenance/frozen/technical_resolution_record_v2.md',
        'P01 all 134 independent primary members > provenance/history/RUNTIME_BUDGET_FINDING_i2c_r2.md',
        'P01 all 134 independent primary members > provenance/i2b_v2/PHASE3_RESULTS_i2b_v2.json',
        'P01 all 134 independent primary members > provenance/i2b_v2/PREEXEC_VERIFICATION_i2b_v2.json',
        'P01 all 134 independent primary members > provenance/i2b_v2/correction_provenance_i2b_v2.json',
        'P01 all 134 independent primary members > provenance/i2b_v2/retention_repair_provenance_i2b_v2.json',
        'P01 all 134 independent primary members > provenance/predecessor/config/voice_profile_versions.json',
        'P01 all 134 independent primary members > provenance/predecessor/render_request_projections.json',
        'P01 all 134 independent primary members > provenance/predecessor/script_craft_revision.json',
        'P01 all 134 independent primary members > provenance/predecessor/script_pass1.json',
        'P01 all 134 independent primary members > provenance/predecessor/script_pass2.json',
        'P01 all 134 independent primary members > provenance/predecessor_v0.4.4_pins.json',
        'P01 all 134 independent primary members > provenance/uuid_correspondence_composed_330.tsv',
        'P01 all 134 independent primary members > provenance/uuid_correspondence_handoff_transcription_v2.tsv',
        'P01 all 134 independent primary members > provenance/v0.4.6/IDENTITY_TRANSITION.json',
        'P01 all 134 independent primary members > ready_expectations.json',
        'P01 all 134 independent primary members > render_manifest.json',
        'P01 all 134 independent primary members > render_request_projections.json',
        'P01 all 134 independent primary members > revalidation_result.json',
        'P01 all 134 independent primary members > revalidation_snapshot.json',
        'P01 all 134 independent primary members > scenarios.json',
        'P01 all 134 independent primary members > script_craft_revision.json',
        'P01 all 134 independent primary members > script_pass1.json',
        'P01 all 134 independent primary members > script_pass2.json',
        'P01 all 134 independent primary members > showrunner_brief.json',
        'P01 all 134 independent primary members > support_payloads.json',
        'P01 all 134 independent primary members > unicode_conformance.json',
        'P01 all 134 independent primary members > validate_fixture.py',
        'P01 all 134 independent primary members > writer_context_manifest.json',
        'P01 all 134 independent primary members > writer_view.json',
        'P01 all 134 independent primary members > writing_craft_review.json',
        'P02 sentinel for all independent members > PACK_MEMBERS.json',
        'P02 sentinel for all independent members > ARTIFACT_INVENTORY.json',
        'P02 sentinel for all independent members > README.md',
        'P02 sentinel for all independent members > SOURCE_PROVENANCE.json',
        'P02 sentinel for all independent members > archive/ARCHIVE_ONLY_85.json',
        'P02 sentinel for all independent members > archive/HISTORICAL_DIRECTION_10.json',
        'P02 sentinel for all independent members > archive/V2_ARCHIVED_283.json',
        'P02 sentinel for all independent members > archive/i2a_source/assembly_recipe.json',
        'P02 sentinel for all independent members > archive/i2a_source/audit_result.json',
        'P02 sentinel for all independent members > archive/i2a_source/config/show.json',
        'P02 sentinel for all independent members > archive/i2a_source/deferred_hash_fields.json',
        'P02 sentinel for all independent members > archive/i2a_source/evidence_package.json',
        'P02 sentinel for all independent members > archive/i2a_source/evidence_store.json',
        'P02 sentinel for all independent members > archive/i2a_source/foundation_rows.json',
        'P02 sentinel for all independent members > archive/i2a_source/master_assembly_map.json',
        'P02 sentinel for all independent members > archive/i2a_source/mechanical_validation.json',
        'P02 sentinel for all independent members > archive/i2a_source/performance_direction.json',
        'P02 sentinel for all independent members > archive/i2a_source/prompt_payloads.json',
        'P02 sentinel for all independent members > archive/i2a_source/pronunciations.json',
        'P02 sentinel for all independent members > archive/i2a_source/ready_expectations.json',
        'P02 sentinel for all independent members > archive/i2a_source/render_manifest.json',
        'P02 sentinel for all independent members > archive/i2a_source/revalidation_result.json',
        'P02 sentinel for all independent members > archive/i2a_source/revalidation_snapshot.json',
        'P02 sentinel for all independent members > archive/i2a_source/scenarios.json',
        'P02 sentinel for all independent members > archive/i2a_source/script_craft_revision.json',
        'P02 sentinel for all independent members > archive/i2a_source/script_pass1.json',
        'P02 sentinel for all independent members > archive/i2a_source/script_pass2.json',
        'P02 sentinel for all independent members > archive/i2a_source/showrunner_brief.json',
        'P02 sentinel for all independent members > archive/i2a_source/support_payloads.json',
        'P02 sentinel for all independent members > archive/i2a_source/voice_profiles.json',
        'P02 sentinel for all independent members > archive/i2a_source/writer_context_manifest.json',
        'P02 sentinel for all independent members > archive/i2a_source/writer_view.json',
        'P02 sentinel for all independent members > archive/i2a_source/writing_craft_review.json',
        'P02 sentinel for all independent members > assembly_recipe.json',
        'P02 sentinel for all independent members > audit_result.json',
        'P02 sentinel for all independent members > authority/01_ARCHITECTURE_AND_ADRS/The_Desk_ADR_003A_BUILD_1_2_READY_and_Repair_Attempt_Semantics.md',
        'P02 sentinel for all independent members > authority/02_ACTIVE_SPECS/The_Desk_Character_Bible_v0.1.4.md',
        'P02 sentinel for all independent members > authority/02_ACTIVE_SPECS/The_Desk_Claims_Policy_v0.1.2.md',
        'P02 sentinel for all independent members > authority/02_ACTIVE_SPECS/The_Desk_Evidence_Package_v0.2.2.md',
        'P02 sentinel for all independent members > authority/02_ACTIVE_SPECS/The_Desk_Operator_Repair_v0.1.1.md',
        'P02 sentinel for all independent members > authority/02_ACTIVE_SPECS/The_Desk_Performance_and_Render_v0.1.4.md',
        'P02 sentinel for all independent members > authority/02_ACTIVE_SPECS/The_Desk_Showrunner_Planning_v0.1.3.md',
        'P02 sentinel for all independent members > authority/02_ACTIVE_SPECS/The_Desk_Writing_Build_1-2_Fixture_Profile_Addendum_v0.1.md',
        'P02 sentinel for all independent members > authority/02_ACTIVE_SPECS/The_Desk_Writing_Craft_and_Invisible_Comprehension_v0.1.md',
        'P02 sentinel for all independent members > authority/02_ACTIVE_SPECS/The_Desk_Writing_Spec_v0.2.3.md',
        'P02 sentinel for all independent members > authority/04_IMPLEMENTATION/The_Desk_Hashing_Fingerprints_and_Text_Spans_v0.1.5.md',
        'P02 sentinel for all independent members > authority_resolution_conformance.json',
        'P02 sentinel for all independent members > base_request_hash_conformance.json',
        'P02 sentinel for all independent members > claim_event_conformance.json',
        'P02 sentinel for all independent members > config/block_types.json',
        'P02 sentinel for all independent members > config/enum_registries.json',
        'P02 sentinel for all independent members > config/episode_modes.json',
        'P02 sentinel for all independent members > config/participant_profiles.json',
        'P02 sentinel for all independent members > config/policy_versions.json',
        'P02 sentinel for all independent members > config/rundown_template_post_event_launch_v2.json',
        'P02 sentinel for all independent members > config/show_config_version.json',
        'P02 sentinel for all independent members > config/show_config_version_v1_history.json',
        'P02 sentinel for all independent members > conformance_cases.py',
        'P02 sentinel for all independent members > conformance_index.json',
        'P02 sentinel for all independent members > evidence_package.json',
        'P02 sentinel for all independent members > fixture_audio/master.wav',
        'P02 sentinel for all independent members > fixture_audio/rb01_take0.wav',
        'P02 sentinel for all independent members > fixture_audio/rb02_take0.wav',
        'P02 sentinel for all independent members > fixture_audio/rb03_take0.wav',
        'P02 sentinel for all independent members > fixture_audio/rb04_take0.wav',
        'P02 sentinel for all independent members > fixture_audio/rb05_take0.wav',
        'P02 sentinel for all independent members > fixture_audio/rb06_take0.wav',
        'P02 sentinel for all independent members > fixture_audio/rb06_take1.wav',
        'P02 sentinel for all independent members > fixture_audio/rb07_take0.wav',
        'P02 sentinel for all independent members > fixture_audio/rb08_take0.wav',
        'P02 sentinel for all independent members > fixture_audio/rb09_take0.wav',
        'P02 sentinel for all independent members > fixture_audio/sting.wav',
        'P02 sentinel for all independent members > fixture_model_requests.json',
        'P02 sentinel for all independent members > fixture_persistence_conformance.json',
        'P02 sentinel for all independent members > foundation_rows_398.json',
        'P02 sentinel for all independent members > gate_fingerprint_inputs.json',
        'P02 sentinel for all independent members > master_assembly_map.json',
        'P02 sentinel for all independent members > mechanical_validation.json',
        'P02 sentinel for all independent members > model_semantic_input_conformance.json',
        'P02 sentinel for all independent members > performance_direction.json',
        'P02 sentinel for all independent members > performance_direction_corrected.json',
        'P02 sentinel for all independent members > persistence_expectations.json',
        'P02 sentinel for all independent members > prompt_manifest_conformance.json',
        'P02 sentinel for all independent members > prompt_payloads.json',
        'P02 sentinel for all independent members > provenance/BUILD330_RESULTS.json',
        'P02 sentinel for all independent members > provenance/CONFIG330_DISPOSITION_TABLE.json',
        'P02 sentinel for all independent members > provenance/CONFIG330_IDENTITY_TABLE.json',
        'P02 sentinel for all independent members > provenance/DEFERRED_RUNTIME_GAP.md',
        'P02 sentinel for all independent members > provenance/FAMILY_TOTALS.json',
        'P02 sentinel for all independent members > provenance/FIXTURE_AUDIT_REPORT.json',
        'P02 sentinel for all independent members > provenance/OBLIGATION_RECONCILIATION.json',
        'P02 sentinel for all independent members > provenance/PREEXEC_VERIFICATION.json',
        'P02 sentinel for all independent members > provenance/REJECTED_V3_DENYLIST.json',
        'P02 sentinel for all independent members > provenance/RUNTIME_BUDGET_RESOLUTION.md',
        'P02 sentinel for all independent members > provenance/SUCCESSOR_IDENTITY_REGISTRY.json',
        'P02 sentinel for all independent members > provenance/captured/model_semantic_inputs.json',
        'P02 sentinel for all independent members > provenance/captured/render_context_projections.json',
        'P02 sentinel for all independent members > provenance/captured/scope_projection.bytes',
        'P02 sentinel for all independent members > provenance/captured/writer_data_input.bytes',
        'P02 sentinel for all independent members > provenance/correction_provenance.json',
        'P02 sentinel for all independent members > provenance/frozen/correction_input_projection.json',
        'P02 sentinel for all independent members > provenance/frozen/i2b_v2/correction_input_projection_v1.json',
        'P02 sentinel for all independent members > provenance/frozen/i2b_v2/technical_resolution_record_v1.md',
        'P02 sentinel for all independent members > provenance/frozen/technical_resolution_record_v2.md',
        'P02 sentinel for all independent members > provenance/history/RUNTIME_BUDGET_FINDING_i2c_r2.md',
        'P02 sentinel for all independent members > provenance/i2b_v2/PHASE3_RESULTS_i2b_v2.json',
        'P02 sentinel for all independent members > provenance/i2b_v2/PREEXEC_VERIFICATION_i2b_v2.json',
        'P02 sentinel for all independent members > provenance/i2b_v2/correction_provenance_i2b_v2.json',
        'P02 sentinel for all independent members > provenance/i2b_v2/retention_repair_provenance_i2b_v2.json',
        'P02 sentinel for all independent members > provenance/predecessor/config/voice_profile_versions.json',
        'P02 sentinel for all independent members > provenance/predecessor/render_request_projections.json',
        'P02 sentinel for all independent members > provenance/predecessor/script_craft_revision.json',
        'P02 sentinel for all independent members > provenance/predecessor/script_pass1.json',
        'P02 sentinel for all independent members > provenance/predecessor/script_pass2.json',
        'P02 sentinel for all independent members > provenance/predecessor_v0.4.4_pins.json',
        'P02 sentinel for all independent members > provenance/uuid_correspondence_composed_330.tsv',
        'P02 sentinel for all independent members > provenance/uuid_correspondence_handoff_transcription_v2.tsv',
        'P02 sentinel for all independent members > provenance/v0.4.6/IDENTITY_TRANSITION.json',
        'P02 sentinel for all independent members > ready_expectations.json',
        'P02 sentinel for all independent members > render_manifest.json',
        'P02 sentinel for all independent members > render_request_projections.json',
        'P02 sentinel for all independent members > revalidation_result.json',
        'P02 sentinel for all independent members > revalidation_snapshot.json',
        'P02 sentinel for all independent members > scenarios.json',
        'P02 sentinel for all independent members > script_craft_revision.json',
        'P02 sentinel for all independent members > script_pass1.json',
        'P02 sentinel for all independent members > script_pass2.json',
        'P02 sentinel for all independent members > showrunner_brief.json',
        'P02 sentinel for all independent members > support_payloads.json',
        'P02 sentinel for all independent members > unicode_conformance.json',
        'P02 sentinel for all independent members > validate_fixture.py',
        'P02 sentinel for all independent members > writer_context_manifest.json',
        'P02 sentinel for all independent members > writer_view.json',
        'P02 sentinel for all independent members > writing_craft_review.json',
        'P03-P09 bounds, name-first and private identity > P03 below sentinel',
        'P03-P09 bounds, name-first and private identity > P03 real repair',
        'P03-P09 bounds, name-first and private identity > P04 stored empty',
        'P03-P09 bounds, name-first and private identity > P05 invalid bound 0',
        'P03-P09 bounds, name-first and private identity > P05 invalid bound 1',
        'P03-P09 bounds, name-first and private identity > P05 invalid bound 2',
        'P03-P09 bounds, name-first and private identity > P05 invalid bound 3',
        'P03-P09 bounds, name-first and private identity > P05 invalid bound 4',
        'P03-P09 bounds, name-first and private identity > P05 invalid bound 5',
        'P03-P09 bounds, name-first and private identity > P05 invalid bound 6',
        'P03-P09 bounds, name-first and private identity > P05 bound repair',
        'P03-P09 bounds, name-first and private identity > P06 unsafe first',
        'P03-P09 bounds, name-first and private identity > P06 repaired name',
        'P03-P09 bounds, name-first and private identity > P06 repaired bound, still blocked',
        'P03-P09 bounds, name-first and private identity > P06 real probe repair',
        'P03-P09 bounds, name-first and private identity > P07 missing member',
        'P03-P09 bounds, name-first and private identity > P07 name repair',
        'P03-P09 bounds, name-first and private identity > P08 exported pin override',
        'P03-P09 bounds, name-first and private identity > P08 export repair',
        'P03-P09 bounds, name-first and private identity > P09 caller pin refusal before listing then real full repair',
        'P10-P17 capture protocol > P10 O_RDONLY missing',
        'P10-P17 capture protocol > P10 O_RDONLY string',
        'P10-P17 capture protocol > P10 O_RDONLY negative',
        'P10-P17 capture protocol > P10 O_RDONLY fractional',
        'P10-P17 capture protocol > P10 O_RDONLY accessor',
        'P10-P17 capture protocol > P10 O_NOFOLLOW missing',
        'P10-P17 capture protocol > P10 O_NOFOLLOW string',
        'P10-P17 capture protocol > P10 O_NOFOLLOW negative',
        'P10-P17 capture protocol > P10 O_NOFOLLOW fractional',
        'P10-P17 capture protocol > P10 O_NOFOLLOW accessor',
        'P10-P17 capture protocol > P10 O_NONBLOCK missing',
        'P10-P17 capture protocol > P10 O_NONBLOCK string',
        'P10-P17 capture protocol > P10 O_NONBLOCK negative',
        'P10-P17 capture protocol > P10 O_NONBLOCK fractional',
        'P10-P17 capture protocol > P10 O_NONBLOCK accessor',
        'P10-P17 capture protocol > P10 actual flags including O_RDONLY zero repair',
        'P10-P17 capture protocol > P11 throw',
        'P10-P17 capture protocol > P11 nonregular',
        'P10-P17 capture protocol > P11 size-minus',
        'P10-P17 capture protocol > P11 size-plus',
        'P10-P17 capture protocol > P11 real repair',
        'P10-P17 capture protocol > P12 invalid fd 0',
        'P10-P17 capture protocol > P12 invalid fd 1',
        'P10-P17 capture protocol > P12 invalid fd 2',
        'P10-P17 capture protocol > P12 invalid fd 3',
        'P10-P17 capture protocol > P12 invalid fd 4',
        'P10-P17 capture protocol > P12 invalid fd 5',
        'P10-P17 capture protocol > P12 open throw',
        'P10-P17 capture protocol > P12 real repair',
        'P10-P17 capture protocol > P13 controlled fd-zero protocol, no real stdin operation',
        'P10-P17 capture protocol > P13 actual delegate repair',
        'P10-P17 capture protocol > P14 throw',
        'P10-P17 capture protocol > P14 mode',
        'P10-P17 capture protocol > P14 size',
        'P10-P17 capture protocol > P14 real repair',
        'P10-P17 capture protocol > P15 invalid count 0',
        'P10-P17 capture protocol > P15 invalid count 1',
        'P10-P17 capture protocol > P15 invalid count 2',
        'P10-P17 capture protocol > P15 invalid count 3',
        'P10-P17 capture protocol > P15 invalid count 4',
        'P10-P17 capture protocol > P15 invalid count 5',
        'P10-P17 capture protocol > P15 real repair',
        'P10-P17 capture protocol > P16 real truncate after fstat',
        'P10-P17 capture protocol > P16 restore primary',
        'P10-P17 capture protocol > P17 real append after fstat',
        'P10-P17 capture protocol > P17 restore primary',
        'P18-P23 short reads, cleanup, identity and reached fields > P18 real short-read protocol F1',
        'P18-P23 short reads, cleanup, identity and reached fields > P18 real-delegate repair',
        'P18-P23 short reads, cleanup, identity and reached fields > P20 real close once then throw',
        'P18-P23 short reads, cleanup, identity and reached fields > P20 real close malformed return',
        'P18-P23 short reads, cleanup, identity and reached fields > P20 real close repair',
        'P18-P23 short reads, cleanup, identity and reached fields > P21 excluded dirty sentinel',
        'P18-P23 short reads, cleanup, identity and reached fields > P22 same-size byte0 XOR1',
        'P18-P23 short reads, cleanup, identity and reached fields > P22 digest wrong',
        'P18-P23 short reads, cleanup, identity and reached fields > P22 digest boxed',
        'P18-P23 short reads, cleanup, identity and reached fields > P22 digest nonstring',
        'P18-P23 short reads, cleanup, identity and reached fields > P22 digest throw',
        'P18-P23 short reads, cleanup, identity and reached fields > P22 real hash repair',
        'P18-P23 short reads, cleanup, identity and reached fields > P23 reached EOCD miss',
        'P18-P23 short reads, cleanup, identity and reached fields > P23 reached EOCD throw',
        'P18-P23 short reads, cleanup, identity and reached fields > P23 reached central miss',
        'P18-P23 short reads, cleanup, identity and reached fields > P23 reached central throw',
        'P18-P23 short reads, cleanup, identity and reached fields > P23 reached local miss',
        'P18-P23 short reads, cleanup, identity and reached fields > P23 reached local throw',
        'P18-P23 short reads, cleanup, identity and reached fields > P23 reached post-hash view throw',
        'P18-P23 short reads, cleanup, identity and reached fields > P23 real field/view repair',
        'P24-P27 output admission and normalized CRC > P24 throw',
        'P24-P27 output admission and normalized CRC > P24 nonBuffer',
        'P24-P27 output admission and normalized CRC > P24 wrong intrinsic length',
        'P24-P27 output admission and normalized CRC > P24 capture alias',
        'P24-P27 output admission and normalized CRC > P24 real inflate repair',
        'P24-P27 output admission and normalized CRC > P25 malformed CRC 0',
        'P24-P27 output admission and normalized CRC > P25 malformed CRC 1',
        'P24-P27 output admission and normalized CRC > P25 malformed CRC 2',
        'P24-P27 output admission and normalized CRC > P25 malformed CRC 3',
        'P24-P27 output admission and normalized CRC > P25 malformed CRC 4',
        'P24-P27 output admission and normalized CRC > P25 wrong unsigned CRC',
        'P24-P27 output admission and normalized CRC > P25 CRC throw',
        'P24-P27 output admission and normalized CRC > P25 real CRC repair',
        'P24-P27 output admission and normalized CRC > P26 allocation throw',
        'P24-P27 output admission and normalized CRC > P26 allocation malformed',
        'P24-P27 output admission and normalized CRC > P26 allocation decoder alias',
        'P24-P27 output admission and normalized CRC > P26 copy throw',
        'P24-P27 output admission and normalized CRC > P26 copy malformed return',
        'P24-P27 output admission and normalized CRC > P26 post-copy prototype rejection',
        'P24-P27 output admission and normalized CRC > P26 real normalization repair',
        'P24-P27 output admission and normalized CRC > P27 named carrier getters0, fresh normalized CRC input',
        'P24-P27 output admission and normalized CRC > P27 real carrier repair',
        'P28-P37 legacy formats, freshness and discarded faults > P28 Deflate',
        'P28-P37 legacy formats, freshness and discarded faults > P29 descriptor',
        'P28-P37 legacy formats, freshness and discarded faults > P30 compressed corruption',
        'P28-P37 legacy formats, freshness and discarded faults > P30 truncated',
        'P28-P37 legacy formats, freshness and discarded faults > P30 central CRC',
        'P28-P37 legacy formats, freshness and discarded faults > P31 duplicate',
        'P28-P37 legacy formats, freshness and discarded faults > P32 ASCII against Unicode',
        'P28-P37 legacy formats, freshness and discarded faults > P33 multidisk',
        'P28-P37 legacy formats, freshness and discarded faults > P34 ZIP64',
        'P28-P37 legacy formats, freshness and discarded faults > P32 direct nonASCII first',
        'P28-P37 legacy formats, freshness and discarded faults > P31 listing refusal before missing manifest',
        'P28-P37 legacy formats, freshness and discarded faults > P32 listing refusal before missing manifest',
        'P28-P37 legacy formats, freshness and discarded faults > P35 delegation-only encryption control, no native acceptance claim',
        'P28-P37 legacy formats, freshness and discarded faults > P28-P35 original-primary real-delegate repair',
        'P28-P37 legacy formats, freshness and discarded faults > P36 same source sees primary to S to primary',
        'P28-P37 legacy formats, freshness and discarded faults > P36 fallback reopens after close/path replacement',
        'P28-P37 legacy formats, freshness and discarded faults > P36 real path/delegate repair',
        'P28-P37 legacy formats, freshness and discarded faults > P37 discarded lstat getters0, legacy wrapping120',
        'P28-P37 legacy formats, freshness and discarded faults > P37 lstat restore legacy only',
        'P28-P37 legacy formats, freshness and discarded faults > P37 lstat restore candidate',
        'P28-P37 legacy formats, freshness and discarded faults > P37 discarded read getters0, legacy wrapping120',
        'P28-P37 legacy formats, freshness and discarded faults > P37 read restore legacy only',
        'P28-P37 legacy formats, freshness and discarded faults > P37 read restore candidate',
        'P28-P37 legacy formats, freshness and discarded faults > P37 discarded inflate getters0, legacy wrapping120',
        'P28-P37 legacy formats, freshness and discarded faults > P37 inflate restore legacy only',
        'P28-P37 legacy formats, freshness and discarded faults > P37 inflate restore candidate',
        'P39 selected Stats DATA/prototype/u32 admission > P39 lstat mode 0',
        'P39 selected Stats DATA/prototype/u32 admission > P39 lstat mode 1',
        'P39 selected Stats DATA/prototype/u32 admission > P39 lstat mode 2',
        'P39 selected Stats DATA/prototype/u32 admission > P39 lstat mode 3',
        'P39 selected Stats DATA/prototype/u32 admission > P39 lstat mode 4',
        'P39 selected Stats DATA/prototype/u32 admission > P39 lstat mode 5',
        'P39 selected Stats DATA/prototype/u32 admission > P39 lstat mode 6',
        'P39 selected Stats DATA/prototype/u32 admission > P39 lstat own mode accessor',
        'P39 selected Stats DATA/prototype/u32 admission > P39 lstat own size accessor',
        'P39 selected Stats DATA/prototype/u32 admission > P39 lstat wrong prototype/inherited fields',
        'P39 selected Stats DATA/prototype/u32 admission > P39 lstat real Stats repair',
        'P39 selected Stats DATA/prototype/u32 admission > P39 fstat mode 0',
        'P39 selected Stats DATA/prototype/u32 admission > P39 fstat mode 1',
        'P39 selected Stats DATA/prototype/u32 admission > P39 fstat mode 2',
        'P39 selected Stats DATA/prototype/u32 admission > P39 fstat mode 3',
        'P39 selected Stats DATA/prototype/u32 admission > P39 fstat mode 4',
        'P39 selected Stats DATA/prototype/u32 admission > P39 fstat mode 5',
        'P39 selected Stats DATA/prototype/u32 admission > P39 fstat mode 6',
        'P39 selected Stats DATA/prototype/u32 admission > P39 fstat own mode accessor',
        'P39 selected Stats DATA/prototype/u32 admission > P39 fstat own size accessor',
        'P39 selected Stats DATA/prototype/u32 admission > P39 fstat wrong prototype/inherited fields',
        'P39 selected Stats DATA/prototype/u32 admission > P39 fstat real Stats repair',
        'P38 finite ordered compounds A-H against original oracle > A unsafe name, empty archive, restored primary',
        'P38 finite ordered compounds A-H against original oracle > B complete ordered repairs',
        'P38 finite ordered compounds A-H against original oracle > C complete ordered repairs',
        'P38 finite ordered compounds A-H against original oracle > D complete ordered repairs',
        'P38 finite ordered compounds A-H against original oracle > E complete ordered repairs',
        'P38 finite ordered compounds A-H against original oracle > F complete ordered repairs',
        'P38 finite ordered compounds A-H against original oracle > G complete ordered repairs',
        'P38 finite ordered compounds A-H against original oracle > H complete ordered repairs',
    ),
    'test/a1-dependency-chain.test.ts': (
        'dependency chain: upstream content hashes recomputed (single active rules of Hashing v0.1.5) > recomputes every artifact content hash from source objects and matches the shipped hashes',
        'dependency chain: upstream content hashes recomputed (single active rules of Hashing v0.1.5) > regenerated identities: writer view, context manifest, serialized input and the five manifests (addendum bound) equal the v0.4.6 rows',
        'dependency chain: upstream content hashes recomputed (single active rules of Hashing v0.1.5) > recomputes the nine base-request hashes and nine render-context digests from the block records',
        'dependency chain: upstream content hashes recomputed (single active rules of Hashing v0.1.5) > derives the six stage fingerprints from recomputed hashes and matches the shipped vectors',
        'dependency chain: upstream content hashes recomputed (single active rules of Hashing v0.1.5) > reproduces the five prompt manifests with recomputed upstream refs and request specimens that embed them',
        'dependency chain: upstream content hashes recomputed (single active rules of Hashing v0.1.5) > proves propagation: an upstream evidence change moves every dependent hash, an audio change moves only assembly onward',
        'documented incompleteness of the chain proof (not claimed as independently derived) > show configurations: both rows reproduce their stored hash under the closed show-config/1 profile; version 2 differs only in the runtime band',
        'documented incompleteness of the chain proof (not claimed as independently derived) > LIMIT (raw request-specimen derivation): rendered-request specimen bytes are shipped fixture-template data, read as exact bytes, not regenerated by TypeScript',
        'documented incompleteness of the chain proof (not claimed as independently derived) > LIMIT: policy/gate version strings and UUID identifiers are literal inputs, cross-checked against the policy map',
        'documented incompleteness of the chain proof (not claimed as independently derived) > LIMIT: the lexical JSON 1.0 reducer case (sequence_not_integer) is not representable through JSON.parse and remains unproved here',
        'predecessor stability: unchanged contracts keep their identities > the existing stage-fingerprint function still reproduces the v0.4.3 vectors, and v0.4.3 constants are not promoted to v0.4.6',
        'dependency classification under the single active rules (hypotheses verified by recomputation) > a changed prediction text moves exactly the script-dependent hashes and four stage fingerprints; knowledge, package, brief, writer chain, manifests, base requests, audio and assembly do not',
        'dependency classification under the single active rules (hypotheses verified by recomputation) > a changed show-config name moves only the show-config hash and the READY candidate',
        "dependency classification under the single active rules (hypotheses verified by recomputation) > different addendum bytes move exactly the four writer-view roles' complete and semantic manifest identities; no script, writer view, context, stage fingerprint or planner manifest",
        'dependency classification under the single active rules (hypotheses verified by recomputation) > an upstream evidence change moves every dependent hash including the stage fingerprints it feeds, and an audio change moves only assembly onward',
    ),
    'test/p1-program-attempt-preflight.test.ts': (
        'P1 entry preflight: refused before any database access > no arguments: exit 1, one fixed stderr line, empty stdout, ZERO database connections',
        'P1 entry preflight: refused before any database access > two positional arguments: exit 1, one fixed stderr line, empty stdout, ZERO database connections',
        'P1 entry preflight: refused before any database access > unknown flag: exit 1, one fixed stderr line, empty stdout, ZERO database connections',
        'P1 entry preflight: refused before any database access > flag without a value: exit 1, one fixed stderr line, empty stdout, ZERO database connections',
        'P1 entry preflight: refused before any database access > duplicate correlation flag: exit 1, one fixed stderr line, empty stdout, ZERO database connections',
        'P1 entry preflight: refused before any database access > uppercase correlation id: exit 1, one fixed stderr line, empty stdout, ZERO database connections',
        'P1 entry preflight: refused before any database access > short correlation id: exit 1, one fixed stderr line, empty stdout, ZERO database connections',
        'P1 entry preflight: refused before any database access > correlation id carrying a canary: exit 1, one fixed stderr line, empty stdout, ZERO database connections',
        'P1 entry preflight: refused before any database access > missing input file: exit 1, one fixed stderr line, empty stdout, ZERO database connections',
        'P1 entry preflight: refused before any database access > invalid JSON: exit 1, one fixed stderr line, empty stdout, ZERO database connections',
        'P1 entry preflight: refused before any database access > unknown top-level key: exit 1, one fixed stderr line, empty stdout, ZERO database connections',
        'P1 entry preflight: refused before any database access > missing slice: exit 1, one fixed stderr line, empty stdout, ZERO database connections',
        'P1 entry preflight: refused before any database access > units not an array: exit 1, one fixed stderr line, empty stdout, ZERO database connections',
        'P1 entry preflight: refused before any database access > unknown key inside slice: exit 1, one fixed stderr line, empty stdout, ZERO database connections',
        'P1 entry preflight: refused before any database access > non-string run identity: exit 1, one fixed stderr line, empty stdout, ZERO database connections',
        'P1 entry preflight: refused before any database access > run/attempt identity mismatch: exit 1, one fixed stderr line, empty stdout, ZERO database connections',
        'P1 entry preflight: refused before any database access > production environment: exit 1, one fixed stderr line, empty stdout, ZERO database connections',
        'P1 entry preflight: refused before any database access > staging environment: exit 1, one fixed stderr line, empty stdout, ZERO database connections',
        'P1 entry preflight: refused before any database access > invalid configuration (no DATABASE_URL): exit 1, one fixed stderr line, empty stdout, ZERO database connections',
        'P1 entry preflight: refused before any database access > positive control: a VALID envelope makes the entry contact the database (the zero counts above are not vacuous)',
        'P1 entry preflight: refused before any database access > a supplied canonical correlation id passes the syntax check (it reaches the database stage)',
    ),
    'test/integration/p1-program-attempt-entry.test.ts': (
        'P1 process entry (real PostgreSQL, real child processes) > complete run: exit 0, empty stderr, pino JSON lines with ONE correlation id, the expected closed event sequence, rows durable',
        'P1 process entry (real PostgreSQL, real child processes) > an identical re-run converges everywhere (exit 0, every command converged, identical row digest)',
        'P1 process entry (real PostgreSQL, real child processes) > a supplied canonical correlation id appears on EVERY line',
        'P1 process entry (real PostgreSQL, real child processes) > two separate invocations mint DIFFERENT correlation ids (one per invocation, never shared)',
        'P1 process entry (real PostgreSQL, real child processes) > PARTIAL PROGRESS (a): the attempt conflicts after the run was created: exit 2, the new run row EXISTS, no attempt/slice rows, typed conflict logged',
        'P1 process entry (real PostgreSQL, real child processes) > PARTIAL PROGRESS (b): the slice refuses after run AND attempt were created: exit 2, both rows EXIST, the package is NOT bound; a corrected re-run converges',
        'P1 process entry (real PostgreSQL, real child processes) > privacy, non-vacuous: stored unit content and an unsupported-field canary never reach stdout or stderr',
        'P1 process entry (real PostgreSQL, real child processes) > real SIGKILL after the run COMMIT > a re-run reaches rows IDENTICAL to an uninterrupted run (exit 0)',
        'P1 process entry (real PostgreSQL, real child processes) > real SIGKILL after the attempt COMMIT > a re-run reaches rows IDENTICAL to an uninterrupted run (exit 0)',
        'P1 process entry (real PostgreSQL, real child processes) > real SIGKILL mid-slice (after the second unit COMMIT) > a re-run reaches rows IDENTICAL to an uninterrupted run (exit 0)',
        'P1 process entry (real PostgreSQL, real child processes) > privacy with a UNIQUE protected-content canary in a valid authored unit and package: supplied to the real child, persisted and read back EXACTLY from canonical_content, absent from stdout and stderr',
        "P1 process entry (real PostgreSQL, real child processes) > a command-level error (exit 1) is retained, with cleanup failures after it > alone: exit 1, one fixed line, the failed command's event on stdout, no raw error text",
        'P1 process entry (real PostgreSQL, real child processes) > a command-level error (exit 1) is retained, with cleanup failures after it > flush_fail after the command error: exit stays 1, BOTH fixed lines in order (command_error first), nothing raw, bounded exit',
        'P1 process entry (real PostgreSQL, real child processes) > a command-level error (exit 1) is retained, with cleanup failures after it > end_reject after the command error: exit stays 1, BOTH fixed lines in order (command_error first), nothing raw, bounded exit',
        'P1 process entry (real PostgreSQL, real child processes) > a command-level error (exit 1) is retained, with cleanup failures after it > flush_hang after the command error: exit stays 1, BOTH fixed lines in order (command_error first), nothing raw, bounded exit',
        'P1 process entry (real PostgreSQL, real child processes) > a command-level error (exit 1) is retained, with cleanup failures after it > end_hang after the command error: exit stays 1, BOTH fixed lines in order (command_error first), nothing raw, bounded exit',
        'P1 process entry (real PostgreSQL, real child processes) > cleanup failures never change the original outcome and never mislead > flush_fail after a SUCCESSFUL run: exit 1 (infrastructure completion failure), fixed line, rows already committed, nothing echoed',
        'P1 process entry (real PostgreSQL, real child processes) > cleanup failures never change the original outcome and never mislead > end_reject after a SUCCESSFUL run: exit 1 (infrastructure completion failure), fixed line, rows already committed, nothing echoed',
        'P1 process entry (real PostgreSQL, real child processes) > cleanup failures never change the original outcome and never mislead > flush_hang: the fixed 5 s safeguard ends the wait, the process EXITS (no hang), exit 1 after a successful run',
        'P1 process entry (real PostgreSQL, real child processes) > cleanup failures never change the original outcome and never mislead > end_hang: the fixed 5 s safeguard ends the wait, the process EXITS (no hang), exit 1 after a successful run',
        'P1 process entry (real PostgreSQL, real child processes) > cleanup failures never change the original outcome and never mislead > a prior nonzero exit (domain refusal, 2) is PRESERVED when cleanup also fails',
    ),
}
IDENTITIES_SHA256 = 'afc88675fe039b4da4680012e63cae29f67f387d934be6d018d2fccd55b8359e'   # sha256 of the 725 full names joined by LF with no final LF, in file order then source order
EXACT_CASES = tuple((index, rel_file + " > " + rel) for index, rel_file in enumerate(GATE_FILES) for rel in IDENTITIES[rel_file])
DB_URL_LITERAL = "postgresql://postgres:postgres@localhost:5432/the_desk_test"   # the existing foundation-ci disposable service URL, exact
DB_NAME = "the_desk_test"
EXPECTED_DIST_FILES = 213                 # build membership derived from the pinned build mapping (71 production modules x .d.ts/.js/.js.map; tsconfig.build includes only src/**/*.ts; no compiled tests or docs): bind-build fails closed BEFORE the test unless the FRESH build has exactly this many files and this membership (validate repeats the check)
EXPECTED_DIST_PATHS_SHA256 = "85ecb3704c382e36b5c08cb00633e716799aba0897c5888a37f5f12f7be9c84a"   # sha256 of the sorted relative dist paths joined by LF with no final LF (names only; 213 paths, 5,336 bytes). The full content digest is NOT pinned: it is measured fresh in bind-build and must equal the post-test measurement
NODE_PROBE = """import pg from 'pg';
const client = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL, connectionTimeoutMillis: 10000 });
try {
  await client.connect();
  const r = await client.query("select current_setting('server_version_num')::int as v, current_database() as d, current_user as u, (select rolsuper from pg_roles where rolname = current_user) as su, (select rolcreatedb from pg_roles where rolname = current_user) as cdb, (select rolcreaterole from pg_roles where rolname = current_user) as crole");
  const row = r.rows[0];
  console.log(JSON.stringify({ ok: true, v: row.v, d: row.d, u: row.u, su: row.su, cdb: row.cdb, crole: row.crole }));
} catch (error) {
  console.log(JSON.stringify({ ok: false, code: typeof error?.code === 'string' ? error.code : 'ERROR' }));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
"""

WORKSPACE = Path("/home/runner/work/the-desk/the-desk")
TARGET = WORKSPACE / "pr34-performance-target"
CONTROL = WORKSPACE / "pr34-performance-control"
TEMP = Path("/home/runner/work/_temp")
BASE = TEMP / "g34"          # short on purpose: the inherited guard binds a unix socket below CAP/tmp (F1)
CAP = BASE / "c"
UPLOAD = BASE / "u"
CDIR = CONTROL / "diagnostic/pr34-performance"
INVENTORY_FILE = CDIR / "inventory-360.tsv"
# The complete reviewed control delta: five additions to the tested source tree, each committed as a regular 100644 blob.
CONTROL_FILES = (
    ".github/workflows/pr34-performance-diagnostic.yml",
    "diagnostic/pr34-performance/gate_bind.py",
    "diagnostic/pr34-performance/inventory-360.tsv",
    "diagnostic/pr34-performance/p33-gate-supervisor.py",
    "diagnostic/pr34-performance/run-gate.sh",
)
SYSTEM_TOOLS = ("/usr/bin/python3", "/usr/bin/timeout", "/usr/bin/env", "/bin/bash", "/usr/bin/git", "/usr/bin/ps", "/usr/bin/sha256sum")
GUARD_ARGV = ("/usr/bin/timeout --signal=TERM --kill-after=20 300 /usr/bin/python3 "
              "/home/runner/work/the-desk/the-desk/pr34-performance-control/diagnostic/pr34-performance/p33-gate-supervisor.py guard gate\n")
ENV_KEYS = ("PATH\nHOME\nTMPDIR\nLANG\nLC_ALL\nTZ\nCI\nTEST_DATABASE_URL\n", "PATH\nHOME\nTMPDIR\nLANG\nLC_ALL\nTZ\nCI\nTEST_DATABASE_URL\nRUNNER_TRACKING_ID\n")
ANSI = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")
SOCKET_LIMIT = 108                  # sizeof(sockaddr_un.sun_path): the pathname plus its terminator must fit, so the pathname must be < 108 bytes
MAX_FILE = 64 * 1024 * 1024         # source, capture and read allowance (unchanged)
TOOL_MAX = 256 * 1024 * 1024        # separate read ceiling for explicit executable/tool hashing only (F2)
COLLECT_ENTRIES = 4096              # collection ceilings only (F4); not runtime allowances
COLLECT_DEPTH = 24
COLLECT_FILE = 64 * 1024 * 1024
COLLECT_TOTAL = 512 * 1024 * 1024
SOCKET_RE = re.compile(r"tmp/the-desk-p33-[0-9]+-[0-9a-f]{24}/attempt-[A-Za-z0-9_]{8}/guard\.sock")
VERDICT_ALL_PASS = "ZOD_FOCUSED_DIAGNOSTIC_ALL_725_CASES_PASSED"
VERDICT_FAILURES = "ZOD_FOCUSED_DIAGNOSTIC_EVIDENCE_COMPLETE_WITH_CASE_FAILURES"
VERDICT_INCOMPLETE = "ZOD_FOCUSED_DIAGNOSTIC_EVIDENCE_INCOMPLETE_HOLD"
T0 = time.monotonic()
MISSING = object()
UPLOAD_STATE = {"created": False}   # True only after THIS process exclusively created UPLOAD; a pre-existing directory is never ours to write into
LEDGER = []       # every fixed binding/version query of this process: argv, cwd, status, streams, timing
PARTIAL = {}      # measurements completed so far in this process


class Hold(Exception):
    """A closed stop: the message is a fixed label, never an input."""


def need(ok, label):
    if not ok:
        raise Hold(label)


def utc():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def sha256_file(path, limit=MAX_FILE):
    h = hashlib.sha256()
    size = 0
    with open(path, "rb") as stream:
        while True:
            block = stream.read(1 << 20)
            if not block:
                break
            size += len(block)
            need(size <= limit, "file_over_cap")
            h.update(block)
    return h.hexdigest(), size


def git_blob(data):
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()


def as_text(value):
    if value is None:
        return ""
    return value.decode("utf-8", "replace") if isinstance(value, bytes) else str(value)


def run(argv, cwd, extra_path=None):
    """A short bounded fixed query: closed stdin (an empty pipe), capture-local HOME/TMPDIR, minimal environment. The complete argv/cwd/status/
    streams/timing are retained in the ledger FIRST, then any nonzero status, timeout or launch error is a HOLD. Never retried. Returns stdout text."""
    env = {"PATH": (extra_path + ":" if extra_path else "") + "/usr/bin:/bin", "HOME": str(CAP / "home"), "TMPDIR": str(CAP / "tmp"), "LANG": "C.UTF-8",
           "LC_ALL": "C.UTF-8", "GIT_OPTIONAL_LOCKS": "0", "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": str(CAP / "home/gitconfig-absent")}
    entry = {"argv": list(argv), "cwd": str(cwd)}
    started = time.monotonic()
    try:
        done = subprocess.run(argv, cwd=cwd, env=env, input=b"", capture_output=True, timeout=30, check=False)
    except subprocess.TimeoutExpired as error:
        entry.update(status="timeout_status_unknown", returncode=None, stdout=as_text(error.stdout), stderr=as_text(error.stderr),
                     seconds=round(time.monotonic() - started, 6))
        LEDGER.append(entry)
        raise Hold("command_timeout")
    except Exception as error:
        entry.update(status="launch_error:" + type(error).__name__, returncode=None, stdout="", stderr="", seconds=round(time.monotonic() - started, 6))
        LEDGER.append(entry)
        raise Hold("command_launch_error")
    entry.update(status="completed", returncode=done.returncode, stdout=as_text(done.stdout), stderr=as_text(done.stderr),
                 seconds=round(time.monotonic() - started, 6))
    LEDGER.append(entry)
    need(done.returncode == 0, "command_nonzero_status:" + os.path.basename(argv[0]))
    return entry["stdout"]


def real_dir(path, label):
    need(path.is_dir() and not path.is_symlink() and Path(os.path.realpath(path)) == path, label)


def walk(root):
    """Exact nonfollowing membership of `root`, excluding only the top-level .git, node_modules and dist entries (dist is measured by measure_dist). Modes keep every permission bit."""
    rows, dirs = {}, set()

    def visit(directory, prefix):
        with os.scandir(directory) as entries:
            ordered = sorted(entries, key=lambda e: e.name.encode())
        for entry in ordered:
            if prefix == "" and entry.name in (".git", "node_modules", "dist"):
                continue
            rel = prefix + entry.name
            st = entry.stat(follow_symlinks=False)
            if stat.S_ISDIR(st.st_mode):
                dirs.add(rel)
                visit(entry.path, rel + "/")
            elif stat.S_ISREG(st.st_mode):
                need(st.st_nlink == 1, "multilink_file:" + rel)
                digest, size = sha256_file(entry.path)
                need(size == st.st_size, "size_race:" + rel)
                rows[rel] = ("%o" % stat.S_IMODE(st.st_mode), size, digest)
            else:
                raise Hold("link_or_special_member:" + rel)

    visit(str(root), "")
    return rows, dirs


def expected_inventory():
    data = INVENTORY_FILE.read_bytes()
    need(sha256_bytes(data) == INVENTORY_SHA256, "inventory_file_identity")
    rows = {}
    for line in data.decode("utf-8").split("\n"):
        if not line:
            continue
        path, mode, size, digest = line.split("\t")
        rows[path] = (mode, int(size), digest)
    need(len(rows) == EXPECTED_FILES, "inventory_row_count")
    return rows


def _ancestors(path):
    parts = path.split("/")[:-1]
    return {"/".join(parts[: i + 1]) for i in range(len(parts))}


PRE_IGNORED = ([], ["!! node_modules/"])
BUILT_IGNORED = (["!! dist/"], ["!! dist/", "!! node_modules/"])


def measure_source(allowed=PRE_IGNORED):
    """A fresh read of the target checkout (git identity plus a complete nonfollowing 360-file walk); pre, bind-build and post each perform their own.
    Tracked or untracked changes are never tolerated. The only tolerated ignored entries are those listed for the phase: node_modules always, dist only
    after the build (dist is measured separately by measure_dist and is excluded from the source walk)."""
    real_dir(TARGET, "target_checkout_dir")
    head = run(["/usr/bin/git", "-C", str(TARGET), "rev-parse", "HEAD"], TARGET).strip()
    tree = run(["/usr/bin/git", "-C", str(TARGET), "rev-parse", "HEAD^{tree}"], TARGET).strip()
    parents = run(["/usr/bin/git", "-C", str(TARGET), "rev-list", "--parents", "-n1", "HEAD"], TARGET).split()
    need(head == SOURCE_SHA, "target_head_is_not_the_literal_source_commit")
    need(tree == SOURCE_TREE, "target_tree")
    need(parents == [SOURCE_SHA, SOURCE_PARENT], "target_sole_parent")
    status = run(["/usr/bin/git", "-C", str(TARGET), "status", "--porcelain=v1", "--ignored"], TARGET)
    lines = sorted(status.splitlines())
    ignored = [line for line in lines if line.startswith("!! ")]
    changed = [line for line in lines if not line.startswith("!! ")]
    need(changed == [], "target_worktree_not_clean:" + status[:80])
    need(ignored in [list(entry) for entry in allowed], "target_ignored_entries_unexpected:" + status[:80])
    rows, dirs = walk(TARGET)
    want = expected_inventory()
    need(rows == want, "membership_modes_sizes_or_hashes_differ_from_the_360_inventory")
    need(dirs == {a for p in want for a in _ancestors(p)}, "unexpected_directory_in_source_namespace")
    gate_tests = {}
    for rel in GATE_FILES:
        data = (TARGET / rel).read_bytes()
        nbytes, digest, blob = GATE_PINS[rel]
        need(len(data) == nbytes and sha256_bytes(data) == digest and git_blob(data) == blob, "gate_test_identity:" + rel)
        gate_tests[rel] = {"bytes": nbytes, "sha256": digest, "blob": blob}
    need(sha256_file(TARGET / "package.json")[0] == PKG_SHA256 and sha256_file(TARGET / "package-lock.json")[0] == LOCK_SHA256, "package_pair")
    inventory_text = "".join("%s\t%s\t%d\t%s\n" % (p, rows[p][0], rows[p][1], rows[p][2]) for p in sorted(rows, key=lambda s: s.encode()))
    need(sha256_bytes(inventory_text.encode()) == INVENTORY_SHA256, "rendered_inventory_identity")
    return {"source_head": head, "source_tree": tree, "source_parents": parents, "files": len(rows), "directories": len(dirs),
            "inventory_sha256": INVENTORY_SHA256, "gate_tests": gate_tests, "package_sha256": PKG_SHA256, "lock_sha256": LOCK_SHA256,
            "status": "", "ignored": ignored}


def measure_tools():
    """Actual hosted executable identities. Executables use the separate TOOL_MAX read ceiling; nothing here pins a hosted hash or size."""
    tools = {}
    for path in SYSTEM_TOOLS:
        real = os.path.realpath(path)
        digest, size = sha256_file(real, TOOL_MAX)
        tools[path] = {"realpath": real, "sha256": digest, "bytes": size}
    which = shutil.which("node")
    need(which is not None, "node_not_on_path")
    node = os.path.realpath(which)
    node_dir = os.path.dirname(node)
    version = run([node, "--version"], TARGET, node_dir).strip()
    need(version == "v" + NODE_VERSION, "node_version")
    digest, size = sha256_file(node, TOOL_MAX)
    tools["node"] = {"realpath": node, "sha256": digest, "bytes": size, "version": version}
    npm_version = run([os.path.join(node_dir, "npm"), "--version"], TARGET, node_dir).strip()
    need(npm_version == NPM_VERSION, "npm_version")
    tools["npm"] = {"version": npm_version}
    pkg_path = TARGET / "node_modules/vitest/package.json"
    pkg = json.loads(pkg_path.read_text("utf-8"))
    need(pkg.get("version") == VITEST_VERSION, "installed_vitest_version")
    entry = TARGET / "node_modules/vitest/vitest.mjs"
    digest, size = sha256_file(entry)
    tools["vitest"] = {"version": pkg["version"], "entrypoint": str(entry), "entrypoint_sha256": digest, "entrypoint_bytes": size,
                       "package_json_sha256": sha256_file(pkg_path)[0]}
    py = sys.version_info
    need(py[:2] in ((3, 12), (3, 13)) and sys.implementation.name == "cpython", "python_version")
    tools["python"] = {"version": sys.version, "executable": os.path.realpath(sys.executable)}
    return tools


def committed_file(root, rel):
    """Actual on-disk identity of one committed control file: regular, single-link, no intermediate link, every permission bit, bytes and git blob."""
    path = root / rel
    need(os.path.realpath(path) == str(path), "control_path_is_linked:" + rel)
    st = path.lstat()
    need(stat.S_ISREG(st.st_mode) and st.st_nlink == 1 and st.st_size <= MAX_FILE, "control_file_not_a_single_regular_file:" + rel)
    data = path.read_bytes()
    need(len(data) == st.st_size, "control_size_race:" + rel)
    return {"mode": "%o" % stat.S_IMODE(st.st_mode), "bytes": len(data), "sha256": sha256_bytes(data), "blob": git_blob(data)}


def verify_identity_table():
    """The embedded 725-name ledger must be internally consistent before anything is measured: 725 unique names, the pinned LF-joined digest, the eleven pinned files and the per-file counts."""
    names = [name for _, name in EXACT_CASES]
    need(len(names) == CASE_TOTAL == 725 and len(set(names)) == CASE_TOTAL, "identity_table_count_or_uniqueness")
    need(sha256_bytes("\n".join(names).encode("utf-8")) == IDENTITIES_SHA256, "identity_table_digest")
    need(len(GATE_FILES) == 11 and sorted(GATE_PINS) == sorted(GATE_FILES), "identity_table_files")
    need(tuple(sum(1 for index, _ in EXACT_CASES if index == i) for i in range(len(GATE_FILES))) == CASE_COUNTS and sum(CASE_COUNTS) == CASE_TOTAL, "identity_table_per_file_counts")
    return {"cases": CASE_TOTAL, "files": len(GATE_FILES), "names_sha256": IDENTITIES_SHA256, "per_file": list(CASE_COUNTS)}


def locked_zod_entry(path, label):
    """The zod entry of one lock-shaped JSON file (the project lock, or npm's hidden lock of the actual installation): exactly the reviewed literals, never a default."""
    document = load_json(path)
    need(document is not MISSING, label + "_unreadable")
    entry = get(document, "packages", "node_modules/zod")
    need(isinstance(entry, dict), label + "_entry_missing")
    need(entry.get("version") == ZOD_VERSION and entry.get("resolved") == ZOD_RESOLVED and entry.get("integrity") == ZOD_INTEGRITY, label + "_entry_differs_from_the_reviewed_literals")
    return {"version": entry["version"], "resolved": entry["resolved"], "integrity": entry["integrity"]}


def measure_zod():
    """The installed Zod, measured before the build and after the test and required to be equal: the locked literals of the project lock and of npm's hidden installed lock,
    the installed package.json identity, and a bounded complete nonfollowing traversal of TARGET/node_modules/zod only (regular single-link files and directories owned by the
    running user; any link or special member is a HOLD) as sorted file rows [relative path, bytes, sha256, permission mode] AND sorted directory rows [relative path, permission mode],
    plus the distinct root identity {permission mode, owner uid}. The digest frames three kinds of line ("R", "D", "F", NUL-separated, LF-joined; a name containing LF is refused) so a
    file, a directory and the root can never collide. REVISION002 (R3/R4): all of these fields are part of the returned dict and therefore of the pre/build/post equality; the
    5,000-descendant budget is ONE global counter that is incremented while each directory is consumed, before the entry is appended to any list, so the first excess entry is
    the only detector and no oversized directory is ever materialized. Depth 12, 8 MiB per file and 64 MiB of file bytes are unchanged. Nothing else under node_modules is
    scanned and Zod is never imported or executed."""
    modules = TARGET / "node_modules"
    root = modules / "zod"
    real_dir(modules, "node_modules_dir")
    real_dir(root, "zod_dir")
    uid = os.getuid()
    root_stat = root.lstat()
    need(root_stat.st_uid == uid, "zod_root_owner")
    root_mode = "%o" % stat.S_IMODE(root_stat.st_mode)
    root_uid = root_stat.st_uid
    project_lock = locked_zod_entry(TARGET / "package-lock.json", "project_lock_zod")
    hidden_lock = locked_zod_entry(modules / ".package-lock.json", "hidden_lock_zod")
    package = load_json(root / "package.json")
    need(get(package, "name") == "zod" and get(package, "version") == ZOD_VERSION, "installed_zod_package_identity")
    rows = []
    directories = []
    state = {"entries": 0, "bytes": 0}

    def visit(directory, prefix, depth):
        need(depth <= ZOD_MAX_DEPTH, "zod_depth_bound")
        found = []
        with os.scandir(directory) as entries:
            for entry in entries:
                state["entries"] += 1
                need(state["entries"] <= ZOD_MAX_ENTRIES, "zod_entry_bound")
                found.append(entry)
        found.sort(key=lambda e: e.name.encode())
        for entry in found:
            rel = prefix + entry.name
            need("\n" not in rel, "zod_member_name_not_framable")
            st = entry.stat(follow_symlinks=False)
            need(st.st_uid == uid, "zod_member_owner:" + rel)
            if stat.S_ISDIR(st.st_mode):
                directories.append([rel, "%o" % stat.S_IMODE(st.st_mode)])
                visit(entry.path, rel + "/", depth + 1)
            elif stat.S_ISREG(st.st_mode):
                need(st.st_nlink == 1 and st.st_size <= ZOD_MAX_FILE, "zod_member_link_or_size:" + rel)
                state["bytes"] += st.st_size
                need(state["bytes"] <= ZOD_MAX_TOTAL, "zod_total_bound")
                digest, size = sha256_file(entry.path, ZOD_MAX_FILE)
                need(size == st.st_size, "zod_size_race:" + rel)
                rows.append([rel, size, digest, "%o" % stat.S_IMODE(st.st_mode)])
            else:
                raise Hold("zod_link_or_special_member:" + rel)

    visit(str(root), "", 1)
    need(rows != [] and any(row[0] == "package.json" for row in rows), "zod_empty_or_without_package_json")
    ordered = sorted(rows)
    ordered_dirs = sorted(directories)
    lines = ["R\0%s\0%d" % (root_mode, root_uid)]
    lines += ["D\0%s\0%s" % (rel, mode) for rel, mode in ordered_dirs]
    lines += ["F\0%s\0%d\0%s\0%s" % (rel, size, digest, mode) for rel, size, digest, mode in ordered]
    return {"root": str(root), "root_identity": {"mode": root_mode, "uid": root_uid}, "version": ZOD_VERSION, "project_lock": project_lock, "hidden_lock": hidden_lock,
            "package_json_sha256": sha256_file(root / "package.json")[0], "files": len(ordered), "directories": len(ordered_dirs), "entries": state["entries"], "bytes": state["bytes"],
            "digest": sha256_bytes("\n".join(lines).encode()), "inventory": ordered, "directory_inventory": ordered_dirs}


def measure_control(control_sha):
    """Control commit == GITHUB_SHA; its SOLE parent is the exact tested source; the parent-to-control tree delta is exactly the five reviewed
    additions (this also preserves the original ci.yml); a clean control worktree; each actual file equals its committed blob and mode."""
    head = run(["/usr/bin/git", "-C", str(CONTROL), "rev-parse", "HEAD"], CONTROL).strip()
    need(head == control_sha, "control_checkout_is_not_github_sha")
    parents = run(["/usr/bin/git", "-C", str(TARGET), "rev-list", "--parents", "-n1", control_sha], TARGET).split()
    need(parents == [control_sha, SOURCE_SHA], "control_sole_parent_is_not_the_tested_source")
    raw = run(["/usr/bin/git", "-C", str(TARGET), "diff-tree", "-r", "--raw", "--no-abbrev", "--no-renames", SOURCE_SHA, control_sha], TARGET)
    delta = {}
    for line in raw.splitlines():
        match = re.fullmatch(r":000000 100644 0{40} ([0-9a-f]{40}) A\t(.+)", line)
        need(match is not None, "control_delta_entry_is_not_a_reviewed_regular_addition")
        need(match.group(2) not in delta, "control_delta_duplicate_path")
        delta[match.group(2)] = match.group(1)
    need(sorted(delta) == list(CONTROL_FILES), "control_delta_is_not_exactly_the_five_reviewed_additions")
    status = run(["/usr/bin/git", "-C", str(CONTROL), "status", "--porcelain=v1", "--ignored"], CONTROL)
    need(status == "", "control_worktree_not_clean")
    listing = run(["/usr/bin/git", "-C", str(CONTROL), "ls-tree", "-r", "--full-tree", "HEAD", "--", *CONTROL_FILES, CI_REL], CONTROL)
    committed = {}
    for line in listing.splitlines():
        match = re.fullmatch(r"(100644) blob ([0-9a-f]{40})\t(.+)", line)
        need(match is not None, "control_committed_entry_is_not_a_regular_100644_blob")
        committed[match.group(3)] = match.group(2)
    need(sorted(committed) == sorted(CONTROL_FILES + (CI_REL,)), "control_committed_entries_incomplete")
    files = {}
    for rel in CONTROL_FILES:
        ident = committed_file(CONTROL, rel)
        need(ident["mode"] == "644" and ident["blob"] == committed[rel] == delta[rel], "control_file_differs_from_its_committed_blob_or_mode:" + rel)
        files[rel] = ident
    ci = committed_file(CONTROL, CI_REL)
    need(ci["sha256"] == CI_SHA256 and ci["blob"] == CI_BLOB == committed[CI_REL] and ci["mode"] == "644", "original_ci_yml_changed")
    files[CI_REL] = ci
    return {"head": head, "sole_parent": SOURCE_SHA, "delta": delta, "status": status, "files": files}


def socket_model():
    """The guard's unchanged runtime-directory/socket naming, modeled with the ACTUAL numeric uid: CAP/tmp/the-desk-p33-<uid>-<24 hex>/attempt-<8>/guard.sock.
    The pathname must be shorter than sizeof(sun_path)=108 bytes. A violation is a HOLD before anything is created or launched; there is no alternate path."""
    uid = os.getuid()
    key = hashlib.sha256(str(TARGET).encode()).hexdigest()[:24]
    path = "%s/tmp/the-desk-p33-%d-%s/attempt-%s/guard.sock" % (CAP, uid, key, "x" * 8)
    length = len(path.encode("utf-8"))
    model = {"uid": uid, "runtime_key": key, "modeled_path": path, "bytes": length, "limit": SOCKET_LIMIT, "rule": "bytes < limit"}
    PARTIAL["socket_model"] = model
    need(length < SOCKET_LIMIT, "guard_socket_pathname_not_shorter_than_108_bytes")
    return model


def write_new(path, value):
    data = (json.dumps(value, sort_keys=True, indent=2) + "\n").encode()
    write_bytes_new(path, data)


def write_bytes_new(path, data):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, "wb") as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())


def read_bounded(path):
    """At most MAX_FILE bytes plus a one-byte overrun detector; MISSING for any unreadable, overlong or non-regular file."""
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
        with os.fdopen(fd, "rb") as stream:
            if not stat.S_ISREG(os.fstat(stream.fileno()).st_mode):
                return MISSING
            data = stream.read(MAX_FILE + 1)
    except OSError:
        return MISSING
    return MISSING if len(data) > MAX_FILE else data


def read_text(path):
    data = read_bounded(path)
    return MISSING if data is MISSING else data.decode("utf-8", "replace")


def load_json(path):
    data = read_bounded(path)
    if data is MISSING:
        return MISSING
    try:
        return json.loads(data.decode("utf-8"))
    except ValueError:
        return MISSING


def get(value, *keys):
    """Presence-checked lookup: an absent field is MISSING and can never become a falsey default."""
    for key in keys:
        if not isinstance(value, dict) or key not in value:
            return MISSING
        value = value[key]
    return value


def owned():
    marker = load_json(CAP / "owner.json")
    return (get(marker, "run_id") == os.environ.get("GITHUB_RUN_ID") and get(marker, "run_attempt") == os.environ.get("GITHUB_RUN_ATTEMPT")
            and os.environ.get("GITHUB_RUN_ID") is not None)


def write_failure(phase, kind, label):
    """Exclusive phase failure record with the accumulated ledger and partial measurements; best effort, never overwriting, never inventing a status."""
    record = {"phase": phase, "kind": kind, "label": label, "commands": LEDGER, "partial": PARTIAL, "utc": utc(),
              "monotonic_seconds": round(time.monotonic() - T0, 6)}
    if not owned():
        targets = []   # a root rejected as unowned is never written into: only the fixed HOLD/error reaches the job log
    elif phase == "collect":
        targets = [BASE / "collect-failure.json"] + ([UPLOAD / "collect-failure.json"] if UPLOAD_STATE["created"] else [])
    else:
        targets = [CAP / (phase + "-failure.json")]
    for target in targets:
        try:
            write_new(target, record)
        except Exception as error:
            print("failure record not written:", target, type(error).__name__, file=sys.stderr)


def common_identity():
    sha = os.environ.get("GITHUB_SHA", "")
    need(re.fullmatch(r"[0-9a-f]{40}", sha) is not None, "github_sha_shape")
    need(sha != SOURCE_SHA, "control_sha_equals_source_sha")
    real_dir(CONTROL, "control_checkout_dir")
    need(os.environ.get("RUNNER_TEMP") == str(TEMP), "runner_temp_literal")
    need(os.environ.get("GITHUB_WORKSPACE") == str(WORKSPACE), "workspace_literal")
    need(os.environ.get("GITHUB_EVENT_NAME") == "push" and os.environ.get("GITHUB_REF") == "refs/heads/diagnostic/pr34-zod-001", "event_and_ref")
    return {"control_github_sha": sha, "source_sha": SOURCE_SHA, "github_run_id": os.environ.get("GITHUB_RUN_ID"),
            "github_run_attempt": os.environ.get("GITHUB_RUN_ATTEMPT"), "github_ref": os.environ.get("GITHUB_REF"),
            "github_event_name": os.environ.get("GITHUB_EVENT_NAME")}


def cmd_pre():
    model = socket_model()
    need(not os.path.lexists(BASE), "capture_base_must_be_absent")
    os.mkdir(BASE, 0o700)
    os.mkdir(CAP, 0o700)
    write_new(CAP / "owner.json", {"run_id": os.environ.get("GITHUB_RUN_ID"), "run_attempt": os.environ.get("GITHUB_RUN_ATTEMPT"), "utc": utc()})
    os.mkdir(CAP / "home", 0o700)
    os.mkdir(CAP / "tmp", 0o700)
    identity = common_identity()
    PARTIAL["identity"] = identity
    control = measure_control(identity["control_github_sha"])
    PARTIAL["control"] = control
    source = measure_source()
    PARTIAL["source"] = source
    tools = measure_tools()
    PARTIAL["tools"] = tools
    table = verify_identity_table()
    PARTIAL["identity_table"] = table
    zod = measure_zod()
    PARTIAL["zod"] = {"files": zod["files"], "directories": zod["directories"], "bytes": zod["bytes"], "digest": zod["digest"]}
    write_new(CAP / "bind-pre.json", {"phase": "pre", **identity, "socket_model": model, "control": control, "source": source, "tools": tools, "identity_table": table, "zod": zod,
                                      "commands": LEDGER, "utc": utc(), "monotonic_seconds": round(time.monotonic() - T0, 6)})
    print("pre ok")
    return 0


def without_ignored(source):
    return {key: value for key, value in source.items() if key != "ignored"}


def redact(text):
    """Only the exact disposable URL literal is replaced; nothing else is altered."""
    return text.replace(DB_URL_LITERAL, "[REDACTED_DISPOSABLE_TEST_DATABASE_URL]")


def interpret_db_probe(row):
    """The existing CI interpretation (tools/ci-validation/ci.py interpret_db_probe), same meaning: ok true, major 17, database the_desk_test, superuser."""
    errors, record = [], {}
    if not isinstance(row, dict) or row.get("ok") is not True:
        code = row.get("code") if isinstance(row, dict) and isinstance(row.get("code"), str) else "unknown"
        return ["database probe failed (error code %s)" % re.sub(r"[^A-Za-z0-9_]", "", code)[:32]], record
    version = row.get("v")
    record = {"server_version_num": version, "major": version // 10000 if isinstance(version, int) and not isinstance(version, bool) else None,
              "database": row.get("d"), "role": row.get("u"), "superuser": row.get("su"), "createdb": row.get("cdb"), "createrole": row.get("crole")}
    if record["major"] != 17:
        errors.append("database major version is not 17")
    if record["database"] != DB_NAME:
        errors.append("connected database is not " + DB_NAME)
    if record["superuser"] is not True:
        errors.append("connected role is not a superuser (cluster-wide role bootstrap is required)")
    return errors, record


def cmd_dbprobe():
    """The fixed read-only database probe of tools/ci-validation/ci.py: the same script text (NODE_PROBE), the same environment (PATH, HOME, TEST_DATABASE_URL),
    the same interpretation, run once against the disposable service in the target checkout. Unlike the CI probe (which discards stderr) both streams and
    the status are retained, with only the exact disposable URL literal redacted. No other SQL exists in this file."""
    need(owned(), "dbprobe_capture_not_owned")
    pre = load_json(CAP / "bind-pre.json")
    need(get(pre, "phase") == "pre", "dbprobe_without_pre_record")
    url = os.environ.get("TEST_DATABASE_URL")
    need(url == DB_URL_LITERAL, "test_database_url_is_not_the_disposable_literal")
    node = shutil.which("node")
    need(node is not None, "node_not_on_path")
    argv = [node, "--input-type=module", "-e", NODE_PROBE]
    env = {"PATH": os.environ.get("PATH", "/usr/bin:/bin"), "HOME": str(CAP / "home"), "TEST_DATABASE_URL": url}
    record = {"phase": "dbprobe", "argv": [node, "--input-type=module", "-e", "<NODE_PROBE sha256 %s>" % sha256_bytes(NODE_PROBE.encode())],
              "cwd": str(TARGET), "env_keys": sorted(env), "timeout_seconds": 30, "errors": []}
    started = time.monotonic()
    try:
        done = subprocess.run(argv, cwd=TARGET, env=env, input=b"", capture_output=True, timeout=30, check=False)
    except subprocess.TimeoutExpired as error:
        record.update(status="timeout_status_unknown", returncode=None, stdout=redact(as_text(error.stdout)), stderr=redact(as_text(error.stderr)))
        record["errors"].append("database probe timed out")
    except Exception as error:
        record.update(status="launch_error:" + type(error).__name__, returncode=None, stdout="", stderr="")
        record["errors"].append("database probe could not be launched")
    else:
        stdout = as_text(done.stdout)
        record.update(status="completed", returncode=done.returncode, stdout=redact(stdout), stderr=redact(as_text(done.stderr)))
        if done.returncode != 0:
            record["errors"].append("database probe process exit status is %r, want exactly 0" % (done.returncode,))
        else:
            last = stdout.strip().splitlines()[-1:]
            try:
                row = json.loads(last[0]) if last else {}
            except ValueError:
                row = None
                record["errors"].append("database probe output unreadable")
            if row is not None:
                errors, info = interpret_db_probe(row)
                record["server"] = info
                record["errors"] += errors
    record["seconds"] = round(time.monotonic() - started, 6)
    record["ok"] = not record["errors"]
    write_new(CAP / "db-probe.json", record)
    print(json.dumps({"dbprobe": record["ok"], "errors": record["errors"][:3]}))
    need(record["ok"], "database_probe_failed")
    return 0


def measure_dist():
    """The emitted build output: a complete nonfollowing inventory of TARGET/dist (regular single-link files only), its count and the same digest recipe as
    tools/ci-validation/ci.py (sha256 over the sorted lines "<rel>\\0<bytes>\\0<sha256>" joined by newlines). Measured fresh; nothing is copied from an older record."""
    root = TARGET / "dist"
    need(root.is_dir() and not root.is_symlink() and Path(os.path.realpath(root)) == root, "dist_dir")
    rows = []

    def visit(directory, prefix):
        with os.scandir(directory) as entries:
            ordered = sorted(entries, key=lambda e: e.name.encode())
        for entry in ordered:
            rel = prefix + entry.name
            st = entry.stat(follow_symlinks=False)
            if stat.S_ISDIR(st.st_mode):
                visit(entry.path, rel + "/")
            elif stat.S_ISREG(st.st_mode):
                need(st.st_nlink == 1, "dist_multilink_file:" + rel)
                digest, size = sha256_file(entry.path)
                need(size == st.st_size, "dist_size_race:" + rel)
                rows.append((rel, size, digest))
                need(len(rows) <= 20000, "dist_file_bound")
            else:
                raise Hold("dist_link_or_special_member:" + rel)

    visit(str(root), "")
    need(rows != [], "dist_empty")
    ordered = sorted(rows)
    lines = ["%s\0%d\0%s" % (rel, size, digest) for rel, size, digest in ordered]
    return {"files": len(ordered), "digest": sha256_bytes("\n".join(lines).encode()), "inventory": [[rel, size, digest] for rel, size, digest in ordered]}


def dist_membership_sha256(inventory):
    """sha256 of the sorted relative dist paths joined by LF (no final LF) from a recorded inventory, or None unless the inventory is a list of 3-element list rows with string path columns."""
    if not isinstance(inventory, list):
        return None
    paths = []
    for row in inventory:
        if not (isinstance(row, list) and len(row) == 3 and isinstance(row[0], str)):
            return None
        paths.append(row[0])
    return sha256_bytes("\n".join(paths).encode())


def cmd_bind_build():
    """After the existing `npm run build`: source, control, tools and the emitted dist are bound again BEFORE the test, and must equal the pre binding
    (dist is new). The dist inventory, count and content digest are measured here; no earlier record is trusted. The record is written first, then the fresh file count and path membership must equal the pinned expectation or this step fails (the failure record prevents the test from launching). The full content digest of this source's build is retained for the post-test equality, not pinned."""
    need(owned(), "bind_build_capture_not_owned")
    pre = load_json(CAP / "bind-pre.json")
    need(get(pre, "phase") == "pre", "bind_build_without_pre_record")
    probe = load_json(CAP / "db-probe.json")
    need(get(probe, "ok") is True, "bind_build_without_a_passing_database_probe")
    identity = common_identity()
    PARTIAL["identity"] = identity
    control = measure_control(identity["control_github_sha"])
    PARTIAL["control"] = control
    source = measure_source(BUILT_IGNORED)
    PARTIAL["source"] = source
    tools = measure_tools()
    PARTIAL["tools"] = tools
    dist = measure_dist()
    PARTIAL["dist"] = {"files": dist["files"], "digest": dist["digest"]}
    zod = measure_zod()
    PARTIAL["zod"] = {"files": zod["files"], "directories": zod["directories"], "bytes": zod["bytes"], "digest": zod["digest"]}
    write_new(CAP / "bind-build.json", {"phase": "build", **identity, "control": control, "source": source, "tools": tools, "dist": dist, "zod": zod,
                                        "commands": LEDGER, "utc": utc(), "monotonic_seconds": round(time.monotonic() - T0, 6)})
    need(identity["control_github_sha"] == pre["control_github_sha"], "control_identity_changed_before_test")
    need(control == pre["control"], "control_changed_before_test")
    need(without_ignored(source) == without_ignored(pre["source"]), "source_changed_by_setup_or_build")
    need(tools == pre["tools"], "tools_changed_before_test")
    need(zod == pre["zod"], "installed_zod_changed_before_test")
    need(dist["files"] == EXPECTED_DIST_FILES, "dist_file_count_differs_from_expected")
    need(dist_membership_sha256(dist["inventory"]) == EXPECTED_DIST_PATHS_SHA256, "dist_membership_differs_from_expected")
    print("bind-build ok", dist["files"], dist["digest"])
    return 0


def cmd_precheck():
    """Launcher gate: pre, the passing database probe and the build binding completed in this run, no failure record, the disposable URL is exactly the
    literal, the socket model re-derived and still fitting, and no stage directory yet."""
    need(owned(), "precheck_capture_not_owned")
    pre = load_json(CAP / "bind-pre.json")
    need(get(pre, "phase") == "pre", "precheck_pre_record")
    need(get(load_json(CAP / "db-probe.json"), "ok") is True, "precheck_database_probe")
    need(get(load_json(CAP / "bind-build.json"), "phase") == "build", "precheck_build_record")
    need(os.environ.get("TEST_DATABASE_URL") == DB_URL_LITERAL, "precheck_test_database_url")
    need(not [p for p in CAP.glob("*-failure.json")], "precheck_failure_record_present")
    again = socket_model()
    need(get(pre, "socket_model") == again, "precheck_socket_model_changed")
    need(not os.path.lexists(CAP / "stage"), "precheck_stage_exists")
    return 0


def cmd_post():
    """After the test, also after a failing test: control, source, tools and dist are measured again and must equal the pre/bind-build bindings."""
    need(owned(), "post_capture_not_owned")
    pre = load_json(CAP / "bind-pre.json")
    need(get(pre, "phase") == "pre", "post_without_pre_record")
    build = load_json(CAP / "bind-build.json")
    need(get(build, "phase") == "build", "post_without_build_record")
    identity = common_identity()
    PARTIAL["identity"] = identity
    control = measure_control(identity["control_github_sha"])
    PARTIAL["control"] = control
    source = measure_source(BUILT_IGNORED)
    PARTIAL["source"] = source
    tools = measure_tools()
    PARTIAL["tools"] = tools
    dist = measure_dist()
    PARTIAL["dist"] = {"files": dist["files"], "digest": dist["digest"]}
    zod = measure_zod()
    PARTIAL["zod"] = {"files": zod["files"], "directories": zod["directories"], "bytes": zod["bytes"], "digest": zod["digest"]}
    write_new(CAP / "bind-post.json", {"phase": "post", **identity, "control": control, "source": source, "tools": tools, "dist": dist, "zod": zod, "commands": LEDGER,
                                       "utc": utc(), "monotonic_seconds": round(time.monotonic() - T0, 6)})
    need(identity["control_github_sha"] == pre["control_github_sha"], "control_identity_changed")
    need(control == pre["control"], "control_changed_during_run")
    need(without_ignored(source) == without_ignored(pre["source"]), "source_changed_during_run")
    need(source["ignored"] == build["source"]["ignored"], "ignored_entries_changed_during_run")
    need(tools == pre["tools"], "tools_changed_during_run")
    need(zod == pre["zod"] and zod == build["zod"], "installed_zod_changed_during_run")
    need(dist == build["dist"], "dist_changed_during_run")
    print("post ok")
    return 0


# ---- Pinned Vitest 4.1.12 verbose reporter, as established by the independent review of the installed sources (stream split, FAIL/divider/banner structure).
# STDOUT carries the verbose case records (one line per case: glyph, full name, duration; short `→ message` arrows) and the final `Test Files` / `Tests` rows.
# STDERR carries the `Failed Suites` / `Failed Tests` banners, the exact `FAIL <identity>` references, the complete diagnostic bodies and the group dividers.
# The two streams are parsed SEPARATELY and never concatenated: there is no cross-stream chronology. printTestModule of the verbose reporter prints nothing, so
# per-file result rows are NOT expected; any record-looking line that is not a known case record is retained and makes the evidence incomplete.
PINNED_GLYPHS = {"✓": "pass", "×": "fail", "↓": "skip", "□": "todo"}
RECORD_START = re.compile(r"^[✓√×✗✘↓□○❯] ")
DURATION = re.compile(r" [0-9]+(?:\.[0-9]+)?m?s$")
FRAME = re.compile(r"^❯ .*:[0-9]+:[0-9]+")
BANNER = re.compile(r"^⎯+ (Failed Suites|Failed Tests) ([0-9]+) ⎯+$")
DIVIDER = re.compile(r"^⎯+(?: ?\[([0-9]+)/([0-9]+)\] ?⎯*)?$")
FAIL_REF = re.compile(r"^FAIL (.+)$")


def norm(text):
    return re.sub(r"\s+", " ", text.strip())


EXACT_NAMES = {norm(name): index for index, name in EXACT_CASES}
# Suite/file FAIL references can only be a selected file or one of the actual "<file> > <describe title>" suites; never a fabricated case identity.
SUITE_REFS = set(GATE_FILES) | {norm(name).rsplit(" > ", 1)[0] for _, name in EXACT_CASES}


def summary_counts(lines, label):
    """One `Test Files` / `Tests` row -> {total, passed, failed, ...}; None when the row is absent, repeated or not understood (never inferred)."""
    rows = [line for line in lines if line.startswith(label + " ")]
    if len(rows) != 1:
        return None
    match = re.fullmatch(re.escape(label) + r" (.+?) \(([0-9]+)\)", rows[0])
    if match is None:
        return None
    counts = {"total": int(match.group(2))}
    for part in match.group(1).split(" | "):
        piece = re.fullmatch(r"([0-9]+) (failed|passed|expected fail|skipped|todo)", part)
        if piece is None or piece.group(2) in counts:
            return None
        counts[piece.group(2)] = int(piece.group(1))
    return counts


def parse_stdout(out):
    """STDOUT only: the case records and the final summaries. Every record-looking line is either an exact expected case identity with a pinned glyph or is kept in
    `unclassified` (a per-file row, a `❯` marker, a non-pinned glyph, a substituted or malformed name). Short `→` arrows are counted, never taken as stacks."""
    lines = [norm(line) for line in ANSI.sub("", out).splitlines()]
    lines = [line for line in lines if line != ""]
    seen, unclassified, arrows = {}, [], 0
    for line in lines:
        if RECORD_START.match(line) is None:
            if line.startswith("→ "):
                arrows += 1
            continue
        status = PINNED_GLYPHS.get(line[0])
        name = DURATION.sub("", line[2:], count=1)
        if status is not None and name in EXACT_NAMES:
            seen.setdefault(name, []).append(status)
        else:
            unclassified.append(line[:300])
    return {"line_count": len(lines), "seen": seen, "unclassified": unclassified, "arrow_lines": arrows,
            "test_files": summary_counts(lines, "Test Files"), "tests": summary_counts(lines, "Tests")}


def parse_stderr(err):
    """STDERR only: the failure banners and the emitted (merged) error groups. A group is one or more exact `FAIL <identity>` references, a nonempty diagnostic body and a
    closing `[n/m]` divider; n advances once per emitted group and m is the raw error-list size before merging. Groups are read only after a `Failed ...` banner. Raw
    slices (the original, unstripped lines) are returned for retention; anything that does not form a complete group is recorded in `problems` / `stray`."""
    original = err.splitlines()
    lines = [norm(line) for line in ANSI.sub("", err).splitlines()]
    banners, groups, problems, stray, unhandled = [], [], [], [], False
    section, group = None, None
    for number, line in enumerate(lines, start=1):
        banner = BANNER.match(line)
        if banner is not None or (line.startswith("⎯") and "Unhandled" in line):
            if group is not None:
                problems.append("group_open_at_banner:%d" % group["start"])
                group = None
            if banner is not None:
                section = "suites" if banner.group(1) == "Failed Suites" else "tests"
                banners.append({"kind": section, "count": int(banner.group(2)), "line": number})
            else:
                section, unhandled = "unhandled", True
            continue
        if section in (None, "unhandled") or line == "":
            continue
        divider = DIVIDER.match(line) if line.startswith("⎯") else None
        if divider is not None and divider.group(1) is not None:
            if group is None:
                problems.append("unexpected_divider:%d" % number)
                group = None
                continue
            if group["body"] == 0:
                problems.append("group_without_diagnostic_body:%d" % group["start"])
            group.update(end=number, section=section, numerator=int(divider.group(1)), denominator=int(divider.group(2)))
            group["text"] = "\n".join(original[group["start"] - 1:number])
            groups.append(group)
            group = None
            continue
        ref = FAIL_REF.match(line)
        if ref is not None:
            if group is not None and group["body"] > 0:
                problems.append("group_without_closing_divider:%d" % group["start"])
                group = None
            if group is None:
                group = {"start": number, "refs": [], "body": 0, "frames": 0}
            group["refs"].append(ref.group(1))
            continue
        if group is None:
            stray.append("%d:%s" % (number, line[:200]))
        else:
            group["body"] += 1
            if FRAME.match(line):
                group["frames"] += 1
    if group is not None:
        problems.append("truncated_open_group:%d" % group["start"])
    return {"line_count": len(lines), "banners": banners, "groups": groups, "problems": problems, "stray": stray[:20], "stray_count": len(stray), "unhandled": unhandled}


CONSOLE_HEADER = re.compile(r"^(stdout|stderr) \| (.+)$")
# REVISION002 (R2): the ONLY raw native diagnostics recognized before the first failure banner are the `unzip` stderr lines of the selected parity file (source-backed by the pinned
# parity fixtures and the retained raw historical stream; EXPECTATIONS, not runtime observations). The single-line families are exact strings after ANSI stripping and whitespace
# normalization; the central-directory diagnostic is ONE complete five-line block whose first line is a bracketed path under THIS run's capture TMPDIR. Nothing else is admitted.
RAW_UNZIP_LINES = frozenset((
    "caution: filename not matched: missing.txt",
    "caution: filename not matched: a.txt",
    "caution: filename not matched: ARTIFACT_INVENTORY.json",
    "file #1: bad zipfile offset (local header sig): 0",
    "foundation_rows_398.json bad CRC f9f71957 (should be 14b50923)",
))
RAW_UNZIP_BLOCK = (
    "End-of-central-directory signature not found. Either this file is not",
    "a zipfile, or it constitutes one disk of a multi-part archive. In the",
    "latter case the central directory and zipfile comment will be found on",
    "the last disk(s) of this archive.",
)
RAW_UNZIP_PATH = re.compile(r"\[" + re.escape(str(CAP / "tmp")) + r"/desk-extraction-parity-[A-Za-z0-9]{6}/fixture\.zip\]")


def classify_console(out, err, se):
    """Source-specific, never blanket. Every nonempty stderr line BEFORE the first failure banner (or all stderr lines when there is no banner) is classified on its own by a
    source-backed rule: (a) a Vitest relay header `stdout | <name>` / `stderr | <name>` whose <name> is an exact selected case identity, a known suite or a selected file (a header
    grants NO permission to any later line), (b) one exact line of RAW_UNZIP_LINES, or (c) one complete consecutive five-line RAW_UNZIP_PATH + RAW_UNZIP_BLOCK. Everything else - an
    unknown header, orphan text, a partial or interleaved block, any other diagnostic - is recorded as unknown/unclassified and refuses the evidence, whatever preceded it. Repetitions
    of a recognized family are counted and prove nothing about which test produced them. Failure sections keep the strict parse_stderr rules; both raw streams are retained whole.
    stdout stays strict by construction: any record-looking stdout line that is not an exact case record is `unclassified` in parse_stdout."""
    known = set(EXACT_NAMES) | set(SUITE_REFS)
    lines = [norm(line) for line in ANSI.sub("", err).splitlines()]
    limit = se["banners"][0]["line"] - 1 if se["banners"] else len(lines)
    region = lines[:limit]
    headers, blocks, unknown_headers, unclassified = 0, 0, [], []
    singles = {}
    index = 0
    while index < len(region):
        number, line = index + 1, region[index]
        if line == "":
            index += 1
            continue
        match = CONSOLE_HEADER.match(line)
        if match is not None:
            headers += 1
            if match.group(2) not in known:
                unknown_headers.append("%d:%s" % (number, line[:200]))
            index += 1
            continue
        if line in RAW_UNZIP_LINES:
            singles[line] = singles.get(line, 0) + 1
            index += 1
            continue
        if RAW_UNZIP_PATH.fullmatch(line) is not None:
            if tuple(region[index + 1:index + 5]) == RAW_UNZIP_BLOCK:
                blocks += 1
                index += 5
                continue
            unclassified.append("%d:partial_or_interleaved_central_directory_block:%s" % (number, line[:160]))
            index += 1
            continue
        unclassified.append("%d:%s" % (number, line[:200]))
        index += 1
    out_headers = sum(1 for line in (norm(raw) for raw in ANSI.sub("", out).splitlines()) if CONSOLE_HEADER.match(line))
    return {"stderr_relay_headers": headers, "raw_unzip_single_counts": singles, "raw_unzip_single_total": sum(singles.values()), "raw_unzip_central_directory_blocks": blocks,
            "stderr_lines_before_first_banner": limit, "unknown_headers": unknown_headers[:20], "unknown_header_count": len(unknown_headers), "unclassified_lines": unclassified[:20],
            "unclassified_count": len(unclassified), "stdout_relay_headers": out_headers, "first_failure_banner_line": se["banners"][0]["line"] if se["banners"] else None}


P33_NONCE = re.compile(r"[0-9a-f]{48}")
P33_CASE_LIMITS = {"result.json": 65536, "completion.json": 4096, "output.log": 65536}   # the unchanged producer's own record limits (OUTPUT_LIMIT / RECORD_LIMIT)


def regular_member_bytes(path, limit):
    """Nonfollowing bounded read of ONE regular single-link file; None for anything else, anything unreadable or anything over the limit."""
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    except OSError:
        return None
    with os.fdopen(fd, "rb") as stream:
        st = os.fstat(stream.fileno())
        if not stat.S_ISREG(st.st_mode) or st.st_nlink != 1 or st.st_size > limit:
            return None
        data = stream.read(limit + 1)
    return data if len(data) == st.st_size else None


def bounded_members(directory, maximum):
    """The first maximum+1 entries of one directory (the extra entry is only an overrun detector); a larger directory is never materialized."""
    found = []
    with os.scandir(directory) as entries:
        for entry in entries:
            found.append(entry)
            if len(found) > maximum:
                break
    return found


def member_kinds(entries):
    kinds = {}
    for entry in entries:
        st = entry.stat(follow_symlinks=False)
        kinds[entry.name] = "dir" if stat.S_ISDIR(st.st_mode) else ("file" if stat.S_ISREG(st.st_mode) and st.st_nlink == 1 else ("socket" if stat.S_ISSOCK(st.st_mode) else "other"))
    return dict(sorted(kinds.items()))


def p33_case_evidence(attempt):
    """REVISION002 (R1): the selected parity file really runs the P33 case, so a successful gate attempt is exactly the two regular records `prerequisite.json` and `guard-result.json`, the retained `guard.sock` socket pathname, and ONE real
    directory named by a 48-lowercase-hex nonce; that directory holds exactly the three regular single-link files `result.json`, `completion.json` and `output.log` (the unchanged producer
    removes only its nested temporary directory). The result must be protocol 1, the directory nonce, mode p33, outcome COMPLETED, reason child_exit, empty controls, true settled /
    directReaped / noChildren / complete / childStarted, present empty errors / residual / cleanupErrors, and a nonempty list of distinct positive-integer reaped pids each with raw 0 and exit 0
    (the number of reaped children is NOT fixed). The completion must be exactly {protocol 1, nonce, case "P33 multidisk", assertionsCompleted true, hooksCompleted true}. The complete output.log
    is measured (size, sha256) and retained whole. The owner pid is not emitted by the case result, so none is claimed. Returns (facts, problems); any problem is a HOLD."""
    facts = {}
    try:
        members = bounded_members(attempt, 4)
        kinds = member_kinds(members)
    except OSError as error:
        return facts, ["attempt_unreadable:" + type(error).__name__]
    facts["attempt_members"] = kinds
    nonces = sorted(name for name, kind in kinds.items() if kind == "dir")
    files = sorted(name for name, kind in kinds.items() if kind == "file")
    if len(members) != 4 or kinds.get("guard.sock") != "socket" or files != ["guard-result.json", "prerequisite.json"] or len(nonces) != 1 or P33_NONCE.fullmatch(nonces[0]) is None:
        return facts, ["attempt_is_not_exactly_two_records_one_guard_socket_and_one_nonce_directory"]
    nonce = nonces[0]
    try:
        inner = bounded_members(attempt / nonce, 3)
        inner_kinds = member_kinds(inner)
    except OSError as error:
        return facts, ["case_directory_unreadable:" + type(error).__name__]
    facts["case_directory"] = nonce
    facts["case_members"] = inner_kinds
    if len(inner) != 3 or inner_kinds != {"completion.json": "file", "output.log": "file", "result.json": "file"}:
        return facts, ["case_directory_is_not_exactly_the_three_regular_records"]
    raw = {name: regular_member_bytes(attempt / nonce / name, limit) for name, limit in P33_CASE_LIMITS.items()}
    if any(value is None for value in raw.values()):
        return facts, ["case_record_unreadable_or_over_its_limit"]
    facts["output_log"] = {"bytes": len(raw["output.log"]), "sha256": sha256_bytes(raw["output.log"])}
    try:
        result = json.loads(raw["result.json"].decode("utf-8"))
        completion = json.loads(raw["completion.json"].decode("utf-8"))
    except ValueError:
        return facts, ["case_record_not_json"]
    problems = []
    flags = ("settled", "directReaped", "noChildren", "complete", "childStarted")
    result_ok = (isinstance(result, dict) and type(result.get("protocol")) is int and result["protocol"] == 1 and result.get("nonce") == nonce and result.get("mode") == "p33"
                 and result.get("outcome") == "COMPLETED" and result.get("reason") == "child_exit" and "controls" in result and result["controls"] == []
                 and all(result.get(key) is True for key in flags) and all(key in result and result[key] == [] for key in ("errors", "residual", "cleanupErrors")))
    if not result_ok:
        problems.append("case_result_is_not_the_completed_p33_child_exit_with_empty_residue")
    pids = []
    reaped = result.get("reaped") if isinstance(result, dict) else None
    reaped_ok = isinstance(reaped, list) and len(reaped) >= 1
    if reaped_ok:
        for row in reaped:
            if not (isinstance(row, dict) and type(row.get("pid")) is int and row["pid"] > 0 and type(row.get("raw")) is int and row["raw"] == 0
                    and type(row.get("exit")) is int and row["exit"] == 0):
                reaped_ok = False
                break
            pids.append(row["pid"])
        reaped_ok = reaped_ok and len(set(pids)) == len(pids)
    if not reaped_ok:
        problems.append("case_reaped_list_is_not_nonempty_distinct_positive_pids_with_raw_and_exit_zero")
    completion_ok = (isinstance(completion, dict) and sorted(completion) == ["assertionsCompleted", "case", "hooksCompleted", "nonce", "protocol"]
                     and type(completion["protocol"]) is int and completion["protocol"] == 1 and completion["nonce"] == nonce and completion["case"] == "P33 multidisk"
                     and completion["assertionsCompleted"] is True and completion["hooksCompleted"] is True)
    if not completion_ok:
        problems.append("case_completion_is_not_the_exact_p33_multidisk_record")
    facts["reaped_pids"] = pids if reaped_ok else []
    facts["result"] = {"outcome": result.get("outcome") if isinstance(result, dict) else None, "reason": result.get("reason") if isinstance(result, dict) else None, "reaped_count": len(pids)}
    return facts, problems


def evaluate(check, report):
    """Every check reads the actual retained facts; an absent or mistyped field fails its check. `report` receives the facts the verdict publishes."""
    check("no_phase_failure_records", sorted(p.name for p in CAP.glob("*-failure.json")) == [])
    pre = load_json(CAP / "bind-pre.json")
    build = load_json(CAP / "bind-build.json")
    post = load_json(CAP / "bind-post.json")
    probe = load_json(CAP / "db-probe.json")
    check("bind_pre_record_present", get(pre, "phase") == "pre")
    check("bind_build_record_present", get(build, "phase") == "build")
    check("bind_post_record_present", get(post, "phase") == "post")
    check("database_probe_passed_postgres17_the_desk_test", get(probe, "ok") is True and get(probe, "server", "major") == 17
          and get(probe, "server", "database") == DB_NAME and get(probe, "returncode") == 0)
    for key in ("control_github_sha", "control", "tools"):
        check("pre_build_post_equal_" + key, get(pre, key) is not MISSING and get(pre, key) == get(build, key) == get(post, key))
    source_pre, source_build, source_post = get(pre, "source"), get(build, "source"), get(post, "source")
    check("source_equal_pre_build_post_modulo_ignored", all(isinstance(s, dict) for s in (source_pre, source_build, source_post))
          and without_ignored(source_pre) == without_ignored(source_build) == without_ignored(source_post))
    check("ignored_entries_as_expected", get(source_pre, "ignored") in ([], ["!! node_modules/"]) and get(source_build, "ignored") == get(source_post, "ignored")
          and get(source_build, "ignored") in (["!! dist/"], ["!! dist/", "!! node_modules/"]))
    check("pre_build_post_equal_installed_zod", get(pre, "zod") is not MISSING and get(pre, "zod") == get(build, "zod") == get(post, "zod"))
    check("installed_zod_is_4_6_6_with_the_reviewed_locked_integrity_and_a_bounded_nonempty_member_set",
          get(pre, "zod", "version") == ZOD_VERSION and get(pre, "zod", "project_lock", "resolved") == ZOD_RESOLVED and get(pre, "zod", "project_lock", "integrity") == ZOD_INTEGRITY
          and get(pre, "zod", "hidden_lock", "resolved") == ZOD_RESOLVED and get(pre, "zod", "hidden_lock", "integrity") == ZOD_INTEGRITY
          and isinstance(get(pre, "zod", "files"), int) and get(pre, "zod", "files") > 0 and isinstance(get(pre, "zod", "digest"), str) and len(get(pre, "zod", "digest")) == 64)
    check("identity_table_725_names_11_files_pinned_digest", get(pre, "identity_table", "cases") == CASE_TOTAL and get(pre, "identity_table", "names_sha256") == IDENTITIES_SHA256
          and get(pre, "identity_table", "per_file") == list(CASE_COUNTS))
    report["installed_zod"] = {key: (None if get(pre, "zod", key) is MISSING else get(pre, "zod", key)) for key in ("files", "directories", "entries", "bytes", "digest", "package_json_sha256", "root_identity")}
    dist_build, dist_post = get(build, "dist"), get(post, "dist")
    check("dist_inventory_equal_build_and_post", dist_build is not MISSING and dist_build == dist_post)
    dist_files, dist_digest = get(build, "dist", "files"), get(build, "dist", "digest")
    check("dist_nonempty_with_recorded_digest", isinstance(dist_files, int) and dist_files > 0 and isinstance(dist_digest, str) and len(dist_digest) == 64)
    report["dist"] = {"files": None if dist_files is MISSING else dist_files, "digest": None if dist_digest is MISSING else dist_digest}
    check("dist_matches_the_expected_count_and_membership", dist_files == EXPECTED_DIST_FILES and dist_membership_sha256(get(build, "dist", "inventory")) == EXPECTED_DIST_PATHS_SHA256)
    check("source_sha_literal", get(pre, "source_sha") == SOURCE_SHA and get(post, "source_sha") == SOURCE_SHA)
    control_sha = get(pre, "control_github_sha")
    check("control_sha_distinct_from_source", isinstance(control_sha, str) and control_sha != SOURCE_SHA and get(pre, "control", "head") == control_sha)
    check("control_sole_parent_is_source", get(pre, "control", "sole_parent") == SOURCE_SHA)
    check("control_delta_is_the_five_files", isinstance(get(pre, "control", "delta"), dict) and sorted(get(pre, "control", "delta")) == list(CONTROL_FILES))
    check("control_worktree_clean", get(pre, "control", "status") == "")
    check("source_360_files", get(pre, "source", "files") == EXPECTED_FILES and get(pre, "source", "inventory_sha256") == INVENTORY_SHA256)
    check("gate_test_files_pinned", get(pre, "source", "gate_tests") == {rel: {"bytes": GATE_PINS[rel][0], "sha256": GATE_PINS[rel][1], "blob": GATE_PINS[rel][2]} for rel in GATE_FILES})
    modeled = get(pre, "socket_model", "bytes")
    check("socket_path_shorter_than_108", isinstance(modeled, int) and not isinstance(modeled, bool) and modeled < SOCKET_LIMIT
          and get(pre, "socket_model", "limit") == SOCKET_LIMIT and isinstance(get(pre, "socket_model", "uid"), int))
    stage = CAP / "stage"
    exact = {"limits.txt": "core 0 0\nfsize 67108864 67108864\n", "snapshot-status.txt": "ps-pre 0\nps-post 0\n", "argv.txt": GUARD_ARGV, "pre-attempts": ""}
    for name, text in exact.items():
        check("stage_" + name + "_exact", read_text(stage / name) == text)
    check("stage_env_keys_exact", read_text(stage / "env-keys.txt") in ENV_KEYS)
    for name in ("started-utc", "ended-utc", "monotonic-start.txt", "monotonic-end.txt", "ps-pre.txt", "ps-post.txt", "post-attempts", "stdout", "stderr"):
        check("stage_present_" + name, read_text(stage / name) is not MISSING)
    check("no_prelaunch_failure_record", not os.path.lexists(stage / "prelaunch-failed"))
    exit_text = read_text(stage / "exit")
    stage_exit = int(exit_text) if isinstance(exit_text, str) and re.fullmatch(r"[0-9]+\n", exit_text) else None
    report["stage_exit"] = stage_exit
    check("stage_exit_is_a_recorded_integer", stage_exit is not None)
    runtimes = sorted(CAP.glob("tmp/the-desk-p33-*"))
    attempts = sorted(CAP.glob("tmp/the-desk-p33-*/attempt-*"))
    check("exactly_one_runtime_directory", len(runtimes) == 1)
    check("exactly_one_guard_attempt", len(attempts) == 1)
    reaped = []
    if len(attempts) == 1:
        attempt = attempts[0]
        check("post_attempts_names_the_attempt", read_text(stage / "post-attempts") == attempt.name + "\n")
        prereq = load_json(attempt / "prerequisite.json")
        check("prerequisite_subreaper_pidfd_proc", get(prereq, "subreaper") is True and get(prereq, "pidfdSignal0") is True and get(prereq, "proc") is True)
        check("prerequisite_interpreter_identity", isinstance(get(prereq, "python"), str) and isinstance(get(prereq, "kernel"), str)
              and get(prereq, "executable") == get(pre, "tools", "python", "executable") and get(prereq, "executable") is not MISSING)
        guard = load_json(attempt / "guard-result.json")
        check("guard_fatal_present_null", get(guard, "fatal") is None)
        check("guard_contained_rejection_present_null", get(guard, "containedRejection") is None)
        for key in ("settled", "directReaped", "noChildren", "complete"):
            check("guard_" + key + "_true", get(guard, key) is True)
        for key in ("errors", "residual", "cleanupErrors"):
            check("guard_" + key + "_present_empty", get(guard, key) == [])
        listed = get(guard, "reaped")
        reaped = listed if isinstance(listed, list) else []
        allowed = (0,) if stage_exit == 0 else (0, 1)
        check("guard_reaped_nonempty_exits_consistent_with_the_stage_exit", stage_exit in (0, 1) and isinstance(listed, list) and len(listed) >= 1 and all(
            isinstance(r, dict) and isinstance(r.get("pid"), int) and not isinstance(r.get("pid"), bool) and r.get("exit") in allowed for r in listed)
            and (stage_exit == 0 or any(r.get("exit") == 1 for r in listed)))
        p33_facts, p33_problems = p33_case_evidence(attempt)
        report["p33_case"] = p33_facts
        report["p33_case_problems"] = p33_problems
        check("exactly_one_real_completed_p33_case_with_complete_bounded_evidence_and_no_other_member", p33_problems == [])
        reaped = reaped + [{"pid": pid} for pid in p33_facts.get("reaped_pids", [])]
    ps_post = read_text(stage / "ps-post.txt")
    post_pids = set()
    if ps_post is not MISSING:
        for line in ps_post.splitlines():
            parts = line.split()
            if parts and parts[0].isdigit():
                post_pids.add(int(parts[0]))
    check("recorded_reaped_pids_absent_after", ps_post is not MISSING and all(r.get("pid") not in post_pids for r in reaped if isinstance(r, dict)))
    out = read_text(stage / "stdout")
    err = read_text(stage / "stderr")
    check("stdout_and_stderr_readable", out is not MISSING and err is not MISSING)
    cases, outcome = [], "not_established"
    if out is not MISSING and err is not MISSING:
        so, se = parse_stdout(out), parse_stderr(err)
        console = classify_console(out, err, se)
        report["console_output"] = console
        missing, duplicated = [], []
        for index, name in EXACT_CASES:
            records = so["seen"].get(norm(name), [])
            if len(records) == 1:
                cases.append({"file": GATE_FILES[index], "name": name, "status": records[0]})
            elif records:
                duplicated.append(name)
            else:
                missing.append(name)
        per_file = [sum(1 for c in cases if c["file"] == rel) for rel in GATE_FILES]
        counts = {s: sum(1 for c in cases if c["status"] == s) for s in ("pass", "fail", "skip", "todo")}
        failed_names = [c["name"] for c in cases if c["status"] == "fail"]
        status_of = {norm(c["name"]): c["status"] for c in cases}
        failed_files = {c["file"] for c in cases if c["status"] == "fail"}
        referenced_failed, suite_refs, ref_unknown, ref_misplaced, ref_nonfailed = set(), [], [], [], []
        for g in se["groups"]:
            for ref in g["refs"]:
                if ref in EXACT_NAMES:
                    if g["section"] != "tests":
                        ref_misplaced.append(ref)
                    if status_of.get(ref) == "fail":
                        referenced_failed.add(ref)
                    else:
                        ref_nonfailed.append(ref)
                elif ref in SUITE_REFS:
                    if g["section"] != "suites":
                        ref_misplaced.append(ref)
                    suite_refs.append(ref)
                else:
                    ref_unknown.append(ref)
        suite_files = {ref.split(" > ")[0] for ref in suite_refs}
        numerators = [g["numerator"] for g in se["groups"]]
        denominators = sorted({g["denominator"] for g in se["groups"]})
        raw_refs = sum(len(g["refs"]) for g in se["groups"])
        tests_banners = [b["count"] for b in se["banners"] if b["kind"] == "tests"]
        suites_banners = [b["count"] for b in se["banners"] if b["kind"] == "suites"]
        report.update(cases=cases, case_counts=counts, per_file=per_file, failed_cases=failed_names, unclassified=so["unclassified"][:20], unclassified_count=len(so["unclassified"]),
                      missing_cases=missing[:20], duplicated_cases=duplicated[:20], test_files=so["test_files"], tests=so["tests"], stdout_arrow_lines=so["arrow_lines"],
                      stderr_banners=se["banners"], stderr_problems=se["problems"], stderr_stray=se["stray"], stderr_stray_count=se["stray_count"], unhandled_section=se["unhandled"],
                      failure_groups=[{"section": g["section"], "start_line": g["start"], "end_line": g["end"], "refs": g["refs"], "diagnostic_body_lines": g["body"], "frame_lines": g["frames"],
                                       "numerator": g["numerator"], "denominator": g["denominator"], "raw_bytes": len(g["text"].encode("utf-8", "replace")),
                                       "raw_sha256": sha256_bytes(g["text"].encode("utf-8", "replace"))} for g in se["groups"]],
                      failure_group_slices=[{"start_line": g["start"], "end_line": g["end"], "text": g["text"]} for g in se["groups"]],
                      divider_denominators=denominators, raw_fail_references=raw_refs, suite_references=sorted(set(suite_refs)),
                      stderr_bytes=len(err.encode()), stdout_bytes=len(out.encode()),
                      database_url_literal_occurrences={"stdout": out.count(DB_URL_LITERAL), "stderr": err.count(DB_URL_LITERAL)})
        check("exact_725_name_bijection_with_exactly_one_pinned_result_record_each", not missing and not duplicated and so["unclassified"] == [] and len(cases) == CASE_TOTAL
              and sorted(so["seen"]) == sorted(norm(name) for _, name in EXACT_CASES))
        check("case_counts_per_file_equal_the_eleven_pinned_counts", tuple(per_file) == CASE_COUNTS)
        check("stderr_before_the_first_failure_banner_is_only_known_headers_exact_raw_unzip_lines_and_complete_central_directory_blocks", console["unknown_header_count"] == 0 and console["unclassified_count"] == 0)
        check("no_unclassified_result_lines", so["unclassified"] == [])
        check("no_skipped_or_todo_cases", counts["skip"] == 0 and counts["todo"] == 0)
        files, tests = so["test_files"], so["tests"]
        check("tests_summary_total_725_reconciles_with_the_case_records", isinstance(tests, dict) and tests.get("total") == CASE_TOTAL
              and tests.get("passed", 0) == counts["pass"] and tests.get("failed", 0) == counts["fail"]
              and tests.get("skipped", 0) == 0 and tests.get("todo", 0) == 0 and tests.get("expected fail", 0) == 0
              and tests.get("passed", 0) + tests.get("failed", 0) == CASE_TOTAL)
        failing_files = failed_files | suite_files
        check("test_files_summary_total_11_reconciles_with_case_and_suite_failures", isinstance(files, dict) and files.get("total") == len(GATE_FILES)
              and files.get("failed", 0) == len(failing_files) and files.get("passed", 0) == len(GATE_FILES) - len(failing_files)
              and files.get("skipped", 0) == 0 and files.get("todo", 0) == 0 and files.get("expected fail", 0) == 0)
        check("failure_group_structure_established", se["problems"] == [] and se["stray_count"] == 0 and all(g["body"] >= 1 for g in se["groups"]))
        check("failure_group_sequence_one_per_emitted_group", numerators == list(range(1, len(se["groups"]) + 1)))
        check("one_divider_denominator_equal_to_the_raw_fail_references", len(denominators) <= 1 and (not se["groups"] or denominators == [raw_refs]))
        check("failure_references_are_exact_known_identities_in_the_right_section", not ref_unknown and not ref_misplaced and not ref_nonfailed)
        check("every_failed_case_is_referenced_by_an_error_group", {norm(n) for n in failed_names} <= referenced_failed)
        check("failed_tests_banner_matches_the_failed_case_count", tests_banners == ([len(failed_names)] if failed_names else []))
        check("failed_suites_banner_matches_the_distinct_suite_references", suites_banners == ([len(set(suite_refs))] if suite_refs else []))
        check("failure_sections_present_exactly_when_something_failed", bool(se["banners"] or se["groups"]) == bool(failed_names or suite_refs))
        check("no_unhandled_errors_section_the_schema_cannot_establish", not se["unhandled"])
        if stage_exit is None:
            outcome = "exit_unreadable"
        elif stage_exit not in (0, 1):
            outcome = "abnormal_exit_%d" % stage_exit
        elif se["unhandled"]:
            outcome = "unhandled_errors_present"
        elif len(cases) != CASE_TOTAL:
            outcome = "not_established"
        else:
            parts = (["suite_errors:%d" % len(set(suite_refs))] if suite_refs else []) + (["case_failures:%d" % len(failed_names)] if failed_names else [])
            if not parts and counts["pass"] == CASE_TOTAL and stage_exit == 0:
                outcome = "all_passed"
            elif parts and stage_exit == 1:
                outcome = "+".join(parts)
            else:
                outcome = "not_established"
        check("exit_status_consistent_with_the_outcome", (outcome == "all_passed" and stage_exit == 0)
              or (outcome.startswith(("suite_errors:", "case_failures:")) and stage_exit == 1))
    report["test_outcome"] = outcome


def cmd_validate():
    """Writes the diagnostic verdict/check list BEFORE collection. Runs whenever the owned capture root was initialized, whatever failed earlier. The
    verdict separates evidence completeness (this command's exit status) from the test outcome (the workflow's final gate judges the real test step)."""
    need(owned(), "validate_without_an_owned_capture_root")
    need(not os.path.lexists(CAP / "verdict.json"), "verdict_already_exists")
    checks, failures, report = [], [], {}

    def check(label, ok):
        passed = ok is True
        checks.append({"check": label, "ok": passed})
        if not passed:
            failures.append(label)

    try:
        evaluate(check, report)
    except Exception as error:
        failures.append("validate_exception:" + type(error).__name__)
    slices = report.pop("failure_group_slices", None)
    if slices:
        try:
            write_new(CAP / "failure-groups.json", {"note": "complete raw slices (original stderr lines) of every emitted error group, by 1-based stderr line range", "groups": slices})
        except Exception as error:
            failures.append("failure_groups_record_not_written:" + type(error).__name__)
    outcome = report.get("test_outcome", "not_established")
    if failures:
        verdict = VERDICT_INCOMPLETE
    elif outcome == "all_passed":
        verdict = VERDICT_ALL_PASS
    else:
        verdict = VERDICT_FAILURES
    document = {"verdict": verdict, "evidence_complete": not failures, "test_outcome": outcome, "job_expected_conclusion": "success" if verdict == VERDICT_ALL_PASS else "failure",
                "failures": failures, "checks": checks, **report,
                "note": "Eleven selected files / 725 cases only: never a full-CI, 76-file or 8,468-test result. Evidence completeness is this verdict; the test outcome is the "
                        "real child status; the workflow gate keeps the job red for any failing case. Upload success is judged by the workflow gate."}
    write_new(CAP / "verdict.json", document)
    print(json.dumps({k: document[k] for k in ("verdict", "evidence_complete", "test_outcome", "failures")}, sort_keys=True))
    return 0 if not failures else 1


def publish_upload_ready():
    """Appends the fixed line `upload_ready=true` to the runner-provided GITHUB_OUTPUT file (which already exists; never created here). Any failure is a HOLD."""
    path = os.environ.get("GITHUB_OUTPUT", "")
    need(path != "", "github_output_channel_missing")
    try:
        fd = os.open(path, os.O_WRONLY | os.O_APPEND | os.O_NOFOLLOW)
        with os.fdopen(fd, "ab") as stream:
            stream.write(b"upload_ready=true\n")
            stream.flush()
            os.fsync(stream.fileno())
    except OSError:
        raise Hold("upload_ready_output_not_published")


def cmd_collect():
    """Builds the upload snapshot from verified regular-file copies of the owned capture root (verdict and exact raw inputs included) with explicit
    finite ceilings. Type, size and budget are checked BEFORE a bounded read. The guard's unix socket is recorded as a non-content omission and is
    never copied; any other link/special member, any limit overrun and any omission is a recorded HOLD. A partial snapshot is retained, not hidden.
    Ownership is verified first and the fresh UPLOAD directory is created exclusively; only then is `upload_ready=true` published, so the upload step
    can never transmit a directory this process did not create. Failure after that point keeps the partial snapshot uploadable but collect fails."""
    need(owned(), "collect_without_an_owned_capture_root")
    os.mkdir(UPLOAD, 0o700)
    UPLOAD_STATE["created"] = True
    publish_upload_ready()
    holds, sockets, copied = [], [], []
    state = {"entries": 0, "total": 0, "stopped": False}

    def copy_file(rel, path, st):
        if st.st_size > COLLECT_FILE:
            holds.append("file_over_64MiB:%s:%d" % (rel, st.st_size))
            return
        if state["total"] + st.st_size > COLLECT_TOTAL:
            holds.append("aggregate_over_512MiB_budget_before:" + rel)
            return
        data = read_bounded(path)
        if data is MISSING or len(data) != st.st_size:
            holds.append("read_failed_or_size_changed:" + rel)
            return
        target = UPLOAD / rel
        write_bytes_new(target, data)
        back = read_bounded(target)
        digest = sha256_bytes(data)
        if back is MISSING or sha256_bytes(back) != digest or len(back) != len(data):
            holds.append("copy_hash_mismatch:" + rel)
            return
        state["total"] += len(data)
        copied.append((rel, len(data), digest))

    def visit(directory, rel_dir, depth):
        if depth > COLLECT_DEPTH:
            holds.append("depth_over_24:" + rel_dir)
            return
        with os.scandir(directory) as scan:
            ordered = sorted(scan, key=lambda e: e.name.encode())
        for entry in ordered:
            state["entries"] += 1
            if state["entries"] > COLLECT_ENTRIES:
                holds.append("entries_over_4096")
                state["stopped"] = True
                return
            rel = rel_dir + entry.name
            st = entry.stat(follow_symlinks=False)
            if stat.S_ISDIR(st.st_mode):
                os.mkdir(UPLOAD / rel, 0o700)
                visit(entry.path, rel + "/", depth + 1)
                if state["stopped"]:
                    return
            elif stat.S_ISREG(st.st_mode):
                copy_file(rel, entry.path, st)
            elif stat.S_ISSOCK(st.st_mode) and SOCKET_RE.fullmatch(rel):
                sockets.append(rel)
            else:
                holds.append("link_or_special_not_copied:%s:%o" % (rel, stat.S_IFMT(st.st_mode)))

    visit(str(CAP), "", 1)
    verdict = load_json(CAP / "verdict.json")
    if get(verdict, "verdict") is MISSING:
        holds.append("verdict_missing_or_unreadable")
    manifest = "".join("%s  %s\n" % (digest, rel) for rel, size, digest in sorted(copied, key=lambda r: r[0].encode()))
    status = {"status": "complete" if not holds else "partial_hold", "holds": holds, "copied_files": len(copied), "copied_bytes": state["total"],
              "entries_seen": state["entries"], "omitted_guard_sockets": sockets, "verdict": get(verdict, "verdict") if get(verdict, "verdict") is not MISSING else None,
              "limits": {"entries": COLLECT_ENTRIES, "depth": COLLECT_DEPTH, "file_bytes": COLLECT_FILE, "total_bytes": COLLECT_TOTAL},
              "sizes": {rel: size for rel, size, digest in copied},
              "note": "Cancellation, the job deadline or a lost runner can leave this evidence incomplete; that is HOLD, never a pass."}
    status_bytes = (json.dumps(status, sort_keys=True, indent=2) + "\n").encode()
    for root in (BASE, UPLOAD):
        write_bytes_new(root / "MANIFEST.sha256", manifest.encode())
        write_bytes_new(root / "collect-status.json", status_bytes)
    print("collect", status["status"], len(copied), "copied", len(sockets), "socket omitted", len(holds), "holds")
    print("manifest sha256", sha256_bytes(manifest.encode()), "status sha256", sha256_bytes(status_bytes))
    return 0 if not holds else 1


def main():
    commands = {"pre": cmd_pre, "dbprobe": cmd_dbprobe, "bind-build": cmd_bind_build, "precheck": cmd_precheck, "post": cmd_post, "validate": cmd_validate,
                "collect": cmd_collect}
    if len(sys.argv) != 2 or sys.argv[1] not in commands:
        print("usage: gate_bind.py pre|dbprobe|bind-build|precheck|post|validate|collect", file=sys.stderr)
        return 64
    phase = sys.argv[1]
    try:
        return commands[phase]()
    except Hold as error:
        write_failure(phase, "hold", str(error))
        print("HOLD:", error, file=sys.stderr)
        return 3
    except Exception as error:
        write_failure(phase, "exception", type(error).__name__ + ":" + str(error)[:200])
        print("EXCEPTION:", type(error).__name__, file=sys.stderr)
        return 70


if __name__ == "__main__":
    raise SystemExit(main())
