import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { getCachedPublicInsight } from "@/application/queries/cached-public-data";
import { InsightOgCard } from "@/components/og/insight-card";
import { isExternalDataBuildSkipped } from "@/lib/env";
import { buildInsightOgModel, INSIGHT_OG_SIZE } from "@/lib/seo/build-og-model";
import { isSourceOnlyInsightBuildSlug } from "@/lib/seo/insight-build";
import { resolveSiteUrl } from "@/lib/site-url";

const geistRegular = await readFile(
  join(
    process.cwd(),
    "node_modules",
    "next",
    "dist",
    "compiled",
    "@vercel",
    "og",
    "Geist-Regular.ttf",
  ),
);

function unavailableInsightImage(): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        background: "#f7f5fb",
        color: "#17152b",
        fontFamily: "Geist",
        fontSize: 54,
      }}
    >
      Insight indisponible
    </div>,
    {
      ...INSIGHT_OG_SIZE,
      status: 404,
      fonts: [
        {
          name: "Geist",
          data: Uint8Array.from(geistRegular).buffer,
          weight: 400,
          style: "normal",
        },
      ],
    },
  );
}

export async function generateImageMetadata({
  params,
}: {
  params: { slug: string };
}) {
  if (isExternalDataBuildSkipped()) return [];

  const insight = await getCachedPublicInsight(params.slug);
  if (!insight) return [];

  return [
    {
      id: "primary",
      alt: insight.ogAlt,
      size: INSIGHT_OG_SIZE,
      contentType: "image/png",
    },
  ];
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
  id: Promise<string | number>;
}) {
  const { slug } = await params;
  if (isSourceOnlyInsightBuildSlug(slug)) {
    return unavailableInsightImage();
  }
  const insight = await getCachedPublicInsight(slug);

  if (!insight) {
    return unavailableInsightImage();
  }

  return new ImageResponse(
    <InsightOgCard model={buildInsightOgModel(insight, resolveSiteUrl())} />,
    {
      ...INSIGHT_OG_SIZE,
      fonts: [
        {
          name: "Geist",
          data: Uint8Array.from(geistRegular).buffer,
          weight: 400,
          style: "normal",
        },
      ],
      headers: {
        "Cache-Control": "public, max-age=86400, immutable",
      },
    },
  );
}
