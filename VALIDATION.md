# Validation du dossier de spécification

> Ce document conserve la validation initiale du 2 septembre, avant développement. L'état réel
> de l'application et des services est consigné dans
> [la validation opérationnelle](docs/18-OPERATIONS-VALIDATION.md) ; les points ci-dessous ne
> constituent pas une liste actuelle de fonctionnalités manquantes.

## Statut

| Élément | Résultat |
|---|---|
| Date de validation | 2 septembre 2026 |
| Version de la documentation | `1.0.0` |
| Résultat | **Validé pour démarrer l'implémentation** |
| Nature du livrable | Spécifications et contrats de référence, pas application déjà développée |

La validation porte sur la cohérence interne du dossier et sur le caractère exploitable des contrats fournis. Elle ne remplace pas les contrôles qui exigent des identifiants France Travail, une base PostgreSQL réelle, les fournisseurs finaux ou la maquette à venir.

---

## Contrôles automatisés exécutés

### Intégrité des fichiers

- fichiers non vides et décodables en UTF-8 ;
- JSON et YAML syntaxiquement valides ;
- blocs de code Markdown équilibrés ;
- quatorze exemples `json` inclus dans la documentation parsés avec succès ;
- liens Markdown relatifs résolus vers des fichiers ou dossiers existants ;
- absence des anciens vocabulaires de classification connus comme incompatibles.

### Contrat OpenAPI

- document OpenAPI `3.1.0` parsé ;
- cinq opérations publiques dotées d'un `operationId` unique :
  - `getOverview` ;
  - `getTrends` ;
  - `listOffers` ;
  - `getTaxonomies` ;
  - `getDataStatus` ;
- toutes les références locales `$ref` résolues ;
- les 38 schémas de composants acceptés comme JSON Schema Draft 2020-12 ;
- les six fixtures de [`docs/reference/openapi-examples.json`](./docs/reference/openapi-examples.json) validées contre leur schéma : cinq enveloppes de succès et un Problem Details ;
- tests négatifs exécutés sur les seuils d'échantillon : une valeur non nulle sous 20 offres, une qualité `caution` sous 20 et une qualité `normal` sous 50 sont bien rejetées.

### Métriques et données

- invariants vérifiés sur tous les taux et points de tendance fournis :
  - `0 <= numerator <= denominator <= populationCount` ;
  - `populationCount = denominator + unknownCount + ambiguousCount` ;
  - `coverage = denominator / populationCount` lorsque la population est non nulle ;
  - `value = numerator / denominator` uniquement lorsque l'échantillon est publiable ;
- identifiants et versions des taux alignés entre OpenAPI, fixtures et définitions de métriques ;
- identifiants analytics alignés avec les taux, volumes et distributions déclarés ;
- registre de requêtes initial entièrement désactivé tant que le contrat source actif n'a pas été validé ;
- familles de métiers du registre de requêtes présentes dans la taxonomie ;
- identifiants et ordres de taxonomie uniques ;
- expressions régulières du classificateur compilées ;
- identifiants de règles uniques et conformes au format public ;
- contrat tri-état et sept segments publics présents, dont `junior_unresolved`.

### Schéma SQL de référence

- seize tables identifiées avec leurs fermetures correspondantes ;
- parenthèses équilibrées après retrait des commentaires et chaînes ;
- présence des contraintes structurantes sur les métriques, snapshots, classifications et datasets ;
- séparation explicite entre `sample_quality` et qualité globale du dataset ;
- verrou unique partiel empêchant deux traitements actifs concurrents du même périmètre sans supprimer l'historique des relances ;
- segment public dérivé dans la vue des offres courantes ;
- volumes, couverture, inconnus et ambigus persistés pour les métriques et insights.

---

## Contrôles à effectuer pendant le bootstrap

Ces points sont volontairement bloquants et ne peuvent pas être inventés dans une documentation statique.

### France Travail

Avant d'activer une requête de collecte :

1. créer l'application et obtenir les identifiants réels ;
2. valider le flux OAuth et les scopes autorisés ;
3. capturer des réponses réelles et figer les schémas Zod de l'adaptateur ;
4. confirmer les paramètres, champs, référentiels, pagination et limites actifs ;
5. relire la licence, les conditions de réutilisation et la formulation d'attribution en vigueur ;
6. résoudre les éventuels codes métiers depuis le référentiel actif, sans les déduire de mémoire ;
7. mesurer la couverture et les doublons du registre de requêtes avant publication.

### Base de données

Le fichier [`docs/reference/schema.sql`](./docs/reference/schema.sql) exprime le modèle et les contraintes. Le développeur doit encore :

- le traduire en schéma Drizzle ;
- générer des migrations relues ;
- les exécuter contre PostgreSQL 18 ;
- tester les index et contraintes avec des fixtures ;
- tester sauvegarde, restauration, rollback de dataset et concurrence d'ingestion.

Aucune affirmation n'est faite ici qu'une migration exécutable a déjà été lancée sur PostgreSQL.

### Maquette

Aucune maquette n'était présente lors de cette validation. Après dépôt dans [`maquette/`](./maquette/README.md), le développeur doit :

- dresser l'inventaire des écrans, états et breakpoints ;
- extraire les tokens réels ;
- vérifier contraste, clavier, focus, zoom et réduction des mouvements ;
- résoudre les écarts avec le contrat de données ;
- faire valider le preset de mouvement sur appareils réels ;
- suivre [`docs/checklists/maquette-integration.md`](./docs/checklists/maquette-integration.md).

### Versions et fournisseurs

Les versions structurantes sont fixées dans la documentation. Les versions exactes des dépendances secondaires doivent être résolues dans leur dernière version **stable compatible**, épinglées dans `package.json` et `pnpm-lock.yaml`, puis vérifiées par la CI. Les préversions ne sont jamais choisies implicitement.

Les régions, rétentions et options réelles de Neon, Vercel, Trigger.dev, Sentry et PostHog doivent être confirmées dans les comptes créés avant la mise en production.

### Juridique

Restent à renseigner avant publication :

- titulaire de la licence du code ;
- responsable du site et moyen de contact ;
- hébergeur effectif ;
- politique de confidentialité finale ;
- durées de conservation réelles ;
- mécanisme de consentement éventuellement requis ;
- procédure de correction ou retrait d'une offre ;
- mentions et attribution validées contre la licence source active.

---

## Critère de passage à l'implémentation

Le dossier peut servir de source de vérité initiale. Le développement doit commencer par [`docs/15-BOOTSTRAP.md`](./docs/15-BOOTSTRAP.md), puis suivre les lots de [`docs/11-IMPLEMENTATION-PLAN.md`](./docs/11-IMPLEMENTATION-PLAN.md).

Le premier jalon produit n'est pas une page animée : c'est une collecte réelle limitée, validée, dédupliquée et classée avec preuves. L'interface finale intervient après validation du modèle de données et intégration de la maquette.
