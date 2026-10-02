// Provider-ledger, take-chain and request-to-WAV mapping checks over rows (A4). Owners: Handoff v0.5.5 (carried v1.2.4 paragraph:
// each model execution has one succeeded zero-cost terminal event, fixture model identity, output-artifact binding; `provider_calls`
// is the authoritative ledger), Performance & Render v0.1.4 section 20.1 (explicit frozen request-to-response mapping), Hashing
// v0.1.5 section 14.3 (ledger causality, request-to-WAV mapping). Fixture-scoped facts (counts 10 TTS + 5 model, "0.0000" USD cost,
// the rb06 reroll chain, causal timestamps) come from Fixture v0.4.6 and its validator group G11; they are not product policy.
// The shipped mapping file is a COMPARISON TARGET: the rows are authoritative.
import {
  fail,
  indexBy,
  instant,
  isObj,
  must,
  obj,
  rowsOf,
  same,
  str,
  type Obj,
} from "./check-util.js";
import type { Row, Tables } from "./rows.js";

export interface MappingEntry extends Obj {
  render_take_id: string;
}

/** FIXTURE-SCOPED: exact decimal text of the synthetic zero cost (G11). Not a product scale rule. */
export const FIXTURE_ZERO_COST = "0.0000";

/** Exact decimal text of `frames / 48000` seconds, rounded half-up to six places by integer arithmetic, trailing zeros trimmed. */
export function secondsText(frames: number): string {
  const micro = Math.floor((frames * 2_000_000 + 48_000) / 96_000);
  const whole = Math.floor(micro / 1_000_000);
  const frac = String(micro % 1_000_000)
    .padStart(6, "0")
    .replace(/0+$/, "");
  return frac ? `${String(whole)}.${frac}` : String(whole);
}

function eventsOf(tables: Tables, callId: string): Row[] {
  return rowsOf(tables, "provider_call_events").filter(
    (e) => e.provider_call_id === callId,
  );
}

export function verifyLedger(tables: Tables, mapping: readonly Obj[]): void {
  const calls = rowsOf(tables, "provider_calls");
  const events = rowsOf(tables, "provider_call_events");
  if (calls.length !== 15 || events.length !== 15)
    fail("ledger_counts", `${String(calls.length)}/${String(events.length)}`);
  const tts = calls.filter((c) => c.operation === "tts");
  if (tts.length !== 10 || calls.length - tts.length !== 5)
    fail("ledger_split", "expected 10 TTS + 5 model calls");
  const callById = indexBy(calls, "provider_call_id");

  for (const call of calls) {
    const id = str(call.provider_call_id);
    if (
      call.operational_try_number !== 1 ||
      call.retry_of_provider_call_id !== null
    )
      fail("ledger_not_try_one", id);
    const own = eventsOf(tables, id);
    const [event, ...rest] = own;
    if (!event || rest.length > 0 || event.event_type !== "succeeded")
      fail("ledger_terminal_event", id);
    // FIXTURE-SCOPED exact decimal text, compared as text (never through Number)
    if (event.actual_cost !== FIXTURE_ZERO_COST || event.currency !== "USD")
      fail("ledger_event_cost", id);
    const usage = obj(event.usage, "event usage");
    if (call.operation === "tts") {
      // FIXTURE-SCOPED exact timing (G30): generated seconds are the exact decimal of the take's frames at 48 kHz, six places
      const take = must(
        rowsOf(tables, "render_takes").find(
          (t) => t.provider_call_id === call.provider_call_id,
        ),
        "tts call take",
      );
      const artifact = must(
        rowsOf(tables, "artifacts").find(
          (a) => a.artifact_id === take.audio_artifact_id,
        ),
        "tts take artifact",
      );
      const frames = obj(
        artifact.canonical_payload,
        "audio payload",
      ).frame_count;
      if (
        typeof frames !== "number" ||
        usage.generated_seconds !== secondsText(frames)
      )
        fail("ledger_generated_seconds", id);
    } else if (
      usage.external_provider_contacted !== false ||
      usage.fixture_execution !== true
    )
      fail("ledger_event_usage", id);
    if (
      !(
        instant(call.started_at, "started_at") <
        instant(event.ended_at, "ended_at")
      )
    )
      fail("ledger_event_before_reservation", id);
    if (
      call.provider === "fixture_tts" &&
      call.model_identifier !== "fixture-model-1.0"
    )
      fail("ledger_tts_model_identity", id);
  }

  // model calls: the succeeded event's response artifact is the model run's output artifact
  for (const run of rowsOf(tables, "model_runs")) {
    const call = must(
      callById.get(str(run.provider_call_id)),
      "model run call",
    );
    if (call.operation === "tts")
      fail("ledger_model_run_on_tts_call", str(run.model_run_id));
    const event = must(
      eventsOf(tables, str(call.provider_call_id))[0],
      "model call event",
    );
    if (event.response_artifact_id !== run.output_artifact_id)
      fail("ledger_model_output_binding", str(run.model_run_id));
    if (call.model_identifier !== run.model_identifier)
      fail("ledger_model_identity_binding", str(run.model_run_id));
  }
  if (rowsOf(tables, "model_runs").length !== 5) fail("ledger_model_run_count");

  // takes
  const takes = rowsOf(tables, "render_takes");
  if (
    takes.length !== 10 ||
    new Set(takes.map((t) => t.provider_call_id)).size !== 10
  )
    fail("ledger_take_count");
  if (
    new Set(takes.map((t) => `${str(t.render_block_id)}:${str(t.take_index)}`))
      .size !== 10
  )
    fail("ledger_take_block_pairs");
  const blocks = indexBy(rowsOf(tables, "render_blocks"), "render_block_id");
  for (const take of takes) {
    const call = must(callById.get(str(take.provider_call_id)), "take call");
    const block = must(blocks.get(str(take.render_block_id)), "take block");
    if (call.operation !== "tts")
      fail("ledger_take_call_not_tts", str(take.render_take_id));
    if (
      call.request_fingerprint !== block.base_request_hash ||
      call.logical_request_key !==
        `${str(block.base_request_hash)}:${str(take.take_index)}` ||
      call.intentional_take_index !== take.take_index
    )
      fail("ledger_take_request_binding", str(take.render_take_id));
    const tv = obj(take.technical_validation, "technical_validation");
    if (tv.status === "pass" && tv.reason_code !== null)
      fail("ledger_passing_take_reason", str(take.render_take_id));
  }
  const ttsResponses = events
    .filter((e) => tts.some((c) => c.provider_call_id === e.provider_call_id))
    .map((e) => str(e.response_artifact_id));
  if (new Set(ttsResponses).size !== 10)
    fail("ledger_tts_responses_not_distinct");

  verifySelections(tables);
  verifyRerollChain(tables, callById);
  verifyMapping(tables, mapping, callById);
}

function verifySelections(tables: Tables): void {
  const selections = rowsOf(tables, "take_selections");
  const takes = indexBy(rowsOf(tables, "render_takes"), "render_take_id");
  if (selections.length !== 10) fail("ledger_selection_count");
  for (const s of selections)
    if (
      must(takes.get(str(s.render_take_id)), "selection take")
        .render_block_id !== s.render_block_id
    )
      fail("ledger_selection_take_block", str(s.take_selection_id));
}

function verifyRerollChain(tables: Tables, callById: Map<string, Row>): void {
  const blocks = rowsOf(tables, "render_blocks");
  const block6 = must(
    blocks.find((b) => b.sequence === 6),
    "render block 6",
  );
  const takes = rowsOf(tables, "render_takes")
    .filter((t) => t.render_block_id === block6.render_block_id)
    .sort((a, b) => Number(a.take_index) - Number(b.take_index));
  if (takes.map((t) => t.take_index).join() !== "0,1")
    fail("reroll_take_chain");
  const [t0, t1] = takes as [Row, Row];
  same("reroll_take0_validation", t0.technical_validation, {
    reason_code: "unexpected_truncation",
    status: "fail",
  });
  const triggers = rowsOf(tables, "reroll_triggers");
  const [trigger, ...extra] = triggers;
  if (!trigger || extra.length > 0) fail("reroll_trigger_count");
  const c0 = must(callById.get(str(t0.provider_call_id)), "take 0 call");
  const c1 = must(callById.get(str(t1.provider_call_id)), "take 1 call");
  if (
    trigger.source_provider_call_id !== c0.provider_call_id ||
    c1.reroll_of_provider_call_id !== c0.provider_call_id ||
    c1.reroll_trigger_id !== trigger.reroll_trigger_id ||
    trigger.base_request_hash !== block6.base_request_hash ||
    trigger.take_index !== 1 ||
    trigger.failure_code !== "unexpected_truncation" ||
    trigger.trigger_kind !== "mechanical_failure"
  )
    fail("reroll_causal_chain");
  const artifact = must(
    rowsOf(tables, "artifacts").find(
      (a) => a.artifact_id === trigger.validation_artifact_id,
    ),
    "validation artifact",
  );
  const mv = obj(artifact.canonical_payload, "mechanical validation");
  const audio0 = must(
    rowsOf(tables, "audio_artifacts").find(
      (a) => a.artifact_id === t0.audio_artifact_id,
    ),
    "take 0 audio",
  );
  if (
    artifact.artifact_type !== "mechanical_validation" ||
    mv.base_request_hash !== block6.base_request_hash ||
    mv.source_provider_call_id !== c0.provider_call_id ||
    mv.source_render_take_id !== t0.render_take_id ||
    mv.audio_sha256 !== audio0.audio_sha256 ||
    mv.failure_code !== trigger.failure_code ||
    mv.result !== "fail"
  )
    fail("reroll_validation_bindings");
  const selections = rowsOf(tables, "take_selections")
    .filter((s) => s.render_block_id === block6.render_block_id)
    .sort(
      (a, b) => instant(a.created_at, "sel") - instant(b.created_at, "sel"),
    );
  const [s0, s1] = selections as [Row, Row];
  if (
    selections.length !== 2 ||
    s0.decision !== "rejected" ||
    s1.decision !== "approved" ||
    s1.supersedes_selection_id !== s0.take_selection_id ||
    s0.render_take_id !== t0.render_take_id ||
    s1.render_take_id !== t1.render_take_id
  )
    fail("reroll_selection_chain");
  const ev0 = must(eventsOf(tables, str(c0.provider_call_id))[0], "event 0");
  const ev1 = must(eventsOf(tables, str(c1.provider_call_id))[0], "event 1");
  // FIXTURE-SCOPED causal order of the synthetic clock (G11): strictly increasing
  const chain = [
    instant(ev0.ended_at, "ev0"),
    instant(mv.validated_at, "validated_at"),
    instant(trigger.created_at, "trigger"),
    instant(s0.created_at, "rejection"),
    instant(c1.started_at, "reroll start"),
    instant(ev1.ended_at, "ev1"),
    instant(s1.created_at, "approval"),
  ];
  if (chain.some((v, i) => i > 0 && v <= (chain[i - 1] ?? v)))
    fail("reroll_causal_timestamps");
}

/** Shipped request-to-WAV mapping (comparison target) against the persisted rows (authoritative). */
function verifyMapping(
  tables: Tables,
  mapping: readonly Obj[],
  callById: Map<string, Row>,
): void {
  const takes = indexBy(rowsOf(tables, "render_takes"), "render_take_id");
  const blocks = indexBy(rowsOf(tables, "render_blocks"), "render_block_id");
  const artifacts = indexBy(rowsOf(tables, "artifacts"), "artifact_id");
  if (mapping.length !== takes.size) fail("mapping_entry_count");
  const seen = new Set<string>();
  for (const entry of mapping) {
    const tag = str(entry.render_take_id);
    if (seen.has(tag)) fail("mapping_duplicate_take", tag);
    seen.add(tag);
    const take = must(takes.get(tag), `mapping take ${tag}`);
    const call = must(callById.get(str(take.provider_call_id)), "mapping call");
    const block = must(blocks.get(str(take.render_block_id)), "mapping block");
    const event = must(
      eventsOf(tables, str(call.provider_call_id))[0],
      "mapping event",
    );
    const artifact = must(
      artifacts.get(str(take.audio_artifact_id)),
      "mapping artifact",
    );
    const audio = must(
      rowsOf(tables, "audio_artifacts").find(
        (a) => a.artifact_id === artifact.artifact_id,
      ),
      "mapping audio row",
    );
    const payload = obj(artifact.canonical_payload, "audio payload");
    const ok =
      entry.provider_call_id === call.provider_call_id &&
      entry.adapter === call.provider &&
      entry.concrete_model_identity === call.model_identifier &&
      entry.base_request_hash === block.base_request_hash &&
      entry.base_request_hash === call.request_fingerprint &&
      entry.logical_request_key === call.logical_request_key &&
      entry.intentional_take_index === take.take_index &&
      entry.intentional_take_index === call.intentional_take_index &&
      entry.succeeded_event_id === event.provider_call_event_id &&
      entry.response_artifact_id === event.response_artifact_id &&
      entry.response_artifact_id === take.audio_artifact_id &&
      entry.audio_row_id === audio.audio_artifact_id &&
      entry.wav_sha256 === audio.audio_sha256 &&
      entry.wav_sha256 === artifact.content_hash &&
      entry.wav_byte_length === artifact.byte_size &&
      entry.wav_frames === payload.frame_count &&
      entry.wav_member_path === artifact.storage_uri &&
      entry.wav_member_path === payload.path;
    if (!ok) fail("mapping_row_binding", tag);
    const receipt = entry.receipt;
    if (
      !isObj(receipt) ||
      receipt.live_provider_contacted !== false ||
      receipt.synthetic !== true
    )
      fail("mapping_receipt", tag);
  }
}
