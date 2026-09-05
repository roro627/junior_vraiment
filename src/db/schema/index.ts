import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  pgView,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

type JsonObject = Record<string, unknown>;
type JsonArray = unknown[];

const emptyJsonObject = sql`'{}'::jsonb`;
const emptyJsonArray = sql`'[]'::jsonb`;
const emptyTextArray = sql`'{}'::text[]`;

export const sources = pgTable("sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  attributionUrl: text("attribution_url").notNull(),
  termsUrl: text("terms_url"),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sourceQueries = pgTable(
  "source_queries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "restrict" }),
    queryKey: text("query_key").notNull(),
    querySetVersion: text("query_set_version").notNull(),
    label: text("label").notNull(),
    definition: jsonb("definition").$type<JsonObject>().notNull(),
    jobFamilies: text("job_families").array().notNull().default(emptyTextArray),
    territoryScope: text("territory_scope"),
    enabled: boolean("enabled").notNull().default(true),
    validFrom: timestamp("valid_from", { withTimezone: true })
      .notNull()
      .defaultNow(),
    validTo: timestamp("valid_to", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("source_queries_source_key_version_unique").on(
      table.sourceId,
      table.queryKey,
      table.querySetVersion,
    ),
    check(
      "source_queries_definition_object_check",
      sql`jsonb_typeof(${table.definition}) = 'object'`,
    ),
    check(
      "source_queries_validity_check",
      sql`${table.validTo} is null or ${table.validTo} >= ${table.validFrom}`,
    ),
  ],
);

export const ingestionRuns = pgTable(
  "ingestion_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "restrict" }),
    businessDate: date("business_date").notNull(),
    querySetVersion: text("query_set_version").notNull(),
    mode: text("mode").notNull().default("full"),
    attempt: integer("attempt").notNull().default(1),
    status: text("status").notNull().default("queued"),
    triggerRunId: text("trigger_run_id"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    requestsCount: integer("requests_count").notNull().default(0),
    offersReceived: integer("offers_received").notNull().default(0),
    offersValid: integer("offers_valid").notNull().default(0),
    offersQuarantined: integer("offers_quarantined").notNull().default(0),
    offersNew: integer("offers_new").notNull().default(0),
    offersUpdated: integer("offers_updated").notNull().default(0),
    offersMarkedMissing: integer("offers_marked_missing").notNull().default(0),
    offersClosed: integer("offers_closed"),
    qualitySummary: jsonb("quality_summary")
      .$type<JsonObject>()
      .notNull()
      .default(emptyJsonObject),
    errorSummary: jsonb("error_summary")
      .$type<JsonObject>()
      .notNull()
      .default(emptyJsonObject),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ingestion_runs_source_date_idx").on(
      table.sourceId,
      table.businessDate.desc(),
    ),
    uniqueIndex("ingestion_runs_trigger_run_unique_idx")
      .on(table.triggerRunId)
      .where(sql`${table.triggerRunId} is not null`),
    unique("ingestion_runs_scope_attempt_unique").on(
      table.sourceId,
      table.businessDate,
      table.querySetVersion,
      table.mode,
      table.attempt,
    ),
    index("ingestion_runs_status_idx").on(table.status, table.createdAt.desc()),
    uniqueIndex("ingestion_runs_one_active_scope_idx")
      .on(table.sourceId, table.businessDate, table.querySetVersion, table.mode)
      .where(
        sql`${table.status} in ('queued', 'running', 'validating', 'aggregating', 'publishing')`,
      ),
    check(
      "ingestion_runs_mode_check",
      sql`${table.mode} in ('full', 'limited', 'reclassify', 'health')`,
    ),
    check(
      "ingestion_runs_status_check",
      sql`${table.status} in ('queued', 'running', 'validating', 'aggregating', 'publishing', 'succeeded', 'partial', 'failed', 'cancelled')`,
    ),
    check(
      "ingestion_runs_counts_check",
      sql`${table.requestsCount} >= 0 and ${table.offersReceived} >= 0 and ${table.offersValid} >= 0 and ${table.offersQuarantined} >= 0 and ${table.offersNew} >= 0 and ${table.offersUpdated} >= 0 and ${table.offersMarkedMissing} >= 0 and (${table.offersClosed} is null or ${table.offersClosed} >= 0)`,
    ),
    check("ingestion_runs_attempt_check", sql`${table.attempt} >= 1`),
    check(
      "ingestion_runs_dates_check",
      sql`${table.finishedAt} is null or ${table.startedAt} is null or ${table.finishedAt} >= ${table.startedAt}`,
    ),
    check(
      "ingestion_runs_json_check",
      sql`jsonb_typeof(${table.qualitySummary}) = 'object' and jsonb_typeof(${table.errorSummary}) = 'object'`,
    ),
  ],
);

export const ingestionRunQueries = pgTable(
  "ingestion_run_queries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ingestionRunId: uuid("ingestion_run_id")
      .notNull()
      .references(() => ingestionRuns.id, { onDelete: "cascade" }),
    sourceQueryId: uuid("source_query_id")
      .notNull()
      .references(() => sourceQueries.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("queued"),
    pagesReceived: integer("pages_received").notNull().default(0),
    offersReceived: integer("offers_received").notNull().default(0),
    requestCount: integer("request_count").notNull().default(0),
    checkpoint: jsonb("checkpoint")
      .$type<JsonObject>()
      .notNull()
      .default(emptyJsonObject),
    errorSummary: jsonb("error_summary")
      .$type<JsonObject>()
      .notNull()
      .default(emptyJsonObject),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [
    unique("ingestion_run_queries_run_query_unique").on(
      table.ingestionRunId,
      table.sourceQueryId,
    ),
    check(
      "ingestion_run_queries_status_check",
      sql`${table.status} in ('queued', 'running', 'succeeded', 'partial', 'failed', 'skipped')`,
    ),
    check(
      "ingestion_run_queries_counts_check",
      sql`${table.pagesReceived} >= 0 and ${table.offersReceived} >= 0 and ${table.requestCount} >= 0`,
    ),
    check(
      "ingestion_run_queries_json_check",
      sql`jsonb_typeof(${table.checkpoint}) = 'object' and jsonb_typeof(${table.errorSummary}) = 'object'`,
    ),
  ],
);

export const ingestionQueryPages = pgTable(
  "ingestion_query_pages",
  {
    ingestionRunQueryId: uuid("ingestion_run_query_id")
      .notNull()
      .references(() => ingestionRunQueries.id, { onDelete: "cascade" }),
    rangeStart: integer("range_start").notNull(),
    nextRangeStart: integer("next_range_start"),
    isTerminal: boolean("is_terminal").notNull(),
    sourceTotal: integer("source_total").notNull(),
    receivedCount: integer("received_count").notNull(),
    validCount: integer("valid_count").notNull(),
    quarantinedCount: integer("quarantined_count").notNull(),
    inPerimeterCount: integer("in_perimeter_count").notNull(),
    warningCount: integer("warning_count").notNull(),
    committedAt: timestamp("committed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.ingestionRunQueryId, table.rangeStart] }),
    check("ingestion_query_pages_range_check", sql`${table.rangeStart} >= 0`),
    check(
      "ingestion_query_pages_next_range_check",
      sql`${table.nextRangeStart} is null or ${table.nextRangeStart} > ${table.rangeStart}`,
    ),
    check(
      "ingestion_query_pages_counts_check",
      sql`${table.receivedCount} >= 0 and ${table.validCount} >= 0 and ${table.quarantinedCount} >= 0 and ${table.inPerimeterCount} >= 0 and ${table.inPerimeterCount} <= ${table.validCount} and ${table.warningCount} >= 0 and ${table.receivedCount} = ${table.validCount} + ${table.quarantinedCount}`,
    ),
    check(
      "ingestion_query_pages_terminal_check",
      sql`${table.isTerminal} = true or ${table.nextRangeStart} is not null`,
    ),
  ],
);

export const ingestionQuarantineEntries = pgTable(
  "ingestion_quarantine_entries",
  {
    ingestionRunQueryId: uuid("ingestion_run_query_id")
      .notNull()
      .references(() => ingestionRunQueries.id, { onDelete: "cascade" }),
    rangeStart: integer("range_start").notNull(),
    itemOrdinal: integer("item_ordinal").notNull(),
    issues: jsonb("issues").$type<JsonArray>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.ingestionRunQueryId, table.rangeStart, table.itemOrdinal],
    }),
    check(
      "ingestion_quarantine_entries_ordinal_check",
      sql`${table.itemOrdinal} >= 0`,
    ),
    check(
      "ingestion_quarantine_entries_issues_check",
      sql`jsonb_typeof(${table.issues}) = 'array'`,
    ),
  ],
);

export const offers = pgTable(
  "offers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "restrict" }),
    externalId: text("external_id").notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
    missingSince: timestamp("missing_since", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    reopenedCount: integer("reopened_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("offers_source_external_unique").on(
      table.sourceId,
      table.externalId,
    ),
    index("offers_active_last_seen_idx")
      .on(table.lastSeenAt.desc())
      .where(sql`${table.closedAt} is null`),
    index("offers_closed_idx")
      .on(table.closedAt.desc())
      .where(sql`${table.closedAt} is not null`),
    check(
      "offers_seen_dates_check",
      sql`${table.lastSeenAt} >= ${table.firstSeenAt}`,
    ),
    check(
      "offers_closed_date_check",
      sql`${table.closedAt} is null or ${table.closedAt} >= ${table.firstSeenAt}`,
    ),
    check("offers_reopened_count_check", sql`${table.reopenedCount} >= 0`),
  ],
);

export const offerQueryMatches = pgTable(
  "offer_query_matches",
  {
    offerId: uuid("offer_id")
      .notNull()
      .references(() => offers.id, { onDelete: "cascade" }),
    sourceQueryId: uuid("source_query_id")
      .notNull()
      .references(() => sourceQueries.id, { onDelete: "cascade" }),
    firstMatchedAt: timestamp("first_matched_at", {
      withTimezone: true,
    }).notNull(),
    lastMatchedAt: timestamp("last_matched_at", {
      withTimezone: true,
    }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.offerId, table.sourceQueryId] }),
    check(
      "offer_query_matches_dates_check",
      sql`${table.lastMatchedAt} >= ${table.firstMatchedAt}`,
    ),
  ],
);

export const offerSnapshots = pgTable(
  "offer_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    offerId: uuid("offer_id")
      .notNull()
      .references(() => offers.id, { onDelete: "cascade" }),
    ingestionRunId: uuid("ingestion_run_id").references(
      () => ingestionRuns.id,
      {
        onDelete: "set null",
      },
    ),
    contentHash: text("content_hash").notNull(),
    title: text("title").notNull(),
    descriptionText: text("description_text").notNull(),
    companyName: text("company_name"),
    sourcePublishedAt: timestamp("source_published_at", { withTimezone: true }),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    locationLabel: text("location_label"),
    communeCode: text("commune_code"),
    departmentCode: text("department_code"),
    regionCode: text("region_code"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    contractSourceCode: text("contract_source_code"),
    contractKind: text("contract_kind").notNull().default("unknown"),
    contractLabel: text("contract_label"),
    structuredExperienceRequired: boolean("structured_experience_required"),
    structuredExperienceLabel: text("structured_experience_label"),
    salaryData: jsonb("salary_data").$type<JsonObject>(),
    applicationUrl: text("application_url"),
    sourceUrl: text("source_url"),
    rawPayload: jsonb("raw_payload").$type<unknown>(),
    rawPayloadExpiresAt: timestamp("raw_payload_expires_at", {
      withTimezone: true,
    }),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
    validTo: timestamp("valid_to", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("offer_snapshots_offer_hash_idx").on(
      table.offerId,
      table.contentHash,
    ),
    uniqueIndex("offer_snapshots_one_current_idx")
      .on(table.offerId)
      .where(sql`${table.validTo} is null`),
    index("offer_snapshots_published_idx").on(table.sourcePublishedAt.desc()),
    index("offer_snapshots_geo_idx").on(
      table.regionCode,
      table.departmentCode,
      table.communeCode,
    ),
    index("offer_snapshots_contract_idx").on(
      table.contractKind,
      table.sourcePublishedAt.desc(),
    ),
    check(
      "offer_snapshots_hash_length_check",
      sql`char_length(${table.contentHash}) >= 32`,
    ),
    check(
      "offer_snapshots_validity_check",
      sql`${table.validTo} is null or ${table.validTo} >= ${table.validFrom}`,
    ),
    check(
      "offer_snapshots_latitude_check",
      sql`${table.latitude} is null or ${table.latitude} between -90 and 90`,
    ),
    check(
      "offer_snapshots_longitude_check",
      sql`${table.longitude} is null or ${table.longitude} between -180 and 180`,
    ),
    check(
      "offer_snapshots_contract_check",
      sql`${table.contractKind} in ('cdi', 'cdd', 'interim', 'alternance', 'internship', 'freelance', 'public', 'other', 'unknown')`,
    ),
    check(
      "offer_snapshots_salary_object_check",
      sql`${table.salaryData} is null or jsonb_typeof(${table.salaryData}) = 'object'`,
    ),
    check(
      "offer_snapshots_raw_payload_expiry_check",
      sql`(${table.rawPayload} is null and ${table.rawPayloadExpiresAt} is null) or (${table.rawPayload} is not null and ${table.rawPayloadExpiresAt} is not null)`,
    ),
  ],
);

export const ingestionRunOfferSightings = pgTable(
  "ingestion_run_offer_sightings",
  {
    ingestionRunQueryId: uuid("ingestion_run_query_id")
      .notNull()
      .references(() => ingestionRunQueries.id, { onDelete: "cascade" }),
    offerId: uuid("offer_id")
      .notNull()
      .references(() => offers.id, { onDelete: "cascade" }),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => offerSnapshots.id, { onDelete: "restrict" }),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    offerCreated: boolean("offer_created").notNull(),
    snapshotCreated: boolean("snapshot_created").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.ingestionRunQueryId, table.offerId] }),
    index("ingestion_sightings_offer_idx").on(
      table.offerId,
      table.ingestionRunQueryId,
    ),
  ],
);

export const classifications = pgTable(
  "classifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => offerSnapshots.id, { onDelete: "cascade" }),
    classifierVersion: text("classifier_version").notNull(),
    taxonomyJobsVersion: text("taxonomy_jobs_version").notNull(),
    taxonomyTechnologiesVersion: text(
      "taxonomy_technologies_version",
    ).notNull(),
    status: text("status").notNull(),
    claimsJunior: boolean("claims_junior"),
    beginnerFriendly: boolean("beginner_friendly"),
    contradictoryJunior: boolean("contradictory_junior"),
    minimumExperienceMonths: integer("minimum_experience_months"),
    salaryTransparent: boolean("salary_transparent").notNull().default(false),
    remoteMode: text("remote_mode").notNull().default("unknown"),
    jobFamily: text("job_family"),
    secondaryJobFamilies: text("secondary_job_families")
      .array()
      .notNull()
      .default(emptyTextArray),
    ruleIds: text("rule_ids").array().notNull().default(emptyTextArray),
    warnings: jsonb("warnings")
      .$type<JsonArray>()
      .notNull()
      .default(emptyJsonArray),
    resultHash: text("result_hash").notNull(),
    classifiedAt: timestamp("classified_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("classifications_snapshot_version_unique").on(
      table.snapshotId,
      table.classifierVersion,
    ),
    index("classifications_contradiction_idx")
      .on(table.classifierVersion, table.contradictoryJunior)
      .where(sql`${table.contradictoryJunior} is not null`),
    index("classifications_junior_idx").on(
      table.classifierVersion,
      table.claimsJunior,
    ),
    index("classifications_experience_idx").on(
      table.classifierVersion,
      table.minimumExperienceMonths,
    ),
    index("classifications_family_idx").on(
      table.classifierVersion,
      table.jobFamily,
    ),
    check(
      "classifications_status_check",
      sql`${table.status} in ('classified', 'ambiguous', 'unclassified')`,
    ),
    check(
      "classifications_experience_check",
      sql`${table.minimumExperienceMonths} is null or ${table.minimumExperienceMonths} >= 0`,
    ),
    check(
      "classifications_remote_check",
      sql`${table.remoteMode} in ('remote', 'hybrid', 'onsite', 'unknown')`,
    ),
    check(
      "classifications_warnings_array_check",
      sql`jsonb_typeof(${table.warnings}) = 'array'`,
    ),
    check(
      "classifications_beginner_check",
      sql`${table.beginnerFriendly} is null or (${table.status} = 'classified' and ${table.minimumExperienceMonths} is not null and ((${table.beginnerFriendly} = true and ${table.minimumExperienceMonths} <= 12) or (${table.beginnerFriendly} = false and ${table.minimumExperienceMonths} > 12)))`,
    ),
    check(
      "classifications_contradiction_status_check",
      sql`${table.contradictoryJunior} is null or ${table.status} = 'classified'`,
    ),
    check(
      "classifications_contradiction_true_check",
      sql`${table.contradictoryJunior} is distinct from true or (${table.claimsJunior} = true and ${table.minimumExperienceMonths} >= 24 and ${table.status} = 'classified')`,
    ),
    check(
      "classifications_contradiction_false_check",
      sql`${table.contradictoryJunior} is distinct from false or (${table.claimsJunior} = false or (${table.claimsJunior} = true and ${table.minimumExperienceMonths} is not null and ${table.minimumExperienceMonths} < 24))`,
    ),
  ],
);

export const classificationEvidence = pgTable(
  "classification_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    classificationId: uuid("classification_id")
      .notNull()
      .references(() => classifications.id, { onDelete: "cascade" }),
    evidenceKind: text("evidence_kind").notNull(),
    ruleId: text("rule_id").notNull(),
    sourceField: text("source_field").notNull(),
    excerpt: text("excerpt").notNull(),
    startOffset: integer("start_offset"),
    endOffset: integer("end_offset"),
    normalizedValue: text("normalized_value"),
    metadata: jsonb("metadata")
      .$type<JsonObject>()
      .notNull()
      .default(emptyJsonObject),
    ordinal: integer("ordinal").notNull().default(0),
  },
  (table) => [
    index("classification_evidence_classification_idx").on(
      table.classificationId,
      table.ordinal,
    ),
    check(
      "classification_evidence_kind_check",
      sql`${table.evidenceKind} in ('junior_claim', 'required_experience', 'desired_experience', 'salary', 'remote', 'technology', 'job_family', 'conflict', 'exclusion', 'ambiguity', 'other')`,
    ),
    check(
      "classification_evidence_offsets_check",
      sql`${table.startOffset} is null or ${table.endOffset} is null or (${table.startOffset} >= 0 and ${table.endOffset} >= ${table.startOffset})`,
    ),
    check(
      "classification_evidence_metadata_check",
      sql`jsonb_typeof(${table.metadata}) = 'object'`,
    ),
    check("classification_evidence_ordinal_check", sql`${table.ordinal} >= 0`),
  ],
);

export const technologies = pgTable(
  "technologies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    label: text("label").notNull(),
    category: text("category").notNull(),
    taxonomyVersion: text("taxonomy_version").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("technologies_slug_version_unique").on(
      table.slug,
      table.taxonomyVersion,
    ),
  ],
);

export const technologyAliases = pgTable(
  "technology_aliases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    technologyId: uuid("technology_id")
      .notNull()
      .references(() => technologies.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
    matchKind: text("match_kind").notNull().default("word"),
    negativePatterns: text("negative_patterns")
      .array()
      .notNull()
      .default(emptyTextArray),
  },
  (table) => [
    unique("technology_aliases_technology_alias_kind_unique").on(
      table.technologyId,
      table.alias,
      table.matchKind,
    ),
    check(
      "technology_aliases_match_kind_check",
      sql`${table.matchKind} in ('word', 'exact', 'regex', 'case_sensitive')`,
    ),
  ],
);

export const offerSnapshotTechnologies = pgTable(
  "offer_snapshot_technologies",
  {
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => offerSnapshots.id, { onDelete: "cascade" }),
    classificationId: uuid("classification_id")
      .notNull()
      .references(() => classifications.id, { onDelete: "cascade" }),
    technologyId: uuid("technology_id")
      .notNull()
      .references(() => technologies.id, { onDelete: "restrict" }),
    mentionKind: text("mention_kind").notNull().default("mentioned"),
    confidence: numeric("confidence", {
      precision: 5,
      scale: 4,
      mode: "number",
    }),
    evidenceId: uuid("evidence_id").references(
      () => classificationEvidence.id,
      {
        onDelete: "set null",
      },
    ),
  },
  (table) => [
    primaryKey({
      columns: [table.snapshotId, table.classificationId, table.technologyId],
    }),
    index("offer_snapshot_technologies_tech_idx").on(
      table.technologyId,
      table.snapshotId,
    ),
    check(
      "offer_snapshot_technologies_mention_kind_check",
      sql`${table.mentionKind} in ('mentioned', 'required', 'preferred', 'contextual')`,
    ),
    check(
      "offer_snapshot_technologies_confidence_check",
      sql`${table.confidence} is null or ${table.confidence} between 0 and 1`,
    ),
  ],
);

export const publishedDatasets = pgTable(
  "published_datasets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    datasetVersion: text("dataset_version").notNull().unique(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "restrict" }),
    ingestionRunId: uuid("ingestion_run_id").references(
      () => ingestionRuns.id,
      {
        onDelete: "set null",
      },
    ),
    classifierVersion: text("classifier_version").notNull(),
    metricVersions: jsonb("metric_versions").$type<JsonObject>().notNull(),
    querySetVersion: text("query_set_version").notNull(),
    taxonomyVersions: jsonb("taxonomy_versions").$type<JsonObject>().notNull(),
    sourceCutoffAt: timestamp("source_cutoff_at", {
      withTimezone: true,
    }).notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    status: text("status").notNull(),
    isCurrent: boolean("is_current").notNull().default(false),
    qualitySummary: jsonb("quality_summary")
      .$type<JsonObject>()
      .notNull()
      .default(emptyJsonObject),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("published_datasets_one_current_idx")
      .on(table.isCurrent)
      .where(sql`${table.isCurrent} = true`),
    check(
      "published_datasets_status_check",
      sql`${table.status} in ('draft', 'validated', 'published', 'withdrawn')`,
    ),
    check(
      "published_datasets_json_check",
      sql`jsonb_typeof(${table.metricVersions}) = 'object' and jsonb_typeof(${table.taxonomyVersions}) = 'object' and jsonb_typeof(${table.qualitySummary}) = 'object'`,
    ),
    check(
      "published_datasets_lifecycle_check",
      sql`((${table.status} in ('draft', 'validated') and ${table.isCurrent} = false and ${table.publishedAt} is null) or (${table.status} = 'published' and ${table.publishedAt} is not null) or (${table.status} = 'withdrawn' and ${table.isCurrent} = false and ${table.publishedAt} is not null))`,
    ),
  ],
);

export const publishedDatasetOffers = pgTable(
  "published_dataset_offers",
  {
    datasetId: uuid("dataset_id")
      .notNull()
      .references(() => publishedDatasets.id, { onDelete: "cascade" }),
    offerId: uuid("offer_id")
      .notNull()
      .references(() => offers.id, { onDelete: "restrict" }),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => offerSnapshots.id, { onDelete: "restrict" }),
    classificationId: uuid("classification_id")
      .notNull()
      .references(() => classifications.id, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({ columns: [table.datasetId, table.offerId] }),
    unique("published_dataset_offers_snapshot_unique").on(
      table.datasetId,
      table.snapshotId,
    ),
    unique("published_dataset_offers_classification_unique").on(
      table.datasetId,
      table.classificationId,
    ),
  ],
);

export const dailyMetrics = pgTable(
  "daily_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    datasetId: uuid("dataset_id")
      .notNull()
      .references(() => publishedDatasets.id, { onDelete: "cascade" }),
    metricKey: text("metric_key").notNull(),
    metricVersion: text("metric_version").notNull(),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    jobFamily: text("job_family"),
    technologySlug: text("technology_slug"),
    regionCode: text("region_code"),
    departmentCode: text("department_code"),
    communeCode: text("commune_code"),
    contractKind: text("contract_kind"),
    remoteMode: text("remote_mode"),
    dimensions: jsonb("dimensions")
      .$type<JsonObject>()
      .notNull()
      .default(emptyJsonObject),
    dimensionHash: text("dimension_hash").notNull(),
    numerator: bigint("numerator", { mode: "number" }).notNull().default(0),
    denominator: bigint("denominator", { mode: "number" }).notNull().default(0),
    populationCount: bigint("population_count", { mode: "number" })
      .notNull()
      .default(0),
    unknownCount: bigint("unknown_count", { mode: "number" })
      .notNull()
      .default(0),
    ambiguousCount: bigint("ambiguous_count", { mode: "number" })
      .notNull()
      .default(0),
    valueNumeric: numeric("value_numeric", {
      precision: 12,
      scale: 8,
      mode: "number",
    }),
    coverageNumeric: numeric("coverage_numeric", {
      precision: 12,
      scale: 8,
      mode: "number",
    }),
    sampleQuality: text("sample_quality").notNull().default("normal"),
    metadata: jsonb("metadata")
      .$type<JsonObject>()
      .notNull()
      .default(emptyJsonObject),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("daily_metrics_dataset_metric_period_dimension_unique").on(
      table.datasetId,
      table.metricKey,
      table.metricVersion,
      table.periodStart,
      table.periodEnd,
      table.dimensionHash,
    ),
    index("daily_metrics_lookup_idx").on(
      table.datasetId,
      table.metricKey,
      table.metricVersion,
      table.jobFamily,
      table.technologySlug,
      table.regionCode,
      table.departmentCode,
      table.communeCode,
    ),
    index("daily_metrics_period_idx").on(
      table.metricKey,
      table.periodEnd.desc(),
    ),
    check(
      "daily_metrics_period_check",
      sql`${table.periodEnd} >= ${table.periodStart}`,
    ),
    check(
      "daily_metrics_json_check",
      sql`jsonb_typeof(${table.dimensions}) = 'object' and jsonb_typeof(${table.metadata}) = 'object'`,
    ),
    check(
      "daily_metrics_counts_check",
      sql`${table.numerator} >= 0 and ${table.denominator} >= 0 and ${table.populationCount} >= 0 and ${table.unknownCount} >= 0 and ${table.ambiguousCount} >= 0 and ${table.numerator} <= ${table.denominator} and ${table.denominator} <= ${table.populationCount} and ${table.populationCount} = ${table.denominator} + ${table.unknownCount} + ${table.ambiguousCount}`,
    ),
    check(
      "daily_metrics_value_check",
      sql`((${table.denominator} = 0 or ${table.sampleQuality} = 'insufficient') and ${table.valueNumeric} is null) or (${table.denominator} > 0 and ${table.sampleQuality} in ('normal', 'caution') and ${table.valueNumeric} is not null)`,
    ),
    check(
      "daily_metrics_value_range_check",
      sql`${table.valueNumeric} is null or ${table.valueNumeric} between 0 and 1`,
    ),
    check(
      "daily_metrics_coverage_check",
      sql`(${table.populationCount} = 0 and ${table.coverageNumeric} is null) or (${table.populationCount} > 0 and ${table.coverageNumeric} is not null)`,
    ),
    check(
      "daily_metrics_coverage_range_check",
      sql`${table.coverageNumeric} is null or ${table.coverageNumeric} between 0 and 1`,
    ),
    check(
      "daily_metrics_sample_quality_check",
      sql`${table.sampleQuality} in ('normal', 'caution', 'insufficient')`,
    ),
  ],
);

export const dataQualityEvents = pgTable(
  "data_quality_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ingestionRunId: uuid("ingestion_run_id").references(
      () => ingestionRuns.id,
      {
        onDelete: "cascade",
      },
    ),
    datasetId: uuid("dataset_id").references(() => publishedDatasets.id, {
      onDelete: "set null",
    }),
    severity: text("severity").notNull(),
    eventCode: text("event_code").notNull(),
    scope: text("scope"),
    message: text("message").notNull(),
    details: jsonb("details")
      .$type<JsonObject>()
      .notNull()
      .default(emptyJsonObject),
    isPublic: boolean("is_public").notNull().default(false),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("data_quality_events_open_idx")
      .on(table.severity, table.createdAt.desc())
      .where(sql`${table.resolvedAt} is null`),
    check(
      "data_quality_events_severity_check",
      sql`${table.severity} in ('info', 'warning', 'error', 'blocking')`,
    ),
    check(
      "data_quality_events_details_check",
      sql`jsonb_typeof(${table.details}) = 'object'`,
    ),
  ],
);

export const insights = pgTable(
  "insights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    status: text("status").notNull().default("draft"),
    datasetId: uuid("dataset_id")
      .notNull()
      .references(() => publishedDatasets.id, { onDelete: "restrict" }),
    metricKey: text("metric_key").notNull(),
    metricVersion: text("metric_version").notNull(),
    filters: jsonb("filters").$type<JsonObject>().notNull(),
    valueNumeric: numeric("value_numeric", {
      precision: 12,
      scale: 8,
      mode: "number",
    }),
    numerator: bigint("numerator", { mode: "number" }).notNull(),
    denominator: bigint("denominator", { mode: "number" }).notNull(),
    populationCount: bigint("population_count", { mode: "number" }).notNull(),
    unknownCount: bigint("unknown_count", { mode: "number" })
      .notNull()
      .default(0),
    ambiguousCount: bigint("ambiguous_count", { mode: "number" })
      .notNull()
      .default(0),
    coverageNumeric: numeric("coverage_numeric", {
      precision: 12,
      scale: 8,
      mode: "number",
    }),
    sampleQuality: text("sample_quality").notNull(),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    ogAlt: text("og_alt").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    correctedAt: timestamp("corrected_at", { withTimezone: true }),
    correctionNote: text("correction_note"),
    previousSnapshot: jsonb("previous_snapshot").$type<JsonObject>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("insights_status_published_idx").on(
      table.status,
      table.publishedAt.desc(),
    ),
    check(
      "insights_status_check",
      sql`${table.status} in ('draft', 'published', 'corrected', 'withdrawn')`,
    ),
    check(
      "insights_json_check",
      sql`jsonb_typeof(${table.filters}) = 'object' and (${table.previousSnapshot} is null or jsonb_typeof(${table.previousSnapshot}) = 'object')`,
    ),
    check(
      "insights_period_check",
      sql`${table.periodEnd} >= ${table.periodStart}`,
    ),
    check(
      "insights_counts_check",
      sql`${table.numerator} >= 0 and ${table.denominator} >= 0 and ${table.populationCount} >= 0 and ${table.unknownCount} >= 0 and ${table.ambiguousCount} >= 0 and ${table.numerator} <= ${table.denominator} and ${table.denominator} <= ${table.populationCount} and ${table.populationCount} = ${table.denominator} + ${table.unknownCount} + ${table.ambiguousCount}`,
    ),
    check(
      "insights_value_check",
      sql`((${table.denominator} = 0 or ${table.sampleQuality} = 'insufficient') and ${table.valueNumeric} is null) or (${table.denominator} > 0 and ${table.sampleQuality} in ('normal', 'caution') and ${table.valueNumeric} is not null)`,
    ),
    check(
      "insights_value_range_check",
      sql`${table.valueNumeric} is null or ${table.valueNumeric} between 0 and 1`,
    ),
    check(
      "insights_coverage_check",
      sql`(${table.populationCount} = 0 and ${table.coverageNumeric} is null) or (${table.populationCount} > 0 and ${table.coverageNumeric} is not null)`,
    ),
    check(
      "insights_coverage_range_check",
      sql`${table.coverageNumeric} is null or ${table.coverageNumeric} between 0 and 1`,
    ),
    check(
      "insights_sample_quality_check",
      sql`${table.sampleQuality} in ('normal', 'caution', 'insufficient')`,
    ),
  ],
);

export const currentPublicOfferClassifications = pgView(
  "current_public_offer_classifications",
  {
    offerId: uuid("offer_id"),
    sourceId: uuid("source_id"),
    externalId: text("external_id"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    snapshotId: uuid("snapshot_id"),
    title: text("title"),
    companyName: text("company_name"),
    locationLabel: text("location_label"),
    communeCode: text("commune_code"),
    departmentCode: text("department_code"),
    regionCode: text("region_code"),
    contractKind: text("contract_kind"),
    sourcePublishedAt: timestamp("source_published_at", { withTimezone: true }),
    applicationUrl: text("application_url"),
    classificationId: uuid("classification_id"),
    classifierVersion: text("classifier_version"),
    classificationStatus: text("classification_status"),
    claimsJunior: boolean("claims_junior"),
    beginnerFriendly: boolean("beginner_friendly"),
    contradictoryJunior: boolean("contradictory_junior"),
    minimumExperienceMonths: integer("minimum_experience_months"),
    salaryTransparent: boolean("salary_transparent"),
    remoteMode: text("remote_mode"),
    jobFamily: text("job_family"),
    classificationSegment: text("classification_segment"),
  },
).as(sql`
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
`);
