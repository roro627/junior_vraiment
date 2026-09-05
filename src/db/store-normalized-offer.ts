import type { NeonQueryFunction } from "@neondatabase/serverless";

import type { NormalizedOffer } from "@/domain/offers/normalized-offer";
import { createOfferContentHash } from "@/domain/offers/snapshot";

type StoreNormalizedOfferInput = {
  sql: NeonQueryFunction<false, false>;
  sourceId: string;
  offer: NormalizedOffer;
  observedAt: Date;
  ingestionRunId?: string;
  ingestionRunQueryId?: string;
  rawPayloadRetentionDays: number;
};

export type StoredOfferSnapshot = {
  offerId: string;
  snapshotId: string;
  offerCreated: boolean;
  snapshotCreated: boolean;
};

export async function storeNormalizedOffer({
  sql,
  sourceId,
  offer,
  observedAt,
  ingestionRunId,
  ingestionRunQueryId,
  rawPayloadRetentionDays,
}: StoreNormalizedOfferInput): Promise<StoredOfferSnapshot> {
  const contentHash = createOfferContentHash(offer);
  const salaryJson = offer.salary ? JSON.stringify(offer.salary) : null;
  const rawPayloadJson =
    offer.rawPayload === null || offer.rawPayload === undefined
      ? null
      : JSON.stringify(offer.rawPayload);
  const rawPayloadExpiresAt = rawPayloadJson
    ? new Date(
        observedAt.getTime() + rawPayloadRetentionDays * 24 * 60 * 60 * 1_000,
      )
    : null;

  const rows = await sql`
    with existing_offer as materialized (
      select id
      from offers
      where source_id = ${sourceId}
        and external_id = ${offer.externalId}
    ), upserted_offer as (
      insert into offers (
        source_id, external_id, first_seen_at, last_seen_at, updated_at
      ) values (
        ${sourceId}, ${offer.externalId}, ${observedAt}, ${observedAt}, ${observedAt}
      )
      on conflict (source_id, external_id) do update set
        last_seen_at = greatest(offers.last_seen_at, excluded.last_seen_at),
        missing_since = null,
        closed_at = null,
        reopened_count = offers.reopened_count +
          case when offers.closed_at is null then 0 else 1 end,
        updated_at = excluded.updated_at
      returning id
    ), current_same_snapshot as (
      select id
      from offer_snapshots
      where offer_id = (select id from upserted_offer)
        and valid_to is null
        and content_hash = ${contentHash}
    ), closed_snapshot as (
      update offer_snapshots
      set valid_to = ${observedAt}
      where offer_id = (select id from upserted_offer)
        and valid_to is null
        and content_hash <> ${contentHash}
      returning id
    ), inserted_snapshot as (
      insert into offer_snapshots (
        offer_id,
        ingestion_run_id,
        content_hash,
        title,
        description_text,
        company_name,
        source_published_at,
        source_updated_at,
        location_label,
        commune_code,
        department_code,
        region_code,
        latitude,
        longitude,
        contract_source_code,
        contract_kind,
        contract_label,
        structured_experience_required,
        structured_experience_label,
        salary_data,
        application_url,
        source_url,
        raw_payload,
        raw_payload_expires_at,
        valid_from
      )
      select
        id,
        ${ingestionRunId ?? null},
        ${contentHash},
        ${offer.title},
        ${offer.descriptionText},
        ${offer.companyName},
        ${offer.publishedAt},
        ${offer.updatedAt},
        ${offer.location.label},
        ${offer.location.communeCode},
        ${offer.location.departmentCode},
        ${offer.location.regionCode},
        ${offer.location.latitude},
        ${offer.location.longitude},
        ${offer.contract.sourceCode},
        ${offer.contract.normalized},
        ${offer.contract.label},
        ${offer.structuredExperience.required},
        ${offer.structuredExperience.label},
        ${salaryJson}::jsonb,
        ${offer.applicationUrl},
        ${offer.sourceUrl},
        ${rawPayloadJson}::jsonb,
        ${rawPayloadExpiresAt},
        ${observedAt}
      from upserted_offer
      where not exists (select 1 from current_same_snapshot)
        and (select count(*) from closed_snapshot) >= 0
      returning id
    ), stored_result as (
    select
      upserted_offer.id as "offerId",
      coalesce(
        (select id from inserted_snapshot),
        (select id from current_same_snapshot)
      ) as "snapshotId",
      not exists(select 1 from existing_offer) as "offerCreated",
      exists(select 1 from inserted_snapshot) as "snapshotCreated"
    from upserted_offer
    ), recorded_sighting as (
      insert into ingestion_run_offer_sightings (
        ingestion_run_query_id,
        offer_id,
        snapshot_id,
        observed_at,
        offer_created,
        snapshot_created
      )
      select
        ${ingestionRunQueryId ?? null},
        "offerId",
        "snapshotId",
        ${observedAt},
        "offerCreated",
        "snapshotCreated"
      from stored_result
      where ${ingestionRunQueryId ?? null}::uuid is not null
      on conflict (ingestion_run_query_id, offer_id) do update set
        snapshot_id = excluded.snapshot_id,
        observed_at = greatest(
          ingestion_run_offer_sightings.observed_at,
          excluded.observed_at
        ),
        offer_created = ingestion_run_offer_sightings.offer_created
          or excluded.offer_created,
        snapshot_created = ingestion_run_offer_sightings.snapshot_created
          or excluded.snapshot_created
      returning offer_id
    )
    select *
    from stored_result
    where (select count(*) from recorded_sighting) >= 0
  `;
  const row = rows.at(0);

  if (
    !row ||
    typeof row["offerId"] !== "string" ||
    typeof row["snapshotId"] !== "string" ||
    typeof row["offerCreated"] !== "boolean" ||
    typeof row["snapshotCreated"] !== "boolean"
  ) {
    throw new Error(
      "Le stockage de l’offre n’a pas retourné de snapshot valide.",
    );
  }

  return {
    offerId: row["offerId"],
    snapshotId: row["snapshotId"],
    offerCreated: row["offerCreated"],
    snapshotCreated: row["snapshotCreated"],
  };
}
