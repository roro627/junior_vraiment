import { z } from "zod";

import initialTaxonomyDocument from "../../../docs/reference/initial-taxonomy.json";

const jobFamilySchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/u),
    label: z.string().min(1),
    sortOrder: z.number().int().nonnegative(),
  })
  .passthrough();

const taxonomySchema = z.object({
  documentVersion: z.literal("1.2.0"),
  jobFamilies: z.array(jobFamilySchema).min(1),
});

const taxonomy = taxonomySchema.parse(initialTaxonomyDocument);

export const JOB_FAMILIES = [...taxonomy.jobFamilies].sort(
  (left, right) => left.sortOrder - right.sortOrder,
);
