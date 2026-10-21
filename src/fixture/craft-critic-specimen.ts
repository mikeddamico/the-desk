// The fixed Craft Critic semantic specimen `craft-critic-specimen/1` (dependent contract `craft-critic-fixture/1`, docs/g1-craft-critic.md).
// This is a NEW fixed fixture result returned by the trusted non-network G1-A `fixture_stub` route for the exact Pass-1 subject
// `script-v2` b18d1fce...4ae9. It is fixed authored diagnostic content: it carries the wording of the frozen historical critique for
// the four turns it cites (t08, t10, t12, t13), whose text is byte-identical in the new subject. It is not a replay of that critique, not a
// new evaluation of the changed turns (t06, t07), not model output and not an independent judgment of craft quality.
// Identities (pinned by the plan builder, never adjusted to fit an implementation): the CANONICAL-JSON SHA-256 of this object is the
// raw-response identity; it is NOT the SHA-256 of any formatted file. `finding_id` is local bookkeeping outside the governed review hash.
export const CRITIC_SPECIMEN_SCHEMA = "craft-critic-specimen/1";
export const CRITIC_SPECIMEN_CANONICAL_SHA256 =
  "a06de7505cf998e0b6cbc7d23758da8efcfdeb131e8414bcfde898af2a06c93b";
export const CRITIC_REVIEW_HASH =
  "b1129448ccdfd8ed799652b8463f16204f40b004bb5f6600279472eeb80df896";
export const CRITIC_CONTRACT_VERSION = "craft-critic-fixture-stub/1";
export const CRITIC_CRAFT_POLICY_VERSION = "writing-craft-0.1";

/** Craft v0.1 section 8.1 finding types (the dependent S0 profile closes the illustrative owner list). */
export const CRITIC_FINDING_TYPES = [
  "device_saturation",
  "conversational_inertia",
  "character_caricature",
  "detached_supporter_voice",
  "over_density",
  "brittle_comprehension",
  "flat_closing_synthesis",
  "educational_signposting",
  "other",
] as const;
export type CriticFindingType = (typeof CRITIC_FINDING_TYPES)[number];
export const CRITIC_SEVERITIES = ["note", "revise"] as const;
export type CriticSeverity = (typeof CRITIC_SEVERITIES)[number];
export const CRITIC_OUTCOMES = ["revise_once", "no_revision"] as const;
export type CriticOutcome = (typeof CRITIC_OUTCOMES)[number];

export interface CriticSpecimenSpanRef {
  readonly semantic_turn_id: string;
}
export interface CriticSpecimenFinding {
  readonly finding_id: string;
  readonly type: CriticFindingType;
  readonly severity: CriticSeverity;
  readonly span_refs: readonly CriticSpecimenSpanRef[];
  readonly observation: string;
  readonly consequence: string;
  readonly revision_instruction: string;
  readonly prohibited_shortcut: string | null;
}
export interface CriticSpecimen {
  readonly schema: string;
  readonly subject_script_hash: string;
  readonly craft_policy_version: string;
  readonly critic_contract_version: string;
  readonly findings: readonly CriticSpecimenFinding[];
  readonly outcome: CriticOutcome;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const child of Object.values(value as Record<string, unknown>))
      deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export const CRITIC_SPECIMEN: CriticSpecimen = deepFreeze({
  schema: "craft-critic-specimen/1",
  subject_script_hash:
    "b18d1fcee6ccd784933fd5e19b957ae252a5c892deb3d342ca768d61cea94ae9",
  craft_policy_version: "writing-craft-0.1",
  critic_contract_version: "craft-critic-fixture-stub/1",
  findings: [
    {
      finding_id: "cf01",
      type: "detached_supporter_voice",
      severity: "revise",
      span_refs: [{ semantic_turn_id: "t08" }],
      observation:
        "Simon reports supporter discomfort politely instead of inhabiting it.",
      consequence:
        "The supporter avatar becomes detached and the analytical point loses emotional salience.",
      revision_instruction:
        "Let Simon argue the supporter consequence directly and vividly, without claiming collective membership or adding facts.",
      prohibited_shortcut:
        "Do not make Simon angry by quota or force a disagreement with Gaz.",
    },
    {
      finding_id: "cf02",
      type: "conversational_inertia",
      severity: "revise",
      span_refs: [
        { semantic_turn_id: "t10" },
        { semantic_turn_id: "t12" },
        { semantic_turn_id: "t13" },
      ],
      observation: "The supporter block reads as sequential mini-essays.",
      consequence:
        "The core insight is explained rather than discovered through conversation.",
      revision_instruction:
        "Make the turns react to each other while preserving every factual claim and attribution.",
      prohibited_shortcut: "Do not merely reorder speakers.",
    },
  ],
  outcome: "revise_once",
});
