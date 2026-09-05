import type { Metadata } from "next";

import { TrustPage } from "@/components/trust-page";
import { buildStaticPageMetadata } from "@/lib/seo/static-metadata";

export const metadata: Metadata = buildStaticPageMetadata({
  canonical: "/limites",
  title: "Limites — Junior, vraiment ?",
  description:
    "Ce que les données et indicateurs de Junior, vraiment ? permettent — et ne permettent pas — de conclure.",
});

const limits = [
  "Le périmètre dépend des offres accessibles via l’API France Travail et du jeu de requêtes publié.",
  "Les formulations libres peuvent rester ambiguës ; ces cas sont conservés et exclus des taux lorsqu’ils ne sont pas résolus.",
  "Une technologie citée n’est pas nécessairement exigée pour candidater.",
  "Le site analyse des annonces, pas les recrutements réellement effectués.",
  "Le terme « junior » n’a pas de définition juridique unique.",
  "Un faible échantillon local peut varier fortement et ne produit pas de faux 0 %.",
  "Une même offre peut être reprise par plusieurs partenaires malgré les règles de déduplication.",
  "Une entreprise peut corriger son annonce après la collecte ; les snapshots permettent de dater l’observation.",
  "L’expérience demandée ne résume pas toutes les barrières à l’entrée.",
] as const;

export default function LimitsPage() {
  return (
    <TrustPage
      eyebrow="Interprétation prudente"
      title="Ce que ces chiffres ne disent pas"
      lead="Une méthodologie explicite n’efface pas les limites de la source ni celles du langage des annonces."
    >
      <section>
        <h2>Limites connues</h2>
        <ol className="limits-list">
          {limits.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ol>
      </section>
      <section>
        <p className="section-label">Bonne lecture</p>
        <h2>Comparer seulement ce qui est comparable</h2>
        <p>
          Une évolution n’est interprétée qu’avec la même méthode, la même
          population et une couverture comparable. Les changements de
          classificateur ou de jeu de requêtes sont versionnés et annotés.
        </p>
        <div className="trust-actions">
          <a className="text-link" href="/methodologie">
            Lire la méthode complète
          </a>
          <a className="text-link" href="/statut-donnees">
            Vérifier les données actuelles
          </a>
        </div>
      </section>
    </TrustPage>
  );
}
