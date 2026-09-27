CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE accounts (
  account_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_subject text UNIQUE,
  display_name text NOT NULL,
  actor_kind text NOT NULL CHECK (actor_kind IN ('human', 'service', 'policy')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE shows (
  show_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE show_config_versions (
  show_config_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id uuid NOT NULL REFERENCES shows(show_id),
  version_number integer NOT NULL CHECK (version_number > 0),
  config_hash text NOT NULL CHECK (config_hash ~ '^[0-9a-f]{64}$'),
  schema_version text NOT NULL,
  canonical_payload jsonb NOT NULL,
  pre_publish_review_required boolean NOT NULL,
  parent_version_id uuid REFERENCES show_config_versions(show_config_version_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (show_id, version_number), UNIQUE (show_id, config_hash)
);

CREATE TABLE program_runs (
  program_run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id uuid NOT NULL REFERENCES shows(show_id),
  purpose text NOT NULL CHECK (purpose IN ('evaluation', 'production')),
  state text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE program_run_attempts (
  attempt_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_run_id uuid NOT NULL REFERENCES program_runs(program_run_id),
  show_config_version_id uuid NOT NULL REFERENCES show_config_versions(show_config_version_id),
  parent_attempt_id uuid REFERENCES program_run_attempts(attempt_id),
  state text NOT NULL,
  publication_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (parent_attempt_id IS NULL OR parent_attempt_id <> attempt_id)
);

CREATE TABLE artifacts (
  artifact_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_type text NOT NULL,
  schema_version text NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  storage_uri text,
  byte_size bigint CHECK (byte_size IS NULL OR byte_size >= 0),
  canonical_payload jsonb,
  parent_artifact_id uuid REFERENCES artifacts(artifact_id),
  supersedes_artifact_id uuid REFERENCES artifacts(artifact_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (artifact_type, content_hash)
);

CREATE TABLE rights_versions (
  rights_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_identity text NOT NULL,
  policy jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE evidence_units (
  evidence_unit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_hash text NOT NULL UNIQUE CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  evidence_type text NOT NULL,
  usage_class text NOT NULL CHECK (usage_class IN ('assertable', 'hedged_only', 'silent')),
  canonical_content jsonb NOT NULL,
  rights_version_id uuid NOT NULL REFERENCES rights_versions(rights_version_id),
  supersedes_evidence_unit_id uuid REFERENCES evidence_units(evidence_unit_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE claims (
  claim_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_hash text NOT NULL UNIQUE CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  claim_kind text NOT NULL,
  subject jsonb NOT NULL,
  predicate text NOT NULL,
  value jsonb NOT NULL,
  initial_usage_class text NOT NULL CHECK (initial_usage_class IN ('assertable', 'hedged_only', 'silent')),
  asserted_at timestamptz,
  supersedes_claim_id uuid REFERENCES claims(claim_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE claim_state_events (
  claim_state_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES claims(claim_id),
  event_type text NOT NULL CHECK (event_type IN ('confirm', 'contest', 'demote', 'supersede', 'expire', 'usage_change', 'tombstone')),
  event_payload jsonb NOT NULL,
  actor_id uuid NOT NULL REFERENCES accounts(account_id),
  occurred_at timestamptz NOT NULL,
  UNIQUE (claim_id, occurred_at, event_type)
);

CREATE TABLE derivation_runs (
  derivation_run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_version text NOT NULL,
  exact_input_refs jsonb NOT NULL,
  output_hash text NOT NULL CHECK (output_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE claim_supports (
  claim_support_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES claims(claim_id),
  support_kind text NOT NULL CHECK (support_kind IN ('evidence', 'derivation', 'lore', 'signal', 'prediction', 'continuity')),
  evidence_unit_id uuid REFERENCES evidence_units(evidence_unit_id),
  derivation_run_id uuid REFERENCES derivation_runs(derivation_run_id),
  external_support_identity text,
  support_hash text NOT NULL CHECK (support_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(evidence_unit_id, derivation_run_id, external_support_identity) = 1)
);

CREATE TABLE prompt_manifests (
  prompt_manifest_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_versions jsonb NOT NULL,
  rendered_request_hash text NOT NULL CHECK (rendered_request_hash ~ '^[0-9a-f]{64}$'),
  policy_source_hashes jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE provider_calls (
  provider_call_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES program_run_attempts(attempt_id),
  provider text NOT NULL,
  operation text NOT NULL,
  request_fingerprint text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  retry_of_provider_call_id uuid REFERENCES provider_calls(provider_call_id),
  reroll_of_provider_call_id uuid REFERENCES provider_calls(provider_call_id),
  status text NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  usage jsonb,
  cost_minor_units bigint CHECK (cost_minor_units IS NULL OR cost_minor_units >= 0),
  currency text,
  response_artifact_id uuid REFERENCES artifacts(artifact_id),
  CHECK (retry_of_provider_call_id IS NULL OR reroll_of_provider_call_id IS NULL)
);

CREATE TABLE model_runs (
  model_run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES program_run_attempts(attempt_id),
  provider_call_id uuid NOT NULL UNIQUE REFERENCES provider_calls(provider_call_id),
  prompt_manifest_id uuid NOT NULL REFERENCES prompt_manifests(prompt_manifest_id),
  model_identifier text NOT NULL,
  semantic_input_hash text NOT NULL CHECK (semantic_input_hash ~ '^[0-9a-f]{64}$'),
  output_artifact_id uuid REFERENCES artifacts(artifact_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE evidence_packages (evidence_package_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), artifact_id uuid NOT NULL UNIQUE REFERENCES artifacts(artifact_id), program_run_id uuid NOT NULL REFERENCES program_runs(program_run_id), package_hash text NOT NULL UNIQUE);
CREATE TABLE showrunner_brief_versions (showrunner_brief_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), artifact_id uuid NOT NULL UNIQUE REFERENCES artifacts(artifact_id), evidence_package_id uuid NOT NULL REFERENCES evidence_packages(evidence_package_id), attempt_id uuid NOT NULL REFERENCES program_run_attempts(attempt_id), revision_parent_id uuid REFERENCES showrunner_brief_versions(showrunner_brief_version_id));
CREATE TABLE program_blocks (program_block_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), showrunner_brief_version_id uuid NOT NULL REFERENCES showrunner_brief_versions(showrunner_brief_version_id), sequence integer NOT NULL, block_type text NOT NULL, semantic_payload jsonb NOT NULL, UNIQUE(showrunner_brief_version_id, sequence));
CREATE TABLE script_versions (script_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), artifact_id uuid NOT NULL UNIQUE REFERENCES artifacts(artifact_id), showrunner_brief_version_id uuid NOT NULL REFERENCES showrunner_brief_versions(showrunner_brief_version_id), attempt_id uuid NOT NULL REFERENCES program_run_attempts(attempt_id), revision_parent_id uuid REFERENCES script_versions(script_version_id), revision_parent_content_identity text, CHECK ((revision_parent_id IS NULL) = (revision_parent_content_identity IS NULL)));
CREATE TABLE turns (turn_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), script_version_id uuid NOT NULL REFERENCES script_versions(script_version_id), program_block_id uuid NOT NULL REFERENCES program_blocks(program_block_id), sequence integer NOT NULL, participant_id text NOT NULL, spoken_text text NOT NULL CHECK (spoken_text = normalize(spoken_text, NFC)), UNIQUE(script_version_id, sequence));
CREATE TABLE turn_claim_uses (turn_claim_use_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), turn_id uuid NOT NULL REFERENCES turns(turn_id), claim_id uuid NOT NULL REFERENCES claims(claim_id), use_mode text NOT NULL, span_start integer NOT NULL, span_end integer NOT NULL, CHECK (span_start >= 0 AND span_end > span_start));
CREATE TABLE turn_evidence_uses (turn_evidence_use_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), turn_id uuid NOT NULL REFERENCES turns(turn_id), evidence_unit_id uuid NOT NULL REFERENCES evidence_units(evidence_unit_id), span_start integer NOT NULL, span_end integer NOT NULL, CHECK (span_start >= 0 AND span_end > span_start));
CREATE TABLE performance_direction_versions (performance_direction_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), artifact_id uuid NOT NULL UNIQUE REFERENCES artifacts(artifact_id), script_version_id uuid NOT NULL REFERENCES script_versions(script_version_id));
CREATE TABLE performance_intents (performance_intent_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), performance_direction_version_id uuid NOT NULL REFERENCES performance_direction_versions(performance_direction_version_id), turn_id uuid NOT NULL REFERENCES turns(turn_id), intent jsonb NOT NULL);
CREATE TABLE audit_runs (audit_run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), attempt_id uuid NOT NULL REFERENCES program_run_attempts(attempt_id), input_fingerprint text NOT NULL, model_run_id uuid REFERENCES model_runs(model_run_id), result_artifact_id uuid REFERENCES artifacts(artifact_id));
CREATE TABLE gate_definitions (gate_definition_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), gate_name text NOT NULL, version text NOT NULL, definition jsonb NOT NULL, UNIQUE(gate_name, version));
CREATE TABLE gate_results (gate_result_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), gate_definition_id uuid NOT NULL REFERENCES gate_definitions(gate_definition_id), attempt_id uuid NOT NULL REFERENCES program_run_attempts(attempt_id), input_fingerprint text NOT NULL, outcome text NOT NULL, result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE render_manifests (render_manifest_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), artifact_id uuid NOT NULL UNIQUE REFERENCES artifacts(artifact_id), script_version_id uuid NOT NULL REFERENCES script_versions(script_version_id), performance_direction_version_id uuid NOT NULL REFERENCES performance_direction_versions(performance_direction_version_id), audit_run_id uuid NOT NULL REFERENCES audit_runs(audit_run_id));
CREATE TABLE render_blocks (render_block_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), render_manifest_id uuid NOT NULL REFERENCES render_manifests(render_manifest_id), program_block_id uuid NOT NULL REFERENCES program_blocks(program_block_id), sequence integer NOT NULL, speaker_map jsonb NOT NULL, base_request_hash text NOT NULL, UNIQUE(render_manifest_id, sequence));
CREATE TABLE voice_profiles (voice_profile_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), participant_identity text NOT NULL UNIQUE);
CREATE TABLE voice_profile_versions (voice_profile_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), voice_profile_id uuid NOT NULL REFERENCES voice_profiles(voice_profile_id), version integer NOT NULL, render_fields jsonb NOT NULL, UNIQUE(voice_profile_id, version));
CREATE TABLE pronunciations (pronunciation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), canonical_text text NOT NULL UNIQUE);
CREATE TABLE pronunciation_renderings (pronunciation_rendering_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), pronunciation_id uuid NOT NULL REFERENCES pronunciations(pronunciation_id), provider text NOT NULL, rendering text NOT NULL, version integer NOT NULL, UNIQUE(pronunciation_id, provider, version));
CREATE TABLE render_takes (render_take_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), render_block_id uuid NOT NULL REFERENCES render_blocks(render_block_id), take_index integer NOT NULL CHECK(take_index >= 0), provider_call_id uuid NOT NULL UNIQUE REFERENCES provider_calls(provider_call_id), audio_artifact_id uuid NOT NULL REFERENCES artifacts(artifact_id), technical_validation jsonb NOT NULL, UNIQUE(render_block_id, take_index));
CREATE TABLE take_selections (take_selection_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), render_block_id uuid NOT NULL REFERENCES render_blocks(render_block_id), render_take_id uuid NOT NULL REFERENCES render_takes(render_take_id), actor_id uuid NOT NULL REFERENCES accounts(account_id), decision text NOT NULL, supersedes_selection_id uuid REFERENCES take_selections(take_selection_id), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE audio_artifacts (audio_artifact_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), artifact_id uuid NOT NULL UNIQUE REFERENCES artifacts(artifact_id), audio_sha256 text NOT NULL UNIQUE, duration_ms integer NOT NULL CHECK(duration_ms >= 0));
CREATE TABLE assembly_recipes (assembly_recipe_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), artifact_id uuid NOT NULL UNIQUE REFERENCES artifacts(artifact_id), version text NOT NULL);
CREATE TABLE master_assembly_maps (master_assembly_map_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), artifact_id uuid NOT NULL UNIQUE REFERENCES artifacts(artifact_id), assembly_recipe_id uuid NOT NULL REFERENCES assembly_recipes(assembly_recipe_id));
CREATE TABLE episodes (episode_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), program_run_id uuid NOT NULL UNIQUE REFERENCES program_runs(program_run_id), guid text NOT NULL UNIQUE, ready_attempt_id uuid NOT NULL REFERENCES program_run_attempts(attempt_id), master_artifact_id uuid NOT NULL REFERENCES artifacts(artifact_id), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE review_decisions (review_decision_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), episode_id uuid NOT NULL REFERENCES episodes(episode_id), actor_id uuid NOT NULL REFERENCES accounts(account_id), ready_candidate_fingerprint text NOT NULL, decision text NOT NULL, decided_at timestamptz NOT NULL);
CREATE TABLE repair_requests (repair_request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_attempt_id uuid NOT NULL REFERENCES program_run_attempts(attempt_id), source_ready_fingerprint text NOT NULL, actor_id uuid NOT NULL REFERENCES accounts(account_id), feedback text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE repair_plans (repair_plan_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), repair_request_id uuid NOT NULL REFERENCES repair_requests(repair_request_id), parent_plan_id uuid REFERENCES repair_plans(repair_plan_id), plan_version integer NOT NULL, typed_plan jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(repair_request_id, plan_version));

CREATE FUNCTION reject_immutable_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'immutable relation % rejects %', TG_TABLE_NAME, TG_OP USING ERRCODE = '55000'; END $$;

DO $$ DECLARE relation text; BEGIN
  FOREACH relation IN ARRAY ARRAY['show_config_versions','artifacts','rights_versions','evidence_units','claims','claim_state_events','derivation_runs','claim_supports','prompt_manifests','provider_calls','model_runs','evidence_packages','showrunner_brief_versions','program_blocks','script_versions','turns','turn_claim_uses','turn_evidence_uses','performance_direction_versions','performance_intents','audit_runs','gate_definitions','gate_results','render_manifests','render_blocks','voice_profile_versions','pronunciations','pronunciation_renderings','render_takes','take_selections','audio_artifacts','assembly_recipes','master_assembly_maps','episodes','review_decisions','repair_requests','repair_plans']
  LOOP EXECUTE format('CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reject_immutable_mutation()', relation); END LOOP;
END $$;
