import { createHash, randomUUID } from "node:crypto";

import type { NeonQueryFunction } from "@neondatabase/serverless";

import type { ClassificationResult } from "@/domain/classification/types";

const TAXONOMY_JOBS_VERSION = "jobs-1.0.0";
const TAXONOMY_TECHNOLOGIES_VERSION = "technologies-1.2.0";

type StoreClassificationInput = {
  sql: NeonQueryFunction<false, false>;
  snapshotId: string;
  classification: ClassificationResult;
  classifiedAt: Date;
};

function createClassificationResultHash(
  classification: ClassificationResult,
): string {
  return createHash("sha256")
    .update(JSON.stringify(classification))
    .digest("hex");
}

export async function storeClassification({
  sql,
  snapshotId,
  classification,
  classifiedAt,
}: StoreClassificationInput): Promise<boolean> {
  const classificationId = randomUUID();
  const warnings = JSON.stringify(classification.warnings);
  const technologySlugs = JSON.stringify(
    classification.technologySlugs.map((slug) => ({ slug })),
  );
  const evidence = JSON.stringify(
    classification.evidence.map((item, ordinal) => ({
      evidence_kind: item.kind,
      rule_id: item.ruleId,
      source_field: item.field,
      excerpt: item.excerpt,
      start_offset: item.start,
      end_offset: item.end,
      normalized_value: item.normalizedValue ?? null,
      ordinal,
    })),
  );
  const rows = await sql`
    with inserted_classification as (
      insert into classifications (
        id,
        snapshot_id,
        classifier_version,
        taxonomy_jobs_version,
        taxonomy_technologies_version,
        status,
        claims_junior,
        beginner_friendly,
        contradictory_junior,
        minimum_experience_months,
        salary_transparent,
        remote_mode,
        rule_ids,
        warnings,
        result_hash,
        classified_at
      ) values (
        ${classificationId},
        ${snapshotId},
        ${classification.classifierVersion},
        ${TAXONOMY_JOBS_VERSION},
        ${TAXONOMY_TECHNOLOGIES_VERSION},
        ${classification.status},
        ${classification.claimsJunior},
        ${classification.beginnerFriendly},
        ${classification.contradictoryJunior},
        ${classification.minimumExperienceMonths},
        ${classification.salaryTransparent},
        ${classification.remoteMode},
        ${classification.ruleIds},
        ${warnings}::jsonb,
        ${createClassificationResultHash(classification)},
        ${classifiedAt}
      )
      on conflict (snapshot_id, classifier_version) do nothing
      returning id
    ), inserted_evidence as (
      insert into classification_evidence (
        classification_id,
        evidence_kind,
        rule_id,
        source_field,
        excerpt,
        start_offset,
        end_offset,
        normalized_value,
        ordinal
      )
      select
        inserted_classification.id,
        item.evidence_kind,
        item.rule_id,
        item.source_field,
        item.excerpt,
        item.start_offset,
        item.end_offset,
        item.normalized_value,
        item.ordinal
      from inserted_classification
      cross join jsonb_to_recordset(${evidence}::jsonb) as item(
        evidence_kind text,
        rule_id text,
        source_field text,
        excerpt text,
        start_offset integer,
        end_offset integer,
        normalized_value text,
        ordinal integer
      )
      returning id, classification_id, evidence_kind, normalized_value
    ), inserted_technologies as (
      insert into offer_snapshot_technologies (
        snapshot_id,
        classification_id,
        technology_id,
        mention_kind,
        confidence,
        evidence_id
      )
      select
        ${snapshotId},
        inserted_classification.id,
        technology.id,
        'mentioned',
        1,
        evidence.id
      from inserted_classification
      cross join jsonb_to_recordset(${technologySlugs}::jsonb) as item(slug text)
      join technologies technology
        on technology.slug = item.slug
        and technology.taxonomy_version = ${TAXONOMY_TECHNOLOGIES_VERSION}
      left join inserted_evidence evidence
        on evidence.classification_id = inserted_classification.id
        and evidence.evidence_kind = 'technology'
        and evidence.normalized_value = item.slug
      returning technology_id
    )
    select
      exists(select 1 from inserted_classification) as "classificationCreated",
      (select count(*)::integer from inserted_evidence) as "evidenceCount",
      (select count(*)::integer from inserted_technologies) as "technologyCount"
  `;
  const row = rows.at(0);

  if (
    !row ||
    typeof row["classificationCreated"] !== "boolean" ||
    typeof row["evidenceCount"] !== "number" ||
    typeof row["technologyCount"] !== "number"
  ) {
    throw new Error("Le stockage de la classification a échoué.");
  }

  if (
    row["classificationCreated"] &&
    row["evidenceCount"] !== classification.evidence.length
  ) {
    throw new Error(
      "Toutes les preuves de classification doivent être stockées.",
    );
  }

  if (
    row["classificationCreated"] &&
    row["technologyCount"] !== classification.technologySlugs.length
  ) {
    throw new Error(
      "Toutes les technologies détectées doivent être reliées à la classification.",
    );
  }

  return row["classificationCreated"];
}
