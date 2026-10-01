-- Migration 002: approved Foundation 001+002 persistence profile (FINAL LOCK v1.2.5).
-- Governed by Hashing, Fingerprints & Text Spans v0.1.4 section 13 and the owning successor specifications:
-- Claims v0.1.2 (4.3, 4.4, 4.4.2, 12), Evidence Package v0.2.2 (10.0), Performance & Render v0.1.4 (18.1, 18.2).
-- It changes exactly eight existing tables and adds no other table, service, default or backfill.
-- The migration runner owns the transaction (single client, advisory lock, effective desk_migrator, checksum ledger):
-- this file must not BEGIN/COMMIT. Any failure rolls back everything, including the ledger row.

-- NFC checks (IS NFC NORMALIZED) require a UTF8 database; fail fast before touching anything.
DO $$ BEGIN
  IF current_setting('server_encoding') <> 'UTF8' THEN
    RAISE EXCEPTION 'Migration 002 requires a UTF8 database for NFC normalization checks' USING ERRCODE = '55000';
  END IF;
END $$;

-- Protect all twelve populated-history tables before inspecting them. One statement acquires the locks in
-- the listed (governed) order; ACCESS EXCLUSIVE is the approved bounded initial choice.
LOCK TABLE
  claim_state_events, claim_supports, claims, derivation_runs, evidence_packages, evidence_units,
  prompt_manifests, pronunciation_renderings, pronunciations, render_manifests, turn_claim_uses, turn_evidence_uses
  IN ACCESS EXCLUSIVE MODE;

-- Emptiness is checked only after the locks, in the same fixed order. Populated history is never repaired here.
DO $$ DECLARE protected_table text; populated boolean; BEGIN
  FOREACH protected_table IN ARRAY ARRAY[
    'claim_state_events', 'claim_supports', 'claims', 'derivation_runs', 'evidence_packages', 'evidence_units',
    'prompt_manifests', 'pronunciation_renderings', 'pronunciations', 'render_manifests', 'turn_claim_uses', 'turn_evidence_uses'
  ] LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I)', protected_table) INTO populated;
    IF populated THEN
      RAISE EXCEPTION 'Migration 002 requires empty protected table %; populated history needs a separately reviewed data-aware migration', protected_table
        USING ERRCODE = '55000';
    END IF;
  END LOOP;
END $$;

-- claims (Claims 4.4): immutable initial status; usage stays a separate dimension.
ALTER TABLE claims ADD COLUMN initial_status text NOT NULL;
ALTER TABLE claims ADD CONSTRAINT claims_initial_status_check
  CHECK (initial_status IN ('confirmed', 'contested', 'demoted', 'superseded', 'expired', 'tombstoned'));

-- claim_state_events (Claims 4.4.2): claim-local authoritative reducer order. The timestamp/type uniqueness is
-- dropped and not replaced; distinct events may share claim, occurred_at and event_type.
ALTER TABLE claim_state_events DROP CONSTRAINT claim_state_events_claim_id_occurred_at_event_type_key;
ALTER TABLE claim_state_events ADD COLUMN event_sequence integer NOT NULL;
ALTER TABLE claim_state_events ADD CONSTRAINT claim_state_events_event_sequence_check CHECK (event_sequence > 0);
ALTER TABLE claim_state_events ADD CONSTRAINT claim_state_events_claim_id_event_sequence_key UNIQUE (claim_id, event_sequence);

-- Append-order guard. Positive/unique constraints cannot express "strictly above every accepted sequence".
-- Mechanism: a per-claim transaction advisory lock serializes appenders and is held to commit; the accepted maximum
-- is then read. The lock alone is not sufficient: a REPEATABLE READ/SERIALIZABLE transaction reads one snapshot
-- taken before the lock was granted, so a competitor's commit could be invisible to the maximum query. Outside
-- READ COMMITTED (where each statement takes a fresh snapshot after the lock) the guard therefore proves the
-- snapshot is current - no transaction was in progress when it was taken and no other transaction has been
-- assigned a transaction id since - and otherwise fails safely with serialization_failure (SQLSTATE 40001) so the
-- caller retries in a new transaction. The first accepted sequence is 1; later ones must exceed the accepted
-- maximum (gaps above it are allowed; earlier or unused-gap sequences below it are rejected).
-- Privileges: runs with the caller's rights; runtime already holds SELECT/INSERT and advisory-lock functions are
-- executable by everyone, so no privilege is expanded and no SECURITY DEFINER is introduced.
CREATE FUNCTION guard_claim_event_order() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE accepted_maximum integer;
BEGIN
  IF NEW.claim_id IS NULL OR NEW.event_sequence IS NULL THEN
    RAISE EXCEPTION 'claim state event requires claim and sequence' USING ERRCODE = '23502';
  END IF;
  PERFORM pg_advisory_xact_lock(182736452, hashtext(NEW.claim_id::text));
  IF current_setting('transaction_isolation') <> 'read committed'
    AND (EXISTS (SELECT 1 FROM pg_snapshot_xip(pg_current_snapshot()))
      OR pg_current_xact_id() <> pg_snapshot_xmax(pg_current_snapshot())) THEN
    RAISE EXCEPTION 'claim event append needs a current snapshot; retry in a new transaction' USING ERRCODE = '40001';
  END IF;
  SELECT max(event_sequence) INTO accepted_maximum FROM claim_state_events WHERE claim_id = NEW.claim_id;
  IF accepted_maximum IS NULL THEN
    IF NEW.event_sequence <> 1 THEN
      RAISE EXCEPTION 'first claim state event must have sequence 1' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.event_sequence <= accepted_maximum THEN
    RAISE EXCEPTION 'claim state event sequence % must exceed accepted maximum %', NEW.event_sequence, accepted_maximum
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER claim_event_order BEFORE INSERT ON claim_state_events
  FOR EACH ROW EXECUTE FUNCTION guard_claim_event_order();

-- evidence_units (Evidence 10.0): equal body hashes do not identify the same extraction.
ALTER TABLE evidence_units DROP CONSTRAINT evidence_units_content_hash_key;
CREATE INDEX evidence_units_content_hash_idx ON evidence_units USING btree (content_hash);

-- claim_supports (Claims 4.3): support role. Kind/target agreement is loader/validator work, not SQL.
ALTER TABLE claim_supports ADD COLUMN support_role text NOT NULL;
ALTER TABLE claim_supports ADD CONSTRAINT claim_supports_support_role_check
  CHECK (support_role IN ('supports_value', 'supports_attribution', 'qualifies', 'contradicts', 'context_only'));

-- derivation_runs (Claims 12): SQL NULL and JSON null are invalid for output; parameters are an object.
ALTER TABLE derivation_runs ADD COLUMN parameters jsonb NOT NULL, ADD COLUMN output jsonb NOT NULL;
ALTER TABLE derivation_runs ADD CONSTRAINT derivation_runs_parameters_object_check CHECK (jsonb_typeof(parameters) = 'object');
ALTER TABLE derivation_runs ADD CONSTRAINT derivation_runs_output_value_check
  CHECK (jsonb_typeof(output) IN ('object', 'array', 'string', 'number', 'boolean'));

-- pronunciations (P&R 18.1): canonical identity (entity, language, version) with immediate predecessor lineage.
ALTER TABLE pronunciations DROP CONSTRAINT pronunciations_canonical_text_key;
ALTER TABLE pronunciations
  ADD COLUMN entity_identity text NOT NULL,
  ADD COLUMN canonical_version integer NOT NULL,
  ADD COLUMN language text NOT NULL,
  ADD COLUMN ipa text,
  ADD COLUMN supersedes_pronunciation_id uuid;
ALTER TABLE pronunciations ADD CONSTRAINT pronunciations_supersedes_fk
  FOREIGN KEY (supersedes_pronunciation_id) REFERENCES pronunciations(pronunciation_id)
  ON UPDATE NO ACTION ON DELETE NO ACTION NOT DEFERRABLE;
ALTER TABLE pronunciations ADD CONSTRAINT pronunciations_identity_key UNIQUE (entity_identity, language, canonical_version);
ALTER TABLE pronunciations ADD CONSTRAINT pronunciations_version_check CHECK (canonical_version > 0);
ALTER TABLE pronunciations ADD CONSTRAINT pronunciations_text_check CHECK (
  entity_identity ~ '[^[:space:]]' AND entity_identity IS NFC NORMALIZED
  AND language ~ '[^[:space:]]' AND language IS NFC NORMALIZED
  AND canonical_text ~ '[^[:space:]]' AND canonical_text IS NFC NORMALIZED
  AND (ipa IS NULL OR (ipa ~ '[^[:space:]]' AND ipa IS NFC NORMALIZED)));
ALTER TABLE pronunciations ADD CONSTRAINT pronunciations_version_one_root_check
  CHECK ((canonical_version = 1) = (supersedes_pronunciation_id IS NULL));

-- Cross-row lineage cannot be a CHECK: a successor references the immediately preceding version of the same
-- entity/language. Structural only; no entity table, no current/stale flag.
CREATE FUNCTION guard_pronunciation_lineage() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE predecessor pronunciations;
BEGIN
  IF NEW.supersedes_pronunciation_id IS NOT NULL THEN
    IF NEW.supersedes_pronunciation_id = NEW.pronunciation_id THEN
      RAISE EXCEPTION 'pronunciation cannot supersede itself' USING ERRCODE = '23514';
    END IF;
    SELECT * INTO predecessor FROM pronunciations WHERE pronunciation_id = NEW.supersedes_pronunciation_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'pronunciation predecessor is not visible' USING ERRCODE = '23503';
    END IF;
    IF predecessor.entity_identity IS DISTINCT FROM NEW.entity_identity OR predecessor.language IS DISTINCT FROM NEW.language THEN
      RAISE EXCEPTION 'pronunciation predecessor must have the same entity and language' USING ERRCODE = '23514';
    END IF;
    IF predecessor.canonical_version + 1 <> NEW.canonical_version THEN
      RAISE EXCEPTION 'pronunciation predecessor must be the immediately preceding version' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER pronunciation_lineage BEFORE INSERT ON pronunciations
  FOR EACH ROW EXECUTE FUNCTION guard_pronunciation_lineage();

-- pronunciation_renderings (P&R 18.2): exact voice-version binding. Provider/model compatibility is NOT SQL.
ALTER TABLE pronunciation_renderings DROP CONSTRAINT pronunciation_renderings_pronunciation_id_provider_version_key;
ALTER TABLE pronunciation_renderings ADD COLUMN voice_profile_version_id uuid NOT NULL;
ALTER TABLE pronunciation_renderings ADD CONSTRAINT pronunciation_renderings_voice_profile_version_fk
  FOREIGN KEY (voice_profile_version_id) REFERENCES voice_profile_versions(voice_profile_version_id)
  ON UPDATE NO ACTION ON DELETE NO ACTION NOT DEFERRABLE;
ALTER TABLE pronunciation_renderings ADD CONSTRAINT pronunciation_renderings_identity_key
  UNIQUE (pronunciation_id, provider, voice_profile_version_id, version);
ALTER TABLE pronunciation_renderings ADD CONSTRAINT pronunciation_renderings_version_check CHECK (version > 0);
ALTER TABLE pronunciation_renderings ADD CONSTRAINT pronunciation_renderings_text_check
  CHECK (provider ~ '[^[:space:]]' AND rendering ~ '[^[:space:]]');

-- prompt_manifests (Hashing 12.5): required unique complete-manifest artifact; the three typed fields stay authoritative.
ALTER TABLE prompt_manifests ADD COLUMN artifact_id uuid NOT NULL;
ALTER TABLE prompt_manifests ADD CONSTRAINT prompt_manifests_artifact_id_key UNIQUE (artifact_id);
ALTER TABLE prompt_manifests ADD CONSTRAINT prompt_manifests_artifact_id_fkey
  FOREIGN KEY (artifact_id) REFERENCES artifacts(artifact_id) ON UPDATE NO ACTION ON DELETE NO ACTION NOT DEFERRABLE;
