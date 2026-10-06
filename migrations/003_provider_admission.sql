-- G1-B dependent operational contract, ROOT adjudication 2026-10-06.
-- Exactly eight nullable metadata additions to the existing immutable call/event ledger.
-- No production table, index, grant, default, backfill or historic migration rewrite.
-- Migration runner owns transaction/checksum/migration lock. Quiescent application is required.
SELECT pg_advisory_xact_lock(182736456, 1);
LOCK TABLE provider_calls, provider_call_events IN ACCESS EXCLUSIVE MODE;
ALTER TABLE provider_calls
  ADD COLUMN admitted_at timestamptz,
  ADD COLUMN reserved_cost_upper_bound numeric,
  ADD COLUMN admission_currency text,
  ADD COLUMN admission_policy_hash text,
  ADD COLUMN admission_certificate jsonb,
  ADD COLUMN admission_certificate_hash text;
ALTER TABLE provider_call_events
  ADD COLUMN recorded_at timestamptz,
  ADD COLUMN admission_settlement jsonb;

-- BEFORE STATEMENT prevents non-cooperative ordinary INSERTs from bypassing arbitration.
-- Reads occur ONLY in separate VOLATILE queries after this lock. No transitively called helper/EXECUTE grant.
CREATE FUNCTION guard_provider_installation_insert() RETURNS trigger LANGUAGE plpgsql VOLATILE
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(182736456, 1);
  RETURN NULL;
END $$;
CREATE TRIGGER provider_admission_statement BEFORE INSERT ON provider_calls
FOR EACH STATEMENT EXECUTE FUNCTION guard_provider_installation_insert();
CREATE TRIGGER provider_settlement_statement BEFORE INSERT ON provider_call_events
FOR EACH STATEMENT EXECUTE FUNCTION guard_provider_installation_insert();

CREATE FUNCTION guard_provider_admission() RETURNS trigger LANGUAGE plpgsql VOLATILE
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  cert jsonb; p jsonb; rule jsonb; tariff jsonb; x jsonb; subject jsonb;
  spec record; key text; actual_keys text[]; norm text; canonical text;
  subject_hash text; policy_digest text; cert_digest text; run_id uuid;
  t timestamptz; target_attempt uuid; target_run uuid; candidate_bound numeric; metrics record;
  q numeric; raw_bound numeric; bound numeric; number_value numeric; prior_event provider_call_events; prior_call provider_calls;
BEGIN
  -- Historic rows remain entirely NULL, including newly inserted pinned fixture history.
  IF num_nonnulls(NEW.admitted_at,NEW.reserved_cost_upper_bound,NEW.admission_currency,
      NEW.admission_policy_hash,NEW.admission_certificate,NEW.admission_certificate_hash)=0 THEN RETURN NEW; END IF;
  IF NEW.admitted_at IS NOT NULL THEN
    RAISE EXCEPTION 'provider admission refused' USING ERRCODE='23514',CONSTRAINT='provider_admission_clock_reversed';
  END IF;
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'certified admission requires READ COMMITTED' USING ERRCODE='0A000',CONSTRAINT='provider_admission_certificate_invalid';
  END IF;
  IF num_nonnulls(NEW.reserved_cost_upper_bound,NEW.admission_currency,NEW.admission_policy_hash,
      NEW.admission_certificate,NEW.admission_certificate_hash) <> 5 THEN
    RAISE EXCEPTION 'provider admission refused' USING ERRCODE='23514',CONSTRAINT='provider_admission_certificate_invalid';
  END IF;
  cert:=NEW.admission_certificate; p:=cert->'policy'; rule:=p->'provider_rule'; tariff:=rule->'tariff';
  -- Explicit closed layouts, not a new general JSON serializer/profile registry.
  FOR spec IN SELECT * FROM (VALUES
    ('', ARRAY['schema','mode','policy','policy_hash','provider_call_id','attempt_id','program_run_id','provider','operation','model_identifier','request_fingerprint','logical_request_key','operational_try_number','intentional_take_index','retry_of_provider_call_id','reroll_of_provider_call_id','reroll_trigger_id','input_text_hash','input_bytes','max_output_bytes','currency','accounting_quantum','unrounded_bound','reserved_cost_upper_bound']),
    ('policy', ARRAY['schema','mode','policy_version','scope','currency','accounting_quantum','attempt_cost_ceiling','run_cost_ceiling','utc_day_cost_ceiling','max_reservations_per_attempt','max_reservations_per_run','max_reservations_per_utc_day','max_operational_retries_per_chain','max_operational_retries_per_attempt','max_operational_retries_per_run','max_operational_retries_per_utc_day','max_intentional_rerolls_per_base','max_intentional_rerolls_per_attempt','max_intentional_rerolls_per_run','max_intentional_rerolls_per_utc_day','max_concurrent_global','global_rate','provider_rule']),
    ('policy.global_rate', ARRAY['max_admissions','window_ms','min_spacing_ms']),
    ('policy.provider_rule', ARRAY['provider','operation','model_identifier','max_concurrent','rate','tariff']),
    ('policy.provider_rule.rate', ARRAY['max_admissions','window_ms','min_spacing_ms']),
    ('policy.provider_rule.tariff', ARRAY['schema','tariff_version','tariff_source_hash','input_unit','output_unit','fixed_fee','input_price_per_byte','output_price_per_byte','max_input_bytes','max_output_bytes'])
  ) layouts(path,keys) LOOP
    x:=CASE WHEN spec.path='' THEN cert ELSE cert #> string_to_array(spec.path,'.') END;
    IF jsonb_typeof(x) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'provider admission refused' USING ERRCODE='23514',CONSTRAINT='provider_admission_certificate_invalid';
    END IF;
    SELECT array_agg(k ORDER BY k COLLATE "C") INTO actual_keys FROM jsonb_object_keys(x) k;
    IF actual_keys IS DISTINCT FROM (SELECT array_agg(k ORDER BY k COLLATE "C") FROM unnest(spec.keys) k) THEN
      RAISE EXCEPTION 'provider admission refused' USING ERRCODE='23514',CONSTRAINT='provider_admission_certificate_invalid';
    END IF;
  END LOOP;
  IF cert->>'schema' IS DISTINCT FROM 'g1-sim-admission-certificate/1'
    OR cert->>'mode' IS DISTINCT FROM 'trusted_non_network_simulation'
    OR p->>'schema' IS DISTINCT FROM 'g1-sim-admission-policy/1'
    OR p->>'mode' IS DISTINCT FROM 'trusted_non_network_simulation'
    OR p->>'scope' IS DISTINCT FROM 'single_database_installation'
    OR rule->>'operation' IS DISTINCT FROM 'g1_sim_text'
    OR tariff->>'schema' IS DISTINCT FROM 'g1-sim-byte-tariff/1'
    OR tariff->>'input_unit' IS DISTINCT FROM 'nfc_utf8_byte'
    OR tariff->>'output_unit' IS DISTINCT FROM 'utf8_byte' THEN
    RAISE EXCEPTION 'provider admission refused' USING ERRCODE='23514',CONSTRAINT='provider_admission_certificate_invalid';
  END IF;
  -- All hash-bearing string domains here are restricted ASCII; no raw prompt or arbitrary JSON can reach emission.
  FOR spec IN SELECT * FROM (VALUES
    ('policy.policy_version','^[a-z0-9][a-z0-9._:/-]{0,127}$'),
    ('policy.currency','^[A-Z]{3}$'),
    ('policy.provider_rule.provider','^[a-z0-9][a-z0-9._:/-]{0,127}$'),
    ('policy.provider_rule.model_identifier','^[a-z0-9][a-z0-9._:/-]{0,127}$'),
    ('policy.provider_rule.tariff.tariff_version','^[a-z0-9][a-z0-9._:/-]{0,127}$'),
    ('policy.provider_rule.tariff.tariff_source_hash','^[0-9a-f]{64}$'),
    ('policy_hash','^[0-9a-f]{64}$'),('input_text_hash','^[0-9a-f]{64}$'),
    ('request_fingerprint','^[0-9a-f]{64}$'),('logical_request_key','^[a-z0-9][a-z0-9._:/-]{0,255}$'),
    ('provider','^[a-z0-9][a-z0-9._:/-]{0,127}$'),('model_identifier','^[a-z0-9][a-z0-9._:/-]{0,127}$'),
    ('provider_call_id','^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
    ('attempt_id','^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
    ('program_run_id','^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  ) strings(path,pattern) LOOP
    x:=cert #> string_to_array(spec.path,'.');
    IF jsonb_typeof(x) IS DISTINCT FROM 'string' OR (x #>> '{}') !~ spec.pattern THEN
      RAISE EXCEPTION 'provider admission refused' USING ERRCODE='23514',CONSTRAINT='provider_admission_certificate_invalid';
    END IF;
  END LOOP;
  -- Reject nonzero intentional rerolls and all intentional call bindings in R0.
  IF NEW.intentional_take_index IS NOT NULL OR NEW.reroll_of_provider_call_id IS NOT NULL OR NEW.reroll_trigger_id IS NOT NULL
      OR cert->'intentional_take_index' IS DISTINCT FROM 'null'::jsonb
      OR cert->'reroll_of_provider_call_id' IS DISTINCT FROM 'null'::jsonb
      OR cert->'reroll_trigger_id' IS DISTINCT FROM 'null'::jsonb THEN
    RAISE EXCEPTION 'provider admission refused' USING ERRCODE='23514',CONSTRAINT='provider_admission_reroll_disabled';
  END IF;
  FOR key IN SELECT jsonb_object_keys(p) LOOP
    IF key LIKE 'max_%' THEN
      x:=p->key;
      IF jsonb_typeof(x) IS DISTINCT FROM 'number' THEN
        RAISE EXCEPTION 'provider admission refused' USING ERRCODE='23514',CONSTRAINT='provider_admission_policy_invalid';
      END IF;
      number_value:=(x #>> '{}')::numeric;
      IF number_value<0 OR number_value>2147483647 OR number_value<>trunc(number_value) THEN
        RAISE EXCEPTION 'provider admission refused' USING ERRCODE='23514',CONSTRAINT='provider_admission_policy_invalid';
      END IF;
      cert:=jsonb_set(cert,ARRAY['policy',key],to_jsonb(number_value::bigint),false);
      IF key LIKE 'max_intentional_%' AND (x #>> '{}')::numeric <> 0 THEN
        RAISE EXCEPTION 'provider admission refused' USING ERRCODE='23514',CONSTRAINT='provider_admission_reroll_disabled';
      END IF;
      IF (key LIKE 'max_reservations_%' OR key='max_concurrent_global') AND (x #>> '{}')::numeric=0 THEN
        RAISE EXCEPTION 'provider admission refused' USING ERRCODE='23514',CONSTRAINT='provider_admission_policy_invalid';
      END IF;
    END IF;
  END LOOP;
  IF (p->>'max_operational_retries_per_chain')::numeric>2147483646 THEN
    RAISE EXCEPTION 'provider admission refused' USING ERRCODE='23514',CONSTRAINT='provider_admission_policy_invalid';
  END IF;
  FOR spec IN SELECT * FROM (VALUES
    ('policy.global_rate.max_admissions',1,2147483647),('policy.global_rate.window_ms',1,2147483647),
    ('policy.global_rate.min_spacing_ms',0,2147483647),('policy.provider_rule.max_concurrent',1,2147483647),
    ('policy.provider_rule.rate.max_admissions',1,2147483647),('policy.provider_rule.rate.window_ms',1,2147483647),
    ('policy.provider_rule.rate.min_spacing_ms',0,2147483647),
    ('policy.provider_rule.tariff.max_input_bytes',1,1048576),('policy.provider_rule.tariff.max_output_bytes',0,1048576),
    ('input_bytes',1,1048576),('max_output_bytes',0,1048576),('operational_try_number',1,2147483647)
  ) integers(path,minimum,maximum) LOOP
    x:=cert #> string_to_array(spec.path,'.');
    IF jsonb_typeof(x) IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'provider admission refused' USING ERRCODE='23514',CONSTRAINT='provider_admission_certificate_invalid';
    END IF;
    number_value:=(x #>> '{}')::numeric;
    IF number_value<>trunc(number_value) OR number_value<spec.minimum OR number_value>spec.maximum THEN
      RAISE EXCEPTION 'provider admission refused' USING ERRCODE='23514',CONSTRAINT='provider_admission_certificate_invalid';
    END IF;
    cert:=jsonb_set(cert,string_to_array(spec.path,'.'),to_jsonb(number_value::bigint),false);
  END LOOP;
  FOR spec IN SELECT * FROM (VALUES
    ('policy.attempt_cost_ceiling'),('policy.run_cost_ceiling'),('policy.utc_day_cost_ceiling'),
    ('policy.provider_rule.tariff.fixed_fee'),('policy.provider_rule.tariff.input_price_per_byte'),
    ('policy.provider_rule.tariff.output_price_per_byte'),('unrounded_bound'),('reserved_cost_upper_bound')
  ) money(path) LOOP
    x:=cert #> string_to_array(spec.path,'.');
    IF jsonb_typeof(x) IS DISTINCT FROM 'string' OR (x #>> '{}') !~ '^(0|[1-9][0-9]{0,17})([.][0-9]{1,6})?$' THEN
      RAISE EXCEPTION 'provider admission refused' USING ERRCODE='23514',CONSTRAINT='provider_admission_certificate_invalid';
    END IF;
    norm:=x #>> '{}';
    IF position('.' in norm)>0 THEN norm:=rtrim(rtrim(norm,'0'),'.'); END IF;
    cert:=jsonb_set(cert,string_to_array(spec.path,'.'),to_jsonb(norm),false);
  END LOOP;
  p:=cert->'policy';rule:=p->'provider_rule';tariff:=rule->'tariff';
  IF p->>'accounting_quantum' NOT IN ('1','0.1','0.01','0.001','0.0001','0.00001','0.000001')
    OR jsonb_typeof(p->'accounting_quantum') IS DISTINCT FROM 'string'
    OR jsonb_typeof(cert->'accounting_quantum') IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION 'provider admission refused' USING ERRCODE='23514',CONSTRAINT='provider_admission_policy_invalid';
  END IF;
  q:=(p->>'accounting_quantum')::numeric;
  FOR key IN SELECT unnest(ARRAY['attempt_cost_ceiling','run_cost_ceiling','utc_day_cost_ceiling']) LOOP
    IF (p->>key)::numeric<=0 OR mod((p->>key)::numeric,q)<>0 THEN
      RAISE EXCEPTION 'provider admission refused' USING ERRCODE='23514',CONSTRAINT='provider_admission_policy_invalid';
    END IF;
  END LOOP;
  SELECT program_run_id INTO run_id FROM program_run_attempts WHERE attempt_id=NEW.attempt_id;
  IF run_id IS NULL THEN
    RAISE EXCEPTION 'provider admission refused' USING ERRCODE='23503',CONSTRAINT='provider_admission_certificate_invalid';
  END IF;
  IF cert->>'provider_call_id' IS DISTINCT FROM NEW.provider_call_id::text
    OR cert->>'attempt_id' IS DISTINCT FROM NEW.attempt_id::text
    OR cert->>'program_run_id' IS DISTINCT FROM run_id::text
    OR cert->>'provider' IS DISTINCT FROM NEW.provider OR rule->>'provider' IS DISTINCT FROM NEW.provider
    OR cert->>'operation' IS DISTINCT FROM NEW.operation OR NEW.operation IS DISTINCT FROM 'g1_sim_text'
    OR cert->>'model_identifier' IS DISTINCT FROM NEW.model_identifier OR rule->>'model_identifier' IS DISTINCT FROM NEW.model_identifier
    OR cert->>'logical_request_key' IS DISTINCT FROM NEW.logical_request_key
    OR cert->>'request_fingerprint' IS DISTINCT FROM NEW.request_fingerprint
    OR (cert->>'operational_try_number')::integer IS DISTINCT FROM NEW.operational_try_number
    OR cert->'retry_of_provider_call_id' IS DISTINCT FROM coalesce(to_jsonb(NEW.retry_of_provider_call_id::text),'null'::jsonb)
    OR cert->>'currency' IS DISTINCT FROM p->>'currency' OR NEW.admission_currency IS DISTINCT FROM p->>'currency'
    OR cert->>'accounting_quantum' IS DISTINCT FROM p->>'accounting_quantum'
    OR (cert->>'input_bytes')::integer>(tariff->>'max_input_bytes')::integer
    OR (cert->>'max_output_bytes')::integer>(tariff->>'max_output_bytes')::integer THEN
    RAISE EXCEPTION 'provider admission refused' USING ERRCODE='23514',CONSTRAINT='provider_admission_certificate_invalid';
  END IF;
  raw_bound:=(tariff->>'fixed_fee')::numeric+(cert->>'input_bytes')::numeric*(tariff->>'input_price_per_byte')::numeric
    +(cert->>'max_output_bytes')::numeric*(tariff->>'output_price_per_byte')::numeric;
  bound:=ceil(raw_bound/q)*q;
  IF bound>=1000000000000000000 OR raw_bound IS DISTINCT FROM (cert->>'unrounded_bound')::numeric
    OR bound IS DISTINCT FROM (cert->>'reserved_cost_upper_bound')::numeric OR bound IS DISTINCT FROM NEW.reserved_cost_upper_bound THEN
    RAISE EXCEPTION 'provider admission refused' USING ERRCODE='23514',CONSTRAINT='provider_admission_certificate_invalid';
  END IF;
  FOR subject IN SELECT unnest(ARRAY[p,cert]) LOOP
    -- INLINE RESTRICTED POLICY/CERTIFICATE EMISSION; layouts above guarantee maximum four object levels and ASCII strings.
    SELECT '{' || string_agg(to_json(j0.key)::text || ':' || CASE WHEN jsonb_typeof(j0.value) = 'object' THEN (SELECT '{' || string_agg(to_json(j1.key)::text || ':' || CASE WHEN jsonb_typeof(j1.value) = 'object' THEN (SELECT '{' || string_agg(to_json(j2.key)::text || ':' || CASE WHEN jsonb_typeof(j2.value) = 'object' THEN (SELECT '{' || string_agg(to_json(j3.key)::text || ':' || j3.value::text, ',' ORDER BY j3.key COLLATE "C") || '}' FROM jsonb_each(j2.value) j3) ELSE j2.value::text END, ',' ORDER BY j2.key COLLATE "C") || '}' FROM jsonb_each(j1.value) j2) ELSE j1.value::text END, ',' ORDER BY j1.key COLLATE "C") || '}' FROM jsonb_each(j0.value) j1) ELSE j0.value::text END, ',' ORDER BY j0.key COLLATE "C") || '}' FROM jsonb_each(subject) j0 INTO canonical;
    subject_hash:=encode(sha256(convert_to(
      CASE WHEN subject=p THEN 'provider-admission-policy-v1' ELSE 'provider-admission-certificate-v1' END
      || chr(10) || canonical,'UTF8')),'hex');
    IF subject=p THEN policy_digest:=subject_hash; ELSE cert_digest:=subject_hash; END IF;
  END LOOP;
  IF policy_digest IS DISTINCT FROM NEW.admission_policy_hash OR policy_digest IS DISTINCT FROM cert->>'policy_hash'
    OR cert_digest IS DISTINCT FROM NEW.admission_certificate_hash THEN
    RAISE EXCEPTION 'provider admission refused' USING ERRCODE='23514',CONSTRAINT='provider_admission_certificate_invalid';
  END IF;
  IF EXISTS(SELECT 1 FROM provider_calls WHERE admission_certificate IS NULL) THEN
    RAISE EXCEPTION 'provider admission refused' USING ERRCODE='23514',CONSTRAINT='provider_admission_legacy_unaccounted';
  END IF;
  IF EXISTS(SELECT 1 FROM provider_calls WHERE admission_policy_hash IS DISTINCT FROM policy_digest
      OR admission_certificate->'policy' IS DISTINCT FROM p) THEN
    RAISE EXCEPTION 'provider admission refused' USING ERRCODE='23514',CONSTRAINT='provider_admission_policy_conflict';
  END IF;
  IF EXISTS(SELECT 1 FROM provider_call_events e JOIN provider_calls c USING(provider_call_id)
    WHERE (e.recorded_at IS NOT NULL AND c.admission_certificate IS NOT NULL
 AND e.admission_settlement->>'schema'='g1-sim-settlement/1' AND e.admission_settlement->>'verification_status'='attributed_receipt'
 AND e.admission_settlement->>'metadata_problem'='none'
 AND jsonb_typeof(e.admission_settlement->'invocation_observation_hash')='string' AND e.admission_settlement->>'invocation_observation_hash' ~ '^[0-9a-f]{64}$'
 AND jsonb_typeof(e.admission_settlement->'final_receipt_hash')='string' AND e.admission_settlement->>'final_receipt_hash' ~ '^[0-9a-f]{64}$'
 AND e.admission_settlement->'attribution'=jsonb_build_object('provider_call_id',c.provider_call_id::text,'attempt_id',c.attempt_id::text,
 'program_run_id',c.admission_certificate->>'program_run_id','provider',c.provider,'operation',c.operation,
 'model_identifier',c.model_identifier,'logical_request_key',c.logical_request_key,'request_fingerprint',c.request_fingerprint,
 'admission_certificate_hash',c.admission_certificate_hash,'admission_policy_hash',c.admission_policy_hash)
 AND ((e.admission_settlement->'event_binding')-'actual_cost')=jsonb_build_object('provider_call_id',e.provider_call_id::text,'event_type',e.event_type,
 'ended_at',to_char(e.ended_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'usage',e.usage,
 'currency',e.currency,'response_artifact_id',e.response_artifact_id::text,'response_reference',e.response_reference)
 AND CASE WHEN e.actual_cost IS NULL THEN e.admission_settlement#>'{event_binding,actual_cost}'='null'::jsonb
   ELSE CASE WHEN jsonb_typeof(e.admission_settlement#>'{event_binding,actual_cost}')='string'
     AND length(e.admission_settlement#>>'{event_binding,actual_cost}')<=64
     AND e.admission_settlement#>>'{event_binding,actual_cost}' ~ '^(0|[1-9][0-9]*)([.][0-9]*[1-9])?$'
     THEN (e.admission_settlement#>>'{event_binding,actual_cost}')::numeric=e.actual_cost ELSE false END END
 AND e.admission_settlement->>'price_status'=CASE WHEN e.actual_cost IS NULL THEN 'unknown_final' ELSE 'known_final' END
 AND jsonb_typeof(e.admission_settlement->'work_ended') IN ('boolean','null')
 AND (
 CASE WHEN jsonb_typeof(e.admission_settlement)='object' THEN (e.admission_settlement) ?& ARRAY['schema','verification_status','metadata_problem','invocation_observation_hash','final_receipt_hash','attribution','consumption','work_ended','observed_output_bytes','price_status','event_binding','violations'] AND (e.admission_settlement) - ARRAY['schema','verification_status','metadata_problem','invocation_observation_hash','final_receipt_hash','attribution','consumption','work_ended','observed_output_bytes','price_status','event_binding','violations']='{}'::jsonb ELSE false END
 AND CASE WHEN jsonb_typeof(e.admission_settlement #> '{attribution}')='object' THEN (e.admission_settlement #> '{attribution}') ?& ARRAY['provider_call_id','attempt_id','program_run_id','provider','operation','model_identifier','logical_request_key','request_fingerprint','admission_certificate_hash','admission_policy_hash'] AND (e.admission_settlement #> '{attribution}') - ARRAY['provider_call_id','attempt_id','program_run_id','provider','operation','model_identifier','logical_request_key','request_fingerprint','admission_certificate_hash','admission_policy_hash']='{}'::jsonb ELSE false END
 AND CASE WHEN jsonb_typeof(e.admission_settlement #> '{consumption}')='object' THEN (e.admission_settlement #> '{consumption}') ?& ARRAY['observation_state','input_text_hash','input_bytes','consumed_output_cap','computed_request_fingerprint','consumed_certificate_hash','consumed_provider','consumed_operation','consumed_model_identifier'] AND (e.admission_settlement #> '{consumption}') - ARRAY['observation_state','input_text_hash','input_bytes','consumed_output_cap','computed_request_fingerprint','consumed_certificate_hash','consumed_provider','consumed_operation','consumed_model_identifier']='{}'::jsonb ELSE false END
 AND CASE WHEN jsonb_typeof(e.admission_settlement #> '{event_binding}')='object' THEN (e.admission_settlement #> '{event_binding}') ?& ARRAY['provider_call_id','event_type','ended_at','usage','actual_cost','currency','response_artifact_id','response_reference'] AND (e.admission_settlement #> '{event_binding}') - ARRAY['provider_call_id','event_type','ended_at','usage','actual_cost','currency','response_artifact_id','response_reference']='{}'::jsonb ELSE false END
 AND CASE WHEN jsonb_typeof(e.admission_settlement #> '{event_binding,usage}')='object' THEN (e.admission_settlement #> '{event_binding,usage}') ?& ARRAY['input_bytes','output_bytes'] AND (e.admission_settlement #> '{event_binding,usage}') - ARRAY['input_bytes','output_bytes']='{}'::jsonb ELSE false END
 AND (jsonb_typeof(e.admission_settlement #> '{attribution,provider_call_id}')='string' AND (e.admission_settlement #>> '{attribution,provider_call_id}') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
 AND (jsonb_typeof(e.admission_settlement #> '{attribution,attempt_id}')='string' AND (e.admission_settlement #>> '{attribution,attempt_id}') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
 AND (jsonb_typeof(e.admission_settlement #> '{attribution,program_run_id}')='string' AND (e.admission_settlement #>> '{attribution,program_run_id}') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
 AND (jsonb_typeof(e.admission_settlement #> '{attribution,provider}')='string' AND (e.admission_settlement #>> '{attribution,provider}') ~ '^[a-z0-9][a-z0-9._:/-]{0,127}$')
 AND (jsonb_typeof(e.admission_settlement #> '{attribution,model_identifier}')='string' AND (e.admission_settlement #>> '{attribution,model_identifier}') ~ '^[a-z0-9][a-z0-9._:/-]{0,127}$')
 AND (jsonb_typeof(e.admission_settlement #> '{attribution,operation}')='string' AND (e.admission_settlement #>> '{attribution,operation}') ~ '^g1_sim_text$')
 AND (jsonb_typeof(e.admission_settlement #> '{attribution,logical_request_key}')='string' AND (e.admission_settlement #>> '{attribution,logical_request_key}') ~ '^[a-z0-9][a-z0-9._:/-]{0,255}$')
 AND (jsonb_typeof(e.admission_settlement #> '{attribution,request_fingerprint}')='string' AND (e.admission_settlement #>> '{attribution,request_fingerprint}') ~ '^[0-9a-f]{64}$')
 AND (jsonb_typeof(e.admission_settlement #> '{attribution,admission_certificate_hash}')='string' AND (e.admission_settlement #>> '{attribution,admission_certificate_hash}') ~ '^[0-9a-f]{64}$')
 AND (jsonb_typeof(e.admission_settlement #> '{attribution,admission_policy_hash}')='string' AND (e.admission_settlement #>> '{attribution,admission_policy_hash}') ~ '^[0-9a-f]{64}$')
 AND ((e.admission_settlement #> '{consumption,input_text_hash}')='null'::jsonb OR (jsonb_typeof(e.admission_settlement #> '{consumption,input_text_hash}')='string' AND (e.admission_settlement #>> '{consumption,input_text_hash}') ~ '^[0-9a-f]{64}$'))
 AND ((e.admission_settlement #> '{consumption,computed_request_fingerprint}')='null'::jsonb OR (jsonb_typeof(e.admission_settlement #> '{consumption,computed_request_fingerprint}')='string' AND (e.admission_settlement #>> '{consumption,computed_request_fingerprint}') ~ '^[0-9a-f]{64}$'))
 AND ((e.admission_settlement #> '{consumption,consumed_certificate_hash}')='null'::jsonb OR (jsonb_typeof(e.admission_settlement #> '{consumption,consumed_certificate_hash}')='string' AND (e.admission_settlement #>> '{consumption,consumed_certificate_hash}') ~ '^[0-9a-f]{64}$'))
 AND ((e.admission_settlement #> '{consumption,consumed_provider}')='null'::jsonb OR (jsonb_typeof(e.admission_settlement #> '{consumption,consumed_provider}')='string' AND (e.admission_settlement #>> '{consumption,consumed_provider}') ~ '^[a-z0-9][a-z0-9._:/-]{0,127}$'))
 AND ((e.admission_settlement #> '{consumption,consumed_operation}')='null'::jsonb OR (jsonb_typeof(e.admission_settlement #> '{consumption,consumed_operation}')='string' AND (e.admission_settlement #>> '{consumption,consumed_operation}') ~ '^[a-z0-9][a-z0-9._:/-]{0,127}$'))
 AND ((e.admission_settlement #> '{consumption,consumed_model_identifier}')='null'::jsonb OR (jsonb_typeof(e.admission_settlement #> '{consumption,consumed_model_identifier}')='string' AND (e.admission_settlement #>> '{consumption,consumed_model_identifier}') ~ '^[a-z0-9][a-z0-9._:/-]{0,127}$'))
 AND ((e.admission_settlement #> '{consumption,input_bytes}')='null'::jsonb OR CASE WHEN jsonb_typeof(e.admission_settlement #> '{consumption,input_bytes}')='number' THEN (e.admission_settlement #>> '{consumption,input_bytes}')::numeric BETWEEN 0 AND 2147483647 AND (e.admission_settlement #>> '{consumption,input_bytes}')::numeric=trunc((e.admission_settlement #>> '{consumption,input_bytes}')::numeric) ELSE false END)
 AND ((e.admission_settlement #> '{consumption,consumed_output_cap}')='null'::jsonb OR CASE WHEN jsonb_typeof(e.admission_settlement #> '{consumption,consumed_output_cap}')='number' THEN (e.admission_settlement #>> '{consumption,consumed_output_cap}')::numeric BETWEEN 0 AND 2147483647 AND (e.admission_settlement #>> '{consumption,consumed_output_cap}')::numeric=trunc((e.admission_settlement #>> '{consumption,consumed_output_cap}')::numeric) ELSE false END)
 AND ((e.admission_settlement #> '{observed_output_bytes}')='null'::jsonb OR CASE WHEN jsonb_typeof(e.admission_settlement #> '{observed_output_bytes}')='number' THEN (e.admission_settlement #>> '{observed_output_bytes}')::numeric BETWEEN 0 AND 2147483647 AND (e.admission_settlement #>> '{observed_output_bytes}')::numeric=trunc((e.admission_settlement #>> '{observed_output_bytes}')::numeric) ELSE false END)
 AND ((e.admission_settlement #> '{event_binding,usage,input_bytes}')='null'::jsonb OR CASE WHEN jsonb_typeof(e.admission_settlement #> '{event_binding,usage,input_bytes}')='number' THEN (e.admission_settlement #>> '{event_binding,usage,input_bytes}')::numeric BETWEEN 0 AND 2147483647 AND (e.admission_settlement #>> '{event_binding,usage,input_bytes}')::numeric=trunc((e.admission_settlement #>> '{event_binding,usage,input_bytes}')::numeric) ELSE false END)
 AND ((e.admission_settlement #> '{event_binding,usage,output_bytes}')='null'::jsonb OR CASE WHEN jsonb_typeof(e.admission_settlement #> '{event_binding,usage,output_bytes}')='number' THEN (e.admission_settlement #>> '{event_binding,usage,output_bytes}')::numeric BETWEEN 0 AND 2147483647 AND (e.admission_settlement #>> '{event_binding,usage,output_bytes}')::numeric=trunc((e.admission_settlement #>> '{event_binding,usage,output_bytes}')::numeric) ELSE false END)
 AND (jsonb_typeof(e.admission_settlement #> '{event_binding,provider_call_id}')='string' AND (e.admission_settlement #>> '{event_binding,provider_call_id}') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
 AND (jsonb_typeof(e.admission_settlement #> '{event_binding,event_type}')='string' AND (e.admission_settlement #>> '{event_binding,event_type}') ~ '^(succeeded|retryable_failure|terminal_failure)$')
 AND ((e.admission_settlement #> '{event_binding,currency}')='null'::jsonb OR (jsonb_typeof(e.admission_settlement #> '{event_binding,currency}')='string' AND (e.admission_settlement #>> '{event_binding,currency}') ~ '^[A-Z]{3}$'))
 AND ((e.admission_settlement #> '{event_binding,response_artifact_id}')='null'::jsonb OR (jsonb_typeof(e.admission_settlement #> '{event_binding,response_artifact_id}')='string' AND (e.admission_settlement #>> '{event_binding,response_artifact_id}') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'))
 AND e.admission_settlement->>'schema'='g1-sim-settlement/1'
 AND e.admission_settlement->>'verification_status'='attributed_receipt'
 AND e.admission_settlement->>'metadata_problem'='none'
 AND (jsonb_typeof(e.admission_settlement->'invocation_observation_hash')='string' AND e.admission_settlement->>'invocation_observation_hash' ~ '^[0-9a-f]{64}$')
 AND (jsonb_typeof(e.admission_settlement->'final_receipt_hash')='string' AND e.admission_settlement->>'final_receipt_hash' ~ '^[0-9a-f]{64}$')
 AND jsonb_typeof(e.admission_settlement->'work_ended') IN ('boolean','null')
 AND e.admission_settlement->>'price_status' IN ('known_final','unknown_final')
 AND CASE WHEN jsonb_typeof(e.admission_settlement->'violations')='array' THEN NOT EXISTS(SELECT 1 FROM jsonb_array_elements(e.admission_settlement->'violations') AS items(violation_item) WHERE jsonb_typeof(violation_item) IS DISTINCT FROM 'string' OR violation_item #>> '{}' NOT IN ('metadata_unverified','input_hash_unobserved','input_hash_mismatch','input_count_unobserved','input_count_mismatch','output_cap_unobserved','output_cap_mismatch','request_fingerprint_unobserved','request_fingerprint_mismatch','certificate_unobserved','certificate_mismatch','provider_unobserved','provider_mismatch','operation_unobserved','operation_mismatch','model_unobserved','model_mismatch','output_count_unknown_at_end','output_over_cap','foreign_currency','actual_above_bound')) ELSE false END
 AND e.admission_settlement#>>'{consumption,observation_state}'=CASE WHEN (e.admission_settlement #> '{consumption}') @> '{"input_text_hash":null}'::jsonb OR (e.admission_settlement #> '{consumption}') @> '{"input_bytes":null}'::jsonb OR (e.admission_settlement #> '{consumption}') @> '{"consumed_output_cap":null}'::jsonb OR (e.admission_settlement #> '{consumption}') @> '{"computed_request_fingerprint":null}'::jsonb OR (e.admission_settlement #> '{consumption}') @> '{"consumed_certificate_hash":null}'::jsonb OR (e.admission_settlement #> '{consumption}') @> '{"consumed_provider":null}'::jsonb OR (e.admission_settlement #> '{consumption}') @> '{"consumed_operation":null}'::jsonb OR (e.admission_settlement #> '{consumption}') @> '{"consumed_model_identifier":null}'::jsonb THEN 'incomplete' ELSE 'complete' END
 AND CASE WHEN jsonb_typeof(e.admission_settlement #> '{event_binding,ended_at}')='string' AND (e.admission_settlement #>> '{event_binding,ended_at}') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{6}Z$' THEN CASE WHEN pg_input_is_valid(e.admission_settlement #>> '{event_binding,ended_at}','timestamp with time zone') THEN to_char((e.admission_settlement #>> '{event_binding,ended_at}')::timestamptz AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')=(e.admission_settlement #>> '{event_binding,ended_at}') ELSE false END ELSE false END
 AND ((e.admission_settlement #> '{event_binding,actual_cost}')='null'::jsonb OR (jsonb_typeof(e.admission_settlement #> '{event_binding,actual_cost}')='string' AND length(e.admission_settlement #>> '{event_binding,actual_cost}')<=64 AND (e.admission_settlement #>> '{event_binding,actual_cost}') ~ '^(0|[1-9][0-9]*)([.][0-9]*[1-9])?$'))
 AND ((e.admission_settlement #> '{event_binding,actual_cost}')='null'::jsonb)=((e.admission_settlement #> '{event_binding,currency}')='null'::jsonb)
 AND ((e.admission_settlement #> '{event_binding,response_reference}')='null'::jsonb OR (jsonb_typeof(e.admission_settlement #> '{event_binding,response_reference}')='string' AND octet_length(e.admission_settlement #>> '{event_binding,response_reference}')<=4096 AND (e.admission_settlement #>> '{event_binding,response_reference}') IS NFC NORMALIZED)))) IS DISTINCT FROM true
      OR e.admission_settlement->'violations' IS DISTINCT FROM '[]'::jsonb
      OR (e.actual_cost IS NOT NULL AND (e.currency IS DISTINCT FROM c.admission_currency OR e.actual_cost>c.reserved_cost_upper_bound))) THEN
    RAISE EXCEPTION 'provider admission refused' USING ERRCODE='23514',CONSTRAINT='provider_admission_breach';
  END IF;
  IF NEW.retry_of_provider_call_id IS NOT NULL THEN
    SELECT * INTO prior_event FROM provider_call_events WHERE provider_call_id=NEW.retry_of_provider_call_id;
    SELECT * INTO prior_call FROM provider_calls WHERE provider_call_id=NEW.retry_of_provider_call_id;
    IF prior_event.event_type IS DISTINCT FROM 'retryable_failure'
      OR (prior_event.recorded_at IS NOT NULL AND prior_call.admission_certificate IS NOT NULL
 AND prior_event.admission_settlement->>'schema'='g1-sim-settlement/1' AND prior_event.admission_settlement->>'verification_status'='attributed_receipt'
 AND prior_event.admission_settlement->>'metadata_problem'='none'
 AND jsonb_typeof(prior_event.admission_settlement->'invocation_observation_hash')='string' AND prior_event.admission_settlement->>'invocation_observation_hash' ~ '^[0-9a-f]{64}$'
 AND jsonb_typeof(prior_event.admission_settlement->'final_receipt_hash')='string' AND prior_event.admission_settlement->>'final_receipt_hash' ~ '^[0-9a-f]{64}$'
 AND prior_event.admission_settlement->'attribution'=jsonb_build_object('provider_call_id',prior_call.provider_call_id::text,'attempt_id',prior_call.attempt_id::text,
 'program_run_id',prior_call.admission_certificate->>'program_run_id','provider',prior_call.provider,'operation',prior_call.operation,
 'model_identifier',prior_call.model_identifier,'logical_request_key',prior_call.logical_request_key,'request_fingerprint',prior_call.request_fingerprint,
 'admission_certificate_hash',prior_call.admission_certificate_hash,'admission_policy_hash',prior_call.admission_policy_hash)
 AND ((prior_event.admission_settlement->'event_binding')-'actual_cost')=jsonb_build_object('provider_call_id',prior_event.provider_call_id::text,'event_type',prior_event.event_type,
 'ended_at',to_char(prior_event.ended_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'usage',prior_event.usage,
 'currency',prior_event.currency,'response_artifact_id',prior_event.response_artifact_id::text,'response_reference',prior_event.response_reference)
 AND CASE WHEN prior_event.actual_cost IS NULL THEN prior_event.admission_settlement#>'{event_binding,actual_cost}'='null'::jsonb
   ELSE CASE WHEN jsonb_typeof(prior_event.admission_settlement#>'{event_binding,actual_cost}')='string'
     AND length(prior_event.admission_settlement#>>'{event_binding,actual_cost}')<=64
     AND prior_event.admission_settlement#>>'{event_binding,actual_cost}' ~ '^(0|[1-9][0-9]*)([.][0-9]*[1-9])?$'
     THEN (prior_event.admission_settlement#>>'{event_binding,actual_cost}')::numeric=prior_event.actual_cost ELSE false END END
 AND prior_event.admission_settlement->>'price_status'=CASE WHEN prior_event.actual_cost IS NULL THEN 'unknown_final' ELSE 'known_final' END
 AND jsonb_typeof(prior_event.admission_settlement->'work_ended') IN ('boolean','null')
 AND (
 CASE WHEN jsonb_typeof(prior_event.admission_settlement)='object' THEN (prior_event.admission_settlement) ?& ARRAY['schema','verification_status','metadata_problem','invocation_observation_hash','final_receipt_hash','attribution','consumption','work_ended','observed_output_bytes','price_status','event_binding','violations'] AND (prior_event.admission_settlement) - ARRAY['schema','verification_status','metadata_problem','invocation_observation_hash','final_receipt_hash','attribution','consumption','work_ended','observed_output_bytes','price_status','event_binding','violations']='{}'::jsonb ELSE false END
 AND CASE WHEN jsonb_typeof(prior_event.admission_settlement #> '{attribution}')='object' THEN (prior_event.admission_settlement #> '{attribution}') ?& ARRAY['provider_call_id','attempt_id','program_run_id','provider','operation','model_identifier','logical_request_key','request_fingerprint','admission_certificate_hash','admission_policy_hash'] AND (prior_event.admission_settlement #> '{attribution}') - ARRAY['provider_call_id','attempt_id','program_run_id','provider','operation','model_identifier','logical_request_key','request_fingerprint','admission_certificate_hash','admission_policy_hash']='{}'::jsonb ELSE false END
 AND CASE WHEN jsonb_typeof(prior_event.admission_settlement #> '{consumption}')='object' THEN (prior_event.admission_settlement #> '{consumption}') ?& ARRAY['observation_state','input_text_hash','input_bytes','consumed_output_cap','computed_request_fingerprint','consumed_certificate_hash','consumed_provider','consumed_operation','consumed_model_identifier'] AND (prior_event.admission_settlement #> '{consumption}') - ARRAY['observation_state','input_text_hash','input_bytes','consumed_output_cap','computed_request_fingerprint','consumed_certificate_hash','consumed_provider','consumed_operation','consumed_model_identifier']='{}'::jsonb ELSE false END
 AND CASE WHEN jsonb_typeof(prior_event.admission_settlement #> '{event_binding}')='object' THEN (prior_event.admission_settlement #> '{event_binding}') ?& ARRAY['provider_call_id','event_type','ended_at','usage','actual_cost','currency','response_artifact_id','response_reference'] AND (prior_event.admission_settlement #> '{event_binding}') - ARRAY['provider_call_id','event_type','ended_at','usage','actual_cost','currency','response_artifact_id','response_reference']='{}'::jsonb ELSE false END
 AND CASE WHEN jsonb_typeof(prior_event.admission_settlement #> '{event_binding,usage}')='object' THEN (prior_event.admission_settlement #> '{event_binding,usage}') ?& ARRAY['input_bytes','output_bytes'] AND (prior_event.admission_settlement #> '{event_binding,usage}') - ARRAY['input_bytes','output_bytes']='{}'::jsonb ELSE false END
 AND (jsonb_typeof(prior_event.admission_settlement #> '{attribution,provider_call_id}')='string' AND (prior_event.admission_settlement #>> '{attribution,provider_call_id}') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
 AND (jsonb_typeof(prior_event.admission_settlement #> '{attribution,attempt_id}')='string' AND (prior_event.admission_settlement #>> '{attribution,attempt_id}') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
 AND (jsonb_typeof(prior_event.admission_settlement #> '{attribution,program_run_id}')='string' AND (prior_event.admission_settlement #>> '{attribution,program_run_id}') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
 AND (jsonb_typeof(prior_event.admission_settlement #> '{attribution,provider}')='string' AND (prior_event.admission_settlement #>> '{attribution,provider}') ~ '^[a-z0-9][a-z0-9._:/-]{0,127}$')
 AND (jsonb_typeof(prior_event.admission_settlement #> '{attribution,model_identifier}')='string' AND (prior_event.admission_settlement #>> '{attribution,model_identifier}') ~ '^[a-z0-9][a-z0-9._:/-]{0,127}$')
 AND (jsonb_typeof(prior_event.admission_settlement #> '{attribution,operation}')='string' AND (prior_event.admission_settlement #>> '{attribution,operation}') ~ '^g1_sim_text$')
 AND (jsonb_typeof(prior_event.admission_settlement #> '{attribution,logical_request_key}')='string' AND (prior_event.admission_settlement #>> '{attribution,logical_request_key}') ~ '^[a-z0-9][a-z0-9._:/-]{0,255}$')
 AND (jsonb_typeof(prior_event.admission_settlement #> '{attribution,request_fingerprint}')='string' AND (prior_event.admission_settlement #>> '{attribution,request_fingerprint}') ~ '^[0-9a-f]{64}$')
 AND (jsonb_typeof(prior_event.admission_settlement #> '{attribution,admission_certificate_hash}')='string' AND (prior_event.admission_settlement #>> '{attribution,admission_certificate_hash}') ~ '^[0-9a-f]{64}$')
 AND (jsonb_typeof(prior_event.admission_settlement #> '{attribution,admission_policy_hash}')='string' AND (prior_event.admission_settlement #>> '{attribution,admission_policy_hash}') ~ '^[0-9a-f]{64}$')
 AND ((prior_event.admission_settlement #> '{consumption,input_text_hash}')='null'::jsonb OR (jsonb_typeof(prior_event.admission_settlement #> '{consumption,input_text_hash}')='string' AND (prior_event.admission_settlement #>> '{consumption,input_text_hash}') ~ '^[0-9a-f]{64}$'))
 AND ((prior_event.admission_settlement #> '{consumption,computed_request_fingerprint}')='null'::jsonb OR (jsonb_typeof(prior_event.admission_settlement #> '{consumption,computed_request_fingerprint}')='string' AND (prior_event.admission_settlement #>> '{consumption,computed_request_fingerprint}') ~ '^[0-9a-f]{64}$'))
 AND ((prior_event.admission_settlement #> '{consumption,consumed_certificate_hash}')='null'::jsonb OR (jsonb_typeof(prior_event.admission_settlement #> '{consumption,consumed_certificate_hash}')='string' AND (prior_event.admission_settlement #>> '{consumption,consumed_certificate_hash}') ~ '^[0-9a-f]{64}$'))
 AND ((prior_event.admission_settlement #> '{consumption,consumed_provider}')='null'::jsonb OR (jsonb_typeof(prior_event.admission_settlement #> '{consumption,consumed_provider}')='string' AND (prior_event.admission_settlement #>> '{consumption,consumed_provider}') ~ '^[a-z0-9][a-z0-9._:/-]{0,127}$'))
 AND ((prior_event.admission_settlement #> '{consumption,consumed_operation}')='null'::jsonb OR (jsonb_typeof(prior_event.admission_settlement #> '{consumption,consumed_operation}')='string' AND (prior_event.admission_settlement #>> '{consumption,consumed_operation}') ~ '^[a-z0-9][a-z0-9._:/-]{0,127}$'))
 AND ((prior_event.admission_settlement #> '{consumption,consumed_model_identifier}')='null'::jsonb OR (jsonb_typeof(prior_event.admission_settlement #> '{consumption,consumed_model_identifier}')='string' AND (prior_event.admission_settlement #>> '{consumption,consumed_model_identifier}') ~ '^[a-z0-9][a-z0-9._:/-]{0,127}$'))
 AND ((prior_event.admission_settlement #> '{consumption,input_bytes}')='null'::jsonb OR CASE WHEN jsonb_typeof(prior_event.admission_settlement #> '{consumption,input_bytes}')='number' THEN (prior_event.admission_settlement #>> '{consumption,input_bytes}')::numeric BETWEEN 0 AND 2147483647 AND (prior_event.admission_settlement #>> '{consumption,input_bytes}')::numeric=trunc((prior_event.admission_settlement #>> '{consumption,input_bytes}')::numeric) ELSE false END)
 AND ((prior_event.admission_settlement #> '{consumption,consumed_output_cap}')='null'::jsonb OR CASE WHEN jsonb_typeof(prior_event.admission_settlement #> '{consumption,consumed_output_cap}')='number' THEN (prior_event.admission_settlement #>> '{consumption,consumed_output_cap}')::numeric BETWEEN 0 AND 2147483647 AND (prior_event.admission_settlement #>> '{consumption,consumed_output_cap}')::numeric=trunc((prior_event.admission_settlement #>> '{consumption,consumed_output_cap}')::numeric) ELSE false END)
 AND ((prior_event.admission_settlement #> '{observed_output_bytes}')='null'::jsonb OR CASE WHEN jsonb_typeof(prior_event.admission_settlement #> '{observed_output_bytes}')='number' THEN (prior_event.admission_settlement #>> '{observed_output_bytes}')::numeric BETWEEN 0 AND 2147483647 AND (prior_event.admission_settlement #>> '{observed_output_bytes}')::numeric=trunc((prior_event.admission_settlement #>> '{observed_output_bytes}')::numeric) ELSE false END)
 AND ((prior_event.admission_settlement #> '{event_binding,usage,input_bytes}')='null'::jsonb OR CASE WHEN jsonb_typeof(prior_event.admission_settlement #> '{event_binding,usage,input_bytes}')='number' THEN (prior_event.admission_settlement #>> '{event_binding,usage,input_bytes}')::numeric BETWEEN 0 AND 2147483647 AND (prior_event.admission_settlement #>> '{event_binding,usage,input_bytes}')::numeric=trunc((prior_event.admission_settlement #>> '{event_binding,usage,input_bytes}')::numeric) ELSE false END)
 AND ((prior_event.admission_settlement #> '{event_binding,usage,output_bytes}')='null'::jsonb OR CASE WHEN jsonb_typeof(prior_event.admission_settlement #> '{event_binding,usage,output_bytes}')='number' THEN (prior_event.admission_settlement #>> '{event_binding,usage,output_bytes}')::numeric BETWEEN 0 AND 2147483647 AND (prior_event.admission_settlement #>> '{event_binding,usage,output_bytes}')::numeric=trunc((prior_event.admission_settlement #>> '{event_binding,usage,output_bytes}')::numeric) ELSE false END)
 AND (jsonb_typeof(prior_event.admission_settlement #> '{event_binding,provider_call_id}')='string' AND (prior_event.admission_settlement #>> '{event_binding,provider_call_id}') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
 AND (jsonb_typeof(prior_event.admission_settlement #> '{event_binding,event_type}')='string' AND (prior_event.admission_settlement #>> '{event_binding,event_type}') ~ '^(succeeded|retryable_failure|terminal_failure)$')
 AND ((prior_event.admission_settlement #> '{event_binding,currency}')='null'::jsonb OR (jsonb_typeof(prior_event.admission_settlement #> '{event_binding,currency}')='string' AND (prior_event.admission_settlement #>> '{event_binding,currency}') ~ '^[A-Z]{3}$'))
 AND ((prior_event.admission_settlement #> '{event_binding,response_artifact_id}')='null'::jsonb OR (jsonb_typeof(prior_event.admission_settlement #> '{event_binding,response_artifact_id}')='string' AND (prior_event.admission_settlement #>> '{event_binding,response_artifact_id}') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'))
 AND prior_event.admission_settlement->>'schema'='g1-sim-settlement/1'
 AND prior_event.admission_settlement->>'verification_status'='attributed_receipt'
 AND prior_event.admission_settlement->>'metadata_problem'='none'
 AND (jsonb_typeof(prior_event.admission_settlement->'invocation_observation_hash')='string' AND prior_event.admission_settlement->>'invocation_observation_hash' ~ '^[0-9a-f]{64}$')
 AND (jsonb_typeof(prior_event.admission_settlement->'final_receipt_hash')='string' AND prior_event.admission_settlement->>'final_receipt_hash' ~ '^[0-9a-f]{64}$')
 AND jsonb_typeof(prior_event.admission_settlement->'work_ended') IN ('boolean','null')
 AND prior_event.admission_settlement->>'price_status' IN ('known_final','unknown_final')
 AND CASE WHEN jsonb_typeof(prior_event.admission_settlement->'violations')='array' THEN NOT EXISTS(SELECT 1 FROM jsonb_array_elements(prior_event.admission_settlement->'violations') AS items(violation_item) WHERE jsonb_typeof(violation_item) IS DISTINCT FROM 'string' OR violation_item #>> '{}' NOT IN ('metadata_unverified','input_hash_unobserved','input_hash_mismatch','input_count_unobserved','input_count_mismatch','output_cap_unobserved','output_cap_mismatch','request_fingerprint_unobserved','request_fingerprint_mismatch','certificate_unobserved','certificate_mismatch','provider_unobserved','provider_mismatch','operation_unobserved','operation_mismatch','model_unobserved','model_mismatch','output_count_unknown_at_end','output_over_cap','foreign_currency','actual_above_bound')) ELSE false END
 AND prior_event.admission_settlement#>>'{consumption,observation_state}'=CASE WHEN (prior_event.admission_settlement #> '{consumption}') @> '{"input_text_hash":null}'::jsonb OR (prior_event.admission_settlement #> '{consumption}') @> '{"input_bytes":null}'::jsonb OR (prior_event.admission_settlement #> '{consumption}') @> '{"consumed_output_cap":null}'::jsonb OR (prior_event.admission_settlement #> '{consumption}') @> '{"computed_request_fingerprint":null}'::jsonb OR (prior_event.admission_settlement #> '{consumption}') @> '{"consumed_certificate_hash":null}'::jsonb OR (prior_event.admission_settlement #> '{consumption}') @> '{"consumed_provider":null}'::jsonb OR (prior_event.admission_settlement #> '{consumption}') @> '{"consumed_operation":null}'::jsonb OR (prior_event.admission_settlement #> '{consumption}') @> '{"consumed_model_identifier":null}'::jsonb THEN 'incomplete' ELSE 'complete' END
 AND CASE WHEN jsonb_typeof(prior_event.admission_settlement #> '{event_binding,ended_at}')='string' AND (prior_event.admission_settlement #>> '{event_binding,ended_at}') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{6}Z$' THEN CASE WHEN pg_input_is_valid(prior_event.admission_settlement #>> '{event_binding,ended_at}','timestamp with time zone') THEN to_char((prior_event.admission_settlement #>> '{event_binding,ended_at}')::timestamptz AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')=(prior_event.admission_settlement #>> '{event_binding,ended_at}') ELSE false END ELSE false END
 AND ((prior_event.admission_settlement #> '{event_binding,actual_cost}')='null'::jsonb OR (jsonb_typeof(prior_event.admission_settlement #> '{event_binding,actual_cost}')='string' AND length(prior_event.admission_settlement #>> '{event_binding,actual_cost}')<=64 AND (prior_event.admission_settlement #>> '{event_binding,actual_cost}') ~ '^(0|[1-9][0-9]*)([.][0-9]*[1-9])?$'))
 AND ((prior_event.admission_settlement #> '{event_binding,actual_cost}')='null'::jsonb)=((prior_event.admission_settlement #> '{event_binding,currency}')='null'::jsonb)
 AND ((prior_event.admission_settlement #> '{event_binding,response_reference}')='null'::jsonb OR (jsonb_typeof(prior_event.admission_settlement #> '{event_binding,response_reference}')='string' AND octet_length(prior_event.admission_settlement #>> '{event_binding,response_reference}')<=4096 AND (prior_event.admission_settlement #>> '{event_binding,response_reference}') IS NFC NORMALIZED)))) IS DISTINCT FROM true
      OR prior_event.admission_settlement->'work_ended' IS DISTINCT FROM 'true'::jsonb THEN
      RAISE EXCEPTION 'provider admission refused' USING ERRCODE='23514',CONSTRAINT='provider_admission_retry_work_not_ended';
    END IF;
  END IF;
  -- ONE actual DB sample PER row, after arbitration and all earlier reads; reused by every temporal equation.
  t:=clock_timestamp();target_attempt:=NEW.attempt_id;target_run:=run_id;candidate_bound:=bound;
  FOR metrics IN
  -- G1_TEMPORAL_ADMISSION_BEGIN
  WITH history AS (
    SELECT c.*, a.program_run_id, e.actual_cost, e.currency AS final_currency, e.recorded_at,
      e.admission_settlement,
      CASE WHEN (e.recorded_at IS NOT NULL AND c.admission_certificate IS NOT NULL
 AND e.admission_settlement->>'schema'='g1-sim-settlement/1' AND e.admission_settlement->>'verification_status'='attributed_receipt'
 AND e.admission_settlement->>'metadata_problem'='none'
 AND jsonb_typeof(e.admission_settlement->'invocation_observation_hash')='string' AND e.admission_settlement->>'invocation_observation_hash' ~ '^[0-9a-f]{64}$'
 AND jsonb_typeof(e.admission_settlement->'final_receipt_hash')='string' AND e.admission_settlement->>'final_receipt_hash' ~ '^[0-9a-f]{64}$'
 AND e.admission_settlement->'attribution'=jsonb_build_object('provider_call_id',c.provider_call_id::text,'attempt_id',c.attempt_id::text,
 'program_run_id',c.admission_certificate->>'program_run_id','provider',c.provider,'operation',c.operation,
 'model_identifier',c.model_identifier,'logical_request_key',c.logical_request_key,'request_fingerprint',c.request_fingerprint,
 'admission_certificate_hash',c.admission_certificate_hash,'admission_policy_hash',c.admission_policy_hash)
 AND ((e.admission_settlement->'event_binding')-'actual_cost')=jsonb_build_object('provider_call_id',e.provider_call_id::text,'event_type',e.event_type,
 'ended_at',to_char(e.ended_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'usage',e.usage,
 'currency',e.currency,'response_artifact_id',e.response_artifact_id::text,'response_reference',e.response_reference)
 AND CASE WHEN e.actual_cost IS NULL THEN e.admission_settlement#>'{event_binding,actual_cost}'='null'::jsonb
   ELSE CASE WHEN jsonb_typeof(e.admission_settlement#>'{event_binding,actual_cost}')='string'
     AND length(e.admission_settlement#>>'{event_binding,actual_cost}')<=64
     AND e.admission_settlement#>>'{event_binding,actual_cost}' ~ '^(0|[1-9][0-9]*)([.][0-9]*[1-9])?$'
     THEN (e.admission_settlement#>>'{event_binding,actual_cost}')::numeric=e.actual_cost ELSE false END END
 AND e.admission_settlement->>'price_status'=CASE WHEN e.actual_cost IS NULL THEN 'unknown_final' ELSE 'known_final' END
 AND jsonb_typeof(e.admission_settlement->'work_ended') IN ('boolean','null')
 AND (
 CASE WHEN jsonb_typeof(e.admission_settlement)='object' THEN (e.admission_settlement) ?& ARRAY['schema','verification_status','metadata_problem','invocation_observation_hash','final_receipt_hash','attribution','consumption','work_ended','observed_output_bytes','price_status','event_binding','violations'] AND (e.admission_settlement) - ARRAY['schema','verification_status','metadata_problem','invocation_observation_hash','final_receipt_hash','attribution','consumption','work_ended','observed_output_bytes','price_status','event_binding','violations']='{}'::jsonb ELSE false END
 AND CASE WHEN jsonb_typeof(e.admission_settlement #> '{attribution}')='object' THEN (e.admission_settlement #> '{attribution}') ?& ARRAY['provider_call_id','attempt_id','program_run_id','provider','operation','model_identifier','logical_request_key','request_fingerprint','admission_certificate_hash','admission_policy_hash'] AND (e.admission_settlement #> '{attribution}') - ARRAY['provider_call_id','attempt_id','program_run_id','provider','operation','model_identifier','logical_request_key','request_fingerprint','admission_certificate_hash','admission_policy_hash']='{}'::jsonb ELSE false END
 AND CASE WHEN jsonb_typeof(e.admission_settlement #> '{consumption}')='object' THEN (e.admission_settlement #> '{consumption}') ?& ARRAY['observation_state','input_text_hash','input_bytes','consumed_output_cap','computed_request_fingerprint','consumed_certificate_hash','consumed_provider','consumed_operation','consumed_model_identifier'] AND (e.admission_settlement #> '{consumption}') - ARRAY['observation_state','input_text_hash','input_bytes','consumed_output_cap','computed_request_fingerprint','consumed_certificate_hash','consumed_provider','consumed_operation','consumed_model_identifier']='{}'::jsonb ELSE false END
 AND CASE WHEN jsonb_typeof(e.admission_settlement #> '{event_binding}')='object' THEN (e.admission_settlement #> '{event_binding}') ?& ARRAY['provider_call_id','event_type','ended_at','usage','actual_cost','currency','response_artifact_id','response_reference'] AND (e.admission_settlement #> '{event_binding}') - ARRAY['provider_call_id','event_type','ended_at','usage','actual_cost','currency','response_artifact_id','response_reference']='{}'::jsonb ELSE false END
 AND CASE WHEN jsonb_typeof(e.admission_settlement #> '{event_binding,usage}')='object' THEN (e.admission_settlement #> '{event_binding,usage}') ?& ARRAY['input_bytes','output_bytes'] AND (e.admission_settlement #> '{event_binding,usage}') - ARRAY['input_bytes','output_bytes']='{}'::jsonb ELSE false END
 AND (jsonb_typeof(e.admission_settlement #> '{attribution,provider_call_id}')='string' AND (e.admission_settlement #>> '{attribution,provider_call_id}') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
 AND (jsonb_typeof(e.admission_settlement #> '{attribution,attempt_id}')='string' AND (e.admission_settlement #>> '{attribution,attempt_id}') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
 AND (jsonb_typeof(e.admission_settlement #> '{attribution,program_run_id}')='string' AND (e.admission_settlement #>> '{attribution,program_run_id}') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
 AND (jsonb_typeof(e.admission_settlement #> '{attribution,provider}')='string' AND (e.admission_settlement #>> '{attribution,provider}') ~ '^[a-z0-9][a-z0-9._:/-]{0,127}$')
 AND (jsonb_typeof(e.admission_settlement #> '{attribution,model_identifier}')='string' AND (e.admission_settlement #>> '{attribution,model_identifier}') ~ '^[a-z0-9][a-z0-9._:/-]{0,127}$')
 AND (jsonb_typeof(e.admission_settlement #> '{attribution,operation}')='string' AND (e.admission_settlement #>> '{attribution,operation}') ~ '^g1_sim_text$')
 AND (jsonb_typeof(e.admission_settlement #> '{attribution,logical_request_key}')='string' AND (e.admission_settlement #>> '{attribution,logical_request_key}') ~ '^[a-z0-9][a-z0-9._:/-]{0,255}$')
 AND (jsonb_typeof(e.admission_settlement #> '{attribution,request_fingerprint}')='string' AND (e.admission_settlement #>> '{attribution,request_fingerprint}') ~ '^[0-9a-f]{64}$')
 AND (jsonb_typeof(e.admission_settlement #> '{attribution,admission_certificate_hash}')='string' AND (e.admission_settlement #>> '{attribution,admission_certificate_hash}') ~ '^[0-9a-f]{64}$')
 AND (jsonb_typeof(e.admission_settlement #> '{attribution,admission_policy_hash}')='string' AND (e.admission_settlement #>> '{attribution,admission_policy_hash}') ~ '^[0-9a-f]{64}$')
 AND ((e.admission_settlement #> '{consumption,input_text_hash}')='null'::jsonb OR (jsonb_typeof(e.admission_settlement #> '{consumption,input_text_hash}')='string' AND (e.admission_settlement #>> '{consumption,input_text_hash}') ~ '^[0-9a-f]{64}$'))
 AND ((e.admission_settlement #> '{consumption,computed_request_fingerprint}')='null'::jsonb OR (jsonb_typeof(e.admission_settlement #> '{consumption,computed_request_fingerprint}')='string' AND (e.admission_settlement #>> '{consumption,computed_request_fingerprint}') ~ '^[0-9a-f]{64}$'))
 AND ((e.admission_settlement #> '{consumption,consumed_certificate_hash}')='null'::jsonb OR (jsonb_typeof(e.admission_settlement #> '{consumption,consumed_certificate_hash}')='string' AND (e.admission_settlement #>> '{consumption,consumed_certificate_hash}') ~ '^[0-9a-f]{64}$'))
 AND ((e.admission_settlement #> '{consumption,consumed_provider}')='null'::jsonb OR (jsonb_typeof(e.admission_settlement #> '{consumption,consumed_provider}')='string' AND (e.admission_settlement #>> '{consumption,consumed_provider}') ~ '^[a-z0-9][a-z0-9._:/-]{0,127}$'))
 AND ((e.admission_settlement #> '{consumption,consumed_operation}')='null'::jsonb OR (jsonb_typeof(e.admission_settlement #> '{consumption,consumed_operation}')='string' AND (e.admission_settlement #>> '{consumption,consumed_operation}') ~ '^[a-z0-9][a-z0-9._:/-]{0,127}$'))
 AND ((e.admission_settlement #> '{consumption,consumed_model_identifier}')='null'::jsonb OR (jsonb_typeof(e.admission_settlement #> '{consumption,consumed_model_identifier}')='string' AND (e.admission_settlement #>> '{consumption,consumed_model_identifier}') ~ '^[a-z0-9][a-z0-9._:/-]{0,127}$'))
 AND ((e.admission_settlement #> '{consumption,input_bytes}')='null'::jsonb OR CASE WHEN jsonb_typeof(e.admission_settlement #> '{consumption,input_bytes}')='number' THEN (e.admission_settlement #>> '{consumption,input_bytes}')::numeric BETWEEN 0 AND 2147483647 AND (e.admission_settlement #>> '{consumption,input_bytes}')::numeric=trunc((e.admission_settlement #>> '{consumption,input_bytes}')::numeric) ELSE false END)
 AND ((e.admission_settlement #> '{consumption,consumed_output_cap}')='null'::jsonb OR CASE WHEN jsonb_typeof(e.admission_settlement #> '{consumption,consumed_output_cap}')='number' THEN (e.admission_settlement #>> '{consumption,consumed_output_cap}')::numeric BETWEEN 0 AND 2147483647 AND (e.admission_settlement #>> '{consumption,consumed_output_cap}')::numeric=trunc((e.admission_settlement #>> '{consumption,consumed_output_cap}')::numeric) ELSE false END)
 AND ((e.admission_settlement #> '{observed_output_bytes}')='null'::jsonb OR CASE WHEN jsonb_typeof(e.admission_settlement #> '{observed_output_bytes}')='number' THEN (e.admission_settlement #>> '{observed_output_bytes}')::numeric BETWEEN 0 AND 2147483647 AND (e.admission_settlement #>> '{observed_output_bytes}')::numeric=trunc((e.admission_settlement #>> '{observed_output_bytes}')::numeric) ELSE false END)
 AND ((e.admission_settlement #> '{event_binding,usage,input_bytes}')='null'::jsonb OR CASE WHEN jsonb_typeof(e.admission_settlement #> '{event_binding,usage,input_bytes}')='number' THEN (e.admission_settlement #>> '{event_binding,usage,input_bytes}')::numeric BETWEEN 0 AND 2147483647 AND (e.admission_settlement #>> '{event_binding,usage,input_bytes}')::numeric=trunc((e.admission_settlement #>> '{event_binding,usage,input_bytes}')::numeric) ELSE false END)
 AND ((e.admission_settlement #> '{event_binding,usage,output_bytes}')='null'::jsonb OR CASE WHEN jsonb_typeof(e.admission_settlement #> '{event_binding,usage,output_bytes}')='number' THEN (e.admission_settlement #>> '{event_binding,usage,output_bytes}')::numeric BETWEEN 0 AND 2147483647 AND (e.admission_settlement #>> '{event_binding,usage,output_bytes}')::numeric=trunc((e.admission_settlement #>> '{event_binding,usage,output_bytes}')::numeric) ELSE false END)
 AND (jsonb_typeof(e.admission_settlement #> '{event_binding,provider_call_id}')='string' AND (e.admission_settlement #>> '{event_binding,provider_call_id}') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
 AND (jsonb_typeof(e.admission_settlement #> '{event_binding,event_type}')='string' AND (e.admission_settlement #>> '{event_binding,event_type}') ~ '^(succeeded|retryable_failure|terminal_failure)$')
 AND ((e.admission_settlement #> '{event_binding,currency}')='null'::jsonb OR (jsonb_typeof(e.admission_settlement #> '{event_binding,currency}')='string' AND (e.admission_settlement #>> '{event_binding,currency}') ~ '^[A-Z]{3}$'))
 AND ((e.admission_settlement #> '{event_binding,response_artifact_id}')='null'::jsonb OR (jsonb_typeof(e.admission_settlement #> '{event_binding,response_artifact_id}')='string' AND (e.admission_settlement #>> '{event_binding,response_artifact_id}') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'))
 AND e.admission_settlement->>'schema'='g1-sim-settlement/1'
 AND e.admission_settlement->>'verification_status'='attributed_receipt'
 AND e.admission_settlement->>'metadata_problem'='none'
 AND (jsonb_typeof(e.admission_settlement->'invocation_observation_hash')='string' AND e.admission_settlement->>'invocation_observation_hash' ~ '^[0-9a-f]{64}$')
 AND (jsonb_typeof(e.admission_settlement->'final_receipt_hash')='string' AND e.admission_settlement->>'final_receipt_hash' ~ '^[0-9a-f]{64}$')
 AND jsonb_typeof(e.admission_settlement->'work_ended') IN ('boolean','null')
 AND e.admission_settlement->>'price_status' IN ('known_final','unknown_final')
 AND CASE WHEN jsonb_typeof(e.admission_settlement->'violations')='array' THEN NOT EXISTS(SELECT 1 FROM jsonb_array_elements(e.admission_settlement->'violations') AS items(violation_item) WHERE jsonb_typeof(violation_item) IS DISTINCT FROM 'string' OR violation_item #>> '{}' NOT IN ('metadata_unverified','input_hash_unobserved','input_hash_mismatch','input_count_unobserved','input_count_mismatch','output_cap_unobserved','output_cap_mismatch','request_fingerprint_unobserved','request_fingerprint_mismatch','certificate_unobserved','certificate_mismatch','provider_unobserved','provider_mismatch','operation_unobserved','operation_mismatch','model_unobserved','model_mismatch','output_count_unknown_at_end','output_over_cap','foreign_currency','actual_above_bound')) ELSE false END
 AND e.admission_settlement#>>'{consumption,observation_state}'=CASE WHEN (e.admission_settlement #> '{consumption}') @> '{"input_text_hash":null}'::jsonb OR (e.admission_settlement #> '{consumption}') @> '{"input_bytes":null}'::jsonb OR (e.admission_settlement #> '{consumption}') @> '{"consumed_output_cap":null}'::jsonb OR (e.admission_settlement #> '{consumption}') @> '{"computed_request_fingerprint":null}'::jsonb OR (e.admission_settlement #> '{consumption}') @> '{"consumed_certificate_hash":null}'::jsonb OR (e.admission_settlement #> '{consumption}') @> '{"consumed_provider":null}'::jsonb OR (e.admission_settlement #> '{consumption}') @> '{"consumed_operation":null}'::jsonb OR (e.admission_settlement #> '{consumption}') @> '{"consumed_model_identifier":null}'::jsonb THEN 'incomplete' ELSE 'complete' END
 AND CASE WHEN jsonb_typeof(e.admission_settlement #> '{event_binding,ended_at}')='string' AND (e.admission_settlement #>> '{event_binding,ended_at}') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{6}Z$' THEN CASE WHEN pg_input_is_valid(e.admission_settlement #>> '{event_binding,ended_at}','timestamp with time zone') THEN to_char((e.admission_settlement #>> '{event_binding,ended_at}')::timestamptz AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')=(e.admission_settlement #>> '{event_binding,ended_at}') ELSE false END ELSE false END
 AND ((e.admission_settlement #> '{event_binding,actual_cost}')='null'::jsonb OR (jsonb_typeof(e.admission_settlement #> '{event_binding,actual_cost}')='string' AND length(e.admission_settlement #>> '{event_binding,actual_cost}')<=64 AND (e.admission_settlement #>> '{event_binding,actual_cost}') ~ '^(0|[1-9][0-9]*)([.][0-9]*[1-9])?$'))
 AND ((e.admission_settlement #> '{event_binding,actual_cost}')='null'::jsonb)=((e.admission_settlement #> '{event_binding,currency}')='null'::jsonb)
 AND ((e.admission_settlement #> '{event_binding,response_reference}')='null'::jsonb OR (jsonb_typeof(e.admission_settlement #> '{event_binding,response_reference}')='string' AND octet_length(e.admission_settlement #>> '{event_binding,response_reference}')<=4096 AND (e.admission_settlement #>> '{event_binding,response_reference}') IS NFC NORMALIZED))))
        AND e.admission_settlement->'work_ended'='true'::jsonb THEN 0 ELSE 1 END AS occupied,
      CASE WHEN e.actual_cost IS NOT NULL AND e.currency=c.admission_currency THEN e.actual_cost
        ELSE c.reserved_cost_upper_bound END AS exposure
    FROM provider_calls c JOIN program_run_attempts a USING(attempt_id)
    LEFT JOIN provider_call_events e USING(provider_call_id)
  )
  SELECT
    coalesce(sum(exposure) FILTER(WHERE attempt_id=target_attempt),0)+candidate_bound>(p->>'attempt_cost_ceiling')::numeric AS attempt_excess,
    coalesce(sum(exposure) FILTER(WHERE program_run_id=target_run),0)+candidate_bound>(p->>'run_cost_ceiling')::numeric AS run_excess,
    coalesce(sum(CASE
      WHEN actual_cost IS NOT NULL AND final_currency=admission_currency THEN
        CASE WHEN (admitted_at AT TIME ZONE 'UTC')::date=(t AT TIME ZONE 'UTC')::date THEN actual_cost ELSE 0 END
      ELSE reserved_cost_upper_bound END),0)+candidate_bound>(p->>'utc_day_cost_ceiling')::numeric AS day_excess,
    count(*) FILTER(WHERE attempt_id=target_attempt)+1>(p->>'max_reservations_per_attempt')::bigint
      OR count(*) FILTER(WHERE program_run_id=target_run)+1>(p->>'max_reservations_per_run')::bigint
      OR count(*) FILTER(WHERE (admitted_at AT TIME ZONE 'UTC')::date=(t AT TIME ZONE 'UTC')::date)+1>(p->>'max_reservations_per_utc_day')::bigint AS reservation_excess,
    count(*) FILTER(WHERE retry_of_provider_call_id IS NOT NULL AND attempt_id=target_attempt)+(CASE WHEN NEW.retry_of_provider_call_id IS NULL THEN 0 ELSE 1 END)>(p->>'max_operational_retries_per_attempt')::bigint
      OR count(*) FILTER(WHERE retry_of_provider_call_id IS NOT NULL AND program_run_id=target_run)+(CASE WHEN NEW.retry_of_provider_call_id IS NULL THEN 0 ELSE 1 END)>(p->>'max_operational_retries_per_run')::bigint
      OR count(*) FILTER(WHERE retry_of_provider_call_id IS NOT NULL AND (admitted_at AT TIME ZONE 'UTC')::date=(t AT TIME ZONE 'UTC')::date)+(CASE WHEN NEW.retry_of_provider_call_id IS NULL THEN 0 ELSE 1 END)>(p->>'max_operational_retries_per_utc_day')::bigint
      OR NEW.operational_try_number-1>(p->>'max_operational_retries_per_chain')::bigint AS retry_excess,
    coalesce(sum(occupied),0)+1>(p->>'max_concurrent_global')::bigint
      OR coalesce(sum(occupied) FILTER(WHERE provider=rule->>'provider'),0)+1>(rule->>'max_concurrent')::bigint AS concurrency_excess,
    count(*) FILTER(WHERE admitted_at>t-(p#>>'{global_rate,window_ms}')::bigint*interval '1 millisecond' AND admitted_at<=t)+1>(p#>>'{global_rate,max_admissions}')::bigint
      OR count(*) FILTER(WHERE provider=rule->>'provider' AND admitted_at>t-(rule#>>'{rate,window_ms}')::bigint*interval '1 millisecond' AND admitted_at<=t)+1>(rule#>>'{rate,max_admissions}')::bigint AS rate_excess,
    coalesce(t-max(admitted_at)<(p#>>'{global_rate,min_spacing_ms}')::bigint*interval '1 millisecond',false)
      OR coalesce(t-max(admitted_at) FILTER(WHERE provider=rule->>'provider')<(rule#>>'{rate,min_spacing_ms}')::bigint*interval '1 millisecond',false) AS spacing_excess,
    coalesce(t<greatest(max(admitted_at),max(recorded_at)),false) AS clock_reversed
  FROM history
  -- G1_TEMPORAL_ADMISSION_END
  LOOP
    IF metrics.clock_reversed THEN key:='provider_admission_clock_reversed';
    ELSIF metrics.attempt_excess THEN key:='provider_admission_attempt_cost';
    ELSIF metrics.run_excess THEN key:='provider_admission_run_cost';
    ELSIF metrics.day_excess THEN key:='provider_admission_day_cost';
    ELSIF metrics.reservation_excess THEN key:='provider_admission_reservation_limit';
    ELSIF metrics.retry_excess THEN key:='provider_admission_retry_limit';
    ELSIF metrics.concurrency_excess THEN key:='provider_admission_concurrency_limit';
    ELSIF metrics.rate_excess THEN key:='provider_admission_rate_limit';
    ELSIF metrics.spacing_excess THEN key:='provider_admission_spacing_limit';
    ELSE key:=NULL; END IF;
    IF key IS NOT NULL THEN RAISE EXCEPTION 'provider admission refused' USING ERRCODE='23514',CONSTRAINT=key; END IF;
  END LOOP;
  NEW.admitted_at:=t;NEW.admission_certificate:=cert;
  RETURN NEW;
END $$;
CREATE TRIGGER provider_admission_row BEFORE INSERT ON provider_calls
FOR EACH ROW EXECUTE FUNCTION guard_provider_admission();

-- Certified events preserve canonical scalar truth; malformed JSONB evidence does NOT discard money.
-- Only representable metadata input problems normalize. No EXCEPTION catch swallows DB/resource/internal failures.
CREATE FUNCTION guard_provider_settlement() RETURNS trigger LANGUAGE plpgsql VOLATILE
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  c provider_calls; m jsonb; ct jsonb; ev jsonb; spec record; key text; actual_keys text[];
  problem text; number_value numeric; missing boolean; v jsonb:='[]'::jsonb;
  expected_at jsonb; recorded_time timestamptz;
BEGIN
  SELECT * INTO STRICT c FROM provider_calls WHERE provider_call_id=NEW.provider_call_id;
  IF c.admission_certificate IS NULL THEN
    IF NEW.recorded_at IS NOT NULL OR NEW.admission_settlement IS NOT NULL THEN
      RAISE EXCEPTION 'historical metadata refused' USING ERRCODE='23514',CONSTRAINT='provider_admission_certificate_invalid';
    END IF;
    RETURN NEW;
  END IF;
  IF current_setting('transaction_isolation')<>'read committed' THEN
    RAISE EXCEPTION 'certified settlement requires READ COMMITTED' USING ERRCODE='0A000',CONSTRAINT='provider_admission_certificate_invalid';
  END IF;
  IF NEW.recorded_at IS NOT NULL THEN
    RAISE EXCEPTION 'authored server time refused' USING ERRCODE='23514',CONSTRAINT='provider_admission_clock_reversed';
  END IF;
  m:=NEW.admission_settlement;
  problem:=CASE WHEN m IS NULL THEN 'absent' ELSE 'none' END;
  IF problem='none' THEN
    FOR spec IN SELECT * FROM (VALUES
      ('',ARRAY['schema','verification_status','metadata_problem','invocation_observation_hash','final_receipt_hash','attribution','consumption','work_ended','observed_output_bytes','price_status','event_binding','violations']),('attribution',ARRAY['provider_call_id','attempt_id','program_run_id','provider','operation','model_identifier','logical_request_key','request_fingerprint','admission_certificate_hash','admission_policy_hash']),
      ('consumption',ARRAY['observation_state','input_text_hash','input_bytes','consumed_output_cap','computed_request_fingerprint','consumed_certificate_hash','consumed_provider','consumed_operation','consumed_model_identifier']),('event_binding',ARRAY['provider_call_id','event_type','ended_at','usage','actual_cost','currency','response_artifact_id','response_reference']),
      ('event_binding.usage',ARRAY['input_bytes','output_bytes'])
    ) layouts(path,keys) LOOP
      ev:=CASE WHEN spec.path='' THEN m ELSE m #> string_to_array(spec.path,'.') END;
      IF jsonb_typeof(ev) IS DISTINCT FROM 'object' THEN problem:='malformed';EXIT; END IF;
      SELECT array_agg(k ORDER BY k COLLATE "C") INTO actual_keys FROM jsonb_object_keys(ev) k;
      IF actual_keys IS DISTINCT FROM (SELECT array_agg(k ORDER BY k COLLATE "C") FROM unnest(spec.keys) k) THEN problem:='malformed';EXIT; END IF;
    END LOOP;
  END IF;
  IF problem='none' AND (
    m->>'schema' IS DISTINCT FROM 'g1-sim-settlement/1' OR m->>'verification_status' IS DISTINCT FROM 'attributed_receipt'
    OR m->>'metadata_problem' IS DISTINCT FROM 'none'
    OR jsonb_typeof(m->'invocation_observation_hash') IS DISTINCT FROM 'string'
    OR m->>'invocation_observation_hash' !~ '^[0-9a-f]{64}$'
    OR jsonb_typeof(m->'final_receipt_hash') IS DISTINCT FROM 'string'
    OR m->>'final_receipt_hash' !~ '^[0-9a-f]{64}$'
    OR jsonb_typeof(m->'work_ended') NOT IN ('boolean','null')
    OR jsonb_typeof(m->'violations') IS DISTINCT FROM 'array'
    OR m->>'price_status' NOT IN ('known_final','unknown_final')
  ) THEN problem:='malformed'; END IF;
  IF problem='none' THEN
    -- Input V is never authoritative, but still must be a representable array of the closed literal domain.
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(m->'violations') x
      WHERE jsonb_typeof(x) IS DISTINCT FROM 'string' OR x #>> '{}' NOT IN (
        'metadata_unverified','input_hash_unobserved','input_hash_mismatch','input_count_unobserved','input_count_mismatch',
        'output_cap_unobserved','output_cap_mismatch','request_fingerprint_unobserved','request_fingerprint_mismatch',
        'certificate_unobserved','certificate_mismatch','provider_unobserved','provider_mismatch','operation_unobserved',
        'operation_mismatch','model_unobserved','model_mismatch','output_count_unknown_at_end','output_over_cap',
        'foreign_currency','actual_above_bound')) THEN problem:='malformed'; END IF;
  END IF;
  ct:=m->'consumption';ev:=m->'event_binding';
  IF problem='none' THEN
    FOR spec IN SELECT * FROM (VALUES
      ('consumption.input_bytes'),('consumption.consumed_output_cap'),('observed_output_bytes'),
      ('event_binding.usage.input_bytes'),('event_binding.usage.output_bytes')
    ) integers(path) LOOP
      IF jsonb_typeof(m #> string_to_array(spec.path,'.'))='null' THEN CONTINUE; END IF;
      IF jsonb_typeof(m #> string_to_array(spec.path,'.')) IS DISTINCT FROM 'number' THEN problem:='malformed';EXIT; END IF;
      number_value:=(m #>> string_to_array(spec.path,'.'))::numeric;
      IF number_value<0 OR number_value>2147483647 OR number_value<>trunc(number_value) THEN problem:='malformed';EXIT; END IF;
      m:=jsonb_set(m,string_to_array(spec.path,'.'),to_jsonb(number_value::bigint),false);
    END LOOP;
    ct:=m->'consumption';ev:=m->'event_binding';
  END IF;
  IF problem='none' THEN
    missing:=false;
    FOR spec IN SELECT * FROM (VALUES
      ('input_text_hash','^[0-9a-f]{64}$'),('computed_request_fingerprint','^[0-9a-f]{64}$'),
      ('consumed_certificate_hash','^[0-9a-f]{64}$'),('consumed_provider','^[a-z0-9][a-z0-9._:/-]{0,127}$'),
      ('consumed_operation','^[a-z0-9][a-z0-9._:/-]{0,127}$'),('consumed_model_identifier','^[a-z0-9][a-z0-9._:/-]{0,127}$')
    ) observed(key,pattern) LOOP
      IF ct->spec.key='null'::jsonb THEN missing:=true;
      ELSIF jsonb_typeof(ct->spec.key) IS DISTINCT FROM 'string' OR ct->>spec.key !~ spec.pattern THEN problem:='malformed';EXIT;
      END IF;
    END LOOP;
    missing:=missing OR ct->'input_bytes'='null'::jsonb OR ct->'consumed_output_cap'='null'::jsonb;
    IF ct->>'observation_state' IS DISTINCT FROM (CASE WHEN missing THEN 'incomplete' ELSE 'complete' END) THEN problem:='malformed';END IF;
  END IF;
  -- CLOSED AT/CT/EV scalar domains precede attribution and typed-event mismatch classification.
  -- pg_input_is_valid handles recognized invalid timestamp input; no broad exception handler.
  IF problem='none' AND (
 CASE WHEN jsonb_typeof(m)='object' THEN (m) ?& ARRAY['schema','verification_status','metadata_problem','invocation_observation_hash','final_receipt_hash','attribution','consumption','work_ended','observed_output_bytes','price_status','event_binding','violations'] AND (m) - ARRAY['schema','verification_status','metadata_problem','invocation_observation_hash','final_receipt_hash','attribution','consumption','work_ended','observed_output_bytes','price_status','event_binding','violations']='{}'::jsonb ELSE false END
 AND CASE WHEN jsonb_typeof(m #> '{attribution}')='object' THEN (m #> '{attribution}') ?& ARRAY['provider_call_id','attempt_id','program_run_id','provider','operation','model_identifier','logical_request_key','request_fingerprint','admission_certificate_hash','admission_policy_hash'] AND (m #> '{attribution}') - ARRAY['provider_call_id','attempt_id','program_run_id','provider','operation','model_identifier','logical_request_key','request_fingerprint','admission_certificate_hash','admission_policy_hash']='{}'::jsonb ELSE false END
 AND CASE WHEN jsonb_typeof(m #> '{consumption}')='object' THEN (m #> '{consumption}') ?& ARRAY['observation_state','input_text_hash','input_bytes','consumed_output_cap','computed_request_fingerprint','consumed_certificate_hash','consumed_provider','consumed_operation','consumed_model_identifier'] AND (m #> '{consumption}') - ARRAY['observation_state','input_text_hash','input_bytes','consumed_output_cap','computed_request_fingerprint','consumed_certificate_hash','consumed_provider','consumed_operation','consumed_model_identifier']='{}'::jsonb ELSE false END
 AND CASE WHEN jsonb_typeof(m #> '{event_binding}')='object' THEN (m #> '{event_binding}') ?& ARRAY['provider_call_id','event_type','ended_at','usage','actual_cost','currency','response_artifact_id','response_reference'] AND (m #> '{event_binding}') - ARRAY['provider_call_id','event_type','ended_at','usage','actual_cost','currency','response_artifact_id','response_reference']='{}'::jsonb ELSE false END
 AND CASE WHEN jsonb_typeof(m #> '{event_binding,usage}')='object' THEN (m #> '{event_binding,usage}') ?& ARRAY['input_bytes','output_bytes'] AND (m #> '{event_binding,usage}') - ARRAY['input_bytes','output_bytes']='{}'::jsonb ELSE false END
 AND (jsonb_typeof(m #> '{attribution,provider_call_id}')='string' AND (m #>> '{attribution,provider_call_id}') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
 AND (jsonb_typeof(m #> '{attribution,attempt_id}')='string' AND (m #>> '{attribution,attempt_id}') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
 AND (jsonb_typeof(m #> '{attribution,program_run_id}')='string' AND (m #>> '{attribution,program_run_id}') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
 AND (jsonb_typeof(m #> '{attribution,provider}')='string' AND (m #>> '{attribution,provider}') ~ '^[a-z0-9][a-z0-9._:/-]{0,127}$')
 AND (jsonb_typeof(m #> '{attribution,model_identifier}')='string' AND (m #>> '{attribution,model_identifier}') ~ '^[a-z0-9][a-z0-9._:/-]{0,127}$')
 AND (jsonb_typeof(m #> '{attribution,operation}')='string' AND (m #>> '{attribution,operation}') ~ '^g1_sim_text$')
 AND (jsonb_typeof(m #> '{attribution,logical_request_key}')='string' AND (m #>> '{attribution,logical_request_key}') ~ '^[a-z0-9][a-z0-9._:/-]{0,255}$')
 AND (jsonb_typeof(m #> '{attribution,request_fingerprint}')='string' AND (m #>> '{attribution,request_fingerprint}') ~ '^[0-9a-f]{64}$')
 AND (jsonb_typeof(m #> '{attribution,admission_certificate_hash}')='string' AND (m #>> '{attribution,admission_certificate_hash}') ~ '^[0-9a-f]{64}$')
 AND (jsonb_typeof(m #> '{attribution,admission_policy_hash}')='string' AND (m #>> '{attribution,admission_policy_hash}') ~ '^[0-9a-f]{64}$')
 AND ((m #> '{consumption,input_text_hash}')='null'::jsonb OR (jsonb_typeof(m #> '{consumption,input_text_hash}')='string' AND (m #>> '{consumption,input_text_hash}') ~ '^[0-9a-f]{64}$'))
 AND ((m #> '{consumption,computed_request_fingerprint}')='null'::jsonb OR (jsonb_typeof(m #> '{consumption,computed_request_fingerprint}')='string' AND (m #>> '{consumption,computed_request_fingerprint}') ~ '^[0-9a-f]{64}$'))
 AND ((m #> '{consumption,consumed_certificate_hash}')='null'::jsonb OR (jsonb_typeof(m #> '{consumption,consumed_certificate_hash}')='string' AND (m #>> '{consumption,consumed_certificate_hash}') ~ '^[0-9a-f]{64}$'))
 AND ((m #> '{consumption,consumed_provider}')='null'::jsonb OR (jsonb_typeof(m #> '{consumption,consumed_provider}')='string' AND (m #>> '{consumption,consumed_provider}') ~ '^[a-z0-9][a-z0-9._:/-]{0,127}$'))
 AND ((m #> '{consumption,consumed_operation}')='null'::jsonb OR (jsonb_typeof(m #> '{consumption,consumed_operation}')='string' AND (m #>> '{consumption,consumed_operation}') ~ '^[a-z0-9][a-z0-9._:/-]{0,127}$'))
 AND ((m #> '{consumption,consumed_model_identifier}')='null'::jsonb OR (jsonb_typeof(m #> '{consumption,consumed_model_identifier}')='string' AND (m #>> '{consumption,consumed_model_identifier}') ~ '^[a-z0-9][a-z0-9._:/-]{0,127}$'))
 AND ((m #> '{consumption,input_bytes}')='null'::jsonb OR CASE WHEN jsonb_typeof(m #> '{consumption,input_bytes}')='number' THEN (m #>> '{consumption,input_bytes}')::numeric BETWEEN 0 AND 2147483647 AND (m #>> '{consumption,input_bytes}')::numeric=trunc((m #>> '{consumption,input_bytes}')::numeric) ELSE false END)
 AND ((m #> '{consumption,consumed_output_cap}')='null'::jsonb OR CASE WHEN jsonb_typeof(m #> '{consumption,consumed_output_cap}')='number' THEN (m #>> '{consumption,consumed_output_cap}')::numeric BETWEEN 0 AND 2147483647 AND (m #>> '{consumption,consumed_output_cap}')::numeric=trunc((m #>> '{consumption,consumed_output_cap}')::numeric) ELSE false END)
 AND ((m #> '{observed_output_bytes}')='null'::jsonb OR CASE WHEN jsonb_typeof(m #> '{observed_output_bytes}')='number' THEN (m #>> '{observed_output_bytes}')::numeric BETWEEN 0 AND 2147483647 AND (m #>> '{observed_output_bytes}')::numeric=trunc((m #>> '{observed_output_bytes}')::numeric) ELSE false END)
 AND ((m #> '{event_binding,usage,input_bytes}')='null'::jsonb OR CASE WHEN jsonb_typeof(m #> '{event_binding,usage,input_bytes}')='number' THEN (m #>> '{event_binding,usage,input_bytes}')::numeric BETWEEN 0 AND 2147483647 AND (m #>> '{event_binding,usage,input_bytes}')::numeric=trunc((m #>> '{event_binding,usage,input_bytes}')::numeric) ELSE false END)
 AND ((m #> '{event_binding,usage,output_bytes}')='null'::jsonb OR CASE WHEN jsonb_typeof(m #> '{event_binding,usage,output_bytes}')='number' THEN (m #>> '{event_binding,usage,output_bytes}')::numeric BETWEEN 0 AND 2147483647 AND (m #>> '{event_binding,usage,output_bytes}')::numeric=trunc((m #>> '{event_binding,usage,output_bytes}')::numeric) ELSE false END)
 AND (jsonb_typeof(m #> '{event_binding,provider_call_id}')='string' AND (m #>> '{event_binding,provider_call_id}') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
 AND (jsonb_typeof(m #> '{event_binding,event_type}')='string' AND (m #>> '{event_binding,event_type}') ~ '^(succeeded|retryable_failure|terminal_failure)$')
 AND ((m #> '{event_binding,currency}')='null'::jsonb OR (jsonb_typeof(m #> '{event_binding,currency}')='string' AND (m #>> '{event_binding,currency}') ~ '^[A-Z]{3}$'))
 AND ((m #> '{event_binding,response_artifact_id}')='null'::jsonb OR (jsonb_typeof(m #> '{event_binding,response_artifact_id}')='string' AND (m #>> '{event_binding,response_artifact_id}') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'))
 AND m->>'schema'='g1-sim-settlement/1'
 AND m->>'verification_status'='attributed_receipt'
 AND m->>'metadata_problem'='none'
 AND (jsonb_typeof(m->'invocation_observation_hash')='string' AND m->>'invocation_observation_hash' ~ '^[0-9a-f]{64}$')
 AND (jsonb_typeof(m->'final_receipt_hash')='string' AND m->>'final_receipt_hash' ~ '^[0-9a-f]{64}$')
 AND jsonb_typeof(m->'work_ended') IN ('boolean','null')
 AND m->>'price_status' IN ('known_final','unknown_final')
 AND CASE WHEN jsonb_typeof(m->'violations')='array' THEN NOT EXISTS(SELECT 1 FROM jsonb_array_elements(m->'violations') AS items(violation_item) WHERE jsonb_typeof(violation_item) IS DISTINCT FROM 'string' OR violation_item #>> '{}' NOT IN ('metadata_unverified','input_hash_unobserved','input_hash_mismatch','input_count_unobserved','input_count_mismatch','output_cap_unobserved','output_cap_mismatch','request_fingerprint_unobserved','request_fingerprint_mismatch','certificate_unobserved','certificate_mismatch','provider_unobserved','provider_mismatch','operation_unobserved','operation_mismatch','model_unobserved','model_mismatch','output_count_unknown_at_end','output_over_cap','foreign_currency','actual_above_bound')) ELSE false END
 AND m#>>'{consumption,observation_state}'=CASE WHEN (m #> '{consumption}') @> '{"input_text_hash":null}'::jsonb OR (m #> '{consumption}') @> '{"input_bytes":null}'::jsonb OR (m #> '{consumption}') @> '{"consumed_output_cap":null}'::jsonb OR (m #> '{consumption}') @> '{"computed_request_fingerprint":null}'::jsonb OR (m #> '{consumption}') @> '{"consumed_certificate_hash":null}'::jsonb OR (m #> '{consumption}') @> '{"consumed_provider":null}'::jsonb OR (m #> '{consumption}') @> '{"consumed_operation":null}'::jsonb OR (m #> '{consumption}') @> '{"consumed_model_identifier":null}'::jsonb THEN 'incomplete' ELSE 'complete' END
 AND CASE WHEN jsonb_typeof(m #> '{event_binding,ended_at}')='string' AND (m #>> '{event_binding,ended_at}') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{6}Z$' THEN CASE WHEN pg_input_is_valid(m #>> '{event_binding,ended_at}','timestamp with time zone') THEN to_char((m #>> '{event_binding,ended_at}')::timestamptz AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')=(m #>> '{event_binding,ended_at}') ELSE false END ELSE false END
 AND ((m #> '{event_binding,actual_cost}')='null'::jsonb OR (jsonb_typeof(m #> '{event_binding,actual_cost}')='string' AND length(m #>> '{event_binding,actual_cost}')<=64 AND (m #>> '{event_binding,actual_cost}') ~ '^(0|[1-9][0-9]*)([.][0-9]*[1-9])?$'))
 AND ((m #> '{event_binding,actual_cost}')='null'::jsonb)=((m #> '{event_binding,currency}')='null'::jsonb)
 AND ((m #> '{event_binding,response_reference}')='null'::jsonb OR (jsonb_typeof(m #> '{event_binding,response_reference}')='string' AND octet_length(m #>> '{event_binding,response_reference}')<=4096 AND (m #>> '{event_binding,response_reference}') IS NFC NORMALIZED))) IS DISTINCT FROM true THEN problem:='malformed';END IF;
  expected_at:=jsonb_build_object('provider_call_id',c.provider_call_id::text,'attempt_id',c.attempt_id::text,
 'program_run_id',c.admission_certificate->>'program_run_id','provider',c.provider,'operation',c.operation,
 'model_identifier',c.model_identifier,'logical_request_key',c.logical_request_key,'request_fingerprint',c.request_fingerprint,
 'admission_certificate_hash',c.admission_certificate_hash,'admission_policy_hash',c.admission_policy_hash);
  IF problem='none' AND m->'attribution' IS DISTINCT FROM expected_at THEN problem:='attribution_mismatch';END IF;
  IF problem='none' THEN
    -- typed numeric equality + exact canonical UTC microseconds/UUID/jsonb/text/null agreement.
    IF (ev-'actual_cost') IS DISTINCT FROM jsonb_build_object('provider_call_id',NEW.provider_call_id::text,'event_type',NEW.event_type,
 'ended_at',to_char(NEW.ended_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'usage',NEW.usage,
 'currency',NEW.currency,'response_artifact_id',NEW.response_artifact_id::text,'response_reference',NEW.response_reference)
      OR (ev#>'{usage,input_bytes}') IS DISTINCT FROM ct->'input_bytes'
      OR (ev#>'{usage,output_bytes}') IS DISTINCT FROM m->'observed_output_bytes'
      OR m->>'price_status' IS DISTINCT FROM (CASE WHEN NEW.actual_cost IS NULL THEN 'unknown_final' ELSE 'known_final' END) THEN
      problem:='event_mismatch';
    ELSIF NEW.actual_cost IS NULL THEN
      IF ev->'actual_cost' IS DISTINCT FROM 'null'::jsonb THEN problem:='event_mismatch';END IF;
    ELSIF jsonb_typeof(ev->'actual_cost') IS DISTINCT FROM 'string'
      OR length(ev->>'actual_cost')>64 OR ev->>'actual_cost' !~ '^(0|[1-9][0-9]*)([.][0-9]*[1-9])?$' THEN
      problem:='malformed';
    ELSIF (ev->>'actual_cost')::numeric IS DISTINCT FROM NEW.actual_cost THEN problem:='event_mismatch';
    END IF;
  END IF;
  IF problem<>'none' THEN
    v:=jsonb_build_array('metadata_unverified');
    m:=jsonb_build_object('schema','g1-sim-settlement/1','verification_status','unverified_assertion','metadata_problem',problem,
      'invocation_observation_hash',NULL,'final_receipt_hash',NULL,'attribution',NULL,'consumption',NULL,
      'work_ended',NULL,'observed_output_bytes',NULL,'price_status',CASE WHEN NEW.actual_cost IS NULL THEN 'asserted_unknown' ELSE 'asserted_known' END,
      'event_binding',NULL,'violations',v);
  ELSE
    -- Exact observed facts, not an opaque hash or transient API flag. Input-count FEWER is a mismatch too.
    FOR spec IN SELECT * FROM (VALUES
      ('input_text_hash','input_text_hash','input_hash'),
      ('input_bytes','input_bytes','input_count'),
      ('consumed_output_cap','max_output_bytes','output_cap'),
      ('computed_request_fingerprint','request_fingerprint','request_fingerprint'),
      ('consumed_certificate_hash',NULL,'certificate'),
      ('consumed_provider','provider','provider'),('consumed_operation','operation','operation'),
      ('consumed_model_identifier','model_identifier','model')
    ) comparison(observed,admitted,prefix) LOOP
      IF ct->spec.observed='null'::jsonb THEN v:=v||jsonb_build_array(spec.prefix||'_unobserved');
      ELSIF ct->spec.observed IS DISTINCT FROM (CASE WHEN spec.observed='consumed_certificate_hash' THEN to_jsonb(c.admission_certificate_hash)
        ELSE c.admission_certificate->spec.admitted END) THEN v:=v||jsonb_build_array(spec.prefix||'_mismatch');
      END IF;
    END LOOP;
    IF m->'work_ended'='true'::jsonb AND m->'observed_output_bytes'='null'::jsonb THEN
      v:=v||jsonb_build_array('output_count_unknown_at_end');
    END IF;
    IF m->'observed_output_bytes'<>'null'::jsonb AND
      ((m->>'observed_output_bytes')::numeric>(c.admission_certificate->>'max_output_bytes')::numeric OR
        (ct->'consumed_output_cap'<>'null'::jsonb AND (m->>'observed_output_bytes')::numeric>(ct->>'consumed_output_cap')::numeric)) THEN
      v:=v||jsonb_build_array('output_over_cap');
    END IF;
    m:=jsonb_set(m,'{violations}',v,false);
  END IF;
  IF NEW.actual_cost IS NOT NULL THEN
    IF NEW.currency IS DISTINCT FROM c.admission_currency THEN v:=v||jsonb_build_array('foreign_currency');
    ELSIF NEW.actual_cost>c.reserved_cost_upper_bound THEN v:=v||jsonb_build_array('actual_above_bound');
    END IF;
  END IF;
  m:=jsonb_set(m,'{violations}',v,false);
  -- Actual server event time is never clipped to admission/watermark or caller supplied.
  recorded_time:=clock_timestamp();
  NEW.recorded_at:=recorded_time;NEW.admission_settlement:=m;
  RETURN NEW;
END $$;
CREATE TRIGGER provider_settlement_row BEFORE INSERT ON provider_call_events
FOR EACH ROW EXECUTE FUNCTION guard_provider_settlement();
