import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";

import { TrustPage } from "@/components/trust-page";
import { buildStaticPageMetadata } from "@/lib/seo/static-metadata";

export const metadata: Metadata = buildStaticPageMetadata({
  canonical: "/a-propos",
  title: "À propos — Junior, vraiment ?",
  description:
    "Objectif, indépendance, code source et attribution de Junior, vraiment ?",
});

export default function AboutPage() {
  return (
    <TrustPage
      eyebrow="À propos du projet"
      title="Mesurer les annonces, pas juger les personnes"
      lead="Junior, vraiment ? est un observatoire indépendant conçu pour rendre le marché tech junior français plus lisible et plus vérifiable."
      navigation={[
        { href: "#mission", label: "Mission" },
        { href: "#independance", label: "Indépendance" },
        { href: "#ouverture", label: "Code et données" },
        { href: "#contact", label: "Contact" },
      ]}
    >
      <section id="mission">
        <p className="section-label">Mission</p>
        <h2>Transformer une impression en question mesurable</h2>
        <p>
          Le projet aide les candidats, recruteurs, formateurs et journalistes à
          vérifier ce que les annonces demandent réellement. Il analyse des
          formulations publiées&nbsp;: il ne prétend pas connaître l’intention
          d’une entreprise ni le résultat final d’un recrutement.
        </p>
      </section>

      <section id="independance">
        <p className="section-label">Indépendance</p>
        <h2>Un objectif non commercial</h2>
        <p>
          Le site ne vend ni offre sponsorisée, ni classement d’entreprise, ni
          service de recrutement. Il ne demande pas de compte, de CV ou de
          profil candidat. France Travail fournit la source initiale mais
          n’édite pas les conclusions de l’observatoire.
        </p>
      </section>

      <section id="ouverture">
        <p className="section-label">Ouverture</p>
        <h2>Un dépôt public et une méthode reproductible</h2>
        <p>
          Le code, les règles, les migrations et les fixtures publiables sont
          consultables dans le dépôt. Les versions du dataset, du
          classificateur, des métriques et des taxonomies évoluent
          indépendamment.
        </p>
        <a
          className="text-link external-text-link"
          href="https://github.com/roro627/junior_vraiment"
          target="_blank"
          rel="noopener noreferrer"
        >
          Ouvrir le dépôt GitHub
          <span className="sr-only"> (nouvel onglet)</span>
          <ExternalLink aria-hidden="true" />
        </a>
        <div className="license-notice">
          <strong>Licence</strong>
          <p>
            La licence MIT est prévue pour le code, mais son attribution
            juridique n’est pas encore finalisée. Les données France Travail, la
            marque du fournisseur et la maquette ne sont pas couvertes par cette
            licence.
          </p>
        </div>
      </section>

      <section id="contact">
        <p className="section-label">Contact et corrections</p>
        <h2>Une erreur doit pouvoir être reproduite</h2>
        <p>
          Les erreurs de données ou de classification suivent une procédure
          publique. Les vulnérabilités de sécurité ne doivent pas être publiées
          dans une issue ordinaire.
        </p>
        <div className="trust-actions">
          <a className="text-link" href="/signaler">
            Signaler une erreur de donnée
          </a>
          <a className="text-link" href="/methodologie#corrections">
            Lire la procédure de correction
          </a>
        </div>
      </section>
    </TrustPage>
  );
}
