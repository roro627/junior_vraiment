-- Junior, vraiment ? — schéma PostgreSQL de référence
-- Version documentation: 1.0.0
-- PostgreSQL: 18.x
--
-- Ce fichier est une référence de conception. La source exécutable finale
-- doit être le schéma Drizzle et ses migrations SQL relues.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  attribution_url text NOT NULL,
  terms_url text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE source_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
  query_key text NOT NULL,
  query_set_version text NOT NULL,
  label text NOT NULL,
  definition jsonb NOT NULL,
  job_families text[] NOT NULL DEFAULT '{}',
  territory_scope text,
  enabled boolean NOT NULL DEFAULT true,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, query_key, query_set_version),
  CHECK (jsonb_typeof(definition) = 'object'),
  CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE TABLE ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
  business_date date NOT NULL,
  query_set_version text NOT NULL,
  mode text NOT NULL DEFAULT 'full'
    CHECK (mode IN ('full', 'limited', 'reclassify', 'health')),
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN (
      'queued', 'running', 'validating', 'aggregating', 'publishing',
      'succeeded', 'partial', 'failed', 'cancelled'
    )),
  trigger_run_id text,
  started_at timestamptz,
  finished_at timestamptz,
  requests_count integer NOT NULL DEFAULT 0 CHECK (requests_count >= 0),
  offers_received integer NOT NULL DEFAULT 0 CHECK (offers_received >= 0),
  offers_valid integer NOT NULL DEFAULT 0 CHECK (offers_valid >= 0),
  offers_quarantined integer NOT NULL DEFAULT 0 CHECK (offers_quarantined >= 0),
  offers_new integer NOT NULL DEFAULT 0 CHECK (offers_new >= 0),
  offers_updated integer NOT NULL DEFAULT 0 CHECK (offers_updated >= 0),
  offers_marked_missing integer NOT NULL DEFAULT 0 CHECK (offers_marked_missing >= 0),
  quality_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (finished_at IS NULL OR started_at IS NULL OR finished_at >= started_at),
  CHECK (jsonb_typeof(quality_summary) = 'object'),
  CHECK (jsonb_typeof(error_summary) = 'object')
);

CREATE INDEX ingestion_runs_source_date_idx
  ON ingestion_runs (source_id, business_date DESC);

CREATE INDEX ingestion_runs_status_idx
  ON ingestion_runs (status, created_at DESC);

-- Autorise l'historique et les relances, mais interdit deux publications
-- concurrentes du même périmètre logique.
CREATE UNIQUE INDEX ingestion_runs_one_active_scope_idx
  ON ingestion_runs (source_id, business_date, query_set_version, mode)
  WHERE status IN (
    'queued', 'running', 'validating', 'aggregating', 'publishing'
  );

CREATE TABLE ingestion_run_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingestion_run_id uuid NOT NULL REFERENCES ingestion_runs(id) ON DELETE CASCADE,
  source_query_id uuid NOT NULL REFERENCES source_queries(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'succeeded', 'partial', 'failed', 'skipped')),
  pages_received integer NOT NULL DEFAULT 0 CHECK (pages_received >= 0),
  offers_received integer NOT NULL DEFAULT 0 CHECK (offers_received >= 0),
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  checkpoint jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  UNIQUE (ingestion_run_id, source_query_id),
  CHECK (jsonb_typeof(checkpoint) = 'object'),
  CHECK (jsonb_typeof(error_summary) = 'object')
);

CREATE TABLE offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
  external_id text NOT NULL,
  first_seen_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  missing_since timestamptz,
  closed_at timestamptz,
  reopened_count integer NOT NULL DEFAULT 0 CHECK (reopened_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, external_id),
  CHECK (last_seen_at >= first_seen_at),
  CHECK (closed_at IS NULL OR closed_at >= first_seen_at)
);

CREATE INDEX offers_active_last_seen_idx
  ON offers (last_seen_at DESC)
  WHERE closed_at IS NULL;

CREATE INDEX offers_closed_idx
  ON offers (closed_at DESC)
  WHERE closed_at IS NOT NULL;

CREATE TABLE offer_query_matches (
  offer_id uuid NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  source_query_id uuid NOT NULL REFERENCES source_queries(id) ON DELETE CASCADE,
  matched_job_families text[], -- NULL: historical matches before queries-3.0.0
  first_matched_at timestamptz NOT NULL,
  last_matched_at timestamptz NOT NULL,
  PRIMARY KEY (offer_id, source_query_id),
  CHECK (last_matched_at >= first_matched_at)
);

CREATE TABLE offer_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  ingestion_run_id uuid REFERENCES ingestion_runs(id) ON DELETE SET NULL,
  content_hash text NOT NULL,
  title text NOT NULL,
  description_text text NOT NULL,
  company_name text,
  source_published_at timestamptz,
  source_updated_at timestamptz,
  location_label text,
  commune_code text,
  department_code text,
  region_code text,
  latitude double precision,
  longitude double precision,
  contract_source_code text,
  contract_kind text NOT NULL DEFAULT 'unknown'
    CHECK (contract_kind IN (
      'cdi', 'cdd', 'interim', 'alternance', 'internship',
      'freelance', 'public', 'other', 'unknown'
    )),
  contract_label text,
  structured_experience_required boolean,
  structured_experience_label text,
  salary_data jsonb,
  application_url text,
  source_url text,
  raw_payload jsonb,
  raw_payload_expires_at timestamptz,
  valid_from timestamptz NOT NULL,
  valid_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (offer_id, content_hash),
  CHECK (char_length(content_hash) >= 32),
  CHECK (valid_to IS NULL OR valid_to >= valid_from),
  CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  CHECK (salary_data IS NULL OR jsonb_typeof(salary_data) = 'object')
);

CREATE UNIQUE INDEX offer_snapshots_one_current_idx
  ON offer_snapshots (offer_id)
  WHERE valid_to IS NULL;

CREATE INDEX offer_snapshots_published_idx
  ON offer_snapshots (source_published_at DESC);

CREATE INDEX offer_snapshots_geo_idx
  ON offer_snapshots (region_code, department_code, commune_code);

CREATE INDEX offer_snapshots_contract_idx
  ON offer_snapshots (contract_kind, source_published_at DESC);

CREATE TABLE classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL REFERENCES offer_snapshots(id) ON DELETE CASCADE,
  classifier_version text NOT NULL,
  taxonomy_jobs_version text NOT NULL,
  taxonomy_technologies_version text NOT NULL,
  status text NOT NULL
    CHECK (status IN ('classified', 'ambiguous', 'unclassified')),
  claims_junior boolean,
  beginner_friendly boolean,
  contradictory_junior boolean,
  minimum_experience_months integer
    CHECK (minimum_experience_months IS NULL OR minimum_experience_months >= 0),
  salary_transparent boolean NOT NULL DEFAULT false,
  remote_mode text NOT NULL DEFAULT 'unknown'
    CHECK (remote_mode IN ('remote', 'hybrid', 'onsite', 'unknown')),
  job_family text,
  secondary_job_families text[] NOT NULL DEFAULT '{}',
  rule_ids text[] NOT NULL DEFAULT '{}',
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  result_hash text NOT NULL,
  classified_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (snapshot_id, classifier_version),
  CHECK (jsonb_typeof(warnings) = 'array'),
  CHECK (
    beginner_friendly IS NULL
    OR (
      status = 'classified'
      AND minimum_experience_months IS NOT NULL
      AND (
        (beginner_friendly = true AND minimum_experience_months <= 12)
        OR (beginner_friendly = false AND minimum_experience_months > 12)
      )
    )
  ),
  CHECK (
    contradictory_junior IS NULL
    OR status = 'classified'
  ),
  CHECK (
    contradictory_junior IS DISTINCT FROM true
    OR (
      claims_junior = true
      AND minimum_experience_months >= 24
      AND status = 'classified'
    )
  ),
  CHECK (
    contradictory_junior IS DISTINCT FROM false
    OR (
      claims_junior = false
      OR (
        claims_junior = true
        AND minimum_experience_months IS NOT NULL
        AND minimum_experience_months < 24
      )
    )
  )
);

CREATE INDEX classifications_contradiction_idx
  ON classifications (classifier_version, contradictory_junior)
  WHERE contradictory_junior IS NOT NULL;

CREATE INDEX classifications_junior_idx
  ON classifications (classifier_version, claims_junior);

CREATE INDEX classifications_experience_idx
  ON classifications (classifier_version, minimum_experience_months);

CREATE INDEX classifications_family_idx
  ON classifications (classifier_version, job_family);

CREATE TABLE classification_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classification_id uuid NOT NULL REFERENCES classifications(id) ON DELETE CASCADE,
  evidence_kind text NOT NULL
    CHECK (evidence_kind IN (
      'junior_claim', 'required_experience', 'desired_experience',
      'salary', 'remote', 'technology', 'job_family', 'conflict',
      'exclusion', 'ambiguity', 'other'
    )),
  rule_id text NOT NULL,
  source_field text NOT NULL,
  excerpt text NOT NULL,
  start_offset integer,
  end_offset integer,
  normalized_value text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ordinal integer NOT NULL DEFAULT 0 CHECK (ordinal >= 0),
  CHECK (
    start_offset IS NULL
    OR end_offset IS NULL
    OR (start_offset >= 0 AND end_offset >= start_offset)
  ),
  CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX classification_evidence_classification_idx
  ON classification_evidence (classification_id, ordinal);

CREATE TABLE technologies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  label text NOT NULL,
  category text NOT NULL,
  taxonomy_version text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slug, taxonomy_version)
);

CREATE TABLE technology_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technology_id uuid NOT NULL REFERENCES technologies(id) ON DELETE CASCADE,
  alias text NOT NULL,
  match_kind text NOT NULL DEFAULT 'word'
    CHECK (match_kind IN ('word', 'exact', 'regex', 'case_sensitive')),
  negative_patterns text[] NOT NULL DEFAULT '{}',
  UNIQUE (technology_id, alias, match_kind)
);

CREATE TABLE offer_snapshot_technologies (
  snapshot_id uuid NOT NULL REFERENCES offer_snapshots(id) ON DELETE CASCADE,
  classification_id uuid NOT NULL REFERENCES classifications(id) ON DELETE CASCADE,
  technology_id uuid NOT NULL REFERENCES technologies(id) ON DELETE RESTRICT,
  mention_kind text NOT NULL DEFAULT 'mentioned'
    CHECK (mention_kind IN ('mentioned', 'required', 'preferred', 'contextual')),
  confidence numeric(5,4)
    CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  evidence_id uuid REFERENCES classification_evidence(id) ON DELETE SET NULL,
  PRIMARY KEY (snapshot_id, classification_id, technology_id)
);

CREATE INDEX offer_snapshot_technologies_tech_idx
  ON offer_snapshot_technologies (technology_id, snapshot_id);

CREATE TABLE published_datasets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_version text NOT NULL UNIQUE,
  source_id uuid NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
  ingestion_run_id uuid REFERENCES ingestion_runs(id) ON DELETE SET NULL,
  classifier_version text NOT NULL,
  metric_versions jsonb NOT NULL,
  query_set_version text NOT NULL,
  taxonomy_versions jsonb NOT NULL,
  source_cutoff_at timestamptz NOT NULL,
  computed_at timestamptz NOT NULL,
  published_at timestamptz,
  status text NOT NULL
    CHECK (status IN ('draft', 'validated', 'published', 'withdrawn')),
  is_current boolean NOT NULL DEFAULT false,
  quality_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(metric_versions) = 'object'),
  CHECK (jsonb_typeof(taxonomy_versions) = 'object'),
  CHECK (jsonb_typeof(quality_summary) = 'object')
);

CREATE UNIQUE INDEX published_datasets_one_current_idx
  ON published_datasets ((is_current))
  WHERE is_current = true;

CREATE TABLE daily_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id uuid NOT NULL REFERENCES published_datasets(id) ON DELETE CASCADE,
  metric_key text NOT NULL,
  metric_version text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  job_family text,
  technology_slug text,
  region_code text,
  department_code text,
  commune_code text,
  contract_kind text,
  remote_mode text,
  dimensions jsonb NOT NULL DEFAULT '{}'::jsonb,
  dimension_hash text NOT NULL,
  numerator bigint NOT NULL DEFAULT 0 CHECK (numerator >= 0),
  denominator bigint NOT NULL DEFAULT 0 CHECK (denominator >= 0),
  population_count bigint NOT NULL DEFAULT 0 CHECK (population_count >= 0),
  unknown_count bigint NOT NULL DEFAULT 0 CHECK (unknown_count >= 0),
  ambiguous_count bigint NOT NULL DEFAULT 0 CHECK (ambiguous_count >= 0),
  value_numeric numeric(12,8)
    CHECK (value_numeric IS NULL OR value_numeric BETWEEN 0 AND 1),
  coverage_numeric numeric(12,8)
    CHECK (coverage_numeric IS NULL OR coverage_numeric BETWEEN 0 AND 1),
  sample_quality text NOT NULL DEFAULT 'normal'
    CHECK (sample_quality IN ('normal', 'caution', 'insufficient')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (
    dataset_id, metric_key, metric_version,
    period_start, period_end, dimension_hash
  ),
  CHECK (period_end >= period_start),
  CHECK (jsonb_typeof(dimensions) = 'object'),
  CHECK (jsonb_typeof(metadata) = 'object'),
  CHECK (numerator <= denominator),
  CHECK (denominator <= population_count),
  CHECK (population_count = denominator + unknown_count + ambiguous_count),
  CHECK (
    (
      (denominator = 0 OR sample_quality = 'insufficient')
      AND value_numeric IS NULL
    )
    OR
    (
      denominator > 0
      AND sample_quality IN ('normal', 'caution')
      AND value_numeric IS NOT NULL
    )
  ),
  CHECK (
    (population_count = 0 AND coverage_numeric IS NULL)
    OR
    (population_count > 0 AND coverage_numeric IS NOT NULL)
  )
);

CREATE INDEX daily_metrics_lookup_idx
  ON daily_metrics (
    dataset_id, metric_key, metric_version,
    job_family, technology_slug, region_code,
    department_code, commune_code
  );

CREATE INDEX daily_metrics_period_idx
  ON daily_metrics (metric_key, period_end DESC);

CREATE TABLE data_quality_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingestion_run_id uuid REFERENCES ingestion_runs(id) ON DELETE CASCADE,
  dataset_id uuid REFERENCES published_datasets(id) ON DELETE SET NULL,
  severity text NOT NULL
    CHECK (severity IN ('info', 'warning', 'error', 'blocking')),
  event_code text NOT NULL,
  scope text,
  message text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_public boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(details) = 'object')
);

CREATE INDEX data_quality_events_open_idx
  ON data_quality_events (severity, created_at DESC)
  WHERE resolved_at IS NULL;

CREATE TABLE insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  summary text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'corrected', 'withdrawn')),
  dataset_id uuid NOT NULL REFERENCES published_datasets(id) ON DELETE RESTRICT,
  metric_key text NOT NULL,
  metric_version text NOT NULL,
  filters jsonb NOT NULL,
  value_numeric numeric(12,8)
    CHECK (value_numeric IS NULL OR value_numeric BETWEEN 0 AND 1),
  numerator bigint NOT NULL CHECK (numerator >= 0),
  denominator bigint NOT NULL CHECK (denominator >= 0),
  population_count bigint NOT NULL CHECK (population_count >= 0),
  unknown_count bigint NOT NULL DEFAULT 0 CHECK (unknown_count >= 0),
  ambiguous_count bigint NOT NULL DEFAULT 0 CHECK (ambiguous_count >= 0),
  coverage_numeric numeric(12,8)
    CHECK (coverage_numeric IS NULL OR coverage_numeric BETWEEN 0 AND 1),
  sample_quality text NOT NULL
    CHECK (sample_quality IN ('normal', 'caution', 'insufficient')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  og_alt text NOT NULL,
  published_at timestamptz,
  corrected_at timestamptz,
  correction_note text,
  previous_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(filters) = 'object'),
  CHECK (previous_snapshot IS NULL OR jsonb_typeof(previous_snapshot) = 'object'),
  CHECK (period_end >= period_start),
  CHECK (numerator <= denominator),
  CHECK (denominator <= population_count),
  CHECK (population_count = denominator + unknown_count + ambiguous_count),
  CHECK (
    (
      (denominator = 0 OR sample_quality = 'insufficient')
      AND value_numeric IS NULL
    )
    OR
    (
      denominator > 0
      AND sample_quality IN ('normal', 'caution')
      AND value_numeric IS NOT NULL
    )
  ),
  CHECK (
    (population_count = 0 AND coverage_numeric IS NULL)
    OR
    (population_count > 0 AND coverage_numeric IS NOT NULL)
  )
);

CREATE INDEX insights_status_published_idx
  ON insights (status, published_at DESC);

-- Vue pratique : snapshot courant et classification de la version du dataset courant.
-- L'implémentation finale peut choisir une vue matérialisée ou une requête Drizzle.
CREATE VIEW current_public_offer_classifications AS
SELECT
  o.id AS offer_id,
  o.source_id,
  o.external_id,
  o.first_seen_at,
  o.last_seen_at,
  o.closed_at,
  s.id AS snapshot_id,
  s.title,
  s.company_name,
  s.location_label,
  s.commune_code,
  s.department_code,
  s.region_code,
  s.contract_kind,
  s.source_published_at,
  s.application_url,
  c.id AS classification_id,
  c.classifier_version,
  c.status AS classification_status,
  c.claims_junior,
  c.beginner_friendly,
  c.contradictory_junior,
  c.minimum_experience_months,
  c.salary_transparent,
  c.remote_mode,
  c.job_family,
  CASE
    WHEN c.status = 'ambiguous' THEN 'ambiguous'
    WHEN c.status = 'unclassified' THEN 'unknown'
    WHEN c.status = 'classified' AND c.contradictory_junior = true
      THEN 'contradictory'
    WHEN c.status = 'classified' AND c.beginner_friendly = true
      THEN 'beginner_friendly'
    WHEN c.status = 'classified'
      AND c.claims_junior = true
      AND (
        c.beginner_friendly IS NULL
        OR c.contradictory_junior IS NULL
      )
      THEN 'junior_unresolved'
    WHEN c.status = 'classified'
      AND c.claims_junior = true
      AND c.beginner_friendly = false
      AND c.contradictory_junior = false
      THEN 'other_junior'
    WHEN c.status = 'classified' AND c.claims_junior = false
      THEN 'not_explicitly_junior'
    ELSE 'unknown'
  END AS classification_segment
FROM offers o
JOIN offer_snapshots s
  ON s.offer_id = o.id
 AND s.valid_to IS NULL
JOIN classifications c
  ON c.snapshot_id = s.id
JOIN published_datasets d
  ON d.is_current = true
 AND d.classifier_version = c.classifier_version;
