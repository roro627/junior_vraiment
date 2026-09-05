import { readFile, writeFile } from "node:fs/promises";

import { z } from "zod";

const annotationSchema = z.strictObject({
  reviewId: z.string().min(1),
  humanStatus: z.enum(["classified", "ambiguous", "unclassified"]),
  humanClaimsJunior: z.boolean().nullable(),
  humanMinimumExperienceMonths: z.number().int().nonnegative().nullable(),
  humanBeginnerFriendly: z.boolean().nullable(),
  humanContradictoryJunior: z.boolean().nullable(),
  rationale: z.string().min(1),
  evidenceExcerpts: z.array(z.string()),
});

const annotationFileSchema = z.array(annotationSchema).length(10);
const sourceSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(20),
});

const reviewDirectory = ".local/agent-reviews";
const filePairs = [
  ["pass-a-01-10.json", "pass-b-01-10.json"],
  ["pass-a-11-20.json", "pass-b-11-20.json"],
] as const;

async function readAnnotations(fileName: string) {
  const content = await readFile(`${reviewDirectory}/${fileName}`, "utf8");
  return annotationFileSchema.parse(JSON.parse(content) as unknown);
}

const sourceContent = await readFile(
  ".local/classifier-review-sample.json",
  "utf8",
);
const source = sourceSchema.parse(JSON.parse(sourceContent) as unknown);
const annotationsByPass = await Promise.all(
  filePairs.flatMap(([passA, passB]) => [
    readAnnotations(passA),
    readAnnotations(passB),
  ]),
);
const passA = [
  ...(annotationsByPass[0] ?? []),
  ...(annotationsByPass[2] ?? []),
];
const passB = [
  ...(annotationsByPass[1] ?? []),
  ...(annotationsByPass[3] ?? []),
];
const passAById = new Map(
  passA.map((annotation) => [annotation.reviewId, annotation]),
);
const passBById = new Map(
  passB.map((annotation) => [annotation.reviewId, annotation]),
);
const comparedFields = [
  "humanStatus",
  "humanClaimsJunior",
  "humanMinimumExperienceMonths",
  "humanBeginnerFriendly",
  "humanContradictoryJunior",
] as const;

const rows = source.rows.slice(0, 20).map((sourceRow) => {
  const reviewId = z.string().parse(sourceRow["reviewId"]);
  const annotationA = passAById.get(reviewId);
  const annotationB = passBById.get(reviewId);
  if (!annotationA || !annotationB) {
    throw new Error(`Annotation manquante pour ${reviewId}.`);
  }

  const disagreements = comparedFields.filter(
    (field) => annotationA[field] !== annotationB[field],
  );
  return {
    reviewId,
    queryGroup: sourceRow["queryGroup"],
    title: sourceRow["title"],
    description: sourceRow["description"],
    structuredExperienceRequired: sourceRow["structuredExperienceRequired"],
    structuredExperienceLabel: sourceRow["structuredExperienceLabel"],
    prediction: {
      status: sourceRow["predictedStatus"],
      claimsJunior: sourceRow["predictedClaimsJunior"],
      minimumExperienceMonths: sourceRow["predictedMinimumExperienceMonths"],
      beginnerFriendly: sourceRow["predictedBeginnerFriendly"],
      contradictoryJunior: sourceRow["predictedContradictoryJunior"],
    },
    passA: annotationA,
    passB: annotationB,
    agentsAgree: disagreements.length === 0,
    disagreements,
    ownerVerdict: null,
    ownerNotes: "",
  };
});

await writeFile(
  `${reviewDirectory}/pilot-20.json`,
  JSON.stringify(
    {
      methodology: "dual-blind-llm-pilot-not-ground-truth",
      model: "gpt-5.6-terra",
      reasoningEffort: "medium",
      rows,
    },
    null,
    2,
  ),
  "utf8",
);

const agreementCount = rows.filter(({ agentsAgree }) => agentsAgree).length;
process.stdout.write(`Accord exact : ${agreementCount}/20.\n`);
