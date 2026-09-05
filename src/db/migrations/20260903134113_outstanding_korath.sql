CREATE EXTENSION IF NOT EXISTS "pgcrypto";
--> statement-breakpoint
CREATE TABLE "classification_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"classification_id" uuid NOT NULL,
	"evidence_kind" text NOT NULL,
	"rule_id" text NOT NULL,
	"source_field" text NOT NULL,
	"excerpt" text NOT NULL,
	"start_offset" integer,
	"end_offset" integer,
	"normalized_value" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ordinal" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "classification_evidence_kind_check" CHECK ("classification_evidence"."evidence_kind" in ('junior_claim', 'required_experience', 'desired_experience', 'salary', 'remote', 'technology', 'job_family', 'conflict', 'exclusion', 'ambiguity', 'other')),
	CONSTRAINT "classification_evidence_offsets_check" CHECK ("classification_evidence"."start_offset" is null or "classification_evidence"."end_offset" is null or ("classification_evidence"."start_offset" >= 0 and "classification_evidence"."end_offset" >= "classification_evidence"."start_offset")),
	CONSTRAINT "classification_evidence_metadata_check" CHECK (jsonb_typeof("classification_evidence"."metadata") = 'object'),
	CONSTRAINT "classification_evidence_ordinal_check" CHECK ("classification_evidence"."ordinal" >= 0)
);
--> statement-breakpoint
CREATE TABLE "classifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"classifier_version" text NOT NULL,
	"taxonomy_jobs_version" text NOT NULL,
	"taxonomy_technologies_version" text NOT NULL,
	"status" text NOT NULL,
	"claims_junior" boolean,
	"beginner_friendly" boolean,
	"contradictory_junior" boolean,
	"minimum_experience_months" integer,
	"salary_transparent" boolean DEFAULT false NOT NULL,
	"remote_mode" text DEFAULT 'unknown' NOT NULL,
	"job_family" text,
	"secondary_job_families" text[] DEFAULT '{}'::text[] NOT NULL,
	"rule_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"result_hash" text NOT NULL,
	"classified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "classifications_snapshot_version_unique" UNIQUE("snapshot_id","classifier_version"),
	CONSTRAINT "classifications_status_check" CHECK ("classifications"."status" in ('classified', 'ambiguous', 'unclassified')),
	CONSTRAINT "classifications_experience_check" CHECK ("classifications"."minimum_experience_months" is null or "classifications"."minimum_experience_months" >= 0),
	CONSTRAINT "classifications_remote_check" CHECK ("classifications"."remote_mode" in ('remote', 'hybrid', 'onsite', 'unknown')),
	CONSTRAINT "classifications_warnings_array_check" CHECK (jsonb_typeof("classifications"."warnings") = 'array'),
	CONSTRAINT "classifications_beginner_check" CHECK ("classifications"."beginner_friendly" is null or ("classifications"."status" = 'classified' and "classifications"."minimum_experience_months" is not null and (("classifications"."beginner_friendly" = true and "classifications"."minimum_experience_months" <= 12) or ("classifications"."beginner_friendly" = false and "classifications"."minimum_experience_months" > 12)))),
	CONSTRAINT "classifications_contradiction_status_check" CHECK ("classifications"."contradictory_junior" is null or "classifications"."status" = 'classified'),
	CONSTRAINT "classifications_contradiction_true_check" CHECK ("classifications"."contradictory_junior" is distinct from true or ("classifications"."claims_junior" = true and "classifications"."minimum_experience_months" >= 24 and "classifications"."status" = 'classified')),
	CONSTRAINT "classifications_contradiction_false_check" CHECK ("classifications"."contradictory_junior" is distinct from false or ("classifications"."claims_junior" = false or ("classifications"."claims_junior" = true and "classifications"."minimum_experience_months" is not null and "classifications"."minimum_experience_months" < 24)))
);
--> statement-breakpoint
CREATE TABLE "daily_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dataset_id" uuid NOT NULL,
	"metric_key" text NOT NULL,
	"metric_version" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"job_family" text,
	"technology_slug" text,
	"region_code" text,
	"department_code" text,
	"commune_code" text,
	"contract_kind" text,
	"remote_mode" text,
	"dimensions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dimension_hash" text NOT NULL,
	"numerator" bigint DEFAULT 0 NOT NULL,
	"denominator" bigint DEFAULT 0 NOT NULL,
	"population_count" bigint DEFAULT 0 NOT NULL,
	"unknown_count" bigint DEFAULT 0 NOT NULL,
	"ambiguous_count" bigint DEFAULT 0 NOT NULL,
	"value_numeric" numeric(12, 8),
	"coverage_numeric" numeric(12, 8),
	"sample_quality" text DEFAULT 'normal' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_metrics_dataset_metric_period_dimension_unique" UNIQUE("dataset_id","metric_key","metric_version","period_start","period_end","dimension_hash"),
	CONSTRAINT "daily_metrics_period_check" CHECK ("daily_metrics"."period_end" >= "daily_metrics"."period_start"),
	CONSTRAINT "daily_metrics_json_check" CHECK (jsonb_typeof("daily_metrics"."dimensions") = 'object' and jsonb_typeof("daily_metrics"."metadata") = 'object'),
	CONSTRAINT "daily_metrics_counts_check" CHECK ("daily_metrics"."numerator" >= 0 and "daily_metrics"."denominator" >= 0 and "daily_metrics"."population_count" >= 0 and "daily_metrics"."unknown_count" >= 0 and "daily_metrics"."ambiguous_count" >= 0 and "daily_metrics"."numerator" <= "daily_metrics"."denominator" and "daily_metrics"."denominator" <= "daily_metrics"."population_count" and "daily_metrics"."population_count" = "daily_metrics"."denominator" + "daily_metrics"."unknown_count" + "daily_metrics"."ambiguous_count"),
	CONSTRAINT "daily_metrics_value_check" CHECK ((("daily_metrics"."denominator" = 0 or "daily_metrics"."sample_quality" = 'insufficient') and "daily_metrics"."value_numeric" is null) or ("daily_metrics"."denominator" > 0 and "daily_metrics"."sample_quality" in ('normal', 'caution') and "daily_metrics"."value_numeric" is not null)),
	CONSTRAINT "daily_metrics_value_range_check" CHECK ("daily_metrics"."value_numeric" is null or "daily_metrics"."value_numeric" between 0 and 1),
	CONSTRAINT "daily_metrics_coverage_check" CHECK (("daily_metrics"."population_count" = 0 and "daily_metrics"."coverage_numeric" is null) or ("daily_metrics"."population_count" > 0 and "daily_metrics"."coverage_numeric" is not null)),
	CONSTRAINT "daily_metrics_coverage_range_check" CHECK ("daily_metrics"."coverage_numeric" is null or "daily_metrics"."coverage_numeric" between 0 and 1),
	CONSTRAINT "daily_metrics_sample_quality_check" CHECK ("daily_metrics"."sample_quality" in ('normal', 'caution', 'insufficient'))
);
--> statement-breakpoint
CREATE TABLE "data_quality_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ingestion_run_id" uuid,
	"dataset_id" uuid,
	"severity" text NOT NULL,
	"event_code" text NOT NULL,
	"scope" text,
	"message" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "data_quality_events_severity_check" CHECK ("data_quality_events"."severity" in ('info', 'warning', 'error', 'blocking')),
	CONSTRAINT "data_quality_events_details_check" CHECK (jsonb_typeof("data_quality_events"."details") = 'object')
);
--> statement-breakpoint
CREATE TABLE "ingestion_run_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ingestion_run_id" uuid NOT NULL,
	"source_query_id" uuid NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"pages_received" integer DEFAULT 0 NOT NULL,
	"offers_received" integer DEFAULT 0 NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"checkpoint" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	CONSTRAINT "ingestion_run_queries_run_query_unique" UNIQUE("ingestion_run_id","source_query_id"),
	CONSTRAINT "ingestion_run_queries_status_check" CHECK ("ingestion_run_queries"."status" in ('queued', 'running', 'succeeded', 'partial', 'failed', 'skipped')),
	CONSTRAINT "ingestion_run_queries_counts_check" CHECK ("ingestion_run_queries"."pages_received" >= 0 and "ingestion_run_queries"."offers_received" >= 0 and "ingestion_run_queries"."request_count" >= 0),
	CONSTRAINT "ingestion_run_queries_json_check" CHECK (jsonb_typeof("ingestion_run_queries"."checkpoint") = 'object' and jsonb_typeof("ingestion_run_queries"."error_summary") = 'object')
);
--> statement-breakpoint
CREATE TABLE "ingestion_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"business_date" date NOT NULL,
	"query_set_version" text NOT NULL,
	"mode" text DEFAULT 'full' NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"trigger_run_id" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"requests_count" integer DEFAULT 0 NOT NULL,
	"offers_received" integer DEFAULT 0 NOT NULL,
	"offers_valid" integer DEFAULT 0 NOT NULL,
	"offers_quarantined" integer DEFAULT 0 NOT NULL,
	"offers_new" integer DEFAULT 0 NOT NULL,
	"offers_updated" integer DEFAULT 0 NOT NULL,
	"offers_marked_missing" integer DEFAULT 0 NOT NULL,
	"quality_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ingestion_runs_mode_check" CHECK ("ingestion_runs"."mode" in ('full', 'limited', 'reclassify', 'health')),
	CONSTRAINT "ingestion_runs_status_check" CHECK ("ingestion_runs"."status" in ('queued', 'running', 'validating', 'aggregating', 'publishing', 'succeeded', 'partial', 'failed', 'cancelled')),
	CONSTRAINT "ingestion_runs_counts_check" CHECK ("ingestion_runs"."requests_count" >= 0 and "ingestion_runs"."offers_received" >= 0 and "ingestion_runs"."offers_valid" >= 0 and "ingestion_runs"."offers_quarantined" >= 0 and "ingestion_runs"."offers_new" >= 0 and "ingestion_runs"."offers_updated" >= 0 and "ingestion_runs"."offers_marked_missing" >= 0),
	CONSTRAINT "ingestion_runs_dates_check" CHECK ("ingestion_runs"."finished_at" is null or "ingestion_runs"."started_at" is null or "ingestion_runs"."finished_at" >= "ingestion_runs"."started_at"),
	CONSTRAINT "ingestion_runs_json_check" CHECK (jsonb_typeof("ingestion_runs"."quality_summary") = 'object' and jsonb_typeof("ingestion_runs"."error_summary") = 'object')
);
--> statement-breakpoint
CREATE TABLE "insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"dataset_id" uuid NOT NULL,
	"metric_key" text NOT NULL,
	"metric_version" text NOT NULL,
	"filters" jsonb NOT NULL,
	"value_numeric" numeric(12, 8),
	"numerator" bigint NOT NULL,
	"denominator" bigint NOT NULL,
	"population_count" bigint NOT NULL,
	"unknown_count" bigint DEFAULT 0 NOT NULL,
	"ambiguous_count" bigint DEFAULT 0 NOT NULL,
	"coverage_numeric" numeric(12, 8),
	"sample_quality" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"og_alt" text NOT NULL,
	"published_at" timestamp with time zone,
	"corrected_at" timestamp with time zone,
	"correction_note" text,
	"previous_snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "insights_slug_unique" UNIQUE("slug"),
	CONSTRAINT "insights_status_check" CHECK ("insights"."status" in ('draft', 'published', 'corrected', 'withdrawn')),
	CONSTRAINT "insights_json_check" CHECK (jsonb_typeof("insights"."filters") = 'object' and ("insights"."previous_snapshot" is null or jsonb_typeof("insights"."previous_snapshot") = 'object')),
	CONSTRAINT "insights_period_check" CHECK ("insights"."period_end" >= "insights"."period_start"),
	CONSTRAINT "insights_counts_check" CHECK ("insights"."numerator" >= 0 and "insights"."denominator" >= 0 and "insights"."population_count" >= 0 and "insights"."unknown_count" >= 0 and "insights"."ambiguous_count" >= 0 and "insights"."numerator" <= "insights"."denominator" and "insights"."denominator" <= "insights"."population_count" and "insights"."population_count" = "insights"."denominator" + "insights"."unknown_count" + "insights"."ambiguous_count"),
	CONSTRAINT "insights_value_check" CHECK ((("insights"."denominator" = 0 or "insights"."sample_quality" = 'insufficient') and "insights"."value_numeric" is null) or ("insights"."denominator" > 0 and "insights"."sample_quality" in ('normal', 'caution') and "insights"."value_numeric" is not null)),
	CONSTRAINT "insights_value_range_check" CHECK ("insights"."value_numeric" is null or "insights"."value_numeric" between 0 and 1),
	CONSTRAINT "insights_coverage_check" CHECK (("insights"."population_count" = 0 and "insights"."coverage_numeric" is null) or ("insights"."population_count" > 0 and "insights"."coverage_numeric" is not null)),
	CONSTRAINT "insights_coverage_range_check" CHECK ("insights"."coverage_numeric" is null or "insights"."coverage_numeric" between 0 and 1),
	CONSTRAINT "insights_sample_quality_check" CHECK ("insights"."sample_quality" in ('normal', 'caution', 'insufficient'))
);
--> statement-breakpoint
CREATE TABLE "offer_query_matches" (
	"offer_id" uuid NOT NULL,
	"source_query_id" uuid NOT NULL,
	"first_matched_at" timestamp with time zone NOT NULL,
	"last_matched_at" timestamp with time zone NOT NULL,
	CONSTRAINT "offer_query_matches_offer_id_source_query_id_pk" PRIMARY KEY("offer_id","source_query_id"),
	CONSTRAINT "offer_query_matches_dates_check" CHECK ("offer_query_matches"."last_matched_at" >= "offer_query_matches"."first_matched_at")
);
--> statement-breakpoint
CREATE TABLE "offer_snapshot_technologies" (
	"snapshot_id" uuid NOT NULL,
	"classification_id" uuid NOT NULL,
	"technology_id" uuid NOT NULL,
	"mention_kind" text DEFAULT 'mentioned' NOT NULL,
	"confidence" numeric(5, 4),
	"evidence_id" uuid,
	CONSTRAINT "offer_snapshot_technologies_snapshot_id_classification_id_technology_id_pk" PRIMARY KEY("snapshot_id","classification_id","technology_id"),
	CONSTRAINT "offer_snapshot_technologies_mention_kind_check" CHECK ("offer_snapshot_technologies"."mention_kind" in ('mentioned', 'required', 'preferred', 'contextual')),
	CONSTRAINT "offer_snapshot_technologies_confidence_check" CHECK ("offer_snapshot_technologies"."confidence" is null or "offer_snapshot_technologies"."confidence" between 0 and 1)
);
--> statement-breakpoint
CREATE TABLE "offer_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"ingestion_run_id" uuid,
	"content_hash" text NOT NULL,
	"title" text NOT NULL,
	"description_text" text NOT NULL,
	"company_name" text,
	"source_published_at" timestamp with time zone,
	"source_updated_at" timestamp with time zone,
	"location_label" text,
	"commune_code" text,
	"department_code" text,
	"region_code" text,
	"latitude" double precision,
	"longitude" double precision,
	"contract_source_code" text,
	"contract_kind" text DEFAULT 'unknown' NOT NULL,
	"contract_label" text,
	"structured_experience_required" boolean,
	"structured_experience_label" text,
	"salary_data" jsonb,
	"application_url" text,
	"source_url" text,
	"raw_payload" jsonb,
	"raw_payload_expires_at" timestamp with time zone,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offer_snapshots_offer_hash_unique" UNIQUE("offer_id","content_hash"),
	CONSTRAINT "offer_snapshots_hash_length_check" CHECK (char_length("offer_snapshots"."content_hash") >= 32),
	CONSTRAINT "offer_snapshots_validity_check" CHECK ("offer_snapshots"."valid_to" is null or "offer_snapshots"."valid_to" >= "offer_snapshots"."valid_from"),
	CONSTRAINT "offer_snapshots_latitude_check" CHECK ("offer_snapshots"."latitude" is null or "offer_snapshots"."latitude" between -90 and 90),
	CONSTRAINT "offer_snapshots_longitude_check" CHECK ("offer_snapshots"."longitude" is null or "offer_snapshots"."longitude" between -180 and 180),
	CONSTRAINT "offer_snapshots_contract_check" CHECK ("offer_snapshots"."contract_kind" in ('cdi', 'cdd', 'interim', 'alternance', 'internship', 'freelance', 'public', 'other', 'unknown')),
	CONSTRAINT "offer_snapshots_salary_object_check" CHECK ("offer_snapshots"."salary_data" is null or jsonb_typeof("offer_snapshots"."salary_data") = 'object'),
	CONSTRAINT "offer_snapshots_raw_payload_expiry_check" CHECK (("offer_snapshots"."raw_payload" is null and "offer_snapshots"."raw_payload_expires_at" is null) or ("offer_snapshots"."raw_payload" is not null and "offer_snapshots"."raw_payload_expires_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"missing_since" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"reopened_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offers_source_external_unique" UNIQUE("source_id","external_id"),
	CONSTRAINT "offers_seen_dates_check" CHECK ("offers"."last_seen_at" >= "offers"."first_seen_at"),
	CONSTRAINT "offers_closed_date_check" CHECK ("offers"."closed_at" is null or "offers"."closed_at" >= "offers"."first_seen_at"),
	CONSTRAINT "offers_reopened_count_check" CHECK ("offers"."reopened_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "published_datasets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dataset_version" text NOT NULL,
	"source_id" uuid NOT NULL,
	"ingestion_run_id" uuid,
	"classifier_version" text NOT NULL,
	"metric_versions" jsonb NOT NULL,
	"query_set_version" text NOT NULL,
	"taxonomy_versions" jsonb NOT NULL,
	"source_cutoff_at" timestamp with time zone NOT NULL,
	"computed_at" timestamp with time zone NOT NULL,
	"published_at" timestamp with time zone,
	"status" text NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"quality_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "published_datasets_dataset_version_unique" UNIQUE("dataset_version"),
	CONSTRAINT "published_datasets_status_check" CHECK ("published_datasets"."status" in ('draft', 'validated', 'published', 'withdrawn')),
	CONSTRAINT "published_datasets_json_check" CHECK (jsonb_typeof("published_datasets"."metric_versions") = 'object' and jsonb_typeof("published_datasets"."taxonomy_versions") = 'object' and jsonb_typeof("published_datasets"."quality_summary") = 'object')
);
--> statement-breakpoint
CREATE TABLE "source_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"query_key" text NOT NULL,
	"query_set_version" text NOT NULL,
	"label" text NOT NULL,
	"definition" jsonb NOT NULL,
	"job_families" text[] DEFAULT '{}'::text[] NOT NULL,
	"territory_scope" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_queries_source_key_version_unique" UNIQUE("source_id","query_key","query_set_version"),
	CONSTRAINT "source_queries_definition_object_check" CHECK (jsonb_typeof("source_queries"."definition") = 'object'),
	CONSTRAINT "source_queries_validity_check" CHECK ("source_queries"."valid_to" is null or "source_queries"."valid_to" >= "source_queries"."valid_from")
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"attribution_url" text NOT NULL,
	"terms_url" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sources_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "technologies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"category" text NOT NULL,
	"taxonomy_version" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "technologies_slug_version_unique" UNIQUE("slug","taxonomy_version")
);
--> statement-breakpoint
CREATE TABLE "technology_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"technology_id" uuid NOT NULL,
	"alias" text NOT NULL,
	"match_kind" text DEFAULT 'word' NOT NULL,
	"negative_patterns" text[] DEFAULT '{}'::text[] NOT NULL,
	CONSTRAINT "technology_aliases_technology_alias_kind_unique" UNIQUE("technology_id","alias","match_kind"),
	CONSTRAINT "technology_aliases_match_kind_check" CHECK ("technology_aliases"."match_kind" in ('word', 'exact', 'regex', 'case_sensitive'))
);
--> statement-breakpoint
ALTER TABLE "classification_evidence" ADD CONSTRAINT "classification_evidence_classification_id_classifications_id_fk" FOREIGN KEY ("classification_id") REFERENCES "public"."classifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classifications" ADD CONSTRAINT "classifications_snapshot_id_offer_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."offer_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_metrics" ADD CONSTRAINT "daily_metrics_dataset_id_published_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."published_datasets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_quality_events" ADD CONSTRAINT "data_quality_events_ingestion_run_id_ingestion_runs_id_fk" FOREIGN KEY ("ingestion_run_id") REFERENCES "public"."ingestion_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_quality_events" ADD CONSTRAINT "data_quality_events_dataset_id_published_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."published_datasets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_run_queries" ADD CONSTRAINT "ingestion_run_queries_ingestion_run_id_ingestion_runs_id_fk" FOREIGN KEY ("ingestion_run_id") REFERENCES "public"."ingestion_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_run_queries" ADD CONSTRAINT "ingestion_run_queries_source_query_id_source_queries_id_fk" FOREIGN KEY ("source_query_id") REFERENCES "public"."source_queries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_runs" ADD CONSTRAINT "ingestion_runs_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_dataset_id_published_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."published_datasets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_query_matches" ADD CONSTRAINT "offer_query_matches_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_query_matches" ADD CONSTRAINT "offer_query_matches_source_query_id_source_queries_id_fk" FOREIGN KEY ("source_query_id") REFERENCES "public"."source_queries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_snapshot_technologies" ADD CONSTRAINT "offer_snapshot_technologies_snapshot_id_offer_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."offer_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_snapshot_technologies" ADD CONSTRAINT "offer_snapshot_technologies_classification_id_classifications_id_fk" FOREIGN KEY ("classification_id") REFERENCES "public"."classifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_snapshot_technologies" ADD CONSTRAINT "offer_snapshot_technologies_technology_id_technologies_id_fk" FOREIGN KEY ("technology_id") REFERENCES "public"."technologies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_snapshot_technologies" ADD CONSTRAINT "offer_snapshot_technologies_evidence_id_classification_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."classification_evidence"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_snapshots" ADD CONSTRAINT "offer_snapshots_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_snapshots" ADD CONSTRAINT "offer_snapshots_ingestion_run_id_ingestion_runs_id_fk" FOREIGN KEY ("ingestion_run_id") REFERENCES "public"."ingestion_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_datasets" ADD CONSTRAINT "published_datasets_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_datasets" ADD CONSTRAINT "published_datasets_ingestion_run_id_ingestion_runs_id_fk" FOREIGN KEY ("ingestion_run_id") REFERENCES "public"."ingestion_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_queries" ADD CONSTRAINT "source_queries_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technology_aliases" ADD CONSTRAINT "technology_aliases_technology_id_technologies_id_fk" FOREIGN KEY ("technology_id") REFERENCES "public"."technologies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "classification_evidence_classification_idx" ON "classification_evidence" USING btree ("classification_id","ordinal");--> statement-breakpoint
CREATE INDEX "classifications_contradiction_idx" ON "classifications" USING btree ("classifier_version","contradictory_junior") WHERE "classifications"."contradictory_junior" is not null;--> statement-breakpoint
CREATE INDEX "classifications_junior_idx" ON "classifications" USING btree ("classifier_version","claims_junior");--> statement-breakpoint
CREATE INDEX "classifications_experience_idx" ON "classifications" USING btree ("classifier_version","minimum_experience_months");--> statement-breakpoint
CREATE INDEX "classifications_family_idx" ON "classifications" USING btree ("classifier_version","job_family");--> statement-breakpoint
CREATE INDEX "daily_metrics_lookup_idx" ON "daily_metrics" USING btree ("dataset_id","metric_key","metric_version","job_family","technology_slug","region_code","department_code","commune_code");--> statement-breakpoint
CREATE INDEX "daily_metrics_period_idx" ON "daily_metrics" USING btree ("metric_key","period_end" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "data_quality_events_open_idx" ON "data_quality_events" USING btree ("severity","created_at" DESC NULLS LAST) WHERE "data_quality_events"."resolved_at" is null;--> statement-breakpoint
CREATE INDEX "ingestion_runs_source_date_idx" ON "ingestion_runs" USING btree ("source_id","business_date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ingestion_runs_status_idx" ON "ingestion_runs" USING btree ("status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "ingestion_runs_one_active_scope_idx" ON "ingestion_runs" USING btree ("source_id","business_date","query_set_version","mode") WHERE "ingestion_runs"."status" in ('queued', 'running', 'validating', 'aggregating', 'publishing');--> statement-breakpoint
CREATE INDEX "insights_status_published_idx" ON "insights" USING btree ("status","published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "offer_snapshot_technologies_tech_idx" ON "offer_snapshot_technologies" USING btree ("technology_id","snapshot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "offer_snapshots_one_current_idx" ON "offer_snapshots" USING btree ("offer_id") WHERE "offer_snapshots"."valid_to" is null;--> statement-breakpoint
CREATE INDEX "offer_snapshots_published_idx" ON "offer_snapshots" USING btree ("source_published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "offer_snapshots_geo_idx" ON "offer_snapshots" USING btree ("region_code","department_code","commune_code");--> statement-breakpoint
CREATE INDEX "offer_snapshots_contract_idx" ON "offer_snapshots" USING btree ("contract_kind","source_published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "offers_active_last_seen_idx" ON "offers" USING btree ("last_seen_at" DESC NULLS LAST) WHERE "offers"."closed_at" is null;--> statement-breakpoint
CREATE INDEX "offers_closed_idx" ON "offers" USING btree ("closed_at" DESC NULLS LAST) WHERE "offers"."closed_at" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "published_datasets_one_current_idx" ON "published_datasets" USING btree ("is_current") WHERE "published_datasets"."is_current" = true;--> statement-breakpoint
CREATE VIEW "public"."current_public_offer_classifications" AS (
  select
    o.id as offer_id,
    o.source_id,
    o.external_id,
    o.first_seen_at,
    o.last_seen_at,
    o.closed_at,
    s.id as snapshot_id,
    s.title,
    s.company_name,
    s.location_label,
    s.commune_code,
    s.department_code,
    s.region_code,
    s.contract_kind,
    s.source_published_at,
    s.application_url,
    c.id as classification_id,
    c.classifier_version,
    c.status as classification_status,
    c.claims_junior,
    c.beginner_friendly,
    c.contradictory_junior,
    c.minimum_experience_months,
    c.salary_transparent,
    c.remote_mode,
    c.job_family,
    case
      when c.status = 'ambiguous' then 'ambiguous'
      when c.status = 'unclassified' then 'unknown'
      when c.status = 'classified' and c.contradictory_junior = true then 'contradictory'
      when c.status = 'classified' and c.beginner_friendly = true then 'beginner_friendly'
      when c.status = 'classified' and c.claims_junior = true and (c.beginner_friendly is null or c.contradictory_junior is null) then 'junior_unresolved'
      when c.status = 'classified' and c.claims_junior = true and c.beginner_friendly = false and c.contradictory_junior = false then 'other_junior'
      when c.status = 'classified' and c.claims_junior = false then 'not_explicitly_junior'
      else 'unknown'
    end as classification_segment
  from offers o
  join offer_snapshots s on s.offer_id = o.id and s.valid_to is null
  join classifications c on c.snapshot_id = s.id
  join published_datasets d on d.is_current = true and d.classifier_version = c.classifier_version
);
