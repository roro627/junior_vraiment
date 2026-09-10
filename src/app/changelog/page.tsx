import type { Metadata } from "next";

import { TrustPage } from "@/components/trust-page";
import { buildStaticPageMetadata } from "@/lib/seo/static-metadata";

export const metadata: Metadata = buildStaticPageMetadata({
  canonical: "/changelog",
  title: "Changelog — Junior, vraiment ?",
  description: "Historique public des évolutions importantes du projet.",
});

export default function ChangelogPage() {
  return (
    <TrustPage
      eyebrow="Historique public"
      title="Changelog"
      lead="Les évolutions du produit, de la méthode et de la chaîne de données sont consignées séparément lorsqu’elles n’ont pas le même impact."
    >
      <section>
        <p className="section-label">
          10 septembre 2026 · Interface et fiabilité
        </p>
        <h2>Une lecture plus cohérente, des preuves toujours accessibles</h2>
        <ul>
          <li>
            Nouvelle identité orange déployée sur l’observatoire, Explorer et
            les pages de confiance.
          </li>
          <li>
            Filtres partageables, navigation clavier, petits écrans et mouvement
            réduit vérifiés.
          </li>
          <li>
            Historique et versions de calcul conservés : une refonte visuelle ne
            change pas les chiffres.
          </li>
          <li>
            Collecte complète du 10 septembre confirmée ; incidents antérieurs
            conservés avec leur résolution.
          </li>
        </ul>
      </section>
      <section>
        <p className="section-label">4 septembre 2026 · En préparation</p>
        <h2>Première chaîne vérifiable de bout en bout</h2>
        <ul>
          <li>
            Connexion réelle à France Travail, Neon, Trigger.dev et Vercel.
          </li>
          <li>
            Ingestion durable, snapshots et publication atomique du dataset.
          </li>
          <li>
            Classificateur déterministe 1.2 avec preuves et jeu de référence.
          </li>
          <li>API publique, accueil et Explorateur alimentés par Neon.</li>
          <li>
            Filtres URL, pagination signée et panneau de preuves accessible.
          </li>
        </ul>
      </section>
      <section>
        <p className="section-label">2 septembre 2026 · 1.0.0</p>
        <h2>Cadrage initial</h2>
        <p>
          Publication des spécifications produit, architecture, données, design,
          animation, sécurité, déploiement et plan d’implémentation.
        </p>
      </section>
      <section>
        <h2>Historique technique complet</h2>
        <p>
          Le fichier source du changelog est maintenu dans le dépôt public et
          reste la référence détaillée.
        </p>
        <a
          className="text-link"
          href="https://github.com/roro627/junior_vraiment/blob/main/CHANGELOG.md"
          target="_blank"
          rel="noopener noreferrer"
        >
          Lire CHANGELOG.md<span className="sr-only"> (nouvel onglet)</span>
        </a>
      </section>
    </TrustPage>
  );
}
