import { z } from "zod";

import initialTaxonomyDocument from "../../../docs/reference/initial-taxonomy.json";

export const TECHNOLOGY_TAXONOMY_VERSION = "technologies-1.2.0";

const technologyRuleSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/u),
    label: z.string().min(1),
    aliases: z.array(z.string().min(1)).default([]),
    caseSensitiveAliases: z.array(z.string().min(1)).optional(),
    contextRequiredAliases: z.array(z.string().min(1)).optional(),
    contextSignals: z.array(z.string().min(1)).optional(),
    exclusions: z.array(z.string().min(1)).optional(),
    sortOrder: z.number().int().nonnegative(),
  })
  .passthrough();

const taxonomySchema = z.object({
  documentVersion: z.literal("1.2.0"),
  technologyMatchingContract: z.object({
    contextWindowCharacters: z.number().int().positive(),
  }),
  technologies: z.array(technologyRuleSchema).min(1),
});

const taxonomy = taxonomySchema.parse(initialTaxonomyDocument);

export type TechnologyRule = z.infer<typeof technologyRuleSchema>;

export const TECHNOLOGY_CONTEXT_WINDOW =
  taxonomy.technologyMatchingContract.contextWindowCharacters;
export const TECHNOLOGY_RULES: readonly TechnologyRule[] = [
  ...taxonomy.technologies,
].sort((left, right) => left.sortOrder - right.sortOrder);
