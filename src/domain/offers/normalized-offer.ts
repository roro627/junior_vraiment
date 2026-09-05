export const contractKinds = [
  "cdi",
  "cdd",
  "interim",
  "alternance",
  "internship",
  "freelance",
  "public",
  "other",
  "unknown",
] as const;

export type ContractKind = (typeof contractKinds)[number];

export type SalaryPeriod = "hour" | "month" | "year";
export type SalaryBasis = "gross" | "net" | "unknown";

export type NormalizedSalary = {
  originalLabel: string;
  minimumOriginal: number | null;
  maximumOriginal: number | null;
  period: SalaryPeriod | null;
  currency: string | null;
  grossOrNet: SalaryBasis;
  normalizedAnnualMinimum: number | null;
  normalizedAnnualMaximum: number | null;
  normalizationWarning: string | null;
};

export type NormalizedOffer = {
  source: "france-travail";
  externalId: string;
  title: string;
  descriptionText: string;
  companyName: string | null;
  publishedAt: Date | null;
  updatedAt: Date | null;
  location: {
    label: string | null;
    communeCode: string | null;
    departmentCode: string | null;
    regionCode: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  contract: {
    sourceCode: string | null;
    normalized: ContractKind;
    label: string | null;
  };
  structuredExperience: {
    required: boolean | null;
    label: string | null;
  };
  salary: NormalizedSalary | null;
  applicationUrl: string | null;
  sourceUrl: string | null;
  rawPayload: unknown;
};
