DROP VIEW "public"."current_public_offer_classifications";--> statement-breakpoint
ALTER TABLE "ingestion_runs" ADD COLUMN "attempt" integer;--> statement-breakpoint
WITH ranked_attempts AS (
	SELECT
		id,
		row_number() OVER (
			PARTITION BY source_id, business_date, query_set_version, mode
			ORDER BY created_at, id
		)::integer AS attempt
	FROM "ingestion_runs"
)
UPDATE "ingestion_runs" AS run
SET "attempt" = ranked_attempts.attempt
FROM ranked_attempts
WHERE run.id = ranked_attempts.id;--> statement-breakpoint
ALTER TABLE "ingestion_runs" ALTER COLUMN "attempt" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "ingestion_runs" ALTER COLUMN "attempt" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ingestion_runs" ADD CONSTRAINT "ingestion_runs_scope_attempt_unique" UNIQUE("source_id","business_date","query_set_version","mode","attempt");--> statement-breakpoint
ALTER TABLE "ingestion_runs" ADD CONSTRAINT "ingestion_runs_attempt_check" CHECK ("ingestion_runs"."attempt" >= 1);--> statement-breakpoint
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
  join published_datasets d
    on d.is_current = true
   and d.source_id = o.source_id
   and d.classifier_version = c.classifier_version
   and exists (
     select 1
     from offer_query_matches oqm
     join source_queries sq on sq.id = oqm.source_query_id
     where oqm.offer_id = o.id
       and sq.query_set_version = d.query_set_version
       and sq.enabled = true
   )
);
