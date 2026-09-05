"use client";

import { ExternalLink, FileSearch, X } from "lucide-react";
import { useRef } from "react";
import { Dialog } from "radix-ui";

import type { PublicOffer } from "@/application/queries/contracts";
import type { AnalyticsContext } from "@/lib/analytics/client";
import {
  analyticsClassificationLabel,
  analyticsRankBucket,
  primaryAnalyticsEvidenceKind,
} from "@/lib/analytics/offer-events";

import { TrackedSourceOfferLink } from "./analytics/tracked-source-offer-link";
import { useAnalyticsCapture } from "./providers/analytics-provider";
import { Button } from "./ui/button";

type EvidencePanelProps = {
  offer: PublicOffer;
  rank: number;
  analyticsContext: AnalyticsContext;
};

const evidenceLabels: Record<PublicOffer["evidence"][number]["kind"], string> =
  {
    junior_claim: "Positionnement junior",
    required_experience: "Expérience obligatoire",
    desired_experience: "Expérience souhaitée",
    salary: "Salaire",
    remote: "Télétravail",
    technology: "Technologie",
    job_family: "Métier",
    conflict: "Contradiction",
    exclusion: "Exclusion",
    ambiguity: "Ambiguïté",
    other: "Autre preuve",
  };

function classificationLabel(offer: PublicOffer): string {
  if (offer.classification.status === "ambiguous") return "Ambiguë";
  if (offer.classification.status === "unclassified") return "Non classée";
  if (offer.classification.contradictoryJunior === true)
    return "Junior contradictoire";
  if (offer.classification.beginnerFriendly === true)
    return "Débutant explicitement accepté";
  if (offer.classification.claimsJunior === true)
    return "Junior, seuil non résolu";
  return "Pas explicitement junior";
}

function EvidenceGroup({
  title,
  evidence,
}: {
  title: string;
  evidence: PublicOffer["evidence"];
}) {
  return (
    <section className="evidence-group">
      <h3>{title}</h3>
      {evidence.length === 0 ? (
        <p className="evidence-empty">
          Aucune preuve explicite dans ce groupe.
        </p>
      ) : (
        <ul>
          {evidence.map((item, index) => (
            <li key={`${item.ruleId}-${index}`}>
              <span className="evidence-kind">{evidenceLabels[item.kind]}</span>
              <mark>{item.excerpt}</mark>
              <span className="evidence-rule">
                Règle {item.ruleId}
                {item.normalizedValue ? ` · ${item.normalizedValue}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function EvidencePanel({
  offer,
  rank,
  analyticsContext,
}: EvidencePanelProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const capture = useAnalyticsCapture();
  const analyticsClassification = analyticsClassificationLabel(offer);
  const juniorEvidence = offer.evidence.filter((item) =>
    ["junior_claim", "conflict", "ambiguity"].includes(item.kind),
  );
  const experienceEvidence = offer.evidence.filter((item) =>
    ["required_experience", "desired_experience"].includes(item.kind),
  );
  const otherEvidence = offer.evidence.filter(
    (item) =>
      !juniorEvidence.includes(item) && !experienceEvidence.includes(item),
  );

  function trackOpening(open: boolean) {
    if (!open) return;
    capture(
      {
        name: "offer_opened",
        properties: {
          classification: analyticsClassification,
          entry_point: "offer_table",
          rank_bucket: analyticsRankBucket(rank),
        },
      },
      analyticsContext,
    );

    const evidenceKind = primaryAnalyticsEvidenceKind(offer);
    if (evidenceKind) {
      capture(
        {
          name: "evidence_expanded",
          properties: {
            classification: analyticsClassification,
            evidence_kind: evidenceKind,
          },
        },
        analyticsContext,
      );
    }
  }

  return (
    <Dialog.Root onOpenChange={trackOpening}>
      <Dialog.Trigger asChild>
        <Button variant="outline" size="sm">
          <FileSearch data-icon="inline-start" /> Voir la preuve
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="evidence-overlay" />
        <Dialog.Content
          className="evidence-panel"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            titleRef.current?.focus();
          }}
        >
          <header className="evidence-panel__header">
            <div>
              <p className="section-label">Preuve de classification</p>
              <Dialog.Title asChild>
                <h2 ref={titleRef} tabIndex={-1}>
                  {offer.title}
                </h2>
              </Dialog.Title>
              <Dialog.Description>
                {offer.companyName ?? "Entreprise non renseignée"}
                {offer.locationLabel ? ` · ${offer.locationLabel}` : ""}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Fermer les preuves"
              >
                <X aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </header>

          <div
            className="evidence-panel__body"
            tabIndex={0}
            aria-label="Preuves détaillées, zone défilante"
          >
            <dl className="evidence-summary">
              <div>
                <dt>Classification</dt>
                <dd>{classificationLabel(offer)}</dd>
              </div>
              <div>
                <dt>Expérience structurée</dt>
                <dd>{offer.experienceLabel ?? "Non renseignée"}</dd>
              </div>
              <div>
                <dt>Minimum extrait</dt>
                <dd>
                  {offer.minimumExperienceMonths === null
                    ? "Non résolu"
                    : `${offer.minimumExperienceMonths} mois`}
                </dd>
              </div>
            </dl>

            <EvidenceGroup title="Preuves junior" evidence={juniorEvidence} />
            <EvidenceGroup
              title="Preuves d’expérience"
              evidence={experienceEvidence}
            />
            {otherEvidence.length > 0 ? (
              <EvidenceGroup title="Autres preuves" evidence={otherEvidence} />
            ) : null}

            <section className="evidence-group">
              <h3>Avertissements et règles</h3>
              {offer.classification.warnings.length === 0 ? (
                <p className="evidence-empty">Aucun avertissement.</p>
              ) : (
                <ul className="evidence-warning-list">
                  {offer.classification.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <footer className="evidence-panel__footer">
            <span>Classificateur {offer.classification.classifierVersion}</span>
            {offer.source.offerUrl ? (
              <Button asChild>
                <TrackedSourceOfferLink
                  href={offer.source.offerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  analyticsContext={analyticsContext}
                  classification={analyticsClassification}
                >
                  Voir l’offre originale
                  <span className="sr-only"> (nouvel onglet)</span>
                  <ExternalLink data-icon="inline-end" />
                </TrackedSourceOfferLink>
              </Button>
            ) : (
              <span>Lien vers l’offre indisponible</span>
            )}
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
