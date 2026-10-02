// Assembly recipe / master map / audio-metadata relationships over rows (A4). Owners: Performance & Render v0.1.4 (assembly), Hashing
// v0.1.5 section 14 (exact master/frame map precede Assembly), Contract Trace v0.5.5 frame rules; fixture validator G12/G30. Audio
// bytes are NOT in the database: only hashes and frame metadata recorded in rows/payloads are verified here (the byte facts were
// proved against the pinned WAV members at load). Fixture-scoped: the 44-byte canonical WAV header, 48 kHz mono 16-bit PCM.
import {
  fail,
  indexBy,
  must,
  obj,
  list,
  rowsOf,
  same,
  str,
} from "./check-util.js";
import type { Tables } from "./rows.js";

const RATE = 48000;

export function verifyAssembly(tables: Tables): void {
  const artifacts = indexBy(rowsOf(tables, "artifacts"), "artifact_id");
  const audioByArtifact = new Map(
    rowsOf(tables, "audio_artifacts").map((a) => [str(a.artifact_id), a]),
  );

  // every audio artifact: typed row, payload metadata and row metadata agree (FIXTURE-SCOPED canonical WAV facts)
  const frameOf = new Map<string, number>();
  for (const [id, artifact] of artifacts) {
    if (!str(artifact.artifact_type).startsWith("audio/")) continue;
    const audio = must(audioByArtifact.get(id), `audio row of ${id}`);
    const p = obj(artifact.canonical_payload, "audio payload");
    const frames = p.frame_count;
    if (
      typeof frames !== "number" ||
      !Number.isSafeInteger(frames) ||
      frames <= 0
    )
      fail("audio_frame_count", id);
    if (
      p.sample_rate_hz !== RATE ||
      p.channels !== 1 ||
      p.sample_width_bytes !== 2 ||
      p.codec !== "pcm_s16le" ||
      p.container !== "wav"
    )
      fail("audio_format", id);
    if (
      p.sha256 !== artifact.content_hash ||
      p.sha256 !== audio.audio_sha256 ||
      p.artifact_id !== id ||
      p.audio_artifact_id !== audio.audio_artifact_id ||
      p.path !== artifact.storage_uri ||
      p.byte_length !== artifact.byte_size
    )
      fail("audio_metadata_binding", id);
    if (artifact.byte_size !== 44 + frames * 2) fail("audio_byte_length", id);
    // rounded row milliseconds: exact integer half-up of frames * 1000 / 48000
    if (audio.duration_ms !== Math.floor((frames * 2000 + RATE) / (2 * RATE)))
      fail("audio_duration_ms", id);
    frameOf.set(id, frames);
  }
  if (frameOf.size !== 12) fail("audio_artifact_count", String(frameOf.size));

  // recipe row <-> artifact payload
  const recipeRow = must(
    rowsOf(tables, "assembly_recipes")[0],
    "assembly recipe row",
  );
  if (rowsOf(tables, "assembly_recipes").length !== 1)
    fail("recipe_cardinality");
  const recipeArtifact = must(
    artifacts.get(str(recipeRow.artifact_id)),
    "recipe artifact",
  );
  const recipe = obj(recipeArtifact.canonical_payload, "recipe payload");
  if (
    recipeArtifact.artifact_type !== "assembly_recipe" ||
    recipe.assembly_recipe_id !== recipeRow.assembly_recipe_id ||
    recipe.assembly_recipe_version !== recipeRow.version ||
    recipe.artifact_id !== recipeRow.artifact_id
  )
    fail("recipe_row_payload");

  // map row <-> artifact payload <-> recipe
  const mapRow = must(
    rowsOf(tables, "master_assembly_maps")[0],
    "master map row",
  );
  if (rowsOf(tables, "master_assembly_maps").length !== 1)
    fail("map_cardinality");
  const mapArtifact = must(
    artifacts.get(str(mapRow.artifact_id)),
    "map artifact",
  );
  const map = obj(mapArtifact.canonical_payload, "map payload");
  const masterAudio = must(
    rowsOf(tables, "audio_artifacts").find(
      (a) => a.audio_artifact_id === mapRow.master_audio_artifact_id,
    ),
    "master audio row",
  );
  if (
    mapArtifact.artifact_type !== "master_assembly_map" ||
    map.master_assembly_map_id !== mapRow.master_assembly_map_id ||
    map.assembly_recipe_id !== mapRow.assembly_recipe_id ||
    map.assembly_recipe_id !== recipeRow.assembly_recipe_id ||
    map.master_audio_artifact_id !== mapRow.master_audio_artifact_id ||
    map.master_artifact_id !== masterAudio.artifact_id ||
    map.master_audio_hash !== masterAudio.audio_sha256 ||
    map.assembly_recipe_hash !== recipe.assembly_recipe_hash ||
    map.sample_rate_hz !== RATE
  )
    fail("map_row_payload");
  if (
    artifacts.get(str(masterAudio.artifact_id))?.artifact_type !==
    "audio/clean_master"
  )
    fail("map_master_kind");

  // selected lineage from rows, in render-block order
  const selections = rowsOf(tables, "take_selections");
  const superseded = new Set(
    selections
      .map((s) => s.supersedes_selection_id)
      .filter((v) => v !== null)
      .map(str),
  );
  const takes = indexBy(rowsOf(tables, "render_takes"), "render_take_id");
  const blocks = [...rowsOf(tables, "render_blocks")].sort(
    (a, b) => Number(a.sequence) - Number(b.sequence),
  );
  const finals = blocks.map((b) => {
    const [s] = selections.filter(
      (x) =>
        x.render_block_id === b.render_block_id &&
        x.decision === "approved" &&
        !superseded.has(str(x.take_selection_id)),
    );
    return {
      block: b,
      selection: must(s, "final selection"),
      take: must(takes.get(str(must(s, "s").render_take_id)), "take"),
    };
  });

  const segments = list(map.segments, "segments").map((s) => obj(s, "segment"));
  const speech = segments.filter((s) => s.kind === "speech");
  if (speech.length !== finals.length) fail("map_speech_segment_count");
  speech.forEach((seg, i) => {
    const f = must(finals[i], "final");
    const audio = must(
      audioByArtifact.get(str(f.take.audio_artifact_id)),
      "segment audio",
    );
    if (
      seg.render_block_id !== f.block.render_block_id ||
      seg.program_block_id !== f.block.program_block_id ||
      seg.render_take_id !== f.take.render_take_id ||
      seg.take_selection_id !== f.selection.take_selection_id ||
      seg.artifact_id !== f.take.audio_artifact_id ||
      seg.audio_artifact_id !== audio.audio_artifact_id ||
      seg.audio_sha256 !== audio.audio_sha256
    )
      fail("map_segment_lineage", `block ${str(f.block.sequence)}`);
  });
  // non-speech segments are the static asset(s) named by the recipe
  const staticHashes = new Set(
    list(recipe.static_asset_hashes, "static_asset_hashes").map(str),
  );
  for (const seg of segments.filter((s) => s.kind !== "speech")) {
    const audio = must(
      audioByArtifact.get(str(seg.artifact_id)),
      "static segment audio",
    );
    if (
      !staticHashes.has(str(audio.audio_sha256)) ||
      seg.audio_sha256 !== audio.audio_sha256
    )
      fail("map_static_segment", str(seg.artifact_id));
  }
  // recipe and map list the same ordered audio hashes (segments in order)
  const ordered = segments.map((s) => str(s.audio_sha256));
  same("recipe_ordered_hashes", recipe.ordered_audio_artifact_hashes, ordered);
  same("map_selected_hashes", map.selected_audio_hashes, ordered);

  // exact cumulative frames: contiguous segments, each as long as its audio, ending at the master's frame count
  let cursor = 0;
  for (const seg of segments) {
    const frames = must(frameOf.get(str(seg.artifact_id)), "segment frames");
    const gap = obj(seg.join_metadata, "join_metadata").gap_frames;
    if (typeof gap !== "number" || seg.start_frame !== cursor + gap)
      fail("map_frame_start", str(seg.artifact_id));
    if (seg.end_frame !== seg.start_frame + frames)
      fail("map_frame_length", str(seg.artifact_id));
    cursor = seg.end_frame;
  }
  if (cursor !== frameOf.get(str(masterAudio.artifact_id)))
    fail("map_master_frames");
  // program-block offsets: per brief block, spanning its speech segments
  const offsets = list(map.program_block_offsets, "program_block_offsets").map(
    (o) => obj(o, "offset"),
  );
  const blockOrder = [...rowsOf(tables, "program_blocks")].sort(
    (a, b) => Number(a.sequence) - Number(b.sequence),
  );
  if (offsets.length !== blockOrder.length) fail("map_offset_count");
  offsets.forEach((o, i) => {
    const pb = must(blockOrder[i], "program block");
    const own = speech.filter(
      (s) => s.program_block_id === pb.program_block_id,
    );
    const first = must(own[0], "block first segment");
    const last = must(own[own.length - 1], "block last segment");
    if (
      o.program_block_id !== pb.program_block_id ||
      o.start_frame !== first.start_frame ||
      o.end_frame !== last.end_frame
    )
      fail("map_program_block_offsets", str(pb.program_block_id));
  });
}
