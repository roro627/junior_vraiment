import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";

import { TrustPage } from "@/components/trust-page";
import { buildStaticPageMetadata } from "@/lib/seo/static-metadata";

export const metadata: Metadata = buildStaticPageMetadata({
  canonical: "/signaler",
  title: "Signaler une erreur — Junior, vraiment ?",
  description:
    "Procédure publique pour signaler une erreur de donnée ou de classification.",
});

export default function ReportPage() {
  return (
    <TrustPage
      eyebrow="Correction publique"
      title="Signaler une erreur"
      lead="Un signalement utile identifie l’offre et la décision observée sans recopier de donnée personnelle."
      navigation={[
        { href: "#donnees", label: "Donnée ou classification" },
        { href: "#traitement", label: "Traitement" },
        { href: "#securite", label: "Sécurité" },
      ]}
    >
      <section id="donnees">
        <p className="section-label">Issue publique</p>
        <h2>Erreur de donnée ou de classification</h2>
        <p>Préparez uniquement les éléments suivants&nbsp;:</p>
        <ul>
          <li>l’URL ou l’identifiant public de l’offre&nbsp;;</li>
          <li>la classification observée&nbsp;;</li>
          <li>la raison précise du désaccord&nbsp;;</li>
          <li>la version du classificateur affichée dans les preuves.</li>
        </ul>
        <p>
          Ne copiez pas de nom, d’adresse e-mail, de téléphone ou d’autre texte
          personnel présent dans une annonce.
        </p>
        <a
          className="report-link"
          href="https://github.com/roro627/junior_vraiment/issues/new?template=classification-error.yml"
          target="_blank"
          rel="noopener noreferrer"
        >
          Ouvrir le formulaire GitHub
          <span className="sr-only"> (nouvel onglet)</span>
          <ExternalLink aria-hidden="true" />
        </a>
      </section>

      <section id="traitement">
        <p className="section-label">Procédure</p>
        <h2>De l’erreur à une règle versionnée</h2>
        <ol>
          <li>Reproduire le cas dans une fixture minimale.</li>
          <li>Ajouter la preuve attendue.</li>
          <li>Corriger la règle déterministe.</li>
          <li>Mesurer les deltas sur le jeu de référence.</li>
          <li>Publier une nouvelle version et reclassifier si nécessaire.</li>
        </ol>
      </section>

      <section id="securite" className="security-warning">
        <p className="section-label">Canal distinct</p>
        <h2>Ne publiez pas une vulnérabilité dans une issue</h2>
        <p>
          Une fuite de secret, un accès non autorisé ou une injection nécessite
          un canal privé. GitHub transmet ce signalement uniquement au
          mainteneur du dépôt afin de permettre une analyse avant toute
          divulgation publique.
        </p>
        <a
          className="report-link"
          href="https://github.com/roro627/junior_vraiment/security/advisories/new"
          target="_blank"
          rel="noopener noreferrer"
        >
          Signaler une vulnérabilité en privé
          <span className="sr-only"> (nouvel onglet)</span>
          <ExternalLink aria-hidden="true" />
        </a>
      </section>
    </TrustPage>
  );
}
