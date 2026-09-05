import type { ResponseMeta } from "@/application/queries/contracts";
import { METHODOLOGY_VERSION } from "@/domain/metrics/rate";

import type { AnalyticsContext } from "./client";

export const APP_VERSION = "0.1.0";

export function buildAnalyticsContext(
  meta: Pick<ResponseMeta, "datasetVersion" | "classifierVersion">,
): AnalyticsContext {
  return {
    appVersion: APP_VERSION,
    datasetId: meta.datasetVersion,
    classifierVersion: meta.classifierVersion,
    methodologyVersion: METHODOLOGY_VERSION,
  };
}
