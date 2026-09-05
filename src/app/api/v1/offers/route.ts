import { z } from "zod";

import { getCachedPublicOffers } from "@/application/queries/cached-public-data";
import {
  offersSearchParamsSchema,
  parseApiSearchParams,
} from "@/application/queries/contracts";
import { jsonResponseWithEtag } from "@/application/queries/http-response";
import { InvalidCursorError } from "@/application/queries/public-id";
import { createProblem, problemResponse } from "@/application/queries/problem";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);

  try {
    const query = parseApiSearchParams(
      url.searchParams,
      offersSearchParamsSchema,
    );
    const result = await getCachedPublicOffers(query);
    if (result.outcome === "invalid_cursor") {
      return problemResponse(
        createProblem({
          code: "INVALID_CURSOR",
          instance: `${url.pathname}${url.search}`,
        }),
      );
    }
    const response = result.response;

    return jsonResponseWithEtag({
      request,
      body: response,
      datasetVersion: response.meta.datasetVersion,
      cacheControl: "public, max-age=60, stale-while-revalidate=600",
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
    if (error instanceof InvalidCursorError) {
      return problemResponse(
        createProblem({
          code: "INVALID_CURSOR",
          instance: `${url.pathname}${url.search}`,
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
