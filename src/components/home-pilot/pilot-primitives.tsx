import type { CSSProperties, ReactNode } from "react";
import { ArrowRight, ArrowUpRight, Plus } from "lucide-react";
import Link from "next/link";
import type { OverviewResponse } from "@/application/queries/contracts";
import { formatInteger, formatRate } from "@/lib/format";
import { JUNIOR_OBSERVATION_METRIC_VERSION } from "@/domain/metrics/junior-observation";
import { Button } from "../ui/button";

export function PilotLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a className="pilot-link" href={href}>
      {children}
      <ArrowUpRight aria-hidden="true" />
    </a>
  );
}

export function PilotSectionHeading({
  number,
  title,
  detail,
}: {
  number: string;
  title: string;
  detail?: string;
}) {
  return (
    <header className="pilot-section-heading">
      <div>
        <span className="pilot-index">{number}</span>
        <h2>{title}</h2>
      </div>
      {detail ? <p>{detail}</p> : null}
    </header>
  );
}

export function PilotHeader({ home = true }: { home?: boolean }) {
  return (
    <header className="pilot-header">
      <div className="pilot-container pilot-header__inner">
        <Link
          className="pilot-wordmark"
          href="/"
          prefetch={false}
          aria-label="Junior, vraiment ? — accueil"
        >
          Junior, vraiment ?
        </Link>
        <nav className="pilot-navigation" aria-label="Navigation principale">
          <a
            href={home ? "#observer" : "/"}
            aria-current={home ? "page" : undefined}
          >
            L’observatoire
          </a>
          <Link href="/explorer" prefetch={false}>
            Explorer
          </Link>
          <Link href="/methodologie" prefetch={false}>
            Méthodologie
          </Link>
        </nav>
        {/* The native menu is usable before React loads; open belongs to the browser. */}
        <details className="pilot-mobile-nav" suppressHydrationWarning>
          <summary>
            Menu <Plus aria-hidden="true" />
          </summary>
          <nav aria-label="Navigation mobile">
            <a href={home ? "#observer" : "/"}>L’observatoire</a>
            <Link href="/explorer">Explorer les offres</Link>
            <Link href="/methodologie">Méthodologie</Link>
            <Link href="/insights">Les analyses</Link>
            <Link href="/statut-donnees">État des données</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}

export function PilotIntroduction({
  explorerHref = "/explorer",
}: {
  explorerHref?: string;
}) {
  return (
    <div className="pilot-introduction">
      <p className="pilot-eyebrow">L’observatoire du premier emploi tech</p>
      <h1>
        Le marché tech junior,
        <br className="pilot-title-break" /> sans les idées reçues.
      </h1>
      <p className="pilot-introduction__copy">
        Expérience, salaires, opportunités :<br className="pilot-title-break" />{" "}
        ce que disent vraiment les offres d’emploi.
      </p>
      <div className="pilot-introduction__actions">
        <Button asChild className="pilot-button">
          <a href={explorerHref}>
            Explorer les offres <ArrowRight aria-hidden="true" />
          </a>
        </Button>
        <a className="pilot-link" href="/methodologie#calcul">
          Comprendre les chiffres <ArrowRight aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}

export type PilotHeadlineProps = {
  metric: OverviewResponse["data"]["headline"];
  explorerHref: string;
  scopeLabel: string;
};

export function PilotHeadline({
  metric,
  explorerHref,
  scopeLabel,
}: PilotHeadlineProps) {
  const rate = formatRate(metric.value);
  return (
    <section className="pilot-headline" aria-labelledby="pilot-headline-title">
      <div className="pilot-headline__top">
        <span className="pilot-eyebrow">Junior… avec de l’expérience ?</span>
      </div>
      <div className="sr-only">
        <span>{scopeLabel}</span>
      </div>
      {rate === null ? (
        <h2 className="pilot-headline__unavailable" id="pilot-headline-title">
          Pas assez
          <br />
          de données.
        </h2>
      ) : (
        <h2 className="pilot-headline__value" id="pilot-headline-title">
          {rate.replace(/\s*%$/u, "")}
          <span>&nbsp;%</span>
        </h2>
      )}
      <p className="pilot-headline__statement">
        {rate === null ? (
          "Élargissez le périmètre pour obtenir un taux publiable."
        ) : (
          <>
            des offres se présentant comme « junior » demandent au moins 2 ans
            d’expérience.
          </>
        )}
      </p>
      <p className="pilot-headline__fraction">
        <strong>
          {formatInteger(metric.numerator)} sur{" "}
          {formatInteger(metric.denominator)}
        </strong>{" "}
        {metric.metricVersion === JUNIOR_OBSERVATION_METRIC_VERSION
          ? "offres junior au seuil résolu"
          : "offres junior classables"}
      </p>
      {metric.sampleQuality === "caution" ? (
        <p className="pilot-headline__caution">
          Échantillon faible · à interpréter avec prudence.
        </p>
      ) : null}
      <div className="pilot-headline__note">
        <p>
          {formatInteger(metric.ambiguousCount)}{" "}
          {metric.metricVersion === JUNIOR_OBSERVATION_METRIC_VERSION
            ? "seuils ambigus"
            : "cas ambigus"}{" "}
          et {formatInteger(metric.unknownCount)} sans expérience exploitable
          exclus du calcul. Couverture :{" "}
          {formatRate(metric.coverage) ?? "non calculable"}.
        </p>
      </div>
      {metric.value === 0 && metric.numerator === 0 ? (
        <aside className="pilot-zero-reading" aria-label="Comprendre ce zéro">
          <strong>Aucun cas confirmé dans les offres classables.</strong>
          <details suppressHydrationWarning>
            <summary>Pourquoi ce zéro ne dit pas tout</summary>
            <p>
              Ce zéro concerne uniquement les offres classables observées.
              {metric.ambiguousCount > 0
                ? " Les cas dont le seuil ne peut pas être résolu ne sont pas comptés dans ce taux."
                : " Il ne décrit pas toutes les offres du marché."}
            </p>
            <a href="/methodologie#calcul">Comment lire ce résultat ?</a>
          </details>
        </aside>
      ) : null}
      <div className="pilot-headline__foot">
        <a className="pilot-quiet-link" href={explorerHref}>
          Voir les offres <ArrowRight aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}

export type PilotDistributionItem = {
  key: string;
  label: string;
  count: number;
  share: number | null;
};

export function PilotDistribution({
  items,
  variant = "default",
}: {
  items: readonly PilotDistributionItem[];
  variant?: "default" | "ranked";
}) {
  if (items.length === 0) {
    return (
      <p className="pilot-chart__empty">
        Aucune observation dans ce périmètre. Essayez d’élargir les filtres.
      </p>
    );
  }
  return (
    <ol className={`pilot-distribution pilot-distribution--${variant}`}>
      {items.map((item, index) => (
        <li key={item.key}>
          <div className="pilot-distribution__label">
            <span>
              {variant === "ranked" ? (
                <span className="pilot-rank">
                  {String(index + 1).padStart(2, "0")}
                </span>
              ) : null}
              {item.label}
            </span>
            <span>
              <strong>{formatInteger(item.count)}</strong>
              <span className="pilot-distribution__share">
                {formatRate(item.share) ?? "—"}
              </span>
            </span>
          </div>
          <div className="pilot-distribution__track" aria-hidden="true">
            <span
              style={
                {
                  "--pilot-share": `${Math.min(1, Math.max(0, item.share ?? 0)) * 100}%`,
                } as CSSProperties
              }
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

export function PilotFooter() {
  return (
    <footer className="pilot-footer pilot-container">
      <div>
        <Link className="pilot-wordmark" href="/">
          Junior, vraiment ?
        </Link>
        <p>Une lecture indépendante du marché tech français.</p>
      </div>
      <nav aria-label="Liens de pied de page">
        <Link href="/insights">Les analyses</Link>
        <Link href="/statut-donnees">État des données</Link>
        <Link href="/methodologie">Méthodologie</Link>
        <Link href="/a-propos">À propos</Link>
        <Link href="/a-propos#confidentialite">Confidentialité</Link>
        <Link href="/limites">Limites</Link>
        <Link href="/signaler">Signaler une erreur</Link>
      </nav>
      <p className="pilot-footer__source">
        Données d’offres issues de France Travail et de partenaires
        participants. Observatoire indépendant, non affilié à France Travail. Ni
        exhaustif, ni un site de candidature.
      </p>
    </footer>
  );
}
