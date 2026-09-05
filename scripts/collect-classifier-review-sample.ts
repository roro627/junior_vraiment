import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

import querySet from "../docs/reference/query-set.active.json";
import { classifyOffer } from "../src/domain/classification/classifier";
import { CLASSIFIER_VERSION } from "../src/domain/classification/types";
import { readFranceTravailEnvironment } from "../src/lib/env";
import { FranceTravailClient } from "../src/lib/france-travail/client";
import { normalizeFranceTravailOffer } from "../src/lib/france-travail/normalize";

const targetSize = 200;

function redactReviewText(value: string): string {
  return value
    .replace(/https?:\/\/\S+/giu, "[URL]")
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/giu, "[EMAIL]")
    .replace(/(?:\+33|0)[\d .()-]{8,}/gu, "[TÉLÉPHONE]")
    .trim();
}

const client = new FranceTravailClient(readFranceTravailEnvironment());
const seen = new Set<string>();
const reviewRows: Array<Record<string, unknown>> = [];

for (const group of querySet.groups) {
  for (const keyword of group.keywordsAny) {
    if (reviewRows.length >= targetSize) break;

    const page = await client.search({ keyword, rangeSize: 50 });
    for (const sourceOffer of page.items) {
      if (reviewRows.length >= targetSize || seen.has(sourceOffer.id)) continue;
      seen.add(sourceOffer.id);

      const offer = normalizeFranceTravailOffer(sourceOffer);
      const classification = classifyOffer(offer);
      reviewRows.push({
        reviewId: createHash("sha256")
          .update(sourceOffer.id)
          .digest("hex")
          .slice(0, 16),
        queryGroup: group.id,
        queryKeyword: keyword,
        title: redactReviewText(offer.title),
        description: redactReviewText(offer.descriptionText),
        structuredExperienceRequired: offer.structuredExperience.required,
        structuredExperienceLabel: offer.structuredExperience.label,
        predictedStatus: classification.status,
        predictedClaimsJunior: classification.claimsJunior,
        predictedMinimumExperienceMonths:
          classification.minimumExperienceMonths,
        predictedBeginnerFriendly: classification.beginnerFriendly,
        predictedContradictoryJunior: classification.contradictoryJunior,
        predictedRuleIds: classification.ruleIds.join(", "),
        humanReviewStatus: "pending",
        humanStatus: "",
        humanClaimsJunior: "",
        humanMinimumExperienceMonths: "",
        humanBeginnerFriendly: "",
        humanContradictoryJunior: "",
        reviewerNotes: "",
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

if (reviewRows.length < targetSize) {
  throw new Error(
    `Échantillon incomplet : ${reviewRows.length}/${targetSize}.`,
  );
}

await mkdir(".local", { recursive: true });
await writeFile(
  ".local/classifier-review-sample.json",
  JSON.stringify(
    {
      source: "API France Travail et partenaires participants",
      collectedAt: new Date().toISOString(),
      classifierVersion: CLASSIFIER_VERSION,
      rows: reviewRows,
    },
    null,
    2,
  ),
  "utf8",
);

process.stdout.write(
  `Échantillon de revue créé : ${reviewRows.length} lignes.\n`,
);
