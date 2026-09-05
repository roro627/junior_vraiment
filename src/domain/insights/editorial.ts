export const INITIAL_INSIGHT_METRIC_KEYS = [
  "junior_contradiction_rate",
  "beginner_friendly_rate",
  "salary_transparency_rate",
] as const;

export type InitialInsightMetricKey =
  (typeof INITIAL_INSIGHT_METRIC_KEYS)[number];

export type InsightMetricSnapshot = {
  datasetId: string;
  metricKey: InitialInsightMetricKey;
  metricVersion: string;
  periodStart: string;
  periodEnd: string;
  numerator: number;
  denominator: number;
  populationCount: number;
  unknownCount: number;
  ambiguousCount: number;
  value: number | null;
  coverage: number | null;
  sampleQuality: "normal" | "caution" | "insufficient";
};

export type InitialInsightDraft = InsightMetricSnapshot & {
  slug: string;
  title: string;
  summary: string;
  ogAlt: string;
  filters: {
    job: null;
    technologies: [];
    area: "france";
    contracts: [];
    remote: null;
    period: "current";
  };
};

const percentFormatter = new Intl.NumberFormat("fr-FR", {
  style: "percent",
  maximumFractionDigits: 1,
});

const integerFormatter = new Intl.NumberFormat("fr-FR");

const globalFilters: InitialInsightDraft["filters"] = {
  job: null,
  technologies: [],
  area: "france",
  contracts: [],
  remote: null,
  period: "current",
};

function requiredRate(snapshot: InsightMetricSnapshot): string {
  if (snapshot.value === null || snapshot.sampleQuality === "insufficient") {
    throw new Error(
      `La métrique ${snapshot.metricKey} n'a pas un échantillon publiable.`,
    );
  }

  return percentFormatter.format(snapshot.value);
}

function fraction(snapshot: InsightMetricSnapshot): string {
  return `${integerFormatter.format(snapshot.numerator)} sur ${integerFormatter.format(snapshot.denominator)}`;
}

export function createInitialInsightDraft(
  snapshot: InsightMetricSnapshot,
): InitialInsightDraft {
  const value = requiredRate(snapshot);
  const date = snapshot.periodEnd;

  if (snapshot.metricKey === "junior_contradiction_rate") {
    return {
      ...snapshot,
      slug: `junior-et-deux-ans-france-${date}`,
      title: `${value} des offres junior classables demandent au moins deux ans d’expérience`,
      summary: `${fraction(snapshot)} offres se présentant comme « junior » avec un minimum obligatoire résolu demandent au moins 24 mois d’expérience. Les cas ambigus sont comptés à part.`,
      ogAlt: `Carte Junior, vraiment ? : ${value}, soit ${fraction(snapshot)} offres junior classables demandant au moins deux ans d’expérience en France, période du ${date}.`,
      filters: globalFilters,
    };
  }

  if (snapshot.metricKey === "beginner_friendly_rate") {
    return {
      ...snapshot,
      slug: `debutants-explicitement-acceptes-france-${date}`,
      title: `${value} des offres classables sont explicitement accessibles aux débutants`,
      summary: `${fraction(snapshot)} offres dont l’accessibilité a pu être résolue acceptent explicitement les débutants. Les absences de preuve et les cas ambigus ne sont pas transformés en refus.`,
      ogAlt: `Carte Junior, vraiment ? : ${value}, soit ${fraction(snapshot)} offres classables explicitement accessibles aux débutants en France, période du ${date}.`,
      filters: globalFilters,
    };
  }

  return {
    ...snapshot,
    slug: `transparence-salariale-france-${date}`,
    title: `${value} des offres publient une rémunération exploitable`,
    summary: `${fraction(snapshot)} offres publient une rémunération explicite sous une forme exploitable. Les formulations vagues comme « selon profil » ne sont pas comptées.`,
    ogAlt: `Carte Junior, vraiment ? : ${value}, soit ${fraction(snapshot)} offres avec une rémunération exploitable en France, période du ${date}.`,
    filters: globalFilters,
  };
}

export function insightExplorerHref(
  metricKey: InitialInsightMetricKey,
): string {
  const params = new URLSearchParams({ period: "current" });

  if (metricKey === "junior_contradiction_rate") {
    params.set("classification", "contradictory");
  } else if (metricKey === "beginner_friendly_rate") {
    params.set("classification", "beginner_friendly");
  } else {
    params.set("salaryPublished", "true");
  }

  return `/explorer?${params.toString()}`;
}
