import { createHash } from "node:crypto";

import type { NormalizedOffer } from "./normalized-offer";

export function createOfferContentHash(offer: NormalizedOffer): string {
  const content = {
    title: offer.title,
    descriptionText: offer.descriptionText,
    companyName: offer.companyName,
    location: offer.location,
    contract: offer.contract,
    structuredExperience: offer.structuredExperience,
    salary: offer.salary,
    applicationUrl: offer.applicationUrl,
    sourceUrl: offer.sourceUrl,
  };

  return createHash("sha256").update(JSON.stringify(content)).digest("hex");
}
