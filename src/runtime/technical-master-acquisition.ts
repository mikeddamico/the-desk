/** Fixed corpus acquisition. No caller bytes, paths, selection authority or computed-result oracles. */
import * as fs from "node:fs/promises";
import { constants } from "node:fs";
import { dirname } from "node:path";
import { canonicalJson, domainHash } from "../identity/canonical-json.js";
import {
  loadFixtureJson,
  loadFixtureBytes,
  loadFoundationRows,
  fixturePack,
} from "../fixture/loader.js";
import { FIXTURE_V046_PINS } from "../fixture/pins.js";
import { verifyLedger } from "../fixture/ledger.js";
import { asRecord } from "../identity/select.js";
import { planFrozenFixture046Render } from "./frozen-render046.js";
import { constructFrozenFixture046Master } from "./frozen-fixture046-master.js";
import {
  capture,
  demand,
  object,
  sha,
  TechnicalRefusal,
  type Subject,
  type Data,
} from "./technical-master-checks.js";

const acquisitions = new WeakSet<object>();
export function assertAcquired(value: Acquired): void {
  demand(acquisitions.has(value), "source_identity_invalid", "source");
}

const ROOT = new URL(
  "../../fixtures/technical-master-admission/",
  import.meta.url,
);
const MANIFEST_PIN =
  "3b2ee2b90bc7a1e1ccfc36c0cff857cce06b5134bb0f066913805af1c7241123";
const PROFILE_PIN =
  "7b2a24e57766f86379a78fa595c65baac44d53239618a27eda123522bc110dd8";
export async function readOwned(
  path: string | URL,
  limit: number,
): Promise<Buffer> {
  const file = await fs.open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await file.stat();
    demand(
      before.isFile() &&
        before.nlink === 1 &&
        before.uid === process.getuid?.() &&
        before.size <= limit,
      "source_read_failed",
      "source",
    );
    const data = Buffer.alloc(before.size + 1);
    const read = await file.read(data, 0, data.length, 0);
    const after = await file.stat();
    demand(
      read.bytesRead === before.size &&
        after.ino === before.ino &&
        after.dev === before.dev &&
        after.uid === before.uid &&
        after.nlink === before.nlink &&
        after.size === before.size &&
        after.mtimeMs === before.mtimeMs &&
        after.ctimeMs === before.ctimeMs,
      "source_read_failed",
      "source",
    );
    return data.subarray(0, before.size);
  } finally {
    await file.close();
  }
}
function json(bytes: Buffer): Data {
  const value = object(capture(JSON.parse(bytes.toString("utf8")) as unknown));
  demand(
    Buffer.from(canonicalJson(value) + "\n").equals(bytes),
    "source_identity_invalid",
    "source",
  );
  return value;
}
export interface Acquired {
  subject: Subject;
  recheck: () => Promise<void>;
  cleanup: () => Promise<void>;
}
/** Internal acquisition seam used only by the fixed evaluator and controlled tests. */
export async function acquireSubject(
  scope: Subject["scope"],
): Promise<Acquired> {
  const manifestBytes = await readOwned(
    new URL("SOURCE-FILE-MANIFEST.json", ROOT),
    262144,
  );
  demand(
    sha(manifestBytes) === MANIFEST_PIN,
    "source_identity_invalid",
    "source",
  );
  const manifest = object(JSON.parse(manifestBytes.toString()) as unknown);
  const acquiredFiles = new Map<string, string>();
  let capturedBytes = 0;
  const get = async (name: string): Promise<Buffer> => {
    const expected = object(manifest[name]);
    demand(
      typeof expected.bytes === "number" &&
        Number.isSafeInteger(expected.bytes) &&
        expected.bytes >= 0 &&
        capturedBytes + expected.bytes <= 12582912 &&
        capturedBytes + 2 * expected.bytes + 2097152 <= 33554432,
      "audio_resource_limit",
      "source",
    );
    const bytes = await readOwned(
      new URL(name, ROOT),
      name.endsWith(".wav") ? 8388608 : 262144,
    );
    demand(
      bytes.length === expected.bytes && sha(bytes) === expected.raw_sha256,
      "source_identity_invalid",
      "source",
    );
    capturedBytes += bytes.length;
    acquiredFiles.set(name, sha(bytes));
    return bytes;
  };
  const policy = json(await get("policy.json"));
  const profile = json(await get("profile.json"));
  demand(
    domainHash("technical-master-measurement-profile-v1", profile) ===
      PROFILE_PIN,
    "profile_invalid",
    "source",
  );
  let ownedRoot: string | undefined;
  let subject: Subject;
  try {
    if (scope === "synthetic60-positive") {
      const source = json(await get("SOURCE.json"));
      const context = json(await get("context.json"));
      demand(
        object(context.source_identity).sha256 ===
          acquiredFiles.get("SOURCE.json") &&
          object(context.selection_authority).source_sha256 ===
            acquiredFiles.get("SOURCE.json") &&
          object(context.runtime_source).source_sha256 ===
            acquiredFiles.get("SOURCE.json"),
        "context_invalid",
        "source",
      );
      demand(
        canonicalJson(context.required_program_blocks) ===
          canonicalJson(source.required_program_blocks) &&
          canonicalJson(context.explained_silence_intervals) ===
            canonicalJson(source.explained_silence_intervals),
        "context_invalid",
        "source",
      );
      const runtime = object(source.runtime_source);
      demand(
        canonicalJson(context.planned_runtime) ===
          canonicalJson(runtime.planned_seconds) &&
          object(context.configured_runtime_bounds).min_seconds ===
            runtime.configured_min_seconds &&
          object(context.configured_runtime_bounds).max_seconds ===
            runtime.configured_max_seconds,
        "context_invalid",
        "source",
      );
      demand(
        Array.isArray(source.selected_inputs) &&
          Array.isArray(source.selection_records),
        "selection_binding_invalid",
        "source",
      );
      const inputs: Subject["inputs"] = [];
      for (const [index, item] of source.selected_inputs.entries())
        inputs.push({
          bytes: await get(`input-${String(index + 1)}.wav`),
          record: object(item),
        });
      const selections = source.selection_records.map(object);
      const lineage = selections.map((selection) => {
        demand(
          selection.authority === "authored-synthetic-selection/1" &&
            selection.decision === "selected_for_synthetic_test" &&
            selection.take_index === 0,
          "selection_binding_invalid",
          "source",
        );
        return {
          render_block_id: selection.render_block_id,
          take_selection_id: selection.take_selection_id,
          render_take_id: selection.render_take_id,
          take_index: selection.take_index,
          audio_sha256: selection.audio_sha256,
        };
      });
      subject = {
        scope,
        master: await get("master.wav"),
        inputs,
        recipe: json(await get("recipe.json")),
        map: json(await get("map.json")),
        context,
        policy,
        profile,
        lineage,
        assemblyPolicy: "performance-render-0.1.4",
        gateSet: "technical-master-positive-test-gates-1",
      };
    } else {
      const pack = fixturePack();
      demand(
        pack.pins.zipSha256 === FIXTURE_V046_PINS.zipSha256 &&
          pack.pins.packMembersSha256 === FIXTURE_V046_PINS.packMembersSha256,
        "source_identity_invalid",
        "source",
      );
      const result = await constructFrozenFixture046Master({
        profile: "frozen-fixture046-master-construction/1",
        purpose: "fixture_conformance",
        environment: "test",
      });
      demand(
        result.status === "fixture_master_construction_pass",
        "source_read_failed",
        "source",
      );
      ownedRoot = dirname(result.candidate_directory);
      const tables = loadFoundationRows().tables;
      const mapping = object(
        loadFixtureJson("fixture_persistence_conformance.json"),
      );
      demand(
        Array.isArray(mapping.entries),
        "source_identity_invalid",
        "source",
      );
      verifyLedger(
        tables,
        mapping.entries.map((entry) => asRecord(entry, "mapping entry")),
      );
      const planned = await planFrozenFixture046Render({
        profile: "frozen-fixture046-render-planning/1",
        purpose: "fixture_conformance",
        environment: "test",
      });
      demand(
        planned.status === "fixture_render_planning_pass",
        "source_identity_invalid",
        "source",
      );
      const blocks = [...(tables.render_blocks ?? [])].sort(
        (a, b) => Number(a.sequence) - Number(b.sequence),
      );
      const selections = tables.take_selections ?? [];
      const lineage = blocks.map((block, index) => {
        demand(
          block.base_request_hash ===
            planned.requests[index]?.base_request_hash &&
            block.program_block_id ===
              planned.requests[index]?.program_block_id,
          "selection_binding_invalid",
          "source",
        );
        const own = selections.filter(
          (selection) => selection.render_block_id === block.render_block_id,
        );
        const superseded = new Set(
          own.map((selection) => selection.supersedes_selection_id),
        );
        const terminal = own.filter(
          (selection) => !superseded.has(selection.take_selection_id),
        );
        demand(
          terminal.length === 1 && terminal[0]?.decision === "approved",
          "selection_binding_invalid",
          "source",
        );
        const selection = terminal[0];
        const take = (tables.render_takes ?? []).find(
          (row) => row.render_take_id === selection.render_take_id,
        );
        demand(
          take &&
            take.render_block_id === block.render_block_id &&
            object(take.technical_validation).status === "pass" &&
            object(take.technical_validation).reason_code === null,
          "selection_binding_invalid",
          "source",
        );
        const audio = (tables.audio_artifacts ?? []).find(
          (row) => row.artifact_id === take.audio_artifact_id,
        );
        demand(audio, "selection_binding_invalid", "source");
        return {
          render_block_id: block.render_block_id,
          take_selection_id: selection.take_selection_id,
          render_take_id: take.render_take_id,
          take_index: take.take_index,
          audio_sha256: audio.audio_sha256,
        };
      });
      const recipe = object(loadFixtureJson("assembly_recipe.json"));
      const ordered = recipe.ordered_audio_artifact_hashes;
      demand(Array.isArray(ordered), "recipe_mismatch", "source");
      const inputs = ordered.map((hash: unknown) => {
        const audio = (tables.audio_artifacts ?? []).find(
          (row) => row.audio_sha256 === hash,
        );
        const artifact = (tables.artifacts ?? []).find(
          (row) => row.artifact_id === audio?.artifact_id,
        );
        demand(
          audio && artifact && typeof artifact.storage_uri === "string",
          "input_binding_invalid",
          "source",
        );
        const selected = lineage.find((line) => line.audio_sha256 === hash);
        const block = blocks.find(
          (row) => row.render_block_id === selected?.render_block_id,
        );
        const bytes = Buffer.from(loadFixtureBytes(artifact.storage_uri));
        return {
          bytes,
          record: {
            kind: selected ? "speech" : "static",
            audio_artifact_id: audio.audio_artifact_id,
            artifact_id: audio.artifact_id,
            audio_sha256: hash,
            render_block_id: selected?.render_block_id ?? null,
            render_take_id: selected?.render_take_id ?? null,
            take_selection_id: selected?.take_selection_id ?? null,
            program_block_id: block?.program_block_id ?? null,
            byte_length: String(bytes.length),
            frame_count: String((bytes.length - 44) / 2),
          },
        };
      });
      const config = object(loadFixtureJson("config/show_config_version.json"));
      const configRaw = loadFixtureBytes("config/show_config_version.json");
      const brief = (tables.artifacts ?? []).find(
        (row) => row.artifact_type === "showrunner_brief",
      );
      demand(
        brief &&
          config.config_hash ===
            "d1f022782d543d1b8d9a7fd3d56895b57ca1f2b8381457d84261508e75b36719",
        "context_invalid",
        "source",
      );
      const runtime = object(
        object(config.canonical_payload).configured_runtime_seconds,
      );
      const briefPayload = object(loadFixtureJson("showrunner_brief.json"));
      const target = object(briefPayload.runtime_target);
      demand(
        briefPayload.brief_hash === brief.content_hash &&
          target.purpose === "evaluation_fixture" &&
          target.seconds === 240,
        "context_invalid",
        "source",
      );
      const context = {
        schema: "technical-master-context/1",
        candidate_scope: scope,
        source_identity: {
          kind: "frozen046_pack",
          id: "fixture-0.4.6",
          sha256: pack.pins.zipSha256,
          rows_sha256:
            "a27f4381bd6449bfb656c6431b56115a932e05c82791696fc293c701c0a58a7e",
          mapping_sha256:
            "963d8f5ae5c8d07350dcd39b0da4866cf137b223f736fe5f42ed8d57e803c30a",
        },
        required_program_blocks: [...(tables.program_blocks ?? [])]
          .sort((a, b) => Number(a.sequence) - Number(b.sequence))
          .map((row) => row.program_block_id),
        selection_authority: {
          kind: "historical_fixture",
          source_sha256: pack.pins.zipSha256,
          rows_sha256:
            "a27f4381bd6449bfb656c6431b56115a932e05c82791696fc293c701c0a58a7e",
        },
        runtime_source: {
          kind: "frozen_show_config",
          show_config_version_hash: config.config_hash,
          show_config_member_sha256: sha(configRaw),
          brief_hash: brief.content_hash,
        },
        planned_runtime: {
          numerator: String(target.seconds),
          denominator: "1",
        },
        configured_runtime_bounds: {
          min_seconds: String(runtime.min),
          max_seconds: String(runtime.max),
        },
        explained_silence_intervals: [],
      };
      subject = {
        scope,
        master: await readOwned(
          result.candidate_directory + "/master.wav",
          8388608,
        ),
        map: json(
          await readOwned(result.candidate_directory + "/map.json", 262144),
        ),
        inputs,
        recipe,
        context,
        policy,
        profile,
        lineage,
        assemblyPolicy: "performance-render-0.1.4",
        gateSet: "build2-gates-v1",
      };
    }
  } catch (error) {
    if (ownedRoot) {
      try {
        await fs.rm(ownedRoot, { recursive: true });
      } catch {
        throw new TechnicalRefusal(
          error instanceof TechnicalRefusal ? error.code : "source_read_failed",
          "source",
          true,
        );
      }
    }
    throw error;
  }
  const capturedIdentity = sha(
    Buffer.from(
      canonicalJson({
        selected_inputs: subject.inputs.map((input) => input.record),
        scope: subject.scope,
        assembly_policy: subject.assemblyPolicy,
        gate_set: subject.gateSet,
        recipe: subject.recipe,
        map: subject.map,
        context: subject.context,
        policy: subject.policy,
        profile: subject.profile,
        lineage: subject.lineage,
      }),
    ),
  );
  const masterHash = sha(subject.master);
  const oldMapHash = sha(Buffer.from(canonicalJson(subject.map) + "\n"));
  const inputHashes = subject.inputs.map((input) => sha(input.bytes));
  const acquired: Acquired = {
    subject,
    cleanup: async () => {
      if (ownedRoot) await fs.rm(ownedRoot, { recursive: true });
    },
    recheck: async () => {
      if (ownedRoot) {
        demand(
          sha(await readOwned(ownedRoot + "/candidate/master.wav", 8388608)) ===
            masterHash &&
            sha(await readOwned(ownedRoot + "/candidate/map.json", 262144)) ===
              oldMapHash,
          "subject_changed",
          "freshness",
        );
      }
      demand(
        sha(subject.master) === masterHash &&
          subject.inputs.every(
            (input, i) => sha(input.bytes) === inputHashes[i],
          ),
        "subject_changed",
        "freshness",
      );
      demand(
        sha(
          Buffer.from(
            canonicalJson({
              selected_inputs: subject.inputs.map((input) => input.record),
              scope: subject.scope,
              assembly_policy: subject.assemblyPolicy,
              gate_set: subject.gateSet,
              recipe: subject.recipe,
              map: subject.map,
              context: subject.context,
              policy: subject.policy,
              profile: subject.profile,
              lineage: subject.lineage,
            }),
          ),
        ) === capturedIdentity,
        "fingerprint_changed",
        "freshness",
      );
      demand(
        sha(
          await readOwned(new URL("SOURCE-FILE-MANIFEST.json", ROOT), 262144),
        ) === MANIFEST_PIN,
        "source_identity_invalid",
        "freshness",
      );
      for (const [name, hash] of acquiredFiles)
        demand(
          sha(
            await readOwned(
              new URL(name, ROOT),
              name.endsWith(".wav") ? 8388608 : 262144,
            ),
          ) === hash,
          "subject_changed",
          "freshness",
        );
    },
  };
  acquisitions.add(acquired);
  return acquired;
}
