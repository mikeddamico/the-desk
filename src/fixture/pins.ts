// External trust anchors for the active Frozen Walking-Skeleton Fixture v0.4.6 (FINAL LOCK v1.2.6). They live in code,
// never in the pack. Changing any value means a different fixture and a reviewed Lock change, not a loader edit.
export interface FixturePins {
  zipSha256: string;
  packMembersSha256: string;
  /** Exactly the 40 table families of the one active load and their row counts (398 rows, 36 artifacts). */
  familyCounts: Readonly<Record<string, number>>;
  totalRows: number;
  artifactRows: number;
  currentArtifactRows: number;
  /** The one retained historical direction artifact (Layer B 4/5): id and accepted hash, never recomputed. */
  historicalDirection: { artifactId: string; contentHash: string };
  /** The single row-bearing member; every other member is evidence, never a load. */
  activeLoadMember: string;
}

export const FIXTURE_V046_PINS: FixturePins = {
  zipSha256: "7e1bb1108cdd84e47269b9ab2dab20ba934fcec64d44262f86d2b505616b0747",
  packMembersSha256:
    "58a3c5e6188a91eba380c4cb4c08fbebb747513b5979ca9b3b0baab61d5b84fe",
  familyCounts: {
    accounts: 2,
    artifacts: 36,
    assembly_recipes: 1,
    audio_artifacts: 12,
    audit_runs: 2,
    claim_state_events: 0,
    claim_supports: 9,
    claims: 9,
    derivation_runs: 1,
    evidence_packages: 1,
    evidence_units: 16,
    gate_definitions: 32,
    gate_results: 62,
    master_assembly_maps: 1,
    model_runs: 5,
    performance_direction_versions: 1,
    performance_intents: 8,
    program_blocks: 9,
    program_run_attempts: 2,
    program_runs: 2,
    prompt_manifests: 5,
    pronunciation_renderings: 3,
    pronunciations: 2,
    provider_call_events: 15,
    provider_calls: 15,
    render_blocks: 9,
    render_manifests: 1,
    render_takes: 10,
    reroll_triggers: 1,
    rights_versions: 7,
    script_versions: 3,
    show_config_versions: 2,
    showrunner_brief_versions: 1,
    shows: 1,
    take_selections: 10,
    turn_claim_uses: 36,
    turn_evidence_uses: 9,
    turns: 51,
    voice_profile_versions: 3,
    voice_profiles: 3,
  },
  totalRows: 398,
  artifactRows: 36,
  currentArtifactRows: 35,
  historicalDirection: {
    artifactId: "d1250005-0000-4000-8000-000000000012",
    contentHash:
      "ea5926e81267dd749cf33ed29564fe88815d3243b68260f1b4ddb96588e2f533",
  },
  activeLoadMember: "foundation_rows_398.json",
};

export const FIXTURE_ZIP_RELATIVE_PATH =
  "Lock/04_IMPLEMENTATION/The_Desk_Walking_Skeleton_Fixture_v0.4.6.zip";
