import { z } from "zod";

import { problemSchema, type Problem } from "./contracts";

type ProblemCode = "INVALID_FILTER" | "INVALID_CURSOR" | "DATA_UNAVAILABLE";

const problemDefinitions: Record<
  ProblemCode,
  { status: number; title: string; type: string; detail: string }
> = {
  INVALID_FILTER: {
    status: 400,
    title: "Filtre invalide",
    type: "/problems/invalid-filter",
    detail: "Un ou plusieurs paramètres de recherche sont invalides.",
  },
  INVALID_CURSOR: {
    status: 400,
    title: "Curseur invalide",
    type: "/problems/invalid-cursor",
    detail:
      "Le curseur de pagination est invalide ou ne correspond plus au périmètre.",
  },
  DATA_UNAVAILABLE: {
    status: 503,
    title: "Données indisponibles",
    type: "/problems/data-unavailable",
    detail: "Aucun dataset public vérifié n'est actuellement disponible.",
  },
};

export function createProblem(input: {
  code: ProblemCode;
  instance?: string;
  error?: z.ZodError;
}): Problem {
  const definition = problemDefinitions[input.code];
  const problem: Problem = {
    ...definition,
    code: input.code,
    ...(input.instance ? { instance: input.instance } : {}),
    ...(input.error
      ? {
          errors: input.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        }
      : {}),
  };

  return problemSchema.parse(problem);
}

export function problemResponse(problem: Problem): Response {
  return new Response(JSON.stringify(problem), {
    status: problem.status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/problem+json; charset=utf-8",
    },
  });
}
