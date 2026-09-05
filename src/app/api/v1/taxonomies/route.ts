import { getCachedPublicTaxonomies } from "@/application/queries/cached-public-data";
import { jsonResponseWithEtag } from "@/application/queries/http-response";
import { createProblem, problemResponse } from "@/application/queries/problem";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (url.search.length > 0) {
    return problemResponse(
      createProblem({
        code: "INVALID_FILTER",
        instance: `${url.pathname}${url.search}`,
      }),
    );
  }

  try {
    const response = await getCachedPublicTaxonomies();
    return jsonResponseWithEtag({
      request,
      body: response,
      datasetVersion: response.meta.datasetVersion,
      cacheControl: "public, max-age=86400",
    });
  } catch {
    return problemResponse(
      createProblem({
        code: "DATA_UNAVAILABLE",
        instance: url.pathname,
      }),
    );
  }
}
