CREATE TABLE "ingestion_quarantine_entries" (
	"ingestion_run_query_id" uuid NOT NULL,
	"range_start" integer NOT NULL,
	"item_ordinal" integer NOT NULL,
	"issues" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ingestion_quarantine_entries_ingestion_run_query_id_range_start_item_ordinal_pk" PRIMARY KEY("ingestion_run_query_id","range_start","item_ordinal"),
	CONSTRAINT "ingestion_quarantine_entries_ordinal_check" CHECK ("ingestion_quarantine_entries"."item_ordinal" >= 0),
	CONSTRAINT "ingestion_quarantine_entries_issues_check" CHECK (jsonb_typeof("ingestion_quarantine_entries"."issues") = 'array')
);
--> statement-breakpoint
CREATE TABLE "ingestion_query_pages" (
	"ingestion_run_query_id" uuid NOT NULL,
	"range_start" integer NOT NULL,
	"next_range_start" integer,
	"is_terminal" boolean NOT NULL,
	"source_total" integer NOT NULL,
	"received_count" integer NOT NULL,
	"valid_count" integer NOT NULL,
	"quarantined_count" integer NOT NULL,
	"in_perimeter_count" integer NOT NULL,
	"warning_count" integer NOT NULL,
	"committed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ingestion_query_pages_ingestion_run_query_id_range_start_pk" PRIMARY KEY("ingestion_run_query_id","range_start"),
	CONSTRAINT "ingestion_query_pages_range_check" CHECK ("ingestion_query_pages"."range_start" >= 0),
	CONSTRAINT "ingestion_query_pages_next_range_check" CHECK ("ingestion_query_pages"."next_range_start" is null or "ingestion_query_pages"."next_range_start" > "ingestion_query_pages"."range_start"),
	CONSTRAINT "ingestion_query_pages_counts_check" CHECK ("ingestion_query_pages"."received_count" >= 0 and "ingestion_query_pages"."valid_count" >= 0 and "ingestion_query_pages"."quarantined_count" >= 0 and "ingestion_query_pages"."in_perimeter_count" >= 0 and "ingestion_query_pages"."in_perimeter_count" <= "ingestion_query_pages"."valid_count" and "ingestion_query_pages"."warning_count" >= 0 and "ingestion_query_pages"."received_count" = "ingestion_query_pages"."valid_count" + "ingestion_query_pages"."quarantined_count"),
	CONSTRAINT "ingestion_query_pages_terminal_check" CHECK ("ingestion_query_pages"."is_terminal" = true or "ingestion_query_pages"."next_range_start" is not null)
);
--> statement-breakpoint
CREATE TABLE "ingestion_run_offer_sightings" (
	"ingestion_run_query_id" uuid NOT NULL,
	"offer_id" uuid NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"offer_created" boolean NOT NULL,
	"snapshot_created" boolean NOT NULL,
	CONSTRAINT "ingestion_run_offer_sightings_ingestion_run_query_id_offer_id_pk" PRIMARY KEY("ingestion_run_query_id","offer_id")
);
--> statement-breakpoint
CREATE TABLE "published_dataset_offers" (
	"dataset_id" uuid NOT NULL,
	"offer_id" uuid NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"classification_id" uuid NOT NULL,
	CONSTRAINT "published_dataset_offers_dataset_id_offer_id_pk" PRIMARY KEY("dataset_id","offer_id"),
	CONSTRAINT "published_dataset_offers_snapshot_unique" UNIQUE("dataset_id","snapshot_id"),
	CONSTRAINT "published_dataset_offers_classification_unique" UNIQUE("dataset_id","classification_id")
);
--> statement-breakpoint
DROP VIEW "public"."current_public_offer_classifications";--> statement-breakpoint
ALTER TABLE "ingestion_quarantine_entries" ADD CONSTRAINT "ingestion_quarantine_entries_ingestion_run_query_id_ingestion_run_queries_id_fk" FOREIGN KEY ("ingestion_run_query_id") REFERENCES "public"."ingestion_run_queries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_query_pages" ADD CONSTRAINT "ingestion_query_pages_ingestion_run_query_id_ingestion_run_queries_id_fk" FOREIGN KEY ("ingestion_run_query_id") REFERENCES "public"."ingestion_run_queries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_run_offer_sightings" ADD CONSTRAINT "ingestion_run_offer_sightings_ingestion_run_query_id_ingestion_run_queries_id_fk" FOREIGN KEY ("ingestion_run_query_id") REFERENCES "public"."ingestion_run_queries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_run_offer_sightings" ADD CONSTRAINT "ingestion_run_offer_sightings_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_run_offer_sightings" ADD CONSTRAINT "ingestion_run_offer_sightings_snapshot_id_offer_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."offer_snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_dataset_offers" ADD CONSTRAINT "published_dataset_offers_dataset_id_published_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."published_datasets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_dataset_offers" ADD CONSTRAINT "published_dataset_offers_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_dataset_offers" ADD CONSTRAINT "published_dataset_offers_snapshot_id_offer_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."offer_snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_dataset_offers" ADD CONSTRAINT "published_dataset_offers_classification_id_classifications_id_fk" FOREIGN KEY ("classification_id") REFERENCES "public"."classifications"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ingestion_sightings_offer_idx" ON "ingestion_run_offer_sightings" USING btree ("offer_id","ingestion_run_query_id");--> statement-breakpoint
ALTER TABLE "published_datasets" ADD CONSTRAINT "published_datasets_lifecycle_check" CHECK ((("published_datasets"."status" in ('draft', 'validated') and "published_datasets"."is_current" = false and "published_datasets"."published_at" is null) or ("published_datasets"."status" = 'published' and "published_datasets"."published_at" is not null) or ("published_datasets"."status" = 'withdrawn' and "published_datasets"."is_current" = false and "published_datasets"."published_at" is not null)));--> statement-breakpoint
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
  from published_datasets d
  join published_dataset_offers membership on membership.dataset_id = d.id
  join offers o on o.id = membership.offer_id
  join offer_snapshots s on s.id = membership.snapshot_id
  join classifications c on c.id = membership.classification_id
  where d.is_current = true
);