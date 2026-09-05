import {
  getCachedDataStatus,
  getCachedPublicOverview,
} from "@/application/queries/cached-public-data";
import type { OverviewQuery } from "@/application/queries/contracts";

import { DataFreshnessBadge } from "./data-freshness-badge";

export async function HomeDataFreshness({ query }: { query: OverviewQuery }) {
  const [overview, dataStatus] = await Promise.all([
    getCachedPublicOverview(query),
    getCachedDataStatus(),
  ]);
  const freshness =
    overview.meta.quality === "partial"
      ? ("partial" as const)
      : dataStatus.data.status !== "operational" ||
          dataStatus.data.freshness === "unavailable"
        ? ("incident" as const)
        : dataStatus.data.freshness;

  return (
    <DataFreshnessBadge
      freshness={freshness}
      dataAsOf={overview.meta.dataAsOf}
    />
  );
}
