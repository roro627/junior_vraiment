# Index de la documentation

Ce dossier constitue la source de vérité du produit **Junior, vraiment ?**. Les documents sont classés dans l'ordre recommandé de lecture.

## Parcours de lecture

### Pour comprendre le produit

1. [`../README.md`](../README.md) — vision, périmètre, stack et démarrage.
2. [`00-PRODUCT-SPEC.md`](./00-PRODUCT-SPEC.md) — problème, audiences, parcours, métriques et critères d'acceptation.
3. [`12-CONTENT-COPY.md`](./12-CONTENT-COPY.md) — ton, terminologie et textes structurants.
4. [`13-GLOSSARY.md`](./13-GLOSSARY.md) — définitions communes.

### Pour concevoir l'expérience

1. [`03-UX-UI-DESIGN-SYSTEM.md`](./03-UX-UI-DESIGN-SYSTEM.md) — règles visuelles, responsive et composants.
2. [`04-MOTION-SPEC.md`](./04-MOTION-SPEC.md) — grammaire d'animation, durées, ressorts et accessibilité.
3. [`10-SEO-SHARING-ANALYTICS.md`](./10-SEO-SHARING-ANALYTICS.md) — indexation, cartes sociales et mesure d'usage.
4. [`checklists/maquette-integration.md`](./checklists/maquette-integration.md) — contrôle de la maquette déposée dans `/maquette`.

### Pour construire le système

1. [`../STACK.md`](../STACK.md) — choix techniques imposés et technologies volontairement exclues.
2. [`15-BOOTSTRAP.md`](./15-BOOTSTRAP.md) — création reproductible du dépôt, outils et premiers contrôles.
3. [`01-ARCHITECTURE.md`](./01-ARCHITECTURE.md) — architecture logique, flux, cache et responsabilités.
4. [`02-DATA-METHODOLOGY.md`](./02-DATA-METHODOLOGY.md) — collecte, normalisation, classification et calculs.
5. [`05-DATABASE.md`](./05-DATABASE.md) — modèle relationnel, index et politique d'historisation.
6. [`06-API-CONTRACT.md`](./06-API-CONTRACT.md) — contrat des endpoints publics.
7. [`reference/openapi.yaml`](./reference/openapi.yaml) — contrat OpenAPI 3.1 lisible par les outils.
8. [`reference/openapi-examples.json`](./reference/openapi-examples.json) — fixtures complètes validées contre les schémas publics.
9. [`reference/schema.sql`](./reference/schema.sql) — schéma SQL de référence.
10. [`reference/initial-taxonomy.json`](./reference/initial-taxonomy.json) — taxonomie initiale des métiers et technologies.
11. [`reference/classifier-rules.example.json`](./reference/classifier-rules.example.json) — représentation versionnée des règles.
12. [`reference/metric-definitions.json`](./reference/metric-definitions.json) — définitions machine des populations, taux, volumes et distributions.
13. [`reference/query-set.template.json`](./reference/query-set.template.json) — registre de requêtes à valider contre le contrat France Travail actif.
14. [`reference/query-set-annotation-protocol.md`](./reference/query-set-annotation-protocol.md) — passe LLM A hors ligne pour mesurer la pertinence du registre.
15. [`reference/query-set.observed-v2-draft.json`](./reference/query-set.observed-v2-draft.json) — candidat filtré par intitulé, désactivé jusqu'à validation indépendante.
15. [`reference/events.json`](./reference/events.json) — événements analytiques autorisés.

### Pour valider et exploiter

1. [`07-TESTING-QUALITY.md`](./07-TESTING-QUALITY.md) — stratégie de tests et budgets qualité.
2. [`08-SECURITY-PRIVACY-LEGAL.md`](./08-SECURITY-PRIVACY-LEGAL.md) — sécurité, vie privée, licences et attribution.
3. [`09-DEPLOYMENT-OPERATIONS.md`](./09-DEPLOYMENT-OPERATIONS.md) — environnements, déploiement, supervision et incidents.
4. [`11-IMPLEMENTATION-PLAN.md`](./11-IMPLEMENTATION-PLAN.md) — ordre de réalisation et lots.
5. [`checklists/definition-of-done.md`](./checklists/definition-of-done.md) — définition de terminé.
6. [`checklists/launch.md`](./checklists/launch.md) — contrôle avant ouverture publique.
7. [`checklists/dataset-release.md`](./checklists/dataset-release.md) — contrôle avant publication d'un nouveau jeu de données.
8. [`../VALIDATION.md`](../VALIDATION.md) — validation automatisée du dossier et portes encore externes.
9. [`../DOCUMENTATION-MANIFEST.json`](../DOCUMENTATION-MANIFEST.json) — inventaire et empreintes du livrable.

## Décisions d'architecture

Les ADR sous [`adr/`](./adr/) enregistrent les décisions qui ne doivent pas être modifiées silencieusement :

| ADR | Décision |
|---|---|
| [`0001`](./adr/0001-nextjs-app-router.md) | Next.js App Router comme application full-stack unique |
| [`0002`](./adr/0002-deterministic-classifier.md) | Classificateur déterministe, explicable et versionné |
| [`0003`](./adr/0003-postgresql-drizzle.md) | PostgreSQL et Drizzle |
| [`0004`](./adr/0004-trigger-dev-jobs.md) | Trigger.dev pour les traitements planifiés et durables |
| [`0005`](./adr/0005-url-state.md) | Filtres publics portés par l'URL |
| [`0006`](./adr/0006-single-repository.md) | Dépôt unique sans monorepo au MVP |
| [`0007`](./adr/0007-motion-system.md) | Système de mouvement centralisé |
| [`0008`](./adr/0008-precomputed-metrics.md) | Agrégats pré-calculés et jeux de données atomiques |
| [`0009`](./adr/0009-single-pass-llm-reference-set.md) | Passe LLM A unique pour le jeu de référence hors production |

Toute modification structurante doit ajouter ou remplacer un ADR, préciser les conséquences et mettre à jour les documents concernés dans la même pull request.

## Hiérarchie en cas de contradiction

1. Les règles légales, de sécurité et la licence de la source priment.
2. Le contrat de données et la méthodologie priment sur le rendu visuel.
3. La spécification produit prime sur une commodité technique.
4. La maquette validée prime sur les exemples visuels de la documentation.
5. Un ADR accepté prime sur une préférence individuelle non documentée.

Une contradiction non résolue bloque la fusion : elle ne doit pas être tranchée implicitement dans le code.
