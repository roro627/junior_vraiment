CREATE OR REPLACE VIEW "public"."current_public_offer_classifications" AS (
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
      when d.metric_versions->>'junior_contradiction_rate' = 'junior-contradiction-2.0.0'
        and c.junior_observation_status = 'resolved' and c.junior_observation_contradictory = true then 'contradictory'
      when c.status = 'ambiguous' then 'ambiguous'
      when c.status = 'unclassified' then 'unknown'
      when c.status = 'classified' and c.contradictory_junior = true then 'contradictory'
      when c.status = 'classified' and c.beginner_friendly = true then 'beginner_friendly'
      when c.status = 'classified' and c.claims_junior = true and (c.beginner_friendly is null or c.contradictory_junior is null) then 'junior_unresolved'
      when c.status = 'classified' and c.claims_junior = true and c.beginner_friendly = false and c.contradictory_junior = false then 'other_junior'
      when c.status = 'classified' and c.claims_junior = false then 'not_explicitly_junior'
      else 'unknown'
    end as classification_segment,
    c.junior_observation_version,
    c.junior_observation_status,
    c.junior_observation_contradictory
  from published_datasets d
  join published_dataset_offers membership on membership.dataset_id = d.id
  join offers o on o.id = membership.offer_id
  join offer_snapshots s on s.id = membership.snapshot_id
  join classifications c on c.id = membership.classification_id
  where d.is_current = true
);
