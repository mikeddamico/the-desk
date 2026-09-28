-- PostgreSQL 17 provides gen_random_uuid in core; no extension privilege is required.
CREATE DOMAIN sha256_hex AS text CHECK (VALUE ~ '^[0-9a-f]{64}$');
CREATE DOMAIN base_request_identity AS text CHECK (VALUE ~ '^v1:[0-9a-f]{64}$');
CREATE TYPE lifecycle_state AS ENUM (
  'PENDING', 'EVIDENCE_READY', 'PACKAGED', 'PLANNED', 'SCRIPTED',
  'PERFORMANCE_DIRECTED', 'AUDITED', 'RENDER_PLANNED', 'SYNTHESIZED',
  'ASSEMBLED', 'VALIDATED', 'READY', 'REVALIDATED', 'PUBLISHING', 'PUBLISHED', 'HALTED'
);

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
  state lifecycle_state NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE program_run_attempts (
  attempt_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_run_id uuid NOT NULL REFERENCES program_runs(program_run_id),
  show_config_version_id uuid NOT NULL REFERENCES show_config_versions(show_config_version_id),
  parent_attempt_id uuid,
  repair_plan_id uuid UNIQUE,
  evidence_package_id uuid,
  UNIQUE (program_run_id, attempt_id),
  FOREIGN KEY (program_run_id, parent_attempt_id) REFERENCES program_run_attempts(program_run_id, attempt_id),
  CHECK ((parent_attempt_id IS NULL) = (repair_plan_id IS NULL)),
  state lifecycle_state NOT NULL DEFAULT 'PENDING',
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
  evidence_type text NOT NULL CHECK (evidence_type IN ('fact','quote','observation','analysis','sentiment','texture','rumor','prediction','context')),
  usage_class text NOT NULL CHECK (usage_class IN ('assertable', 'hedged_only', 'silent')),
  canonical_content jsonb NOT NULL,
  rights_version_id uuid NOT NULL REFERENCES rights_versions(rights_version_id),
  supersedes_evidence_unit_id uuid REFERENCES evidence_units(evidence_unit_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE claims (
  claim_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_hash text NOT NULL UNIQUE CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  claim_kind text NOT NULL CHECK (claim_kind IN ('event_fact','status','reported_fact','observation','analysis','desk_derived','lore','mood','program_history','incident','rumor')),
  origin text NOT NULL CHECK (origin IN ('external_publisher','official_source','data_provider','supporter_source','licensed_partner','desk_derived','first_party')),
  subject_domain text NOT NULL CHECK (length(subject_domain) > 0),
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
  provider text NOT NULL CHECK (length(provider) > 0),
  operation text NOT NULL CHECK (length(operation) > 0),
  model_identifier text NOT NULL,
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^(v1:)?[0-9a-f]{64}$'),
  logical_request_key text NOT NULL CHECK (length(logical_request_key) > 0),
  operational_try_number integer NOT NULL CHECK (operational_try_number > 0),
  intentional_take_index integer CHECK (intentional_take_index >= 0),
  retry_of_provider_call_id uuid UNIQUE REFERENCES provider_calls(provider_call_id),
  reroll_of_provider_call_id uuid REFERENCES provider_calls(provider_call_id),
  reroll_trigger_id uuid,
  started_at timestamptz NOT NULL,
  UNIQUE (logical_request_key, operational_try_number),
  CHECK ((operational_try_number = 1) = (retry_of_provider_call_id IS NULL)),
  CHECK (retry_of_provider_call_id IS NULL OR reroll_of_provider_call_id IS NULL),
  CHECK ((reroll_trigger_id IS NULL) = (reroll_of_provider_call_id IS NULL)),
  CHECK (operation <> 'tts' OR (intentional_take_index IS NOT NULL AND request_fingerprint ~ '^v1:[0-9a-f]{64}$')),
  CHECK (intentional_take_index IS NULL OR logical_request_key = request_fingerprint || ':' || intentional_take_index::text)
);
-- Reservation is the immutable started record. A single final event closes an operational try.
CREATE TABLE provider_call_events (
  provider_call_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_call_id uuid NOT NULL UNIQUE REFERENCES provider_calls(provider_call_id),
  event_type text NOT NULL CHECK (event_type IN ('succeeded','retryable_failure','terminal_failure')),
  ended_at timestamptz NOT NULL,
  usage jsonb NOT NULL CHECK (jsonb_typeof(usage) = 'object'),
  actual_cost numeric CHECK (actual_cost >= 0 AND actual_cost < 'Infinity'::numeric),
  currency text CHECK (currency ~ '^[A-Z]{3}$'),
  response_artifact_id uuid REFERENCES artifacts(artifact_id),
  response_reference text,
  CHECK ((actual_cost IS NULL) = (currency IS NULL))
);
CREATE TABLE reroll_triggers (
  reroll_trigger_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_provider_call_id uuid NOT NULL REFERENCES provider_calls(provider_call_id),
  base_request_hash base_request_identity NOT NULL,
  take_index integer NOT NULL CHECK (take_index > 0),
  trigger_kind text NOT NULL DEFAULT 'mechanical_failure' CHECK (trigger_kind IN ('mechanical_failure','operator_repair')),
  failure_code text CHECK (length(failure_code) > 0),
  repair_plan_id uuid,
  CHECK ((trigger_kind = 'mechanical_failure' AND failure_code IS NOT NULL AND repair_plan_id IS NULL)
    OR (trigger_kind = 'operator_repair' AND failure_code IS NULL AND repair_plan_id IS NOT NULL)),
  policy_version text NOT NULL CHECK (length(policy_version) > 0),
  validation_artifact_id uuid NOT NULL REFERENCES artifacts(artifact_id),
  actor_id uuid NOT NULL REFERENCES accounts(account_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (base_request_hash, take_index),
  UNIQUE (reroll_trigger_id, source_provider_call_id)
);
ALTER TABLE provider_calls ADD FOREIGN KEY (reroll_trigger_id, reroll_of_provider_call_id)
  REFERENCES reroll_triggers(reroll_trigger_id, source_provider_call_id);

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

CREATE TABLE evidence_packages (evidence_package_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), artifact_id uuid NOT NULL UNIQUE REFERENCES artifacts(artifact_id), package_hash sha256_hex NOT NULL UNIQUE);
CREATE TABLE showrunner_brief_versions (showrunner_brief_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), artifact_id uuid NOT NULL UNIQUE REFERENCES artifacts(artifact_id), evidence_package_id uuid NOT NULL REFERENCES evidence_packages(evidence_package_id), attempt_id uuid NOT NULL REFERENCES program_run_attempts(attempt_id), revision_parent_id uuid REFERENCES showrunner_brief_versions(showrunner_brief_version_id));
CREATE TABLE program_blocks (program_block_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), showrunner_brief_version_id uuid NOT NULL REFERENCES showrunner_brief_versions(showrunner_brief_version_id), sequence integer NOT NULL, block_type text NOT NULL, semantic_payload jsonb NOT NULL, UNIQUE(showrunner_brief_version_id, sequence));
CREATE TABLE script_versions (script_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), artifact_id uuid NOT NULL UNIQUE REFERENCES artifacts(artifact_id), showrunner_brief_version_id uuid NOT NULL REFERENCES showrunner_brief_versions(showrunner_brief_version_id), attempt_id uuid NOT NULL REFERENCES program_run_attempts(attempt_id), revision_parent_id uuid REFERENCES script_versions(script_version_id), revision_parent_content_identity sha256_hex, CHECK ((revision_parent_id IS NULL) = (revision_parent_content_identity IS NULL)));
CREATE TABLE turns (turn_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), script_version_id uuid NOT NULL REFERENCES script_versions(script_version_id), program_block_id uuid NOT NULL REFERENCES program_blocks(program_block_id), sequence integer NOT NULL, participant_id text NOT NULL, spoken_text text NOT NULL CHECK (spoken_text = normalize(spoken_text, NFC)), UNIQUE(script_version_id, sequence));
CREATE TABLE turn_claim_uses (turn_claim_use_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), turn_id uuid NOT NULL REFERENCES turns(turn_id), claim_id uuid NOT NULL REFERENCES claims(claim_id), use_mode text NOT NULL CHECK (use_mode IN ('asserted','hedged','attributed','relied_on_silent')), span_start integer NOT NULL, span_end integer NOT NULL, CHECK (span_start >= 0 AND span_end > span_start));
CREATE TABLE turn_evidence_uses (turn_evidence_use_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), turn_id uuid NOT NULL REFERENCES turns(turn_id), evidence_unit_id uuid NOT NULL REFERENCES evidence_units(evidence_unit_id), use_mode text NOT NULL CHECK (use_mode IN ('quoted','paraphrased')), span_start integer NOT NULL, span_end integer NOT NULL, CHECK (span_start >= 0 AND span_end > span_start));
CREATE TABLE performance_direction_versions (performance_direction_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), artifact_id uuid NOT NULL UNIQUE REFERENCES artifacts(artifact_id), script_version_id uuid NOT NULL REFERENCES script_versions(script_version_id));
CREATE TABLE performance_intents (performance_intent_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), performance_direction_version_id uuid NOT NULL REFERENCES performance_direction_versions(performance_direction_version_id), turn_id uuid NOT NULL REFERENCES turns(turn_id), intent jsonb NOT NULL);
CREATE TABLE audit_runs (audit_run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), attempt_id uuid NOT NULL REFERENCES program_run_attempts(attempt_id), input_fingerprint sha256_hex NOT NULL, auditor_kind text NOT NULL CHECK (length(auditor_kind) > 0), auditor_version text NOT NULL CHECK (length(auditor_version) > 0), model_run_id uuid REFERENCES model_runs(model_run_id), result_artifact_id uuid REFERENCES artifacts(artifact_id));
CREATE TABLE gate_definitions (gate_definition_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), gate_name text NOT NULL, version text NOT NULL, definition jsonb NOT NULL, UNIQUE(gate_name, version));
CREATE TABLE gate_results (gate_result_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), gate_definition_id uuid NOT NULL REFERENCES gate_definitions(gate_definition_id), attempt_id uuid NOT NULL REFERENCES program_run_attempts(attempt_id), input_fingerprint sha256_hex NOT NULL, outcome text NOT NULL CHECK (outcome IN ('pass','fail','warn')),  result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE render_manifests (render_manifest_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), artifact_id uuid NOT NULL UNIQUE REFERENCES artifacts(artifact_id), script_version_id uuid NOT NULL REFERENCES script_versions(script_version_id), performance_direction_version_id uuid NOT NULL REFERENCES performance_direction_versions(performance_direction_version_id), audit_run_id uuid NOT NULL REFERENCES audit_runs(audit_run_id));
CREATE TABLE render_blocks (render_block_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), render_manifest_id uuid NOT NULL REFERENCES render_manifests(render_manifest_id), program_block_id uuid NOT NULL REFERENCES program_blocks(program_block_id), sequence integer NOT NULL, speaker_map jsonb NOT NULL, base_request_hash base_request_identity NOT NULL, UNIQUE(render_manifest_id, sequence));
CREATE TABLE voice_profiles (voice_profile_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), participant_identity text NOT NULL UNIQUE);
CREATE TABLE voice_profile_versions (voice_profile_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), voice_profile_id uuid NOT NULL REFERENCES voice_profiles(voice_profile_id), version integer NOT NULL, render_fields jsonb NOT NULL, UNIQUE(voice_profile_id, version));
CREATE TABLE pronunciations (pronunciation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), canonical_text text NOT NULL UNIQUE);
CREATE TABLE pronunciation_renderings (pronunciation_rendering_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), pronunciation_id uuid NOT NULL REFERENCES pronunciations(pronunciation_id), provider text NOT NULL, rendering text NOT NULL, version integer NOT NULL, UNIQUE(pronunciation_id, provider, version));
CREATE TABLE render_takes (render_take_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), render_block_id uuid NOT NULL REFERENCES render_blocks(render_block_id), take_index integer NOT NULL CHECK(take_index >= 0), provider_call_id uuid NOT NULL UNIQUE REFERENCES provider_calls(provider_call_id), audio_artifact_id uuid NOT NULL REFERENCES artifacts(artifact_id), technical_validation jsonb NOT NULL, UNIQUE(render_block_id, take_index), UNIQUE(render_block_id, render_take_id));
CREATE TABLE take_selections (take_selection_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), render_block_id uuid NOT NULL REFERENCES render_blocks(render_block_id), render_take_id uuid NOT NULL REFERENCES render_takes(render_take_id), actor_id uuid NOT NULL REFERENCES accounts(account_id), decision text NOT NULL CHECK (decision IN ('approved','rejected')), supersedes_selection_id uuid REFERENCES take_selections(take_selection_id), created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY (render_block_id, render_take_id) REFERENCES render_takes(render_block_id, render_take_id));
CREATE TABLE audio_artifacts (audio_artifact_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), artifact_id uuid NOT NULL UNIQUE REFERENCES artifacts(artifact_id), audio_sha256 sha256_hex NOT NULL UNIQUE, duration_ms integer NOT NULL CHECK(duration_ms >= 0));
CREATE TABLE assembly_recipes (assembly_recipe_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), artifact_id uuid NOT NULL UNIQUE REFERENCES artifacts(artifact_id), version text NOT NULL);
CREATE TABLE master_assembly_maps (master_assembly_map_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), artifact_id uuid NOT NULL UNIQUE REFERENCES artifacts(artifact_id), assembly_recipe_id uuid NOT NULL REFERENCES assembly_recipes(assembly_recipe_id), master_audio_artifact_id uuid NOT NULL REFERENCES audio_artifacts(audio_artifact_id));
CREATE TABLE episodes (
  episode_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_run_id uuid NOT NULL UNIQUE REFERENCES program_runs(program_run_id),
  guid text NOT NULL UNIQUE,
  pub_date timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE episode_versions (
  episode_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES episodes(episode_id),
  attempt_id uuid NOT NULL UNIQUE REFERENCES program_run_attempts(attempt_id),
  ready_candidate_fingerprint sha256_hex NOT NULL UNIQUE,
  master_artifact_id uuid NOT NULL REFERENCES audio_artifacts(artifact_id),
  -- Immutable status at candidate creation; current execution state lives on the attempt.
  status text NOT NULL DEFAULT 'READY' CHECK (status = 'READY'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (episode_version_id, ready_candidate_fingerprint),
  UNIQUE (attempt_id, ready_candidate_fingerprint)
);
CREATE TABLE review_decisions (
  review_decision_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_version_id uuid NOT NULL UNIQUE,
  actor_id uuid NOT NULL REFERENCES accounts(account_id),
  ready_candidate_fingerprint sha256_hex NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approve','request_repair','halt')),
  decided_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (episode_version_id, ready_candidate_fingerprint) REFERENCES episode_versions(episode_version_id, ready_candidate_fingerprint)
);
CREATE TABLE repair_requests (
  repair_request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_attempt_id uuid NOT NULL,
  source_ready_fingerprint sha256_hex NOT NULL,
  actor_id uuid NOT NULL REFERENCES accounts(account_id),
  feedback text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (source_attempt_id, source_ready_fingerprint) REFERENCES episode_versions(attempt_id, ready_candidate_fingerprint)
);
CREATE TABLE repair_plans (
  repair_plan_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_request_id uuid NOT NULL REFERENCES repair_requests(repair_request_id),
  parent_plan_id uuid REFERENCES repair_plans(repair_plan_id),
  plan_version integer NOT NULL CHECK (plan_version > 0),
  typed_plan jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (repair_request_id, plan_version),
  CHECK (typed_plan->>'repair_layer' IS NOT NULL AND typed_plan->>'repair_layer' IN ('programming','writing','performance','pronunciation','render_planning','evidence_claims','unknown'))
);
CREATE TABLE repair_plan_decisions (
  repair_plan_decision_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_plan_id uuid NOT NULL UNIQUE REFERENCES repair_plans(repair_plan_id),
  actor_id uuid NOT NULL REFERENCES accounts(account_id),
  decision text NOT NULL CHECK (decision IN ('confirm','reject')),
  decided_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE reroll_triggers ADD FOREIGN KEY (repair_plan_id) REFERENCES repair_plans(repair_plan_id);
ALTER TABLE program_run_attempts ADD FOREIGN KEY (repair_plan_id) REFERENCES repair_plans(repair_plan_id);
ALTER TABLE program_run_attempts ADD FOREIGN KEY (evidence_package_id) REFERENCES evidence_packages(evidence_package_id);

CREATE FUNCTION reject_immutable_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'immutable relation % rejects %', TG_TABLE_NAME, TG_OP USING ERRCODE = '55000'; END $$;

DO $$ DECLARE relation text; BEGIN
  FOREACH relation IN ARRAY ARRAY['show_config_versions','artifacts','rights_versions','evidence_units','claims','claim_state_events','derivation_runs','claim_supports','prompt_manifests','provider_calls','provider_call_events','reroll_triggers','model_runs','evidence_packages','showrunner_brief_versions','program_blocks','script_versions','turns','turn_claim_uses','turn_evidence_uses','performance_direction_versions','performance_intents','audit_runs','gate_definitions','gate_results','render_manifests','render_blocks','voice_profile_versions','pronunciations','pronunciation_renderings','render_takes','take_selections','audio_artifacts','assembly_recipes','master_assembly_maps','episodes','episode_versions','review_decisions','repair_requests','repair_plans','repair_plan_decisions']
  LOOP EXECUTE format('CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reject_immutable_mutation()', relation);
    EXECUTE format('CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION reject_immutable_mutation()', relation);
  END LOOP;
END $$;

-- One canonical graph, shared by both operational projections.
CREATE FUNCTION valid_lifecycle_edge(previous lifecycle_state, next_state lifecycle_state)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT (next_state = 'HALTED' AND previous NOT IN ('HALTED','PUBLISHED'))
    OR (previous NOT IN ('HALTED','PUBLISHED') AND next_state <> 'HALTED'
        AND array_position(enum_range(NULL::lifecycle_state), next_state)
          = array_position(enum_range(NULL::lifecycle_state), previous) + 1)
$$;

CREATE FUNCTION guard_run_lifecycle() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.state <> 'PENDING' THEN RAISE EXCEPTION 'run must start PENDING'; END IF;
  ELSE
    IF (to_jsonb(NEW) - 'state') IS DISTINCT FROM (to_jsonb(OLD) - 'state')
      OR NOT valid_lifecycle_edge(OLD.state, NEW.state) THEN
      RAISE EXCEPTION 'illegal run transition or identity mutation';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM program_run_attempts WHERE program_run_id = NEW.program_run_id AND state = NEW.state) THEN
      RAISE EXCEPTION 'run projection requires an attempt at the requested state';
    END IF;
  END IF;
  IF NEW.purpose = 'evaluation' AND NEW.state IN ('READY','REVALIDATED','PUBLISHING','PUBLISHED') THEN
    RAISE EXCEPTION 'evaluation cannot pass VALIDATED';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER run_lifecycle BEFORE INSERT OR UPDATE ON program_runs FOR EACH ROW EXECUTE FUNCTION guard_run_lifecycle();

CREATE FUNCTION guard_attempt_lifecycle() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE run_record program_runs; parent program_run_attempts; repair_layer text;
BEGIN
  SELECT * INTO STRICT run_record FROM program_runs WHERE program_run_id = NEW.program_run_id;
  IF NOT EXISTS (SELECT 1 FROM show_config_versions WHERE show_config_version_id = NEW.show_config_version_id AND show_id = run_record.show_id) THEN
    RAISE EXCEPTION 'cross-show configuration binding';
  END IF;
  IF run_record.purpose = 'evaluation' AND (NEW.publication_enabled OR NEW.state IN ('READY','REVALIDATED','PUBLISHING','PUBLISHED')) THEN
    RAISE EXCEPTION 'evaluation cannot enable publication or pass VALIDATED';
  END IF;
  IF NOT NEW.publication_enabled AND NEW.state IN ('PUBLISHING','PUBLISHED') THEN
    RAISE EXCEPTION 'publication disabled';
  END IF;
  IF NEW.state NOT IN ('PENDING','EVIDENCE_READY','HALTED') AND NEW.evidence_package_id IS NULL THEN
    RAISE EXCEPTION 'packaged attempt requires Evidence Package binding';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.state <> 'PENDING' THEN RAISE EXCEPTION 'attempt must start PENDING'; END IF;
    IF NEW.parent_attempt_id IS NOT NULL THEN
      SELECT * INTO STRICT parent FROM program_run_attempts WHERE attempt_id = NEW.parent_attempt_id;
      IF parent.program_run_id <> NEW.program_run_id OR parent.state <> 'READY' THEN
        RAISE EXCEPTION 'repair parent must be READY in the same run';
      END IF;
      SELECT p.typed_plan->>'repair_layer' INTO repair_layer
      FROM repair_plans p JOIN repair_requests r USING (repair_request_id)
      JOIN repair_plan_decisions d USING (repair_plan_id)
      JOIN episode_versions v ON v.attempt_id = r.source_attempt_id AND v.ready_candidate_fingerprint = r.source_ready_fingerprint
      JOIN review_decisions review USING (episode_version_id)
      WHERE p.repair_plan_id = NEW.repair_plan_id AND r.source_attempt_id = parent.attempt_id
        AND d.decision = 'confirm' AND review.decision = 'request_repair';
      IF repair_layer IS NULL OR repair_layer = 'unknown' THEN RAISE EXCEPTION 'repair requires confirmed causal plan and request_repair decision'; END IF;
      IF NEW.evidence_package_id IS NULL OR (repair_layer <> 'evidence_claims' AND NEW.evidence_package_id IS DISTINCT FROM parent.evidence_package_id) THEN
        RAISE EXCEPTION 'lower-layer repair must reuse the exact Evidence Package';
      END IF;
    END IF;
  ELSE
    -- One-time package binding is separate from lifecycle advancement.
    IF NEW.evidence_package_id IS DISTINCT FROM OLD.evidence_package_id THEN
      IF OLD.evidence_package_id IS NOT NULL OR OLD.state NOT IN ('PENDING','EVIDENCE_READY')
        OR (to_jsonb(NEW) - 'evidence_package_id') IS DISTINCT FROM (to_jsonb(OLD) - 'evidence_package_id') THEN
        RAISE EXCEPTION 'Evidence Package binding is immutable once assigned';
      END IF;
    ELSE
      IF (to_jsonb(NEW) - 'state') IS DISTINCT FROM (to_jsonb(OLD) - 'state') OR NOT valid_lifecycle_edge(OLD.state, NEW.state) THEN
        RAISE EXCEPTION 'illegal attempt transition or identity mutation';
      END IF;
    END IF;
    IF NEW.state = 'REVALIDATED' AND EXISTS (SELECT 1 FROM episode_versions v JOIN review_decisions d USING (episode_version_id) WHERE v.attempt_id = NEW.attempt_id AND d.decision <> 'approve') THEN
      RAISE EXCEPTION 'terminal review prevents revalidation';
    END IF;
    IF NEW.state = 'REVALIDATED' AND EXISTS (SELECT 1 FROM show_config_versions WHERE show_config_version_id = NEW.show_config_version_id AND pre_publish_review_required)
      AND NOT EXISTS (SELECT 1 FROM episode_versions v JOIN review_decisions d USING (episode_version_id) WHERE v.attempt_id = NEW.attempt_id AND d.decision = 'approve') THEN
      RAISE EXCEPTION 'READY candidate requires its own approval';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER attempt_lifecycle BEFORE INSERT OR UPDATE ON program_run_attempts FOR EACH ROW EXECUTE FUNCTION guard_attempt_lifecycle();

CREATE FUNCTION bind_evidence_package(target uuid, package uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  UPDATE program_run_attempts SET evidence_package_id = package WHERE attempt_id = target AND evidence_package_id IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'missing attempt or package already bound'; END IF;
END $$;

CREATE FUNCTION guard_episode_lineage() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF TG_TABLE_NAME = 'episodes' THEN
    IF NOT EXISTS (SELECT 1 FROM program_runs r JOIN program_run_attempts a USING (program_run_id)
      WHERE r.program_run_id = NEW.program_run_id AND r.purpose = 'production' AND a.state = 'READY') THEN
      RAISE EXCEPTION 'Episode requires a production READY attempt';
    END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM episodes e JOIN program_run_attempts a USING (program_run_id)
      JOIN program_runs r USING (program_run_id) WHERE e.episode_id = NEW.episode_id AND a.attempt_id = NEW.attempt_id AND a.state = 'READY' AND r.purpose = 'production') THEN
      RAISE EXCEPTION 'candidate must bind a production READY attempt in the Episode run';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER episode_lineage BEFORE INSERT ON episodes FOR EACH ROW EXECUTE FUNCTION guard_episode_lineage();
CREATE TRIGGER episode_version_lineage BEFORE INSERT ON episode_versions FOR EACH ROW EXECUTE FUNCTION guard_episode_lineage();

CREATE FUNCTION transition_attempt(target uuid, expected lifecycle_state, next_state lifecycle_state,
  ready_fingerprint sha256_hex DEFAULT NULL, master uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE run_id uuid; episode uuid;
BEGIN
  IF expected IS NULL OR next_state IS NULL THEN RAISE EXCEPTION 'states required'; END IF;
  IF next_state = 'READY' AND (ready_fingerprint IS NULL OR master IS NULL) THEN
    RAISE EXCEPTION 'READY requires exact candidate and master';
  END IF;
  IF next_state <> 'READY' AND (ready_fingerprint IS NOT NULL OR master IS NOT NULL) THEN
    RAISE EXCEPTION 'candidate fields belong only to READY';
  END IF;
  UPDATE program_run_attempts SET state = next_state WHERE attempt_id = target AND state = expected RETURNING program_run_id INTO run_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'stale or missing attempt'; END IF;
  IF next_state = 'READY' THEN
    -- Serialize first-candidate minting across attempts of the same run.
    PERFORM 1 FROM program_runs WHERE program_run_id = run_id FOR UPDATE;
    SELECT episode_id INTO episode FROM episodes WHERE program_run_id = run_id;
    IF episode IS NULL THEN
      episode := gen_random_uuid();
      INSERT INTO episodes(episode_id, program_run_id, guid, pub_date)
        VALUES (episode, run_id, 'urn:thedesk:episode:' || episode::text, transaction_timestamp());
    END IF;
    INSERT INTO episode_versions(episode_id, attempt_id, ready_candidate_fingerprint, master_artifact_id)
      VALUES (episode, target, ready_fingerprint, master);
  END IF;
END $$;

CREATE FUNCTION transition_run(target uuid, expected lifecycle_state, next_state lifecycle_state)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF expected IS NULL OR next_state IS NULL THEN RAISE EXCEPTION 'states required'; END IF;
  UPDATE program_runs SET state = next_state WHERE program_run_id = target AND state = expected;
  IF NOT FOUND THEN RAISE EXCEPTION 'stale or missing run'; END IF;
END $$;

CREATE FUNCTION guard_operator_decision() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM accounts WHERE account_id = NEW.actor_id AND actor_kind = 'human') THEN
    RAISE EXCEPTION 'privileged decision requires human actor';
  END IF;
  IF TG_TABLE_NAME = 'review_decisions' THEN
    IF NOT EXISTS (
    SELECT 1 FROM episode_versions v JOIN program_run_attempts a USING (attempt_id)
      WHERE v.episode_version_id = NEW.episode_version_id AND a.state = 'READY'
    ) THEN RAISE EXCEPTION 'review requires current READY candidate'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER review_actor BEFORE INSERT ON review_decisions FOR EACH ROW EXECUTE FUNCTION guard_operator_decision();
CREATE TRIGGER repair_decision_actor BEFORE INSERT ON repair_plan_decisions FOR EACH ROW EXECUTE FUNCTION guard_operator_decision();

CREATE FUNCTION guard_provider_history() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE prior provider_calls; trigger_record reroll_triggers;
BEGIN
  IF TG_TABLE_NAME = 'provider_call_events' THEN
    SELECT * INTO STRICT prior FROM provider_calls WHERE provider_call_id = NEW.provider_call_id;
    IF NEW.ended_at < prior.started_at THEN RAISE EXCEPTION 'outcome precedes reservation'; END IF;
  ELSIF TG_TABLE_NAME = 'reroll_triggers' THEN
    SELECT * INTO STRICT prior FROM provider_calls WHERE provider_call_id = NEW.source_provider_call_id;
    IF prior.request_fingerprint <> NEW.base_request_hash OR prior.intentional_take_index + 1 IS DISTINCT FROM NEW.take_index
      OR NOT EXISTS (SELECT 1 FROM provider_call_events WHERE provider_call_id = prior.provider_call_id AND event_type = 'succeeded') THEN
      RAISE EXCEPTION 'reroll requires retained prior take and next intentional index';
    END IF;
    IF NEW.trigger_kind = 'operator_repair' AND (NOT EXISTS (SELECT 1 FROM repair_plan_decisions WHERE repair_plan_id = NEW.repair_plan_id AND decision = 'confirm')
      OR NOT EXISTS (SELECT 1 FROM accounts WHERE account_id = NEW.actor_id AND actor_kind = 'human')) THEN
      RAISE EXCEPTION 'editorial take requires confirmed operator repair';
    END IF;
  ELSE
    IF NEW.retry_of_provider_call_id IS NOT NULL THEN
      SELECT * INTO STRICT prior FROM provider_calls WHERE provider_call_id = NEW.retry_of_provider_call_id;
      IF NEW.logical_request_key <> prior.logical_request_key OR NEW.request_fingerprint <> prior.request_fingerprint
        OR NEW.provider <> prior.provider OR NEW.operation <> prior.operation OR NEW.model_identifier <> prior.model_identifier
        OR NEW.attempt_id <> prior.attempt_id OR NEW.intentional_take_index IS DISTINCT FROM prior.intentional_take_index
        OR NEW.operational_try_number <> prior.operational_try_number + 1
        OR NOT EXISTS (SELECT 1 FROM provider_call_events WHERE provider_call_id = prior.provider_call_id AND event_type = 'retryable_failure') THEN
        RAISE EXCEPTION 'retry must follow a retryable outcome with unchanged logical identity';
      END IF;
    ELSIF NEW.intentional_take_index > 0 THEN
      -- Mechanical rerolls need explicit triggers; new editorial content has a new base hash.
      IF NEW.reroll_trigger_id IS NULL THEN RAISE EXCEPTION 'new intentional take requires reroll trigger'; END IF;
    END IF;
    IF NEW.reroll_trigger_id IS NOT NULL THEN
      SELECT * INTO STRICT trigger_record FROM reroll_triggers WHERE reroll_trigger_id = NEW.reroll_trigger_id;
      SELECT * INTO STRICT prior FROM provider_calls WHERE provider_call_id = trigger_record.source_provider_call_id;
      IF trigger_record.trigger_kind = 'operator_repair' AND NOT EXISTS (SELECT 1 FROM program_run_attempts WHERE attempt_id = NEW.attempt_id AND repair_plan_id = trigger_record.repair_plan_id) THEN
        RAISE EXCEPTION 'editorial take must execute in its confirmed repair child';
      END IF;
      IF NEW.request_fingerprint <> trigger_record.base_request_hash OR NEW.intentional_take_index IS DISTINCT FROM trigger_record.take_index
        OR NEW.provider <> prior.provider OR NEW.operation <> prior.operation OR NEW.model_identifier <> prior.model_identifier THEN
        RAISE EXCEPTION 'reroll call must match its durable trigger';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER provider_history BEFORE INSERT ON provider_calls FOR EACH ROW EXECUTE FUNCTION guard_provider_history();
CREATE TRIGGER provider_event_history BEFORE INSERT ON provider_call_events FOR EACH ROW EXECUTE FUNCTION guard_provider_history();
CREATE TRIGGER reroll_history BEFORE INSERT ON reroll_triggers FOR EACH ROW EXECUTE FUNCTION guard_provider_history();

CREATE FUNCTION guard_render_take() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM render_blocks b JOIN provider_calls c ON c.request_fingerprint = b.base_request_hash
    JOIN provider_call_events e USING (provider_call_id)
    WHERE b.render_block_id = NEW.render_block_id AND c.provider_call_id = NEW.provider_call_id
      AND c.intentional_take_index = NEW.take_index AND e.event_type = 'succeeded'
      AND e.response_artifact_id = NEW.audio_artifact_id) THEN
    RAISE EXCEPTION 'take must match successful provider request, index and audio';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER render_take_lineage BEFORE INSERT ON render_takes FOR EACH ROW EXECUTE FUNCTION guard_render_take();

-- Explicit exceptions to the default application INSERT grant.
REVOKE INSERT ON episodes, episode_versions, review_decisions, repair_plan_decisions FROM desk_runtime;
GRANT INSERT ON review_decisions, repair_plan_decisions TO desk_operator;
GRANT EXECUTE ON FUNCTION transition_attempt(uuid,lifecycle_state,lifecycle_state,sha256_hex,uuid),
  transition_run(uuid,lifecycle_state,lifecycle_state), bind_evidence_package(uuid,uuid) TO desk_runtime;
