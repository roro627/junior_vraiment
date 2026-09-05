import { z } from "zod";

const sourceString = z.string();

export const franceTravailLocationSchema = z.looseObject({
  libelle: sourceString.optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  codePostal: sourceString.optional(),
  commune: sourceString.optional(),
});

export const franceTravailCompanySchema = z.looseObject({
  nom: sourceString.optional(),
  description: sourceString.optional(),
  entrepriseAdaptee: z.boolean().optional(),
});

export const franceTravailSalarySchema = z.looseObject({
  libelle: sourceString.optional(),
  commentaire: sourceString.optional(),
  complement1: sourceString.optional(),
  complement2: sourceString.optional(),
});

export const franceTravailOriginSchema = z.looseObject({
  origine: sourceString.optional(),
  urlOrigine: sourceString.optional(),
});

export const franceTravailWorkContextSchema = z.looseObject({
  horaires: z.union([sourceString, z.array(sourceString)]).optional(),
});

export const franceTravailRequirementSchema = z.looseObject({
  libelle: sourceString.optional(),
  exigence: sourceString.optional(),
});

export const franceTravailOfferSchema = z.looseObject({
  id: sourceString.min(1),
  intitule: sourceString.min(1),
  description: sourceString.min(1),
  dateCreation: sourceString.optional(),
  dateActualisation: sourceString.optional(),
  lieuTravail: franceTravailLocationSchema.optional(),
  romeCode: sourceString.optional(),
  romeLibelle: sourceString.optional(),
  appellationlibelle: sourceString.optional(),
  entreprise: franceTravailCompanySchema.optional(),
  typeContrat: sourceString.optional(),
  typeContratLibelle: sourceString.optional(),
  natureContrat: sourceString.optional(),
  experienceExige: sourceString.optional(),
  experienceLibelle: sourceString.optional(),
  experienceCommentaire: sourceString.optional(),
  complementExercice: sourceString.optional(),
  formations: z.array(z.unknown()).optional(),
  competences: z.array(z.unknown()).optional(),
  langues: z.array(franceTravailRequirementSchema).optional(),
  permis: z.array(franceTravailRequirementSchema).optional(),
  salaire: franceTravailSalarySchema.optional(),
  dureeTravailLibelle: sourceString.optional(),
  dureeTravailLibelleConverti: sourceString.optional(),
  alternance: z.boolean().optional(),
  contact: z.looseObject({}).optional(),
  agence: z.looseObject({}).optional(),
  nombrePostes: z.number().int().nonnegative().optional(),
  deplacementCode: sourceString.optional(),
  deplacementLibelle: sourceString.optional(),
  qualificationCode: sourceString.optional(),
  qualificationLibelle: sourceString.optional(),
  codeNAF: sourceString.optional(),
  secteurActivite: sourceString.optional(),
  secteurActiviteLibelle: sourceString.optional(),
  qualitesProfessionnelles: z.array(z.unknown()).optional(),
  trancheEffectifEtab: sourceString.optional(),
  origineOffre: franceTravailOriginSchema.optional(),
  offresManqueCandidats: z.boolean().optional(),
  contexteTravail: franceTravailWorkContextSchema.optional(),
  entrepriseAdaptee: z.boolean().optional(),
  employeurHandiEngage: z.boolean().optional(),
  accessibleTH: z.boolean().optional(),
});

const franceTravailSearchEnvelopeSchema = z.looseObject({
  resultats: z.array(z.unknown()),
  filtresPossibles: z.array(z.unknown()).optional(),
});

export const franceTravailTokenSchema = z.looseObject({
  access_token: sourceString.min(1),
  token_type: sourceString.min(1),
  expires_in: z.number().int().positive(),
  scope: sourceString.optional(),
});

export const franceTravailOccupationSchema = z.looseObject({
  code: sourceString.min(1),
  libelle: sourceString.min(1),
});

export const franceTravailOccupationListSchema = z.array(
  franceTravailOccupationSchema,
);

export type FranceTravailOffer = z.infer<typeof franceTravailOfferSchema>;
export type FranceTravailOccupation = z.infer<
  typeof franceTravailOccupationSchema
>;

export type ContractWarning = {
  path: string;
  field: string;
  observedType: string;
};

export type QuarantinedOffer = {
  index: number;
  issues: ReadonlyArray<{
    path: string;
    code: string;
    message: string;
  }>;
};

export type SourceSearchValidation = {
  status: "valid" | "valid_with_warnings" | "invalid_quarantined";
  offers: FranceTravailOffer[];
  warnings: ContractWarning[];
  quarantined: QuarantinedOffer[];
  rootIssues: QuarantinedOffer["issues"];
};

const knownRootFields = new Set(["resultats", "filtresPossibles"]);
const knownOfferFields = new Set(Object.keys(franceTravailOfferSchema.shape));

function findUnknownFields(
  value: Readonly<Record<string, unknown>>,
  knownFields: ReadonlySet<string>,
  path: string,
): ContractWarning[] {
  return Object.keys(value)
    .filter((field) => !knownFields.has(field))
    .sort()
    .map((field) => ({
      path,
      field,
      observedType:
        value[field] === null
          ? "null"
          : Array.isArray(value[field])
            ? "array"
            : typeof value[field],
    }));
}

function formatIssues(error: z.ZodError): QuarantinedOffer["issues"] {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    code: issue.code,
    message: issue.message,
  }));
}

export function validateSourceSearchPage(
  payload: unknown,
): SourceSearchValidation {
  const envelopeResult = franceTravailSearchEnvelopeSchema.safeParse(payload);

  if (!envelopeResult.success) {
    return {
      status: "invalid_quarantined",
      offers: [],
      warnings: [],
      quarantined: [],
      rootIssues: formatIssues(envelopeResult.error),
    };
  }

  const warnings = findUnknownFields(
    envelopeResult.data,
    knownRootFields,
    "$root",
  );
  const offers: FranceTravailOffer[] = [];
  const quarantined: QuarantinedOffer[] = [];

  envelopeResult.data.resultats.forEach((rawOffer, index) => {
    const offerResult = franceTravailOfferSchema.safeParse(rawOffer);

    if (!offerResult.success) {
      quarantined.push({ index, issues: formatIssues(offerResult.error) });
      return;
    }

    offers.push(offerResult.data);
    warnings.push(
      ...findUnknownFields(
        offerResult.data,
        knownOfferFields,
        `resultats.${index}`,
      ),
    );
  });

  return {
    status:
      warnings.length > 0 || quarantined.length > 0
        ? "valid_with_warnings"
        : "valid",
    offers,
    warnings,
    quarantined,
    rootIssues: [],
  };
}
