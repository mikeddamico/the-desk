import { describe, expect, it } from "vitest";

import { verifyAddendumBindings } from "../src/identity/addendum-binding.js";
import {
  scriptHash,
  semanticAuditResultHash,
  showrunnerBriefHash,
  writerContextManifestHash,
  writerViewHash,
} from "../src/identity/artifacts.js";
import { rawBytesHash } from "../src/identity/domains.js";
import { ProfileRejected } from "../src/identity/profile-errors.js";
import {
  requestBaseHash,
  selectBaseRequestProjection,
} from "../src/identity/request.js";
import {
  showConfigPayloadKeys,
  showConfigVersionHash,
} from "../src/identity/show-config.js";

import {
  applyMutations,
  artifactsByType,
  fixtureBytes,
  fixtureJson,
  foundationTables,
  must,
  onlyArtifact,
  payloadOf,
  type Mutation,
  type Row,
} from "./support/fixture-v046.js";

// Executes every vector of authority_resolution_conformance.json (65) through the TypeScript implementation. The
// expected hashes are read from the shipped file as assertion targets only; each actual value is recomputed here.
type Obj = Record<string, unknown>;
type Step = Omit<Mutation, "op"> & {
  op: string;
  prefix?: string;
  role?: string;
  component?: string;
  policy?: string;
  fact?: string;
};
interface Vector {
  id: string;
  family: string;
  subject: string;
  description: string;
  mutations: Step[];
  expect: {
    result: "accept" | "reject" | "fact";
    relation?: string;
    code?: string;
    value?: boolean;
    hash?: string;
    baseline_hash?: string;
    hashes?: Record<string, string>;
    baseline_hashes?: Record<string, string>;
  };
}
const file = fixtureJson("authority_resolution_conformance.json") as {
  schema: string;
  counts: { vectors: number; by_family: Record<string, number> };
  vectors: Vector[];
};
const tables = foundationTables();
const clone = <T>(value: T): T => structuredClone(value);
const stored = (type: string): string =>
  onlyArtifact(type).content_hash as string;

const block = (n: number): Row =>
  must(
    (
      fixtureJson("base_request_hash_conformance.json") as {
        actual_blocks: { render_block_sequence: number; input_record: Row }[];
      }
    ).actual_blocks.find((b) => b.render_block_sequence === n),
    `block ${String(n)}`,
  ).input_record;

/** Mutations the shared strict helper does not define. */
function applySteps<T>(doc: T, steps: readonly Step[]): T {
  let out = clone(doc);
  for (const step of steps) {
    if (step.op === "reverse") {
      const node = (out as Obj)[step.path.slice(1)] as unknown[];
      node.reverse();
    } else if (step.op === "relabel_turn_ids") {
      const script = out as Obj;
      const map = new Map<string, string>();
      (script.turns as Obj[]).forEach((t, i) => {
        map.set(
          String(t.turn_id),
          `${step.prefix ?? ""}${String(i).padStart(12, "0")}`,
        );
      });
      for (const list of [
        script.turns,
        script.turn_claim_uses,
        script.turn_evidence_uses,
        script.prediction_candidates,
      ])
        for (const item of list as Obj[])
          item.turn_id = must(map.get(String(item.turn_id)));
    } else out = applyMutations(out, [step as Mutation]);
  }
  return out;
}

const mapAddendumPath = (): string =>
  String(
    (
      (fixtureJson("config/policy_versions.json") as { policies: Obj }).policies
        .writing_fixture_profile_addendum as Obj
    ).shipped_at,
  );

function manifestInputs(): { role: string; row: Row; payload: Obj }[] {
  return (tables.prompt_manifests ?? []).map((row) => {
    const artifact = must(
      (tables.artifacts ?? []).find((a) => a.artifact_id === row.artifact_id),
    );
    const payload = clone(payloadOf(artifact));
    return { role: String(payload.purpose), row: clone(row), payload };
  });
}

type Outcome =
  | { kind: "hash"; value: string; baseline: string | undefined }
  | { kind: "hashes"; value: Record<string, string> }
  | { kind: "fact"; value: boolean };

function run(vector: Vector): Outcome {
  const { family, subject, mutations } = vector;
  if (family === "prediction_candidate") {
    const script = payloadOf(onlyArtifact(subject));
    const brief = payloadOf(onlyArtifact("showrunner_brief"));
    return {
      kind: "hash",
      value: scriptHash(applySteps(script, mutations), { brief }),
      baseline: stored(subject),
    };
  }
  if (family === "show_config") {
    const configs = [...(tables.show_config_versions ?? [])].sort(
      (a, b) => Number(a.version_number) - Number(b.version_number),
    );
    const row = must(configs[subject.endsWith("_1") ? 0 : 1]);
    if (mutations[0]?.op === "each_field_changes_hash") {
      const out: Record<string, string> = {};
      for (const key of showConfigPayloadKeys) {
        const changed = clone(row);
        const pl = changed.canonical_payload as Obj;
        const v = pl[key];
        if (key === "configured_runtime_seconds")
          (v as Obj).max = Number((v as Obj).max) + 1;
        else if (typeof v === "boolean") pl[key] = !v;
        else if (typeof v === "number") pl[key] = v + 1;
        else pl[key] = `${String(v)}x`;
        if (key === "pre_publish_review_required")
          changed.pre_publish_review_required = pl[key];
        if (key === "show_id") changed.show_id = pl[key];
        out[key] = showConfigVersionHash(changed);
      }
      return { kind: "hashes", value: out };
    }
    return {
      kind: "hash",
      value: showConfigVersionHash(applySteps(row, mutations)),
      baseline: row.config_hash as string,
    };
  }
  if (family === "writer_view")
    return {
      kind: "hash",
      value: writerViewHash(
        applySteps(payloadOf(onlyArtifact("writer_view")), mutations),
      ),
      baseline: stored("writer_view"),
    };
  if (family === "audit_findings")
    return {
      kind: "hash",
      value: semanticAuditResultHash(
        applySteps(payloadOf(onlyArtifact("semantic_audit_result")), mutations),
      ),
      baseline: stored("semantic_audit_result"),
    };
  if (family === "brief")
    return {
      kind: "hash",
      value: showrunnerBriefHash(
        applySteps(payloadOf(onlyArtifact("showrunner_brief")), mutations),
      ),
      baseline: stored("showrunner_brief"),
    };
  if (family === "addendum_binding") {
    if (subject === "writer_context_manifest")
      return {
        kind: "hash",
        value: writerContextManifestHash(
          applySteps(
            payloadOf(onlyArtifact("writer_context_manifest")),
            mutations,
          ),
        ),
        baseline: stored("writer_context_manifest"),
      };
    const manifests = manifestInputs();
    const policy = clone(fixtureJson("config/policy_versions.json")) as {
      policies: Obj;
    };
    const bytes = fixtureBytes(mapAddendumPath());
    for (const step of mutations) {
      const targets = manifests.filter((m) => m.role === step.role);
      const sha = rawBytesHash(bytes);
      for (const m of targets)
        for (const part of [m.row, m.payload] as Obj[]) {
          const versions = part.component_versions as Obj;
          const sources = part.policy_source_hashes as Obj;
          const component = String(step.component);
          if (step.op === "delete_component") {
            Reflect.deleteProperty(versions, component);
            Reflect.deleteProperty(sources, component);
          } else if (step.op === "set_source_hash")
            sources[component] = (step as unknown as { value: string }).value;
          else if (step.op === "add_component") {
            versions[component] = "writing-fixture-profile-addendum-0.1";
            sources[component] = sha;
          }
        }
      if (step.op === "delete_policy")
        Reflect.deleteProperty(policy.policies, String(step.policy));
    }
    return {
      kind: "hashes",
      value: verifyAddendumBindings(manifests, policy, bytes),
    };
  }
  if (family === "config_identity") {
    const manifest = payloadOf(onlyArtifact("render_manifest"));
    const label = manifest.show_render_config_version;
    const configs = [...(tables.show_config_versions ?? [])].sort(
      (a, b) => Number(a.version_number) - Number(b.version_number),
    );
    const versions = configs.map(
      (c) => (c.canonical_payload as Obj).show_version,
    );
    const hashes = configs.map((c) => String(c.config_hash));
    const gates = fixtureJson("gate_fingerprint_inputs.json") as Record<
      string,
      { input_projection: Obj }
    >;
    const fact = mutations[0]?.fact;
    if (fact === "label_equals_show_version_all_versions")
      return {
        kind: "fact",
        value:
          versions.every((v) => v === label) &&
          payloadOf(onlyArtifact("showrunner_brief")).show_version === label &&
          payloadOf(onlyArtifact("writer_view")).show_version === label,
      };
    if (fact === "label_not_hash_and_not_distinguishing")
      return {
        kind: "fact",
        value:
          !hashes.includes(String(label)) &&
          new Set(versions).size === 1 &&
          !hashes.some((h) => JSON.stringify(manifest).includes(h)),
      };
    return {
      kind: "fact",
      value:
        gates.ready_candidate?.input_projection.show_config_version_hash ===
          hashes[1] && hashes[0] !== hashes[1],
    };
  }
  // pronunciation_grouping
  const n = Number(subject.split("_").at(-1));
  const record = block(n);
  const step = must(mutations[0]);
  const baseline = requestBaseHash(record);
  const hash = (r: unknown): string => requestBaseHash(r);
  const apps = (r: Obj): Obj[] => r.pronunciation_applications as Obj[];
  const r = clone(record);
  if (step.op === "relabel_pronunciation_voice_uuids") {
    const ids = new Map<string, string>();
    const fresh = (old: unknown): string => {
      const key = String(old);
      if (!ids.has(key))
        ids.set(
          key,
          `${step.prefix ?? ""}${String(ids.size + 1).padStart(12, "0")}`,
        );
      return must(ids.get(key));
    };
    for (const voice of Object.values(
      r.voice_versions as Record<string, Obj>,
    )) {
      voice.voice_profile_version_id = fresh(voice.voice_profile_version_id);
      voice.voice_profile_id = fresh(voice.voice_profile_id);
    }
    for (const t of r.turns as Obj[])
      t.voice_profile_version_id =
        ids.get(String(t.voice_profile_version_id)) ??
        t.voice_profile_version_id;
    for (const a of apps(r)) {
      for (const k of [
        "pronunciation_id",
        "pronunciation_rendering_id",
        "rendering_pronunciation_id",
        "canonical_current_pronunciation_id",
      ])
        a[k] = fresh(a[k]);
      a.voice_profile_version_id =
        ids.get(String(a.voice_profile_version_id)) ??
        a.voice_profile_version_id;
    }
    return { kind: "hash", value: hash(r), baseline };
  }
  if (step.op === "descending_rendering_uuids") {
    for (const a of apps(r))
      a.pronunciation_rendering_id = `ffffffff-0000-4000-8000-${Array.from(String(a.pronunciation_rendering_id).slice(-12)).reverse().join("")}`;
    return { kind: "hash", value: hash(r), baseline };
  }
  if (step.op === "clone_first_application_adjacent_fresh_uuids") {
    const first = must(apps(record)[0]);
    const adjacent: Obj = {
      ...first,
      start_offset: Number(first.start_offset) + 1,
      end_offset: Number(first.end_offset) + 1,
    };
    const fresh: Obj = {
      ...adjacent,
      pronunciation_rendering_id: "cf0000aa-0000-4000-8000-0000000000e1",
      pronunciation_id: "cf0000aa-0000-4000-8000-0000000000e2",
    };
    const shared = hash({
      ...record,
      pronunciation_applications: [first, adjacent],
    });
    const freshRecord = {
      ...record,
      pronunciation_applications: [first, fresh],
    };
    const entries = selectBaseRequestProjection(freshRecord)
      .applied_pronunciation_rendering_versions as unknown[];
    if (entries.length !== 1)
      throw new ProfileRejected("identical_content_rows_not_merged");
    return { kind: "hash", value: hash(freshRecord), baseline: shared };
  }
  if (step.op === "duplicate_first_application_same_span") {
    apps(r).push({
      ...must(apps(r)[0]),
      pronunciation_rendering_id: "cf0000aa-0000-4000-8000-0000000000e2",
    });
    return { kind: "hash", value: hash(r), baseline };
  }
  if (step.op === "permute_applications") {
    const [x, y] = apps(record);
    const set = new Set([
      hash({ ...record, pronunciation_applications: [x, y] }),
      hash({ ...record, pronunciation_applications: [y, x] }),
    ]);
    if (set.size !== 1)
      throw new ProfileRejected("application_order_changes_hash");
    return { kind: "hash", value: [...set][0] ?? "", baseline };
  }
  if (step.op === "shuffle_keys") {
    const shuffled = Object.fromEntries(
      Object.entries({
        ...record,
        pronunciation_applications: apps(record).map((a) =>
          Object.fromEntries(Object.entries(a).reverse()),
        ),
      }).reverse(),
    );
    return { kind: "hash", value: hash(shuffled), baseline };
  }
  if (step.op === "duplicate_voice_entry") {
    const voices = r.voice_versions as Record<string, Obj>;
    voices.zz_extra_participant = clone(must(Object.values(voices)[0]));
    return { kind: "hash", value: hash(r), baseline };
  }
  if (step.op === "delete_first_turn_voice_binding") {
    Reflect.deleteProperty(
      r.voice_versions as Obj,
      String(must((r.turns as Obj[])[0]).participant_id),
    );
    return { kind: "hash", value: hash(r), baseline };
  }
  if (step.op === "append_voice_compat") {
    const voices = r.voice_versions as Record<string, Obj>;
    (
      must(voices[String(must((r.turns as Obj[])[0]).participant_id)])
        .provider_model_compatibility as string[]
    ).push("fixture-model-9");
    return { kind: "hash", value: hash(r), baseline };
  }
  return { kind: "hash", value: hash(applySteps(record, mutations)), baseline };
}

describe("authority-resolution vectors (Hashing v0.1.5 10.1) through the TypeScript implementation", () => {
  it("ships 65 vectors in the eight declared families", () => {
    expect(file.schema).toBe("authority-resolution-conformance/1");
    expect(file.vectors).toHaveLength(65);
    expect(file.counts.by_family).toEqual({
      prediction_candidate: 16,
      show_config: 10,
      writer_view: 8,
      addendum_binding: 8,
      audit_findings: 3,
      brief: 4,
      config_identity: 3,
      pronunciation_grouping: 13,
    });
    expect(artifactsByType().size).toBeGreaterThan(0);
  });

  for (const vector of file.vectors)
    it(`${vector.id} ${vector.description}`, () => {
      const exp = vector.expect;
      if (exp.result === "reject") {
        let caught: unknown;
        try {
          run(vector);
        } catch (error) {
          caught = error;
        }
        expect(caught).toBeInstanceOf(ProfileRejected);
        expect((caught as ProfileRejected).code).toBe(exp.code);
        return;
      }
      const outcome = run(vector);
      if (exp.result === "fact") {
        expect(outcome.kind).toBe("fact");
        expect((outcome as { value: boolean }).value).toBe(exp.value);
        return;
      }
      if (outcome.kind === "hash") {
        expect(outcome.value).toBe(exp.hash);
        expect(exp.relation).toBeDefined();
        const same = outcome.value === exp.baseline_hash;
        expect(
          ["baseline", "same", "same_as_shared_uuid_clone"].includes(
            exp.relation ?? "",
          ),
        ).toBe(same);
        if (exp.relation === "baseline" && outcome.baseline !== undefined)
          expect(outcome.value).toBe(outcome.baseline);
      } else if (outcome.kind === "hashes") {
        expect(outcome.value).toEqual(exp.hashes);
        if (exp.relation === "different_each") {
          const baseline = Object.values(exp.baseline_hashes ?? {})[0];
          expect(new Set(Object.values(outcome.value)).size).toBe(
            Object.keys(outcome.value).length,
          );
          expect(Object.values(outcome.value)).not.toContain(baseline);
        }
        if (
          exp.relation === "baseline" &&
          vector.subject === "prompt_manifests"
        )
          for (const row of manifestInputs())
            expect(outcome.value[row.role]).toBe(
              (tables.artifacts ?? []).find(
                (a) =>
                  (a.canonical_payload as Obj).purpose === row.role &&
                  String(a.artifact_type).startsWith("prompt_manifest"),
              )?.content_hash,
            );
      } else throw new Error(`unexpected outcome for ${vector.id}`);
    });
});
