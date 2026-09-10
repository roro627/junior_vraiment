export const CLASSIFIER_VERSION = "classifier-1.3.7";

export type ClassificationStatus = "classified" | "ambiguous" | "unclassified";

export type EvidenceField =
  "title" | "description" | "experienceLabel" | "salaryLabel";

export type EvidenceKind =
  | "junior_claim"
  | "required_experience"
  | "desired_experience"
  | "salary"
  | "remote"
  | "technology"
  | "job_family"
  | "conflict"
  | "exclusion"
  | "ambiguity"
  | "other";

export type RemoteMode = "remote" | "hybrid" | "onsite" | "unknown";

export type Evidence = {
  kind: EvidenceKind;
  ruleId: string;
  field: EvidenceField;
  excerpt: string;
  start: number;
  end: number;
  normalizedValue?: string;
};

export type ClassificationWarning = {
  code: string;
  severity: "warning" | "blocking";
  message: string;
};

export type ClassificationResult = {
  classifierVersion: typeof CLASSIFIER_VERSION;
  status: ClassificationStatus;
  claimsJunior: boolean | null;
  minimumExperienceMonths: number | null;
  beginnerFriendly: boolean | null;
  contradictoryJunior: boolean | null;
  salaryTransparent: boolean;
  remoteMode: RemoteMode;
  technologySlugs: string[];
  evidence: Evidence[];
  ruleIds: string[];
  warnings: ClassificationWarning[];
};
