import type { Metadata } from "next";

type StaticPageMetadataInput = Readonly<{
  canonical: `/${string}` | "/";
  description: string;
  index?: boolean;
  socialDescription?: string;
  title: string;
  twitterCard?: "summary" | "summary_large_image";
}>;

export function buildStaticPageMetadata({
  canonical,
  description,
  index,
  socialDescription = description,
  title,
  twitterCard = "summary",
}: StaticPageMetadataInput): Metadata {
  return {
    title,
    description,
    alternates: { canonical },
    ...(index === false
      ? { robots: { index: false, follow: true } }
      : undefined),
    openGraph: {
      type: "website",
      locale: "fr_FR",
      siteName: "Junior, vraiment ?",
      title,
      description: socialDescription,
      url: canonical,
    },
    twitter: {
      card: twitterCard,
      title,
      description: socialDescription,
    },
  };
}
