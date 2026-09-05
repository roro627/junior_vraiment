import { z } from "zod";

import { getCachedPublicTrends } from "@/application/queries/cached-public-data";
import {
  parseApiSearchParams,
  trendsSearchParamsSchema,
} from "@/application/queries/contracts";
import { jsonResponseWithEtag } from "@/application/queries/http-response";
import { createProblem, problemResponse } from "@/application/queries/problem";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);

  try {
    const query = parseApiSearchParams(
      url.searchParams,
      trendsSearchParamsSchema,
    );
    const response = await getCachedPublicTrends(query);

    return jsonResponseWithEtag({
      request,
      body: response,
      datasetVersion: response.meta.datasetVersion,
      cacheControl: "public, max-age=900, stale-while-revalidate=21600",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return problemResponse(
        createProblem({
          code: "INVALID_FILTER",
          instance: `${url.pathname}${url.search}`,
          error,
        }),
      );
    }

    return problemResponse(
      createProblem({
        code: "DATA_UNAVAILABLE",
        instance: `${url.pathname}${url.search}`,
      }),
    );
  }
}
