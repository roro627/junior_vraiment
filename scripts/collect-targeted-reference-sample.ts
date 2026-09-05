import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import { z } from "zod";

import { classifyOffer } from "../src/domain/classification/classifier";
import { CLASSIFIER_VERSION } from "../src/domain/classification/types";
import { readFranceTravailEnvironment } from "../src/lib/env";
import { FranceTravailClient } from "../src/lib/france-travail/client";
import { normalizeFranceTravailOffer } from "../src/lib/france-travail/normalize";

const representativeSchema = z.object({
  rows: z.array(z.object({ reviewId: z.string().min(1) })).min(200),
});

function redactReviewText(value: string): string {
  return value
    .replace(/https?:\/\/\S+/giu, "[URL]")
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/giu, "[EMAIL]")
    .replace(/(?:\+33|0)[\d .()-]{8,}/gu, "[TÉLÉPHONE]")
    .trim();
}

const representative = representativeSchema.parse(
  JSON.parse(
    await readFile(".local/classifier-review-sample.json", "utf8"),
  ) as unknown,
);
const existingReviewIds = new Set(
  representative.rows.map(({ reviewId }) => reviewId),
);
const client = new FranceTravailClient(readFranceTravailEnvironment());
const page = await client.search({
  grandDomainReference: "M18",
  keyword: "junior",
  rangeSize: 150,
});

const rows: Array<Record<string, unknown>> = [];
const predictions: Array<Record<string, unknown>> = [];

for (const sourceOffer of page.items) {
  const reviewId = createHash("sha256")
    .update(sourceOffer.id)
    .digest("hex")
    .slice(0, 16);
  if (existingReviewIds.has(reviewId)) {
    continue;
  }

  const offer = normalizeFranceTravailOffer(sourceOffer);
  const classification = classifyOffer(offer);
  rows.push({
    reviewId,
    title: redactReviewText(offer.title),
    description: redactReviewText(offer.descriptionText),
    structuredExperienceRequired: offer.structuredExperience.required,
    structuredExperienceLabel: offer.structuredExperience.label,
  });
  predictions.push({
    reviewId,
    status: classification.status,
    claimsJunior: classification.claimsJunior,
    minimumExperienceMonths: classification.minimumExperienceMonths,
    beginnerFriendly: classification.beginnerFriendly,
    contradictoryJunior: classification.contradictoryJunior,
    ruleIds: classification.ruleIds,
  });
}

if (rows.length === 0) {
  throw new Error(
    "Le probe ciblé n'a produit aucune offre nouvelle à annoter.",
  );
}

await mkdir(".local/agent-reviews", { recursive: true });
await Promise.all([
  writeFile(
    ".local/agent-reviews/targeted-junior-source.json",
    `${JSON.stringify(
      {
        source: "API France Travail et partenaires participants",
        collectedAt: new Date().toISOString(),
        annotationProtocolVersion: "llm-review-a-1.0.0",
        selection: {
          purpose: "contradictory-junior-positive-coverage",
          grandDomainReference: "M18",
          keyword: "junior",
          marketPrevalenceEligible: false,
        },
        rows,
      },
      null,
      2,
    )}\n`,
    "utf8",
  ),
  writeFile(
    ".local/agent-reviews/targeted-junior-predictions.json",
    `${JSON.stringify(
      {
        classifierVersion: CLASSIFIER_VERSION,
        rows: predictions,
      },
      null,
      2,
    )}\n`,
    "utf8",
  ),
]);

process.stdout.write(
  `Échantillon ciblé aveugle créé : ${rows.length} offres nouvelles sur ${page.items.length}.\n`,
);
