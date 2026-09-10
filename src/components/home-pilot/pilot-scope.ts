import type { OverviewQuery } from "@/application/queries/contracts";

export function scopeParameters(query: OverviewQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.job) params.set("job", query.job);
  if (query.technologies.length > 0)
    params.set("tech", query.technologies.join(","));
  if (query.area !== "france") params.set("area", query.area);
  if (query.contracts.length > 0)
    params.set("contract", query.contracts.join(","));
  if (query.remote) params.set("remote", query.remote);
  if (query.period !== "30d") params.set("period", query.period);
  return params;
}
