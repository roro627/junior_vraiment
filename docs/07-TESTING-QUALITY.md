# 07 — Tests, qualité et budgets

## 1. Philosophie

La qualité doit protéger les deux promesses du produit :

1. **le chiffre est juste selon la méthode publiée** ;
2. **l'expérience est rapide, claire et accessible**.

Le plus grand risque n'est pas un bouton légèrement mal aligné. C'est un chiffre convaincant mais faux. La pyramide de tests donne donc une forte priorité au domaine et aux données.

---

## 2. Niveaux

```text
Statique
  TypeScript, ESLint, format, schémas

Unitaire
  parsing, classification, calculs, formatage

Intégration
  base, adaptateur, API, composants avec MSW

Contractuel
  France Travail fixtures, OpenAPI, Zod

E2E
  parcours utilisateur, navigation, partage

Accessibilité
  axe + clavier + revue manuelle

Visuel
  Storybook et captures Playwright

Performance
  bundle, Lighthouse, Web Vitals, SQL

Opérations
  ingestion, retry, rollback, restauration
```

---

## 3. Contrôles statiques

Commandes bloquantes :

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:schemas
```

### TypeScript

- strict ;
- aucun `any` non justifié ;
- exhaustivité des enums ;
- pas d'assertion `as` pour contourner une validation ;
- types de domaine indépendants des fournisseurs.

### ESLint

Règles :

- Next.js ;
- React hooks ;
- JSX a11y ;
- imports ;
- promesses non gérées ;
- interdiction de `console` hors logger ;
- interdiction d'accès direct à `process.env` hors module env ;
- interdiction du HTML dangereux.

---

## 4. Tests unitaires

### Domaine prioritaire

Modules :

```text
normalize-text
detect-junior-signals
extract-experience
resolve-experience
detect-technologies
classify-salary
classify-remote
classify-offer
compute-metric
canonicalize-filters
canonicalize-dimensions
```

### Style

- table-driven tests ;
- noms décrivant le comportement ;
- fixtures minimales ;
- pas de snapshot massif pour les résultats métier ;
- tests de propriétés pour plages et conversions si utile ;
- mutation testing optionnel sur le classificateur après MVP.

Exemple :

```ts
it.each([
  ["2 ans minimum", 24],
  ["au moins 18 mois", 18],
  ["une première expérience appréciée", null],
  ["sans expérience requise", 0],
])("extracts %s", (text, expected) => {
  expect(resolve(text).minimumExperienceMonths).toBe(expected);
});
```

---

## 5. Couverture

Objectifs :

| Zone | Couverture |
|---|---:|
| classificateur et calculs | branches `≥ 95 %` |
| normalisation | branches `≥ 90 %` |
| parsing filtres | branches `≥ 90 %` |
| application | lignes `≥ 80 %` |
| composants UI | pas de quota artificiel ; états et interactions obligatoires |

La couverture ne remplace pas le jeu de vérité.

---

## 6. Jeu de vérité

### Séparation

```text
gold/dev
gold/validation
gold/regressions
```

Le set de validation ne doit pas guider chaque ajustement de règle.

Au MVP, les labels de référence proviennent d'une unique passe LLM A, aveugle aux prédictions,
selon `docs/reference/llm-annotation-protocol.md`. Le rapport CI doit enregistrer la version du jeu,
du protocole et du modèle. Une métrique dont la classe positive est absente est `non_evaluable` :
elle ne reçoit ni faux zéro ni réussite implicite.

### Rapport CI

Pour chaque modification :

```text
precision
recall
F1
confusion matrix
deltas par catégorie
nouvelles ambiguïtés
offres dont le résultat change
```

Une baisse de précision du positif principal bloque automatiquement.

---

## 7. Tests d'intégration base

Utiliser une base éphémère ou branche preview.

Scénarios :

- création offre ;
- même offre inchangée ;
- offre modifiée ;
- deux requêtes trouvent la même offre ;
- classification versionnée ;
- fermeture après absences valides ;
- run partiel ;
- bascule de dataset ;
- rollback ;
- pagination ;
- agrégat ;
- contraintes ;
- concurrence de deux runs ;
- purge.

Ne pas mocker Drizzle dans ces tests : tester réellement PostgreSQL.

---

## 8. Contrats source

Conserver des fixtures redacted provenant de réponses réelles autorisées :

```text
normal
missing_optional_fields
unknown_fields
empty_company
long_description
structured_beginner
salary_range
partner_offer
pagination_boundary
```

Tests :

- payload valide ;
- champ nouveau ;
- champ absent ;
- type modifié ;
- encodage ;
- page vide ;
- 401 renouvellement ;
- 429 backoff ;
- 5xx retry ;
- total incohérent.

Les tests réseau ne doivent pas appeler la vraie API en CI standard.

Un smoke test planifié peut l'appeler avec quota réduit et secret dédié.

---

## 9. Composants

Testing Library vérifie :

- rôles ;
- noms accessibles ;
- clavier ;
- états ;
- texte ;
- focus ;
- annonces ;
- callbacks.

Éviter :

- test de classes Tailwind ;
- test de structure DOM privée ;
- snapshot complet comme seule assertion.

---

## 10. Storybook

Chaque composant produit doit avoir les states listés dans la spec.

Contrôles automatisés :

- interaction tests ;
- axe addon ou test Playwright ;
- capture visuelle ;
- viewport ;
- thème si applicable ;
- reduced motion ;
- contenu long.

---

## 11. E2E Playwright

### Parcours P0

1. accueil charge le KPI ;
2. filtres modifient l'URL et les données ;
3. explorer conserve les filtres ;
4. preuve s'ouvre et se ferme ;
5. retour focus ;
6. lien source ;
7. partage/copie ;
8. méthodologie ;
9. statut ;
10. erreur récupérable.

### Viewports

```text
375 × 812
768 × 1024
1440 × 900
```

### Navigateurs

- Chromium ;
- WebKit ;
- Firefox sur parcours critiques.

### Modes

- JavaScript normal ;
- réseau lent ;
- reduced motion ;
- clavier ;
- données vides ;
- données périmées ;
- erreur API.

---

## 12. Accessibilité

### Automatique

`@axe-core/playwright` sur :

- accueil ;
- filtres ouverts ;
- explorer ;
- panneau de preuve ;
- insight ;
- méthodologie ;
- état erreur ;
- mobile.

Aucune violation `critical` ou `serious`.

### Manuel

- Tab / Shift+Tab ;
- Enter / Space / Escape ;
- zoom 200 % ;
- reflow 320 px ;
- VoiceOver Safari ou NVDA/Chrome sur parcours principal ;
- contraste ;
- contenu sans couleur ;
- reduced motion ;
- target size.

Le rapport de lancement contient la date et les résultats.

---

## 13. Visuel

### Baselines

Stocker des captures des composants et pages clés. Les données, heures et animations sont déterministes.

### Tolérance

Une différence doit être examinée, pas automatiquement acceptée en augmentant la tolérance.

### Maquette

Créer des tests comparatifs spécifiques lors de l'intégration de la maquette, puis maintenir des snapshots du produit implémenté.

---

## 14. Performance frontend

### Budgets

| Budget | Seuil |
|---|---:|
| JS initial accueil total | 200 Ko gzip |
| JS produit spécifique | 75 Ko gzip |
| image principale | aucune image bitmap lourde |
| police | sous-ensemble minimal |
| LCP p75 | 2,5 s |
| INP p75 | 200 ms |
| CLS p75 | 0,1 |
| Lighthouse perf CI | 90 |

### Outils

- analyse bundle Next.js ;
- Lighthouse CI ;
- `web-vitals`/observabilité ;
- DevTools performance ;
- Sentry performance échantillonnée.

### Régressions

Toute hausse de plus de :

- 10 Ko gzip de JS ;
- 100 ms de LCP labo ;
- 50 ms d'INP labo ;
- 20 % de durée d'une requête critique

doit être signalée dans la PR.

---

## 15. Performance SQL

Jeu de volume synthétique :

```text
100 000 offres
500 000 snapshots
500 000 classifications
2 000 000 preuves/relations
plusieurs années d'agrégats
```

Objectifs indicatifs :

- lecture KPI p95 < 100 ms base ;
- explorer p95 < 250 ms base ;
- statut < 100 ms ;
- aucune requête publique non bornée ;
- aucun `SELECT *` sur payload brut.

Vérifier avec `EXPLAIN (ANALYZE, BUFFERS)`.

---

## 16. Tests d'ingestion

Scénarios :

- run nominal ;
- interruption après page N ;
- relance même date ;
- token expiré ;
- 429 ;
- 500 ;
- page dupliquée ;
- page manquante ;
- schéma nouveau ;
- validation sous seuil ;
- agrégation échoue ;
- revalidation échoue ;
- dataset précédent reste publié ;
- run concurrent ;
- heure d'été/hiver.

---

## 17. Résilience

### Game day avant lancement

Simuler :

1. source indisponible ;
2. base temporairement indisponible ;
3. payload incompatible ;
4. publication d'un mauvais dataset puis rollback ;
5. secret source roté ;
6. échec d'OG ;
7. trafic concentré sur un insight.

Documenter le résultat et corriger avant lancement.

---

## 18. CI

### Pull request

```text
format
lint
typecheck
unit
gold-set
schema/openapi
build
storybook build
a11y component
database migration check
```

### E2E

Sur PR prête ou label :

```text
deploy preview
seed database branch
run Playwright
run visual
run Lighthouse
destroy/expire resources
```

### Main

```text
all checks
migration controlled
deploy
smoke tests
release Sentry
```

---

## 19. Flaky tests

Un test instable n'est pas masqué par cinq retries.

Procédure :

- maximum un retry en CI pour diagnostic ;
- marquer et corriger sous 48 h ;
- propriétaire explicite ;
- ne pas fusionner une fonctionnalité reposant sur un test mis en quarantaine.

---

## 20. Definition of Done

Une story n'est terminée que si :

- comportement ;
- types ;
- tests ;
- accessibilité ;
- responsive ;
- états ;
- analytics utile ;
- observabilité ;
- documentation ;
- performance ;
- revue visuelle

sont traités selon leur pertinence.

La checklist complète est dans [`checklists/definition-of-done.md`](./checklists/definition-of-done.md).
