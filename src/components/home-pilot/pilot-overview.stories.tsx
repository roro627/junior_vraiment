import type { Meta, StoryObj } from "@storybook/react-vite";
import exampleDocument from "../../../docs/reference/openapi-examples.json";
import {
  overviewResponseSchema,
  taxonomiesResponseSchema,
} from "@/application/queries/contracts";
import { buildAnalyticsContext } from "@/lib/analytics/context";
import { DataFreshnessBadge } from "../data-freshness-badge";
import { FilterBar } from "../filter-bar";
import { HomeSkeleton } from "../home-skeleton";
import { PilotMetrics } from "./pilot-metrics";
import { PilotPeriod } from "./pilot-period";
import {
  PilotHeader,
  PilotHeadline,
  PilotIntroduction,
} from "./pilot-primitives";
import "@/styles/home-pilot.css";

const overview = overviewResponseSchema.parse(exampleDocument.overview);
const taxonomies = taxonomiesResponseSchema.parse(
  exampleDocument.taxonomies,
).data;

function OverviewPreview({
  freshness = "fresh",
  empty = false,
  loading = false,
  zero = false,
}: {
  freshness?: "fresh" | "partial" | "stale" | "incident";
  empty?: boolean;
  loading?: boolean;
  zero?: boolean;
}) {
  const data = overview.data;
  const headline = empty
    ? {
        ...data.headline,
        value: null,
        denominator: 0,
        numerator: 0,
        populationCount: 0,
        unknownCount: 0,
        ambiguousCount: 0,
        coverage: null,
        sampleQuality: "insufficient" as const,
      }
    : zero
      ? { ...data.headline, value: 0, numerator: 0 }
      : data.headline;
  return (
    <div className="home-pilot">
      <PilotHeader />
      <main>
        {loading ? (
          <HomeSkeleton />
        ) : (
          <>
            <section
              className="pilot-container pilot-hero"
              aria-label="Aperçu de démonstration"
            >
              <PilotIntroduction />
              <PilotHeadline
                metric={headline}
                explorerHref="/explorer"
                scopeLabel="France · 30 jours"
              />
              <div className="pilot-hero__meta">
                <span className="pilot-scope">France · 30 derniers jours</span>
                <span>Source : France Travail · Fixture UI</span>
                <DataFreshnessBadge
                  freshness={freshness}
                  dataAsOf="2026-09-07T08:00:00Z"
                />
              </div>
            </section>
            <section className="pilot-container pilot-observation">
              <div className="pilot-observation__heading">
                <div>
                  <h2>Votre lecture du marché.</h2>
                  <p className="pilot-observation__description">
                    Un même périmètre pour tous les chiffres. À vous de
                    l’affiner.
                  </p>
                </div>
                <PilotPeriod scope={data.scope} />
              </div>
              {freshness === "partial" ? (
                <aside className="data-warning" role="status">
                  Une partie de la collecte est incomplète.
                </aside>
              ) : null}
              <FilterBar
                presentation="pilot"
                scope={data.scope}
                taxonomies={taxonomies}
                analyticsContext={buildAnalyticsContext(overview.meta)}
              />
            </section>
            <PilotMetrics
              sampleSize={empty ? 0 : overview.meta.sampleSize}
              beginnerFriendly={
                empty
                  ? {
                      ...data.beginnerFriendly,
                      value: null,
                      numerator: 0,
                      denominator: 0,
                      coverage: null,
                    }
                  : data.beginnerFriendly
              }
              salaryTransparency={
                empty
                  ? {
                      ...data.salaryTransparency,
                      value: null,
                      numerator: 0,
                      denominator: 0,
                      coverage: null,
                    }
                  : data.salaryTransparency
              }
            />
          </>
        )}
      </main>
    </div>
  );
}
const meta = {
  title: "Pilote accueil/Direction orange",
  component: OverviewPreview,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Maquette interactive sur fixtures UI explicites, non reliée à la collecte. Desktop et mobile, contrôles clavier et états de données.",
      },
    },
  },
} satisfies Meta<typeof OverviewPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Normal: Story = {};
export const ZeroConfirme: Story = { args: { zero: true } };
export const Partiel: Story = { args: { freshness: "partial" } };
export const Ancien: Story = { args: { freshness: "stale" } };
export const Incident: Story = { args: { freshness: "incident" } };
export const Vide: Story = { args: { empty: true } };
export const Chargement: Story = { args: { loading: true } };
