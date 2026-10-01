// FIXTURE-SCOPED request ownership/recipe checks (Hashing v0.1.5 section 7.1; P&R v0.1.4 sections 17, 18.2, 19, 23;
// Contract Trace v0.5.4 section 9 item 2 for the C0/C2 recipes). This is NOT a product-wide request validator and the
// closed fixture request mapping is deliberately absent (membership checks live in test support, not here).
import { normalizeString } from "./canonical-json.js";
import { sliceCodePointSpan } from "./spans.js";
import {
  asArray,
  asInteger,
  asRecord,
  asString,
  isRecord,
  type JsonObject,
} from "./select.js";

export type RequestRejectionCode =
  | "empty_block"
  | "anchor_not_in_bound_script"
  | "participant_not_from_bound_script"
  | "text_not_from_bound_script"
  | "turn_identity_not_from_bound_script"
  | "cross_program_block"
  | "turn_order_not_script_order"
  | "block_does_not_begin_at_first_turn_of_program_block"
  | "context_recipe_c0_not_empty"
  | "c0_used_after_the_first_block"
  | "context_not_exactly_one_preceding_turn"
  | "context_from_own_block"
  | "context_not_final_turn_of_preceding_block"
  | "context_text_not_from_bound_script"
  | "context_recipe_unknown"
  | "intent_outside_block"
  | "voice_binding_missing"
  | "voice_binding_mismatch"
  | "voice_model_incompatible"
  | "pronunciation_outside_block"
  | "pronunciation_span_mismatch"
  | "pronunciation_wrong_voice"
  | "pronunciation_provider_mismatch"
  | "pronunciation_not_derived_from_applied_canonical"
  | "pronunciation_stale"
  | "take_index_invalid";

export class RequestRejected extends Error {
  readonly code: RequestRejectionCode;
  constructor(code: RequestRejectionCode, detail = "") {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "RequestRejected";
    this.code = code;
  }
}

export interface FixtureScriptContext {
  program_block_order: readonly string[];
  turns: readonly JsonObject[];
}

const nfc = (text: unknown, what: string): string =>
  normalizeString(asString(text, what));

/** Throws {@link RequestRejected} with the first named violation; returns normally for an owned request. */
export function checkFixtureRequestOwnership(
  recordInput: unknown,
  contextInput: unknown,
): void {
  const record = asRecord(recordInput, "request record");
  const context = asRecord(contextInput, "script context");
  const scriptTurns = asArray(context.turns, "script turns").map((t) =>
    asRecord(t, "script turn"),
  );
  const blockOrder = asArray(
    context.program_block_order,
    "program_block_order",
  ).map((b) => asString(b, "program block"));
  const bySemantic = new Map(
    scriptTurns.map((t) => [String(t.semantic_turn_id), t]),
  );
  const generated = asArray(record.turns, "turns").map((t) =>
    asRecord(t, "generated turn"),
  );
  if (generated.length === 0) throw new RequestRejected("empty_block");

  // Hashing 7.1: every semantic anchor resolves through the exact bound script.
  for (const turn of generated) {
    const anchor = String(turn.semantic_turn_id);
    const script = bySemantic.get(anchor);
    if (!script)
      throw new RequestRejected("anchor_not_in_bound_script", anchor);
    if (script.participant_id !== turn.participant_id)
      throw new RequestRejected("participant_not_from_bound_script", anchor);
    if (
      nfc(script.spoken_text, "script text") !==
      nfc(turn.spoken_text, "turn text")
    )
      throw new RequestRejected("text_not_from_bound_script", anchor);
    if (
      script.turn_id !== turn.turn_id ||
      script.program_block_id !== turn.program_block_id
    )
      throw new RequestRejected("turn_identity_not_from_bound_script", anchor);
  }
  // Hashing 7.1: ordered generated turns stay inside one program block, in script order.
  if (new Set(generated.map((t) => t.program_block_id)).size !== 1)
    throw new RequestRejected("cross_program_block");
  const sequences = generated.map((t) =>
    asInteger(bySemantic.get(String(t.semantic_turn_id))?.sequence, "sequence"),
  );
  if (sequences.some((s, i) => i > 0 && s <= (sequences[i - 1] ?? s)))
    throw new RequestRejected("turn_order_not_script_order");
  const programBlock = asString(
    generated[0]?.program_block_id,
    "program_block_id",
  );
  const sameBlock = scriptTurns
    .filter((t) => t.program_block_id === programBlock)
    .sort(
      (a, b) =>
        asInteger(a.sequence, "sequence") - asInteger(b.sequence, "sequence"),
    );
  // Fixture profile (Layer B C2 recipe): the render block begins at the first approved turn of its program block.
  if (generated[0]?.semantic_turn_id !== sameBlock[0]?.semantic_turn_id)
    throw new RequestRejected(
      "block_does_not_begin_at_first_turn_of_program_block",
    );

  // P&R 17 recipes: C0 none (first block only), C2 exactly the final approved turn of the immediately preceding block.
  const recipe = asRecord(record.context, "context");
  const contextTurns = asArray(recipe.turns, "context turns").map((t) =>
    asRecord(t, "context turn"),
  );
  const position = blockOrder.indexOf(programBlock);
  if (recipe.recipe_version === "C0-v1") {
    if (contextTurns.length > 0)
      throw new RequestRejected("context_recipe_c0_not_empty");
    if (position !== 0)
      throw new RequestRejected("c0_used_after_the_first_block");
  } else if (recipe.recipe_version === "C2-v1") {
    if (position <= 0 || contextTurns.length !== 1)
      throw new RequestRejected("context_not_exactly_one_preceding_turn");
    const preceding = scriptTurns
      .filter((t) => t.program_block_id === blockOrder[position - 1])
      .sort(
        (a, b) =>
          asInteger(a.sequence, "sequence") - asInteger(b.sequence, "sequence"),
      )
      .at(-1);
    const [only] = contextTurns;
    if (!only)
      throw new RequestRejected("context_not_exactly_one_preceding_turn");
    if (generated.some((g) => g.semantic_turn_id === only.semantic_turn_id))
      throw new RequestRejected("context_from_own_block");
    if (only.semantic_turn_id !== preceding?.semantic_turn_id)
      throw new RequestRejected(
        "context_not_final_turn_of_preceding_block",
        String(only.semantic_turn_id),
      );
    if (
      nfc(only.spoken_text, "context text") !==
        nfc(preceding?.spoken_text, "script text") ||
      only.participant_id !== preceding?.participant_id
    )
      throw new RequestRejected("context_text_not_from_bound_script");
  } else {
    throw new RequestRejected(
      "context_recipe_unknown",
      String(recipe.recipe_version),
    );
  }

  const anchors = new Set(generated.map((t) => String(t.semantic_turn_id)));
  for (const intent of asArray(record.intents, "intents").map((i) =>
    asRecord(i, "intent"),
  ))
    if (intent.scope_type === "turn" && !anchors.has(String(intent.scope_ref)))
      throw new RequestRejected(
        "intent_outside_block",
        String(intent.scope_ref),
      );

  // P&R 18.2: the exact voice version bound to each speaker; model compatibility is validator/runtime work (not SQL).
  const voices = asRecord(record.voice_versions, "voice_versions");
  for (const turn of generated) {
    const participant = String(turn.participant_id);
    if (!isRecord(voices[participant]))
      throw new RequestRejected("voice_binding_missing", participant);
    const voice = asRecord(voices[participant], "voice version");
    if (turn.voice_profile_version_id !== voice.voice_profile_version_id)
      throw new RequestRejected("voice_binding_mismatch", participant);
    if (
      !asArray(voice.provider_model_compatibility, "compatibility").includes(
        record.concrete_model_identity,
      )
    )
      throw new RequestRejected("voice_model_incompatible", participant);
  }

  // P&R 18.2/19: pronunciation applications must be inside the block, on the right span/voice/provider, and fresh.
  const applications = Object.hasOwn(record, "pronunciation_applications")
    ? asArray(record.pronunciation_applications, "pronunciation_applications")
    : [];
  for (const value of applications) {
    const application = asRecord(value, "pronunciation application");
    const turn = generated.find(
      (t) => t.semantic_turn_id === application.semantic_turn_id,
    );
    if (!turn)
      throw new RequestRejected(
        "pronunciation_outside_block",
        String(application.semantic_turn_id),
      );
    const text = nfc(turn.spoken_text, "turn text");
    const start = asInteger(application.start_offset, "start_offset");
    const end = asInteger(application.end_offset, "end_offset");
    // Coordinates are zero-based half-open Unicode code points over the NFC spoken text (Hashing section 8).
    let sliced: string | undefined;
    try {
      sliced =
        start < end ? sliceCodePointSpan(text, { start, end }) : undefined;
    } catch {
      sliced = undefined;
    }
    if (sliced !== application.canonical_text)
      throw new RequestRejected(
        "pronunciation_span_mismatch",
        String(application.semantic_turn_id),
      );
    const voice = asRecord(
      voices[String(turn.participant_id)],
      "voice version",
    );
    if (application.voice_profile_version_id !== voice.voice_profile_version_id)
      throw new RequestRejected(
        "pronunciation_wrong_voice",
        String(application.semantic_turn_id),
      );
    if (application.provider !== voice.provider)
      throw new RequestRejected(
        "pronunciation_provider_mismatch",
        String(application.pronunciation_rendering_id),
      );
    if (application.rendering_pronunciation_id !== application.pronunciation_id)
      throw new RequestRejected(
        "pronunciation_not_derived_from_applied_canonical",
        String(application.pronunciation_rendering_id),
      );
    if (
      application.pronunciation_id !==
      application.canonical_current_pronunciation_id
    )
      throw new RequestRejected(
        "pronunciation_stale",
        String(application.pronunciation_rendering_id),
      );
  }

  const takeIndex = record.take_index;
  if (
    typeof takeIndex !== "number" ||
    !Number.isInteger(takeIndex) ||
    takeIndex < 0
  )
    throw new RequestRejected("take_index_invalid");
}
