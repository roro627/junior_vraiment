# 06 — Contrats API

## 1. Principes

L'API du produit est une API de lecture. Le rendu serveur peut appeler directement les fonctions d'application, mais les routes HTTP offrent :

- partage avec d'autres interfaces ;
- tests contractuels ;
- séparation claire des modèles publics ;
- future réutilisation.

Le contrat OpenAPI de référence est dans [`reference/openapi.yaml`](./reference/openapi.yaml). Les réponses représentatives complètes, destinées aux tests contractuels, sont dans [`reference/openapi-examples.json`](./reference/openapi-examples.json).

---

## 2. Version

Préfixe :

```text
/api/v1
```

Les changements compatibles restent dans `v1`. Un changement incompatible crée `v2`.

Chaque réponse de donnée inclut :

Extension additive du 10 septembre 2026 : `classification.juniorObservation` expose l'axe
`junior-observation-2.0.0` sur un dataset qui déclare `junior-contradiction-2.0.0`.
Il comporte `version`, `status` (`resolved`, `unknown`, `ambiguous`) et `contradictory` tri-état.
Absent ou null pour l'ancienne méthode. Les anciens champs gardent leur sens : le statut global
peut rester ambigu alors que l'observation est résolue positive. Les preuves sont dans `evidence`.
Le filtre `contradictory` suit la méthode déclarée du dataset ; le filtre d'expérience conserve
l'ambiguïté globale. Les tendances calculent chaque dataset avec sa propre méthode et annotent
la rupture, sans relier artificiellement les séries.

```json
{
  "meta": {
    "generatedAt": "2026-09-02T08:00:00.000Z",
    "dataAsOf": "2026-09-02T03:30:00.000Z",
    "datasetVersion": "...",
    "classifierVersion": "classifier-1.0.0",
    "metricVersions": {
      "junior_contradiction_rate": "junior-contradiction-1.0.0",
      "beginner_friendly_rate": "beginner-friendly-1.0.0",
      "salary_transparency_rate": "salary-transparency-1.0.0"
    },
    "querySetVersion": "queries-1.0.0",
    "sampleSize": 324,
    "quality": "normal"
  }
}
```

---

## 3. Format

- JSON UTF-8 ;
- dates ISO 8601 UTC ;
- nombres comme nombres, pas chaînes ;
- pourcentage entre `0` et `1` dans le contrat, formaté par l'interface ;
- identifiants publics opaques ;
- champs optionnels explicites ;
- pas de `undefined` en JSON ;
- `null` seulement si le sens est documenté.

Exemple :

```json
{
  "metric": "junior_contradiction_rate",
  "metricVersion": "junior-contradiction-1.0.0",
  "value": 0.3796,
  "numerator": 123,
  "denominator": 324,
  "populationCount": 361,
  "unknownCount": 31,
  "ambiguousCount": 6,
  "coverage": 0.8975,
  "sampleQuality": "normal"
}
```

---

## 4. Erreurs

Format Problem Details :

```json
{
  "type": "https://junior-vraiment.example/problems/invalid-filter",
  "title": "Filtre invalide",
  "status": 400,
  "detail": "La technologie demandée n'existe pas.",
  "instance": "/api/v1/overview?tech=unknown",
  "code": "INVALID_TECHNOLOGY",
  "errors": [
    {
      "path": "tech",
      "message": "Valeur non reconnue"
    }
  ]
}
```

Ne jamais renvoyer :

- stack trace ;
- requête SQL ;
- secret ;
- payload source brut ;
- chemin interne ;
- détail d'un fournisseur.

---

## 5. Cache HTTP

Référence :

| Route | Cache |
|---|---|
| `/overview` | public, 5 min, stale-while-revalidate 1 h |
| `/trends` | public, 15 min, stale-while-revalidate 6 h |
| `/offers` | public, 1 min, stale-while-revalidate 10 min |
| `/taxonomies` | public, 24 h |
| `/data-status` | public, 1 min |
| insight figé | public, long cache immuable par version |

Les valeurs finales doivent être alignées avec la stratégie Next.js et invalidées après publication du dataset.

Inclure un `ETag` si la plateforme le permet sans complexité excessive.

---

## 6. Paramètres communs

### `job`

Un slug de famille.

```text
frontend
backend
fullstack
mobile
data
devops-cloud
cybersecurity
qa-test
```

### `tech`

Liste séparée par virgule, maximum trois valeurs. L'ordre est normalisé.

### `area`

```text
france
region:<code>
department:<code>
commune:<code>
```

### `contract`

Liste de catégories normalisées.

### `remote`

```text
remote
hybrid
onsite
unknown
```

### `period`

```text
7d
30d
90d
current
```

### Normalisation

`tech=typescript,react` devient canoniquement `tech=react,typescript`.

Les paramètres inconnus sont ignorés dans l'interface uniquement s'ils ne présentent aucun risque, mais l'API devrait renvoyer une erreur claire pour éviter des résultats faussement compris.

---

## 7. `GET /overview`

### Rôle

Retourne le modèle complet des cartes principales pour un périmètre.

### Exemple de réponse

```json
{
  "data": {
    "scope": {
      "job": "mobile",
      "technologies": ["react-native"],
      "area": "commune:59350",
      "contracts": [],
      "remote": null,
      "period": "30d"
    },
    "headline": {
      "metric": "junior_contradiction_rate",
      "metricVersion": "junior-contradiction-1.0.0",
      "value": 0.38,
      "numerator": 19,
      "denominator": 50,
      "populationCount": 63,
      "unknownCount": 11,
      "ambiguousCount": 2,
      "coverage": 0.7937,
      "sampleQuality": "normal",
      "changePoints": 4.2
    },
    "beginnerFriendly": {
      "metric": "beginner_friendly_rate",
      "metricVersion": "beginner-friendly-1.0.0",
      "value": 0.2656,
      "numerator": 17,
      "denominator": 64,
      "populationCount": 77,
      "unknownCount": 11,
      "ambiguousCount": 2,
      "coverage": 0.8312,
      "sampleQuality": "normal"
    },
    "salaryTransparency": {
      "metric": "salary_transparency_rate",
      "metricVersion": "salary-transparency-1.0.0",
      "value": 0.4416,
      "numerator": 34,
      "denominator": 77,
      "populationCount": 77,
      "unknownCount": 0,
      "ambiguousCount": 0,
      "coverage": 1,
      "sampleQuality": "normal"
    },
    "experienceBuckets": [
      { "key": "none", "count": 17 },
      { "key": "1_12", "count": 13 },
      { "key": "13_23", "count": 4 },
      { "key": "24_35", "count": 18 },
      { "key": "36_59", "count": 10 },
      { "key": "60_plus", "count": 4 },
      { "key": "unknown", "count": 9 },
      { "key": "ambiguous", "count": 2 }
    ],
    "topTechnologies": [],
    "contracts": [],
    "remoteModes": [
      { "key": "remote", "label": "100 % à distance", "count": 6, "share": 0.0779 },
      { "key": "hybrid", "label": "Hybride", "count": 29, "share": 0.3766 },
      { "key": "onsite", "label": "Sur site", "count": 18, "share": 0.2338 },
      { "key": "unknown", "label": "Non précisé", "count": 24, "share": 0.3117 }
    ],
    "examples": []
  },
  "meta": {
    "generatedAt": "2026-09-02T14:30:00Z",
    "dataAsOf": "2026-09-02T04:00:00Z",
    "datasetVersion": "dataset-2026-09-02-v1",
    "classifierVersion": "classifier-1.0.0",
    "metricVersions": {
      "junior_contradiction_rate": "junior-contradiction-1.0.0",
      "beginner_friendly_rate": "beginner-friendly-1.0.0",
      "salary_transparency_rate": "salary-transparency-1.0.0"
    },
    "querySetVersion": "queries-1.0.0",
    "sampleSize": 77,
    "quality": "normal",
    "warnings": []
  }
}
```

### Cas sans échantillon

`headline.value` est `null`, pas `0`.

```json
{
  "headline": {
    "metric": "junior_contradiction_rate",
    "metricVersion": "junior-contradiction-1.0.0",
    "value": null,
    "numerator": 0,
    "denominator": 0,
    "populationCount": 0,
    "unknownCount": 0,
    "ambiguousCount": 0,
    "coverage": null,
    "sampleQuality": "insufficient"
  }
}
```

### Sémantique commune des taux

`populationCount` est la population avant exclusion des inconnus et des ambigus propres à la métrique. Les champs respectent :

```text
populationCount = denominator + unknownCount + ambiguousCount
coverage = denominator / populationCount
value = numerator / denominator
```

`coverage` vaut `null` lorsque sa population est nulle. `value` vaut `null` lorsque le dénominateur est nul ou inférieur au seuil de publication. Les règles exactes de population de chaque KPI sont normatives dans [`../SPEC.md`](../SPEC.md#6-indicateurs-du-mvp) et détaillées dans [`02-DATA-METHODOLOGY.md`](./02-DATA-METHODOLOGY.md#15-métriques-publiées).

---

## 8. `GET /trends`

### Rôle

Retourne une série temporelle bornée.

### Règles

- maximum 366 points ;
- pas de granularité horaire ;
- jours partiels marqués ;
- changement de méthode marqué ;
- `null` pour valeur non publiable ;
- fuseau de la date métier indiqué.

### Point

```json
{
  "date": "2026-09-02",
  "value": 0.3796,
  "numerator": 123,
  "denominator": 324,
  "populationCount": 361,
  "unknownCount": 31,
  "ambiguousCount": 6,
  "coverage": 0.8975,
  "sampleQuality": "normal",
  "quality": "normal",
  "datasetVersion": "...",
  "annotation": null
}
```

---

## 9. `GET /offers`

### Rôle

Retourne les offres composant un résultat ou correspondant à un filtre.

### Pagination

Curseur recommandé :

```text
cursor=<opaque>
limit=25
```

- minimum 1 ;
- défaut 25 ;
- maximum 50.

Réponse :

```json
{
  "data": {
    "items": [],
    "page": {
      "nextCursor": "...",
      "hasNext": true
    }
  },
  "meta": {
    "generatedAt": "2026-09-02T14:30:00Z",
    "dataAsOf": "2026-09-02T04:00:00Z",
    "datasetVersion": "dataset-2026-09-02-v1",
    "classifierVersion": "classifier-1.0.0",
    "metricVersions": {
      "junior_contradiction_rate": "junior-contradiction-1.0.0",
      "beginner_friendly_rate": "beginner-friendly-1.0.0",
      "salary_transparency_rate": "salary-transparency-1.0.0"
    },
    "querySetVersion": "queries-1.0.0",
    "sampleSize": 1,
    "quality": "normal",
    "warnings": []
  }
}
```

### Tri

Allowlist :

```text
published_desc
published_asc
experience_desc
experience_asc
```

Aucun nom de colonne SQL n'est accepté directement.

### Filtre de classification

```text
classification=contradictory
classification=beginner_friendly
classification=junior_unresolved
classification=other_junior
classification=not_explicitly_junior
classification=ambiguous
classification=unknown
```

### Offre publique

```ts
type PublicOffer = {
  id: string;
  title: string;
  companyName: string | null;
  locationLabel: string | null;
  contractLabel: string | null;
  publishedAt: string | null;
  lastSeenAt: string;
  availability: "active" | "not_seen" | "closed";
  minimumExperienceMonths: number | null;
  experienceLabel: string | null;
  classification: {
    status: "classified" | "ambiguous" | "unclassified";
    claimsJunior: boolean | null;
    beginnerFriendly: boolean | null;
    contradictoryJunior: boolean | null;
    classifierVersion: string;
    warnings: string[];
  };
  evidence: PublicEvidence[];
  technologies: string[];
  salary: PublicSalary | null;
  remoteMode: "remote" | "hybrid" | "onsite" | "unknown";
  source: {
    label: string;
    offerUrl: string | null;
    attributionUrl: string;
  };
};
```

Ne pas exposer le payload brut.

---

## 10. `GET /taxonomies`

Retourne :

- familles ;
- technologies ;
- territoires populaires ;
- contrats ;
- versions ;
- aliases non sensibles si utiles.

Le front utilise cette route ou une fonction serveur équivalente, plutôt que des listes dupliquées.

---

## 11. `GET /data-status`

Retourne uniquement des informations publiques :

```json
{
  "data": {
    "status": "operational",
    "lastSuccessfulRunAt": "...",
    "dataAsOf": "...",
    "freshness": "fresh",
    "latestRun": {
      "status": "succeeded",
      "durationMs": 84231,
      "received": 4217,
      "new": 127,
      "updated": 85,
      "quarantined": 9,
      "ambiguousRate": 0.041
    },
    "incidents": []
  },
  "meta": {
    "generatedAt": "2026-09-02T14:30:00Z",
    "dataAsOf": "2026-09-02T04:00:00Z",
    "datasetVersion": "dataset-2026-09-02-v1",
    "classifierVersion": "classifier-1.0.0",
    "metricVersions": {
      "junior_contradiction_rate": "junior-contradiction-1.0.0",
      "beginner_friendly_rate": "beginner-friendly-1.0.0",
      "salary_transparency_rate": "salary-transparency-1.0.0"
    },
    "querySetVersion": "queries-1.0.0",
    "sampleSize": 120,
    "quality": "normal",
    "warnings": []
  }
}
```

Ne pas exposer :

- URL de base ;
- stack trace ;
- identifiant de projet ;
- jeton ;
- détails d'une offre en quarantaine.

---

## 12. Endpoint interne de revalidation

Cette route d'exploitation est volontairement absente du contrat OpenAPI **public**. Elle doit disposer de son propre schéma Zod, de tests contractuels et d'une documentation interne non publiée.

```text
POST /api/internal/revalidate
```

Protection :

- secret partagé rotatif ou signature HMAC ;
- timestamp ;
- fenêtre anti-rejeu ;
- allowlist des tags ;
- limite de taille ;
- log d'audit ;
- non indexé ;
- réponse minimale.

Payload :

```json
{
  "datasetVersion": "...",
  "tags": ["overview", "trends", "data-status"],
  "timestamp": "..."
}
```

Ne jamais accepter un chemin arbitraire à invalider.

---

## 13. Contrats Zod

Chaque route possède :

```text
SearchParamsSchema
ResponseSchema
ProblemSchema
```

Les schémas sont source de vérité runtime. Le document OpenAPI doit être généré ou vérifié à partir des mêmes modèles pour éviter la dérive.

Test obligatoire :

```text
chaque fixture de réponse valide passe Zod
chaque exemple OpenAPI passe Zod
chaque erreur invalide documentée échoue comme attendu
```

---

## 14. Sécurité et quotas

Au MVP, les routes sont publiques, mais :

- limite de taille de query string ;
- maximum 3 technologies ;
- période max 366 jours ;
- limit max 50 ;
- timeout ;
- cache ;
- journalisation agrégée ;
- protection anti-abus si besoin.

Ne pas ajouter Redis dès le premier jour. Utiliser les protections plateforme et ajouter un rate limiter distribué seulement si des abus apparaissent.

---

## 15. CORS

Par défaut, same-origin seulement.

Une API publique cross-origin future nécessite :

- domaines autorisés ou `*` en lecture si assumé ;
- version stable ;
- quotas ;
- documentation ;
- politique d'usage ;
- monitoring distinct.

---

## 16. Dépréciation

Lorsqu'un champ est remplacé :

1. ajouter le nouveau ;
2. documenter l'ancien comme déprécié ;
3. conserver au moins un cycle de rapport mensuel ;
4. mesurer les consommateurs si possible ;
5. supprimer uniquement dans une version majeure.

---

## 17. Tests contractuels

- exemples OpenAPI ;
- paramètres valides/invalides ;
- canonicalisation ;
- empty ;
- partial ;
- stale ;
- pagination ;
- curseur altéré ;
- tri non autorisé ;
- injection ;
- réponse sans champ privé ;
- cache headers ;
- dataset rollback ;
- compatibilité avec le modèle de page.
