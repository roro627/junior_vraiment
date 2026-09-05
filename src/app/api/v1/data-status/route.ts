import { getCachedDataStatus } from "@/application/queries/cached-public-data";
import { jsonResponseWithEtag } from "@/application/queries/http-response";
import { createProblem, problemResponse } from "@/application/queries/problem";

export async function GET(request: Request): Promise<Response> {
  try {
    const response = await getCachedDataStatus();

    return jsonResponseWithEtag({
      request,
      body: response,
      datasetVersion: response.meta.datasetVersion,
      cacheControl: "public, max-age=60",
    });
  } catch {
    return problemResponse(
      createProblem({
        code: "DATA_UNAVAILABLE",
        instance: new URL(request.url).pathname,
      }),
    );
  }
}
