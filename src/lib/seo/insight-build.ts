import { isExternalDataBuildSkipped } from "@/lib/env";

export const SOURCE_ONLY_INSIGHT_BUILD_SLUG = "source-only-build";

export function isSourceOnlyInsightBuildSlug(slug: string): boolean {
  return (
    slug === SOURCE_ONLY_INSIGHT_BUILD_SLUG && isExternalDataBuildSkipped()
  );
}
