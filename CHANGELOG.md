# Changelog

Toutes les modifications notables de la documentation et, une fois le développement commencé, du produit sont consignées ici.

Le format suit l'esprit de *Keep a Changelog*. Le versionnement du produit, de la méthodologie, du classificateur, de la taxonomie et du schéma de données reste indépendant lorsque leur impact diffère.

## [Unreleased]

### Added

- Connexions réelles vérifiées avec France Travail, Neon, Trigger.dev et Vercel.
- Adaptateur France Travail validé sur payload observé et ingestion technique limitée idempotente.
- Schéma PostgreSQL/Drizzle migré, snapshots immuables et bascule atomique de dataset testés.
- Jeu de référence hors ligne à passe LLM A unique, protocole et ADR associés.
- Rapport reproductible du classificateur 1.2 avec deltas, preuves et seuils de lancement validés.
- Rejet mesuré du query set 1.0, candidat 2.0 filtré par intitulé et validation de pertinence à passe LLM A unique.
- Collecteur de validation France Travail avec traçabilité requête-offre, reprise sur erreur transitoire et backoff avec jitter.
- Ingestion complète durable sur 335 requêtes : checkpoints de pages, quarantaine persistée, observations dédupliquées et reprise après erreur HTTP 429 réellement vérifiée.
- Premier dataset complet publié depuis Trigger.dev avec 1 256 offres figées, 1 256 classifications, qualité validée et KPI principal calculé sur le périmètre publié.
- Cycle de vie des offres fondé sur deux absences consécutives éligibles, sans fermeture après une collecte partielle.
- Enrichissements déterministes du salaire, du télétravail et des technologies, avec preuves et trois KPI publiés sur le dataset figé.
- Première route publique `/api/v1/data-status` déployée avec cache, ETag, réponse 304 et Problem Details.
- Modèles de lecture publics `overview`, `trends`, `offers` et `taxonomies` adossés au dataset figé, avec filtres validés, pagination signée, caches tagués, ETag et tests contractuels.
- Budgets de lecture vérifiés sur Neon : KPI et explorer sous leurs seuils p95, avec tests de performance live reproductibles.
- Fondations visuelles issues des maquettes, composants produit documentés dans Storybook et accueil responsive alimenté par les données publiées.
- Explorateur public avec filtres URL, pagination signée, table desktop, cartes mobile et panneau de preuves accessible.
- Pages de confiance pour la méthodologie, l’état des données, les limites, le changelog, le projet et les signalements.
- Compteur durable d’offres fermées ajouté aux nouvelles exécutions ; les exécutions antérieures restent explicitement non historisées.
- Trois insights France publiés depuis les métriques figées, avec pages canoniques, cartes sociales 1200 × 630, partage et correction visible.
- Analytics manuels allowlistés et respectueux de DNT, maintenus désactivés jusqu’à activation explicite après revue juridique.

## [1.0.0] — 2026-09-02

### Added

- README principal et spécification normative.
- Architecture Next.js App Router et flux de données.
- Choix de stack et exclusions explicites.
- Méthodologie déterministe de classification des offres junior.
- Modèle PostgreSQL et schéma SQL de référence.
- Contrat API public et OpenAPI 3.1, accompagné de fixtures complètes validables.
- Design system, responsive et spécification des animations.
- Stratégie de tests, accessibilité et budgets de performance.
- Sécurité, confidentialité, conformité et attribution.
- Déploiement, supervision, incidents et rollback.
- SEO, cartes sociales et plan analytics respectueux des données.
- Plan d'implémentation, règles éditoriales, glossaire et références.
- ADR structurants, taxonomie initiale et exemples de règles.
- Définitions machine des taux, volumes et distributions, registre de requêtes sécurisé et taxonomie analytics.
- Rapport de validation et manifeste d'intégrité du dossier.
- Checklists d'intégration de la maquette, dataset, Definition of Done et lancement.
