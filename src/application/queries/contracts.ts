import { z } from "zod";

import { TECHNOLOGY_RULES } from "@/domain/classification/technology-registry";
import { JOB_FAMILIES } from "@/domain/taxonomies/job-registry";

export const API_MAX_QUERY_STRING_LENGTH = 2_048;

export const contractKindSchema = z.enum([
  "cdi",
  "cdd",
  "interim",
  "alternance",
  "internship",
  "freelance",
  "public",
  "other",
  "unknown",
]);
export const remoteModeSchema = z.enum([
  "remote",
  "hybrid",
  "onsite",
  "unknown",
]);
export const periodSchema = z.enum(["7d", "30d", "90d", "current"]);
export const metricIdSchema = z.enum([
  "junior_contradiction_rate",
  "beginner_friendly_rate",
  "salary_transparency_rate",
]);
export const dataQualitySchema = z.enum([
  "normal",
  "limited",
  "partial",
  "stale",
  "insufficient",
  "unavailable",
]);
export const sampleQualitySchema = z.enum([
  "normal",
  "caution",
  "insufficient",
]);
export const experienceBucketSchema = z.enum([
  "none",
  "1_12",
  "13_23",
  "24_35",
  "36_59",
  "60_plus",
  "unknown",
  "ambiguous",
]);
export const classificationSegmentSchema = z.enum([
  "contradictory",
  "beginner_friendly",
  "junior_unresolved",
  "other_junior",
  "not_explicitly_junior",
  "ambiguous",
  "unknown",
]);

const slugSchema = z.string().regex(/^[a-z0-9-]{1,64}$/u);
const technologySlugSchema = z.string().regex(/^[a-z0-9.+#-]{1,64}$/u);
const areaSchema = z
  .string()
  .max(40)
  .regex(/^(?:france|(?:region|department|commune):[0-9A-Z-]+)$/u);
const isoDateSchema = z.iso.date();
const isoDateTimeSchema = z.iso.datetime({ offset: true });

const splitCommaListSchema = z
  .string()
  .max(800)
  .transform((value): string[] =>
    [...new Set(value.split(",").map((item) => item.trim()))]
      .filter(Boolean)
      .sort(),
  );
const technologyListSchema = splitCommaListSchema.pipe(
  z
    .array(technologySlugSchema)
    .max(3)
    .superRefine((technologies, context) => {
      const known = new Set(TECHNOLOGY_RULES.map(({ id }) => id));
      for (const [index, technology] of technologies.entries()) {
        if (!known.has(technology)) {
          context.addIssue({
            code: "custom",
            path: [index],
            message: "Technologie non reconnue.",
          });
        }
      }
    }),
);
const contractListSchema = splitCommaListSchema.pipe(
  z.array(contractKindSchema).max(10),
);
const experienceListSchema = splitCommaListSchema.pipe(
  z.array(experienceBucketSchema).max(8),
);

const rawScopeShape = {
  job: slugSchema
    .refine((job) => JOB_FAMILIES.some(({ id }) => id === job), {
      message: "Métier non reconnu.",
    })
    .optional(),
  tech: technologyListSchema.optional(),
  area: areaSchema.optional(),
  contract: contractListSchema.optional(),
  remote: remoteModeSchema.optional(),
  period: periodSchema.optional(),
};

export const scopeSchema = z
  .object({
    job: slugSchema.nullable(),
    technologies: z.array(technologySlugSchema).max(3),
    area: areaSchema,
    contracts: z.array(contractKindSchema).max(10),
    remote: remoteModeSchema.nullable(),
    period: periodSchema,
  })
  .strict();

export type Scope = z.infer<typeof scopeSchema>;

function normalizedScope(input: {
  job?: string | undefined;
  tech?: string[] | undefined;
  area?: string | undefined;
  contract?: z.infer<typeof contractKindSchema>[] | undefined;
  remote?: z.infer<typeof remoteModeSchema> | undefined;
  period?: z.infer<typeof periodSchema> | undefined;
}): Scope {
  return {
    job: input.job ?? null,
    technologies: input.tech ?? [],
    area: input.area ?? "france",
    contracts: input.contract ?? [],
    remote: input.remote ?? null,
    period: input.period ?? "30d",
  };
}

export const overviewSearchParamsSchema = z
  .object(rawScopeShape)
  .strict()
  .transform(normalizedScope);

export const offersSortSchema = z.enum([
  "published_desc",
  "published_asc",
  "experience_desc",
  "experience_asc",
]);

export const offersSearchParamsSchema = z
  .object({
    ...rawScopeShape,
    classification: classificationSegmentSchema.optional(),
    salaryPublished: z.enum(["true", "false"]).optional(),
    experience: experienceListSchema.optional(),
    sort: offersSortSchema.optional(),
    cursor: z.string().min(1).max(512).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  })
  .strict()
  .transform((input) => ({
    scope: normalizedScope(input),
    classification: input.classification ?? null,
    salaryPublished:
      input.salaryPublished === undefined
        ? null
        : input.salaryPublished === "true",
    experience: input.experience ?? [],
    sort: input.sort ?? ("published_desc" as const),
    cursor: input.cursor ?? null,
    limit: input.limit ?? 25,
  }));

export const trendsSearchParamsSchema = z
  .object({
    ...rawScopeShape,
    metric: metricIdSchema,
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if ((input.from === undefined) !== (input.to === undefined)) {
      context.addIssue({
        code: "custom",
        path: [input.from === undefined ? "from" : "to"],
        message: "Les deux bornes de date sont requises ensemble.",
      });
      return;
    }

    if (input.from && input.to) {
      const from = Date.parse(`${input.from}T00:00:00.000Z`);
      const to = Date.parse(`${input.to}T00:00:00.000Z`);
      const dayCount = Math.floor((to - from) / 86_400_000) + 1;
      if (dayCount < 1 || dayCount > 366) {
        context.addIssue({
          code: "custom",
          path: ["to"],
          message: "La période doit contenir entre 1 et 366 jours.",
        });
      }
    }
  })
  .transform((input) => ({
    scope: normalizedScope(input),
    metric: input.metric,
    from: input.from ?? null,
    to: input.to ?? null,
  }));

export function parseApiSearchParams<T>(
  searchParams: URLSearchParams,
  schema: z.ZodType<T>,
): T {
  if (searchParams.toString().length > API_MAX_QUERY_STRING_LENGTH) {
    throw new z.ZodError([
      {
        code: "too_big",
        origin: "string",
        maximum: API_MAX_QUERY_STRING_LENGTH,
        inclusive: true,
        path: [],
        message: "La chaîne de paramètres est trop longue.",
      },
    ]);
  }

  const input: Record<string, string | string[]> = {};
  for (const [key, value] of searchParams) {
    const previous = input[key];
    input[key] =
      previous === undefined
        ? value
        : Array.isArray(previous)
          ? [...previous, value]
          : [previous, value];
  }

  return schema.parse(input);
}

export const dataWarningSchema = z
  .object({
    code: z.enum([
      "SMALL_SAMPLE",
      "PARTIAL_COLLECTION",
      "STALE_DATA",
      "SOURCE_SCHEMA_CHANGE",
      "CLASSIFICATION_DRIFT",
      "METHODOLOGY_BREAK",
      "UNKNOWN",
    ]),
    severity: z.enum(["info", "warning", "critical"]),
    message: z.string().max(500),
  })
  .strict();

export const responseMetaSchema = z
  .object({
    generatedAt: isoDateTimeSchema,
    dataAsOf: isoDateTimeSchema,
    datasetVersion: z.string().min(1).max(100),
    classifierVersion: z.string().min(1).max(100),
    metricVersions: z.record(z.string(), z.string().min(1).max(100)),
    querySetVersion: z.string().min(1).max(100),
    sampleSize: z.number().int().nonnegative(),
    quality: dataQualitySchema,
    warnings: z.array(dataWarningSchema),
  })
  .strict();

export const metricValueSchema = z
  .object({
    metric: metricIdSchema,
    metricVersion: z.string().min(1).max(100),
    value: z.number().min(0).max(1).nullable(),
    numerator: z.number().int().nonnegative(),
    denominator: z.number().int().nonnegative(),
    populationCount: z.number().int().nonnegative(),
    unknownCount: z.number().int().nonnegative(),
    ambiguousCount: z.number().int().nonnegative(),
    coverage: z.number().min(0).max(1).nullable(),
    sampleQuality: sampleQualitySchema,
    changePoints: z.number().nullable().optional(),
    caveat: z.string().max(500).nullable().optional(),
  })
  .strict()
  .superRefine((metric, context) => {
    if (
      metric.numerator > metric.denominator ||
      metric.denominator > metric.populationCount ||
      metric.populationCount !==
        metric.denominator + metric.unknownCount + metric.ambiguousCount
    ) {
      context.addIssue({
        code: "custom",
        path: ["populationCount"],
        message: "Les compteurs de la métrique sont incohérents.",
      });
    }

    const expectedCoverage =
      metric.populationCount === 0
        ? null
        : metric.denominator / metric.populationCount;
    if (
      (expectedCoverage === null) !== (metric.coverage === null) ||
      (expectedCoverage !== null &&
        metric.coverage !== null &&
        Math.abs(expectedCoverage - metric.coverage) > 1e-8)
    ) {
      context.addIssue({
        code: "custom",
        path: ["coverage"],
        message: "La couverture ne correspond pas aux compteurs.",
      });
    }

    const expectedQuality =
      metric.denominator < 20
        ? "insufficient"
        : metric.denominator < 50
          ? "caution"
          : "normal";
    if (metric.sampleQuality !== expectedQuality) {
      context.addIssue({
        code: "custom",
        path: ["sampleQuality"],
        message: "La qualité d'échantillon ne correspond pas au dénominateur.",
      });
    }
    if ((metric.sampleQuality === "insufficient") !== (metric.value === null)) {
      context.addIssue({
        code: "custom",
        path: ["value"],
        message: "Un échantillon insuffisant ne publie aucune valeur.",
      });
    }
  });

export const countItemSchema = z
  .object({
    key: z.string().min(1),
    label: z.string().optional(),
    count: z.number().int().nonnegative(),
    share: z.number().min(0).max(1).nullable().optional(),
  })
  .strict();

export const juniorObservationSchema = z
  .strictObject({
    version: z.literal("junior-observation-2.0.0"),
    status: z.enum(["resolved", "unknown", "ambiguous"]),
    contradictory: z.boolean().nullable(),
  })
  .refine(
    (value) => (value.status === "resolved") === (value.contradictory !== null),
    "Un seuil non résolu reste indéterminé.",
  );

export const classificationSchema = z
  .object({
    status: z.enum(["classified", "ambiguous", "unclassified"]),
    claimsJunior: z.boolean().nullable(),
    beginnerFriendly: z.boolean().nullable(),
    contradictoryJunior: z.boolean().nullable(),
    juniorObservation: juniorObservationSchema.nullable().optional(),
    classifierVersion: z.string().min(1).max(100),
    warnings: z.array(z.string().max(120)),
  })
  .strict();

export const publicEvidenceSchema = z
  .object({
    kind: z.enum([
      "junior_claim",
      "required_experience",
      "desired_experience",
      "salary",
      "remote",
      "technology",
      "job_family",
      "conflict",
      "exclusion",
      "ambiguity",
      "other",
    ]),
    ruleId: z.string().regex(/^[A-Z0-9_]+$/u),
    sourceField: z.string().max(100).nullable().optional(),
    excerpt: z.string().max(700),
    normalizedValue: z.string().max(100).nullable().optional(),
  })
  .strict();

export const publicSalarySchema = z
  .object({
    published: z.boolean(),
    label: z.string().max(250).nullable(),
    minimumAnnualGross: z.number().nonnegative().nullable().optional(),
    maximumAnnualGross: z.number().nonnegative().nullable().optional(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/u)
      .nullable()
      .optional(),
    period: z.enum(["hour", "month", "year"]).nullable().optional(),
  })
  .strict();

export const publicOfferSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{8,100}$/u),
    title: z.string().max(250),
    companyName: z.string().max(250).nullable(),
    locationLabel: z.string().max(250).nullable(),
    contractLabel: z.string().max(150).nullable(),
    publishedAt: isoDateTimeSchema.nullable(),
    lastSeenAt: isoDateTimeSchema,
    availability: z.enum(["active", "not_seen", "closed"]),
    minimumExperienceMonths: z.number().int().nonnegative().nullable(),
    experienceLabel: z.string().max(250).nullable(),
    classification: classificationSchema,
    evidence: z.array(publicEvidenceSchema),
    technologies: z.array(technologySlugSchema),
    salary: publicSalarySchema.nullable(),
    remoteMode: remoteModeSchema,
    source: z
      .object({
        label: z.string().max(100),
        offerUrl: z.url().nullable(),
        attributionUrl: z.url(),
      })
      .strict(),
  })
  .strict();

export const overviewResponseSchema = z
  .object({
    data: z
      .object({
        scope: scopeSchema,
        headline: metricValueSchema,
        beginnerFriendly: metricValueSchema,
        salaryTransparency: metricValueSchema,
        experienceBuckets: z.array(
          z
            .object({
              key: experienceBucketSchema,
              count: z.number().int().nonnegative(),
            })
            .strict(),
        ),
        topTechnologies: z.array(countItemSchema),
        contracts: z.array(countItemSchema),
        remoteModes: z.array(countItemSchema),
        examples: z.array(publicOfferSchema).max(10),
      })
      .strict(),
    meta: responseMetaSchema,
  })
  .strict();

export const trendsResponseSchema = z
  .object({
    data: z
      .object({
        scope: scopeSchema,
        metric: metricIdSchema,
        metricVersion: z.string().min(1).max(100),
        timezone: z.literal("Europe/Paris"),
        points: z
          .array(
            z
              .object({
                date: isoDateSchema,
                value: z.number().min(0).max(1).nullable(),
                numerator: z.number().int().nonnegative(),
                denominator: z.number().int().nonnegative(),
                populationCount: z.number().int().nonnegative(),
                unknownCount: z.number().int().nonnegative(),
                ambiguousCount: z.number().int().nonnegative(),
                coverage: z.number().min(0).max(1).nullable(),
                sampleQuality: sampleQualitySchema,
                quality: dataQualitySchema,
                datasetVersion: z.string().min(1),
                annotation: z
                  .object({
                    kind: z.enum([
                      "partial_day",
                      "incident",
                      "methodology_change",
                      "classifier_change",
                      "source_change",
                    ]),
                    label: z.string().max(200),
                  })
                  .strict()
                  .nullable(),
              })
              .strict(),
          )
          .max(366),
      })
      .strict(),
    meta: responseMetaSchema,
  })
  .strict();

export const offersResponseSchema = z
  .object({
    data: z
      .object({
        items: z.array(publicOfferSchema),
        page: z
          .object({
            nextCursor: z.string().nullable(),
            hasNext: z.boolean(),
          })
          .strict(),
      })
      .strict(),
    meta: responseMetaSchema,
  })
  .strict();

export const taxonomyOptionSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    availableCount: z.number().int().nonnegative(),
    parentId: z.string().nullable().optional(),
  })
  .strict();

export const taxonomiesResponseSchema = z
  .object({
    data: z
      .object({
        versions: z
          .object({
            jobs: z.string().min(1),
            technologies: z.string().min(1),
            geography: z.string().min(1),
            contracts: z.string().min(1),
          })
          .strict(),
        jobs: z.array(taxonomyOptionSchema),
        technologies: z.array(taxonomyOptionSchema),
        popularAreas: z.array(taxonomyOptionSchema),
        contracts: z.array(taxonomyOptionSchema),
        remoteModes: z.array(taxonomyOptionSchema),
      })
      .strict(),
    meta: responseMetaSchema,
  })
  .strict();

export const dataStatusResponseSchema = z
  .object({
    data: z
      .object({
        status: z.enum([
          "operational",
          "degraded",
          "unavailable",
          "maintenance",
        ]),
        lastSuccessfulRunAt: isoDateTimeSchema.nullable(),
        dataAsOf: isoDateTimeSchema.nullable(),
        freshness: z.enum(["fresh", "delayed", "stale", "unavailable"]),
        latestRun: z
          .object({
            status: z.enum(["succeeded", "partial", "failed"]),
            durationMs: z.number().int().nonnegative(),
            requests: z.number().int().nonnegative(),
            queries: z.number().int().nonnegative(),
            partialQueries: z.number().int().nonnegative(),
            received: z.number().int().nonnegative(),
            valid: z.number().int().nonnegative(),
            new: z.number().int().nonnegative(),
            updated: z.number().int().nonnegative(),
            quarantined: z.number().int().nonnegative(),
            markedMissing: z.number().int().nonnegative(),
            closed: z.number().int().nonnegative().nullable(),
            ambiguousRate: z.number().min(0).max(1),
          })
          .strict()
          .nullable(),
        incidents: z.array(
          z
            .object({
              id: z.string().min(1),
              status: z.enum([
                "investigating",
                "identified",
                "monitoring",
                "resolved",
              ]),
              startedAt: isoDateTimeSchema,
              resolvedAt: isoDateTimeSchema.nullable().optional(),
              summary: z.string().max(500),
            })
            .strict(),
        ),
      })
      .strict(),
    meta: responseMetaSchema,
  })
  .strict();

export const problemSchema = z
  .object({
    type: z.string().min(1),
    title: z.string().min(1),
    status: z.number().int().min(400).max(599),
    detail: z.string().optional(),
    instance: z.string().optional(),
    code: z.string().regex(/^[A-Z0-9_]+$/u),
    errors: z
      .array(z.object({ path: z.string(), message: z.string() }).strict())
      .optional(),
    traceId: z.string().optional(),
  })
  .strict();

export type ResponseMeta = z.infer<typeof responseMetaSchema>;
export type OverviewQuery = z.infer<typeof overviewSearchParamsSchema>;
export type OffersQuery = z.infer<typeof offersSearchParamsSchema>;
export type TrendsQuery = z.infer<typeof trendsSearchParamsSchema>;
export type PublicOffer = z.infer<typeof publicOfferSchema>;
export type OverviewResponse = z.infer<typeof overviewResponseSchema>;
export type TrendsResponse = z.infer<typeof trendsResponseSchema>;
export type OffersResponse = z.infer<typeof offersResponseSchema>;
export type TaxonomiesResponse = z.infer<typeof taxonomiesResponseSchema>;
export type DataStatusResponse = z.infer<typeof dataStatusResponseSchema>;
export type Problem = z.infer<typeof problemSchema>;
