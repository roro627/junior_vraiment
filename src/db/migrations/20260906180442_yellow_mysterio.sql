ALTER TABLE "published_dataset_offers" ADD COLUMN "job_families" text[] DEFAULT '{}'::text[] NOT NULL;
--> statement-breakpoint
-- Freeze the associations currently used by public reads before future title changes.
-- This adds provenance; snapshot/classification references and KPI rows are untouched.
UPDATE published_dataset_offers membership
SET job_families = ARRAY(
  SELECT DISTINCT family.key
  FROM offer_query_matches matched
  JOIN source_queries query ON query.id = matched.source_query_id
  CROSS JOIN LATERAL unnest(coalesce(matched.matched_job_families, query.job_families)) family(key)
  WHERE matched.offer_id = membership.offer_id
    AND query.query_set_version = dataset.query_set_version
  ORDER BY family.key
)
FROM published_datasets dataset
WHERE dataset.id = membership.dataset_id;
