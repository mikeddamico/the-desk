// The fixed writer Pass-1 semantic specimen `writer-pass1-specimen/1` (dependent contract `writer-fixture-pass1/1`, docs/g1-writer-pass1.md).
// This is a NEW approved fixture result returned by the trusted non-network G1-A `fixture_stub` route. It is not a replay of the
// historical Pass-1 output (whose t07 shares a long run with the withheld original C4 sentence) and it is not model generation.
// Relative to the historical Pass-1 script the approved semantic delta is exactly: `spoken_text` of t06 and t07 and the four span
// ends that follow them (claim C3 118 -> 144, C4 159 -> 168; evidence E003 118 -> 144, E004 159 -> 168). Nothing else differs.
// Identities (pinned by the plan builder, never adjusted to fit an implementation): the CANONICAL-JSON SHA-256 of this object is
// the raw-response identity; it is NOT the SHA-256 of any formatted file. The script-v2 hash is the hash of the mapped script.
export const PASS1_SPECIMEN_SCHEMA = "writer-pass1-specimen/1";
export const PASS1_SPECIMEN_CANONICAL_SHA256 =
  "bff8461a214d8c9a8a0895c8a956c1d162bee5bb3870c6475abdef0661b65682";
export const PASS1_SCRIPT_HASH =
  "b18d1fcee6ccd784933fd5e19b957ae252a5c892deb3d342ca768d61cea94ae9";

export interface Pass1SpecimenTurn {
  readonly semantic_turn_id: string;
  readonly sequence: number;
  readonly program_block_id: string;
  readonly participant_id: string;
  readonly spoken_text: string;
}
export interface Pass1SpecimenClaimUse {
  readonly semantic_turn_id: string;
  readonly claim_id: string;
  readonly use_mode: string;
  readonly span_start: number;
  readonly span_end: number;
  readonly claim_state_hash: string;
}
export interface Pass1SpecimenEvidenceUse {
  readonly semantic_turn_id: string;
  readonly evidence_unit_id: string;
  readonly use_mode: string;
  readonly span_start: number;
  readonly span_end: number;
  readonly rights_policy_version: string;
}
export interface Pass1SpecimenPrediction {
  readonly prediction_candidate_id: string;
  readonly semantic_turn_id: string;
  readonly participant_id: string;
  readonly prediction_text: string;
  readonly horizon: string;
  readonly topic_thread_id: string;
}
export interface Pass1Specimen {
  readonly schema: string;
  readonly script_phase: string;
  readonly revision_reason: string;
  readonly purpose: string;
  readonly writing_policy_version: string;
  readonly brief_hash: string;
  readonly package_hash: string;
  readonly program_block_refs: readonly string[];
  readonly turns: readonly Pass1SpecimenTurn[];
  readonly turn_claim_uses: readonly Pass1SpecimenClaimUse[];
  readonly turn_evidence_uses: readonly Pass1SpecimenEvidenceUse[];
  readonly prediction_candidates: readonly Pass1SpecimenPrediction[];
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const child of Object.values(value as Record<string, unknown>))
      deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export const PASS1_SPECIMEN: Pass1Specimen = deepFreeze({
  schema: "writer-pass1-specimen/1",
  script_phase: "pass_1",
  revision_reason: "content_pass_candidate",
  purpose: "evaluation",
  writing_policy_version: "writing-0.2.3",
  brief_hash:
    "36fb22d03300206d3181959a100f2911c2b27d9ff72379f21831d32a4bd5c475",
  package_hash:
    "a8655c0e8bd72094a823b367a0c21cd665d3d99c271341286a92dbdc2ea304ab",
  program_block_refs: [
    "cbe4f84a-85e8-4720-861f-ed11f39fbc84",
    "c3df1781-d7e5-44e3-b33e-401f766dd80b",
    "479c96f1-0cc6-4e9d-a111-e8b44283c56e",
    "71d90cda-d830-400b-a85f-23b322cea6ea",
    "8bec3a45-6db4-4189-b57a-ef6767538a19",
    "b6d74c53-1961-460c-9d1f-ef02204a3942",
    "b587f46a-fd0e-4372-ab26-c9baf908b109",
    "808e22d6-795a-4cd5-9ef5-b1c9fec99b10",
    "afd6db20-2275-4352-b613-e2f7dcda0cf7",
  ],
  turns: [
    {
      semantic_turn_id: "t01",
      sequence: 1,
      program_block_id: "cbe4f84a-85e8-4720-861f-ed11f39fbc84",
      participant_id: "simon",
      spoken_text:
        "I have a small complaint about the phrase 'comfortable lead'. Football has spent years proving the second word can survive perfectly well without the first.",
    },
    {
      semantic_turn_id: "t02",
      sequence: 2,
      program_block_id: "cbe4f84a-85e8-4720-861f-ed11f39fbc84",
      participant_id: "gaz",
      spoken_text:
        "That is not really a complaint. It is a sample-size problem.",
    },
    {
      semantic_turn_id: "t03",
      sequence: 3,
      program_block_id: "c3df1781-d7e5-44e3-b33e-401f766dd80b",
      participant_id: "tully",
      spoken_text:
        "Right. Before Simon opens a statistical grievance department, Northbridge.",
    },
    {
      semantic_turn_id: "t04",
      sequence: 4,
      program_block_id: "479c96f1-0cc6-4e9d-a111-e8b44283c56e",
      participant_id: "tully",
      spoken_text:
        "Northbridge won 2-1. If all you wanted was the score, lovely, we're done. The interesting bit is the ending: 43 percent possession, and ten minutes that still felt more like survival than control.",
    },
    {
      semantic_turn_id: "t05",
      sequence: 5,
      program_block_id: "479c96f1-0cc6-4e9d-a111-e8b44283c56e",
      participant_id: "gaz",
      spoken_text:
        "Possession alone doesn't settle it. More useful: Northbridge have now conceded after the 80th minute in 3 of their last 5 league matches. That's a pattern. It is not yet a diagnosis.",
    },
    {
      semantic_turn_id: "t06",
      sequence: 6,
      program_block_id: "71d90cda-d830-400b-a85f-23b322cea6ea",
      participant_id: "tully",
      spoken_text:
        "There was at least a plan. The North Coast Gazette reports that training included a 5-4-1 option for Northbridge to use when closing out a match.",
    },
    {
      semantic_turn_id: "t07",
      sequence: 7,
      program_block_id: "71d90cda-d830-400b-a85f-23b322cea6ea",
      participant_id: "gaz",
      spoken_text:
        "One specialist analysis in the package suggests Southbank's focus on the flanks after half-time could have been an intentional answer to Northbridge's narrower midfield. Could. I would keep that word.",
    },
    {
      semantic_turn_id: "t08",
      sequence: 8,
      program_block_id: "71d90cda-d830-400b-a85f-23b322cea6ea",
      participant_id: "simon",
      spoken_text:
        "Supporters may still find the ending uncomfortable even if the intended shape was reasonable.",
    },
    {
      semantic_turn_id: "t09",
      sequence: 9,
      program_block_id: "8bec3a45-6db4-4189-b57a-ef6767538a19",
      participant_id: "tully",
      spoken_text:
        "So the useful distinction is intention versus proof. Whatever the intention, the proof is still pending.",
    },
    {
      semantic_turn_id: "t10",
      sequence: 10,
      program_block_id: "b6d74c53-1961-460c-9d1f-ef02204a3942",
      participant_id: "simon",
      spoken_text:
        "Across four supporter sources in the package, the dominant note was relief more than celebration. That suggests the result has not removed the underlying anxiety.",
    },
    {
      semantic_turn_id: "t11",
      sequence: 11,
      program_block_id: "b6d74c53-1961-460c-9d1f-ef02204a3942",
      participant_id: "tully",
      spoken_text:
        "There is a phrase in the club's supporter history for this, isn't there? 'the long ten'.",
    },
    {
      semantic_turn_id: "t12",
      sequence: 12,
      program_block_id: "b6d74c53-1961-460c-9d1f-ef02204a3942",
      participant_id: "simon",
      spoken_text:
        "Exactly. One approved lore source traces it to at least 2019. It describes the final minutes stretching emotionally.",
    },
    {
      semantic_turn_id: "t13",
      sequence: 13,
      program_block_id: "b6d74c53-1961-460c-9d1f-ef02204a3942",
      participant_id: "gaz",
      spoken_text:
        "Three late concessions in five keeps the question open. It does not prove the answer.",
    },
    {
      semantic_turn_id: "t14",
      sequence: 14,
      program_block_id: "b587f46a-fd0e-4372-ab26-c9baf908b109",
      participant_id: "tully",
      spoken_text:
        "So, the win counts. But the previous published episode left late-game control unresolved, and this one does not magically close the file. The next time Northbridge are protecting something late, listen for the difference between intention and control.",
    },
    {
      semantic_turn_id: "t15",
      sequence: 15,
      program_block_id: "808e22d6-795a-4cd5-9ef5-b1c9fec99b10",
      participant_id: "gaz",
      spoken_text:
        "My prediction is dull on purpose: next time they are ahead late, I want ten ordinary minutes before I upgrade the diagnosis.",
    },
    {
      semantic_turn_id: "t16",
      sequence: 16,
      program_block_id: "808e22d6-795a-4cd5-9ef5-b1c9fec99b10",
      participant_id: "simon",
      spoken_text:
        "Mine is less scientific. If it gets frantic again, supporters will be anxious before the first clearance lands.",
    },
    {
      semantic_turn_id: "t17",
      sequence: 17,
      program_block_id: "afd6db20-2275-4352-b613-e2f7dcda0cf7",
      participant_id: "tully",
      spoken_text:
        "That is the file for now: 2-1 banked, question still open. We'll find out whether the ending was progress the next time the clock gets loud. From The Desk, good night.",
    },
  ],
  turn_claim_uses: [
    {
      semantic_turn_id: "t04",
      claim_id: "d1250008-0000-4000-8000-000000000001",
      use_mode: "asserted",
      span_start: 0,
      span_end: 19,
      claim_state_hash:
        "2239630f0ed9835266704ae1432d3b269dccfdd2d43b946a2b969aae310e9e94",
    },
    {
      semantic_turn_id: "t04",
      claim_id: "d1250008-0000-4000-8000-000000000002",
      use_mode: "asserted",
      span_start: 109,
      span_end: 130,
      claim_state_hash:
        "db0710627bea350c1ca0d9c3344c951c9bb57d7740dd8c23bbc91a7060fd732f",
    },
    {
      semantic_turn_id: "t05",
      claim_id: "d1250008-0000-4000-8000-000000000007",
      use_mode: "asserted",
      span_start: 49,
      span_end: 136,
      claim_state_hash:
        "98fa9d6b3406e2b5734cc8fcc12cdd9038e9976838d95f1d4b7f8321ecfb833e",
    },
    {
      semantic_turn_id: "t06",
      claim_id: "d1250008-0000-4000-8000-000000000003",
      use_mode: "attributed",
      span_start: 27,
      span_end: 144,
      claim_state_hash:
        "3de1334c7a8e5c58ba2cbdd531d6541bec7e1a7f5fc7447714b41b584af2bae4",
    },
    {
      semantic_turn_id: "t07",
      claim_id: "d1250008-0000-4000-8000-000000000004",
      use_mode: "hedged",
      span_start: 0,
      span_end: 168,
      claim_state_hash:
        "59580d5287ca5d6d8c428d73936fc442c21454be258e5b0c6d4b5209b2fca4cd",
    },
    {
      semantic_turn_id: "t10",
      claim_id: "d1250008-0000-4000-8000-000000000005",
      use_mode: "attributed",
      span_start: 0,
      span_end: 96,
      claim_state_hash:
        "4a32d360454d615f54c7b467e95338c8cde8c9388c67919aa9bc4bcf8fa41a8e",
    },
    {
      semantic_turn_id: "t11",
      claim_id: "d1250008-0000-4000-8000-000000000006",
      use_mode: "asserted",
      span_start: 73,
      span_end: 87,
      claim_state_hash:
        "2999b750b23ef1a6c98b3b6ab029a0cf734ea6d2ca9a823f5420dce700bcfc5f",
    },
    {
      semantic_turn_id: "t12",
      claim_id: "d1250008-0000-4000-8000-000000000006",
      use_mode: "asserted",
      span_start: 9,
      span_end: 60,
      claim_state_hash:
        "2999b750b23ef1a6c98b3b6ab029a0cf734ea6d2ca9a823f5420dce700bcfc5f",
    },
    {
      semantic_turn_id: "t13",
      claim_id: "d1250008-0000-4000-8000-000000000007",
      use_mode: "asserted",
      span_start: 0,
      span_end: 30,
      claim_state_hash:
        "98fa9d6b3406e2b5734cc8fcc12cdd9038e9976838d95f1d4b7f8321ecfb833e",
    },
    {
      semantic_turn_id: "t14",
      claim_id: "d1250008-0000-4000-8000-000000000001",
      use_mode: "asserted",
      span_start: 4,
      span_end: 11,
      claim_state_hash:
        "2239630f0ed9835266704ae1432d3b269dccfdd2d43b946a2b969aae310e9e94",
    },
    {
      semantic_turn_id: "t14",
      claim_id: "d1250008-0000-4000-8000-000000000009",
      use_mode: "asserted",
      span_start: 24,
      span_end: 88,
      claim_state_hash:
        "dfa61e2a799d3966fe4eccb6998b9d4925e074a04ad07724d95957d4052d8231",
    },
    {
      semantic_turn_id: "t17",
      claim_id: "d1250008-0000-4000-8000-000000000001",
      use_mode: "asserted",
      span_start: 26,
      span_end: 29,
      claim_state_hash:
        "2239630f0ed9835266704ae1432d3b269dccfdd2d43b946a2b969aae310e9e94",
    },
  ],
  turn_evidence_uses: [
    {
      semantic_turn_id: "t06",
      evidence_unit_id: "d1250007-0000-4000-8000-000000000003",
      use_mode: "paraphrased",
      span_start: 27,
      span_end: 144,
      rights_policy_version: "d1250006-0000-4000-8000-000000000005",
    },
    {
      semantic_turn_id: "t07",
      evidence_unit_id: "d1250007-0000-4000-8000-000000000004",
      use_mode: "paraphrased",
      span_start: 0,
      span_end: 168,
      rights_policy_version: "d1250006-0000-4000-8000-000000000005",
    },
    {
      semantic_turn_id: "t11",
      evidence_unit_id: "d1250007-0000-4000-8000-000000000009",
      use_mode: "quoted",
      span_start: 73,
      span_end: 87,
      rights_policy_version: "d1250006-0000-4000-8000-000000000006",
    },
  ],
  prediction_candidates: [
    {
      prediction_candidate_id: "pred_gaz_late_control",
      semantic_turn_id: "t15",
      participant_id: "gaz",
      prediction_text:
        "My prediction is dull on purpose: next time they are ahead late, I want ten ordinary minutes before I upgrade the diagnosis.",
      horizon: "next_relevant_event",
      topic_thread_id: "thr_late_game_control",
    },
    {
      prediction_candidate_id: "pred_simon_anxiety",
      semantic_turn_id: "t16",
      participant_id: "simon",
      prediction_text:
        "Mine is less scientific. If it gets frantic again, supporters will be anxious before the first clearance lands.",
      horizon: "next_relevant_event",
      topic_thread_id: "thr_late_game_control",
    },
  ],
});
