# 02 — Données, classification et méthodologie

## 1. Objectif

Ce document définit ce que les chiffres signifient et comment ils sont produits. Il est normatif : une modification des règles décrites ici doit créer une nouvelle version de méthodologie.

Le produit ne doit pas seulement être techniquement correct. Il doit éviter les conclusions que les données ne permettent pas.

---

## 2. Source initiale

### API Offres d'emploi de France Travail

La source initiale fournit des offres actives collectées par France Travail et certains partenaires. Elle permet des recherches paginées et des filtres de métier, lieu et contrat.

Le projet doit :

- créer une application sur le portail développeur ;
- respecter la licence et les conditions de réutilisation ;
- respecter la limite publiée ;
- afficher l'attribution ;
- ne jamais présenter le périmètre comme l'intégralité absolue des offres françaises ;
- surveiller l'évolution du contrat et du schéma.

### Périmètre réel

La formulation publique recommandée est :

> « Offres tech actives récupérées dans le périmètre de requêtes publié depuis l'API France Travail et ses partenaires participants. »

Éviter :

> « Toutes les offres tech en France. »

---

## 3. Registre des requêtes

Chaque recherche source doit être déclarée dans un registre versionné.

Exemple conceptuel :

```ts
type SourceQueryDefinition = {
  id: string;
  version: string;
  enabled: boolean;
  label: string;
  sourceFilters: Record<string, string | string[]>;
  jobFamilies: string[];
  territoryScope: string;
  expectedVolumeRange?: [number, number];
};
```

Le registre permet de répondre à :

- quelles requêtes composent le dataset ;
- quand une requête a été ajoutée ;
- si deux requêtes se chevauchent ;
- pourquoi un volume change.

Une modification du registre incrémente `query_set_version`.

### Validation de pertinence

Avant activation, chaque groupe est échantillonné sur les résultats réels des canaux ROME,
mots-clés et leur chevauchement. La pertinence métier peut être annotée hors ligne par une unique
passe LLM A aveugle aux sorties du classificateur, selon
[`reference/query-set-annotation-protocol.md`](./reference/query-set-annotation-protocol.md). Les
labels détaillés restent locaux ; seuls les volumes, couvertures, précisions et empreintes sont
publiés. Ce jeu ne mesure jamais la prévalence du marché.

La politique `query-relevance-gate-1.0.0`, fixée avant l'annotation, exige 30 paires par groupe,
une couverture résolue globale et par groupe d'au moins `0,90`, une précision globale d'au moins
`0,80`, une précision par groupe d'au moins `0,70`, une pagination complète, aucune requête au-delà
du plafond et aucune quarantaine. Une métrique non évaluable bloque l'activation.

Le brouillon `queries-1.0.0-observed-draft` a été rejeté le 4 septembre 2026 : sa précision de
pertinence observée est de `139 / 239`, soit `58,2 %`. Le candidat 2.0 a ajouté un filtre
d'intitulé déterministe, puis a été activé après une nouvelle validation à `210 / 239`.
Son rapport est conservé comme preuve historique, sans prétendre valider les versions suivantes.

Le 6 septembre, le propriétaire demande d'élargir la couverture. `queries-3.0.0` complète les
intitulés explicites, Data scientist, et les familles `software` et `ai-ml` déjà définies dans
la taxonomie. La validation réelle a parcouru 566 requêtes complètes, sans plafond atteint ni
quarantaine, et trouvé 1 828 offres distinctes. La nouvelle passe A de 300 paires donne 278
pertinentes sur 298 résolues (93,3 %), deux ambiguës, et chaque groupe passe les seuils inchangés.
Cette estimation LLM ne mesure pas le rappel ni l'exhaustivité de la source.
Voir l'[ADR 0012](adr/0012-expand-observed-tech-coverage.md), le
[protocole 2.0](reference/query-set-annotation-protocol-v2.md) et le
[rapport agrégé](reference/query-set-v3-validation-report.json).

Les familles admises sont conservées par offre et par requête : partager une requête ne suffit
pas à appartenir à toutes ses familles. Les liens historiques restent inchangés. Les volumes
avant/après élargissement ne sont pas comparables comme évolution du marché ; l'API annote
la rupture et le graphique ne relie pas les points concernés.

---

## 4. Fréquence et fenêtre

### Collecte

- collecte complète quotidienne ;
- heure nominale : `03:30 Europe/Paris` ;
- contrôle de santé : `12:30 Europe/Paris` ;
- date métier : date locale du run ;
- horodatages stockés en UTC ;
- présentation en heure française.

### Offres actives

Une offre vue aujourd'hui et absente demain ne doit pas être déclarée définitivement fermée après une seule absence si une partition a échoué.

Règle :

```text
closed_at =
  première date d'absence après deux collectes complètes réussies consécutives
  OU état de fermeture explicite fourni par la source
```

Conserver aussi `last_seen_at`.

---

## 5. Validation du payload

### Stratégie Zod

Utiliser :

- `.strict()` pour les objets internes ;
- une validation tolérante contrôlée pour la source afin qu'un champ nouveau non critique ne casse pas tout ;
- un rapport de champs inconnus ;
- une quarantaine pour les erreurs structurelles.

Trois résultats :

```text
valid
valid_with_warnings
invalid_quarantined
```

### Taux de qualité

- `valid + valid_with_warnings ≥ 98 %` pour publier normalement ;
- entre 95 % et 98 % : run partiel avec avertissement ;
- sous 95 % : ne pas publier le nouveau dataset sans revue.

Ces seuils peuvent être adaptés après observation, mais doivent rester versionnés.

---

## 6. Normalisation

Le modèle normalisé ne reproduit pas exactement la source.

### Champs principaux

```ts
type NormalizedOffer = {
  source: "france-travail";
  externalId: string;
  title: string;
  descriptionText: string;
  companyName: string | null;
  publishedAt: Date | null;
  updatedAt: Date | null;
  location: {
    label: string | null;
    communeCode: string | null;
    departmentCode: string | null;
    regionCode: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  contract: {
    sourceCode: string | null;
    normalized: ContractKind;
    label: string | null;
  };
  structuredExperience: {
    required: boolean | null;
    label: string | null;
  };
  salary: NormalizedSalary | null;
  applicationUrl: string | null;
  sourceUrl: string | null;
  rawPayload: unknown;
};
```

Les noms précis de champs de l'API externe doivent être confirmés sur le schéma actif et confinés à l'adaptateur.

### Texte

- décoder les entités ;
- convertir le HTML en texte sûr ;
- préserver des retours utiles ;
- conserver une version source dans le payload brut ;
- ne pas corriger l'orthographe ;
- normaliser une copie dédiée au matching ;
- ne pas supprimer la ponctuation de l'extrait affiché.

---

## 7. Identité et déduplication

### Identité primaire

```text
(source, external_id)
```

### Snapshot

Créer un nouveau snapshot lorsque l'empreinte des champs pertinents change :

```text
title
description
company
location
contract
experience
salary
remote hints
application URL
```

### Doublons entre requêtes

La même offre peut ressortir dans plusieurs requêtes. Elle n'est stockée qu'une fois, avec une relation vers toutes les requêtes qui l'ont trouvée.

### Doublons entre partenaires

Créer un `duplicate_cluster` probable à partir d'une empreinte :

```text
titre normalisé
entreprise normalisée si connue
commune
contrat
similarité du texte
date proche
```

Ne pas fusionner automatiquement deux identifiants externes au lancement. Les métriques peuvent :

- utiliser les identifiants source comme unité officielle ;
- publier un indicateur de doublons probables ;
- tester ultérieurement une déduplication secondaire.

La règle choisie doit être constante et affichée.

---

## 8. Taxonomie métier

### Construction

Une famille peut être attribuée à partir de :

1. code métier structuré ;
2. intitulé ;
3. compétences ;
4. description.

Le code structuré prévaut lorsqu'il est assez précis. Le texte complète mais ne doit pas faire entrer un commercial vendant des logiciels dans « développement ».

### Multi-étiquette

Une offre peut être `frontend` et `fullstack` seulement si les preuves sont explicites. Pour les métriques par famille, indiquer si le comptage est :

- `primary_only` ;
- ou `multi_label`.

Le MVP utilise `primary_only` pour les volumes principaux et expose les tags secondaires.

### Version

`taxonomy_version`, par exemple `jobs-1.0.0`.

---

## 9. Taxonomie technologie

### Registre

Chaque technologie possède :

```ts
type TechnologyRule = {
  slug: string;
  label: string;
  category: string;
  aliases: string[];
  negativePatterns?: string[];
  caseSensitivePatterns?: string[];
};
```

Exemples :

```text
react:
  aliases: ["React", "React.js", "ReactJS"]
  negatives: ["réactivité"]

dotnet:
  aliases: [".NET", "dotnet", "ASP.NET"]

csharp:
  aliases: ["C#", "C Sharp"]

go:
  aliases: ["Golang"]
  ne pas utiliser le mot isolé "go" sans contexte
```

### Exigence ou simple mention

Au MVP, l'indicateur est « technologie citée ». Il ne prétend pas distinguer parfaitement :

- exigée ;
- appréciée ;
- utilisée par l'équipe ;
- citée comme alternative.

Une évolution peut ajouter `required`, `preferred`, `contextual`, mais seulement après validation.

---

## 10. Détection du caractère junior

### Préparation

Créer une version normalisée pour matching :

- Unicode NFKC ;
- minuscules ;
- espaces homogènes ;
- apostrophes normalisées ;
- conservation d'une table de correspondance vers le texte original pour l'extrait.

### Règles positives initiales

| ID | Exemple | Signal |
|---|---|---|
| `JR_TITLE_EXPLICIT` | « Développeur React Junior » | fort |
| `JR_BEGINNER_ACCEPTED` | « Débutant accepté » | fort |
| `JR_GRADUATE` | « Jeune diplômé bienvenu » | fort |
| `JR_FIRST_EXPERIENCE` | « Première expérience acceptée » | moyen |
| `JR_ENTRY_LEVEL` | « Profil débutant » | fort |
| `JR_STRUCTURED_BEGINNER` | donnée source débutant accepté | fort |

### Règles négatives / contexte

Ne pas considérer comme signal :

- « encadrer les développeurs juniors » pour un poste senior ;
- « former une équipe junior » ;
- « junior enterprise » comme nom propre ;
- « pas un poste junior » ;
- historique décrivant une ancienne fonction ;
- contenu de page externe non attribuable au poste.

Les motifs doivent analyser une fenêtre de contexte et les négations.

### Résultat

```text
true      preuve junior fiable
false     preuve explicite que le poste n'est pas junior, si utile
null      aucune conclusion
```

Le KPI principal ne prend que `true`.

---

## 11. Extraction de l'expérience

### Modèle

Chaque occurrence devient :

```ts
type ExperienceMention = {
  amountMinMonths: number | null;
  amountMaxMonths: number | null;
  modality: "required" | "preferred" | "accepted" | "unknown";
  subject: "professional" | "technology" | "education" | "management" | "unknown";
  evidence: Evidence;
};
```

### Motifs numériques

Reconnaître :

```text
6 mois
12 mois
1 an
2 ans
2 années
2 à 3 ans
2-3 ans
minimum 2 ans
au moins deux ans
3 ans+
plus de 3 ans
entre 1 et 2 ans
```

Inclure les nombres écrits en lettres jusqu'à dix au minimum.

### Modalité

Indicateurs `required` :

```text
exigé, obligatoire, requis, minimum, au moins,
vous justifiez de, vous disposez de, expérience de X ans
```

Indicateurs `preferred` :

```text
souhaité, apprécié, idéalement, serait un plus,
de préférence, bonus
```

Indicateurs `accepted` :

```text
débutant accepté, sans expérience, aucune expérience requise
```

### Sujet

Exemples :

- « 3 ans d'expérience en React » : expérience technologie, souvent aussi professionnelle mais à marquer précisément ;
- « 3 ans dans le développement web » : professionnelle ;
- « cursus de 3 ans » : éducation, à exclure ;
- « manager une équipe de 3 personnes » : pas une durée ;
- « projet de 2 ans » : durée de projet, à exclure.

### Agrégation

Pour `minimum_experience_months` :

1. filtrer les mentions `required` ;
2. privilégier `subject=professional` ;
3. inclure `technology` si la formulation constitue clairement une condition professionnelle du poste ;
4. prendre le maximum des minima applicables ;
5. produire `ambiguous` en cas de conflit non résolu ;
6. conserver toutes les mentions.

### Expérience structurée

La donnée structurée de la source et le texte sont comparés.

- accord : confiance renforcée ;
- structuré débutant + texte 3 ans obligatoire : ambigu ou contradiction de données, revue ;
- structuré expérience exigée sans durée + texte sans durée : minimum inconnu ;
- texte plus précis : durée extraite, avec preuve.

---

## 12. Classification finale

Pseudo-code normatif :

```ts
export function classifyOffer(
  offer: NormalizedOffer,
  rules: RuleRegistry,
): ClassificationResult {
  const juniorEvidence = detectJuniorSignals(offer, rules);
  const experienceMentions = extractExperienceMentions(offer, rules);
  const experience = resolveMinimumExperience(experienceMentions, offer);
  const salary = classifySalaryTransparency(offer);
  const remote = classifyRemoteMode(offer);

  const warnings = detectConflicts({
    offer,
    juniorEvidence,
    experience,
    salary,
    remote,
  });

  if (warnings.some((warning) => warning.severity === "blocking")) {
    return ambiguousResult(...);
  }

  const claimsJunior = resolveJuniorClaim(juniorEvidence); // boolean | null
  const minimum = experience.minimumRequiredMonths;
  const status =
    claimsJunior !== null || minimum !== null
      ? "classified"
      : "unclassified";

  const beginnerFriendly =
    status !== "classified" || experience.hardContradiction
      ? null
      : hasExplicitBeginnerAcceptance(offer, juniorEvidence)
        ? true
        : minimum !== null
          ? minimum <= 12
          : null;

  const contradictoryJunior =
    status !== "classified" || claimsJunior === null
      ? null
      : claimsJunior === false
        ? false
        : minimum === null
          ? null
          : minimum >= 24;

  return {
    status,
    claimsJunior,
    minimumExperienceMonths: minimum,
    beginnerFriendly,
    contradictoryJunior,
    evidence: [...],
    ruleIds: [...],
    warnings: [...],
  };
}
```

---

## 13. Salaire

### Transparence

`salary_transparent=true` si une rémunération explicite est fournie sous une forme exploitable :

- minimum et/ou maximum ;
- période ;
- devise, supposée EUR uniquement si source française et règle documentée ;
- texte original conservé.

`false` pour :

```text
selon profil
à négocier
attractif
package compétitif
```

### Normalisation

Ne convertir en annuel brut que si :

- période connue ;
- durée du travail suffisante ;
- aucune ambiguïté net/brut ;
- formule publiée.

Conserver :

```text
original_label
min_original
max_original
period
currency
gross_or_net
normalized_annual_min
normalized_annual_max
normalization_warning
```

Ne jamais imputer une valeur à une offre sans salaire.

---

## 14. Télétravail

Catégories :

| Catégorie | Définition |
|---|---|
| `remote` | poste explicitement réalisable entièrement à distance |
| `hybrid` | présence et télétravail explicitement combinés |
| `onsite` | présence sur site explicitement requise et pas de télétravail |
| `unknown` | aucune preuve suffisante |

« Télétravail possible » sans fréquence peut être `hybrid` avec warning `frequency_unknown`, sauf si le texte dit clairement « full remote ».

Ne pas déduire `onsite` d'un simple lieu de travail.

---

## 15. Métriques publiées

### 15.1 Indicateur principal — contradiction junior

#### Population

Offres :

- actives dans la période définie ;
- du périmètre tech ;
- provenant des requêtes publiées ;
- non dupliquées selon l'unité de comptage ;
- possédant une preuve explicite de positionnement junior.

`threshold_resolvable=true` uniquement lorsque :

```text
status = classified
AND claims_junior = true
AND minimum_experience_months IS NOT NULL
```

« Débutant accepté » résout le minimum à `0`. Une expérience seulement souhaitée, un intitulé vague comme « profil confirmé » ou une durée de contrat ne résout pas le seuil.

#### Formule

```text
contradiction_rate =
  count(
    claims_junior = true
    AND status = classified
    AND minimum_experience_months >= 24
  )
  /
  count(
    claims_junior = true
    AND status = classified
    AND threshold_resolvable
  )
```

#### Cas inconnus et couverture

Afficher séparément :

```text
N offres junior classées n'indiquent pas une durée obligatoire exploitable.
M offres avec une preuve junior présentent une ambiguïté bloquante.
coverage = denominator / (denominator + N + M)
```

Ne jamais inclure silencieusement `N` ou `M` dans le dénominateur. `contradictory_junior=false` n'est produit pour une offre junior que lorsque le seuil est résolvable et inférieur à 24 mois.

### 15.2 Accessibilité réelle

La population métrique est l'ensemble des offres actives, valides et non dupliquées du périmètre.

`accessibility_resolvable=true` lorsque le statut est `classified`, qu'aucun conflit bloquant ne subsiste et qu'au moins un des éléments suivants est connu :

- acceptation explicite des débutants ;
- minimum d'expérience obligatoire résolu.

```text
beginner_friendly_rate =
  count(beginner_friendly = true)
  /
  count(status = classified AND accessibility_resolvable)
```

Règles de publication :

- `beginner_friendly=null` reste dans `unknownCount`, pas dans le dénominateur ;
- `status=ambiguous` reste dans `ambiguousCount` ;
- `coverage = denominator / populationCount` ;
- le taux n'est jamais publié sans sa couverture.

Cette séparation évite qu'une absence de précision soit interprétée comme un refus des débutants.

### 15.3 Transparence salariale

La population métrique est l'ensemble des offres actives, valides, non dupliquées et entièrement traitées du périmètre. L'ambiguïté de l'expérience n'a aucun effet sur cette population.

```text
salary_transparency_rate =
  count(salary_transparent = true)
  /
  count(offres de la population métrique)
```

L'absence de salaire dans un payload complet est une observation valide et produit `salary_transparent=false`. Une offre dont le payload est tronqué, invalide ou non traité est mise en quarantaine avant publication ; elle n'est pas transformée en `false`.

### 15.4 Contrat commun des taux

Chaque métrique de taux publie :

```text
metric
value
numerator
denominator
populationCount
unknownCount
ambiguousCount
coverage
sampleQuality
metricVersion
```

Invariants :

```text
0 <= numerator <= denominator <= populationCount
populationCount = denominator + unknownCount + ambiguousCount
coverage = denominator / populationCount, ou null si populationCount = 0
value = numerator / denominator lorsque le dénominateur atteint le seuil de publication ; sinon null
```

Pour la transparence salariale d'un dataset complet, `unknownCount=0`, `ambiguousCount=0`, `denominator=populationCount` et `coverage=1`.

### 15.5 Intervalle et seuil d'échantillon

Les seuils portent sur le **dénominateur résolu**, pas sur la population totale :

- moins de 20 offres : ne pas publier un pourcentage principal ; afficher le volume et « échantillon insuffisant » ;
- 20 à 49 : afficher avec avertissement « faible échantillon » ;
- 50 et plus : affichage standard.

Une version future peut ajouter un intervalle binomial, mais le MVP doit d'abord garantir la compréhension.

---

## 16. Tendance temporelle

Deux options de population :

1. **stock actif du jour** : offres visibles à la date ;
2. **nouvelles offres publiées pendant la fenêtre**.

Ne jamais mélanger les deux.

Le KPI d'accueil utilise le **stock actif du jour**. Les rapports mensuels peuvent utiliser les nouvelles offres, avec libellé distinct.

Pour lisser :

- valeur quotidienne brute ;
- moyenne mobile 7 jours optionnelle ;
- ne pas masquer les jours partiels ;
- annotation des changements de méthode.

---

## 17. Comparaisons

Une comparaison n'est autorisée que si :

- même version de méthode ;
- même type de population ;
- périodes comparables ;
- seuil d'échantillon respecté ;
- couverture source comparable.

Afficher :

```text
A : 37 % (74 / 200)
B : 29 % (58 / 201)
écart : +8 points
```

Ne pas écrire « +27,6 % » lorsque la compréhension attendue est un écart de points.

---

## 18. Agrégats

Dimensions autorisées au MVP :

```text
date
job_family
technology
region
department
commune
contract
remote_mode
```

Limiter une agrégation à trois dimensions métier combinées afin d'éviter l'explosion des cellules.

Chaque ligne stocke :

```text
dataset_version
metric_version
classifier_version
query_set_version
period
dimensions
numerator
denominator
population_count
unknown_count
ambiguous_count
value
coverage
sample_quality
computed_at
```

---

## 19. Contrôles qualité

### À chaque run

- pagination complète ;
- total reçu ;
- duplication ;
- taux invalide ;
- taux de description vide ;
- répartition des contrats ;
- taux junior ;
- taux d'expérience connue ;
- taux ambigu ;
- volume par requête ;
- comparaison avec médiane 7 jours ;
- preuve présente pour chaque classification positive.

### Détection d'anomalie

Signaler :

- volume global ±40 % ;
- volume d'une partition ±60 % ;

Depuis `ingestion-quality-1.1.0` (6 septembre 2026), une hausse de partition inférieure à
cinq offres reste signalée et conservée dans `quality_summary.volumeWarnings`, mais ne bloque
pas à elle seule la publication. Le seuil relatif de 60 % continue de détecter ces variations.
Ce plancher absolu est un garde-fou opérationnel contre les ratios instables (par exemple 1 → 2),
pas une estimation de confiance statistique. Toutes les baisses dépassant 60 %, les hausses
d’au moins cinq offres dépassant 60 %, et les variations globales dépassant 40 % restent
bloquantes. Aucun seuil de KPI, aucune preuve ni classification ne sont modifiés.
La règle s’applique aux nouvelles évaluations ; les anciens résumés qualité restent conservés.

Depuis `ingestion-quality-1.2.0` (7 septembre 2026), ce même plancher de cinq offres s'applique
également aux baisses : par exemple 1 → 0 est un avertissement tracé, tandis que 5 → 0 reste
bloquant. Cette correction opérationnelle est motivée et bornée dans l'[ADR 0013](adr/0013-small-partition-volume-losses.md).
Les seuils globaux, les autres contrôles d'intégrité et la règle des deux absences pour clôturer
une offre restent inchangés. Ce n'est ni une modification du classificateur ni du calcul des KPI.

- taux junior variant de plus de 15 points en un jour ;
- ambiguïté doublée ;
- plus de 2 % de payloads invalides ;
- absence soudaine d'un champ courant ;
- nombre de pages égal à une limite artificielle.

Une anomalie ne prouve pas une panne ; elle bloque ou marque la publication selon sa sévérité.

---

## 20. Jeu de vérité et revue

Le jeu de référence MVP est annoté hors ligne par une unique passe LLM aveugle, conformément à
[`reference/llm-annotation-protocol.md`](./reference/llm-annotation-protocol.md). La prédiction du
classificateur n'est pas fournie au modèle. Chaque annotation conserve le modèle, l'effort de
raisonnement, la version du protocole, un rationnel court et au moins un extrait de preuve vérifié
contre le texte source. Il n'y a ni seconde passe ni arbitrage humain obligatoire.

Ces labels servent uniquement à évaluer et faire évoluer le moteur de règles déterministe. Ils ne
remplacent pas ce moteur dans le pipeline de production et ne sont pas utilisés pour calculer la
prévalence du marché. Une classe absente rend sa précision ou son rappel non évaluable ; un jeu
ciblé réel peut alors compléter la couverture des cas sans être mélangé aux estimations de volume.

La précision de l'extraction d'expérience obligatoire porte sur les valeurs résolues avec
`status=classified`. Les durées conservées comme preuves dans un résultat `ambiguous` ne sont pas
comptées comme une décision publiée et sont évaluées dans les catégories de conflits.

### Format fixture

```json
{
  "fixtureId": "exp-001",
  "title": "Développeur React junior",
  "description": "Vous justifiez d'au moins 2 ans d'expérience...",
  "expected": {
    "claimsJunior": true,
    "minimumExperienceMonths": 24,
    "contradictoryJunior": true,
    "status": "classified"
  },
  "notes": "Contradiction explicite",
  "labelsVersion": "gold-1.0.0"
}
```

### Catégories de fixtures

- nombres ;
- lettres ;
- mois ;
- plages ;
- préférences ;
- négations ;
- diplôme ;
- durée de mission ;
- ancienneté d'entreprise ;
- management ;
- junior mentionné comme collègue ;
- HTML ;
- fautes fréquentes ;
- texte en anglais ;
- données structurées contradictoires.

### Revue

Toute règle modifiée doit :

- ajouter un test reproduisant le problème ;
- exécuter le jeu de vérité ;
- produire un rapport de delta ;
- comparer les changements à la même version du jeu de référence LLM ;
- incrémenter la version selon SemVer métier.

---

## 21. Versionnement métier

### Classificateur

```text
MAJOR : définition incompatible ou catégories modifiées
MINOR : nouvelles règles améliorant le périmètre
PATCH : correction sans changement intentionnel de définition
```

Exemple : `classifier-1.3.2`.

### Métrique

Exemple : `junior-contradiction-1.0.0`.

### Taxonomie

Versions séparées :

```text
jobs-1.0.0
technologies-1.2.0
contracts-1.0.0
geography-2026.1
```

### Insight

Un insight stocke les versions utilisées. Il reste reproductible même après amélioration de la méthode et peut afficher un lien vers le résultat recalculé.

---

## 22. Transparence publique

La page méthodologie doit publier :

- date de dernière modification ;
- source ;
- requêtes ou familles couvertes ;
- définitions ;
- seuils ;
- cas exclus ;
- taux d'ambiguïté ;
- versions ;
- changelog ;
- limites ;
- procédure de signalement.

Le dépôt public devrait contenir les règles et fixtures non problématiques.

---

## 23. Corrections

### Signalement

Un utilisateur peut ouvrir une issue préremplie contenant :

- URL de l'offre ou identifiant public ;
- classification observée ;
- raison ;
- version du classificateur ;
- aucun texte personnel.

### Traitement

1. reproduire ;
2. créer une fixture ;
3. corriger la règle ;
4. mesurer les deltas ;
5. publier la nouvelle version ;
6. reclassifier l'historique nécessaire ;
7. indiquer la correction si elle affecte un insight partagé.

Ne jamais modifier manuellement une classification isolée sans garder un audit. Une exception métier durable doit devenir une règle versionnée.

---

## 24. Rétention

Proposition initiale :

| Donnée | Rétention |
|---|---|
| offres normalisées | durée du projet |
| snapshots utiles | durée du projet |
| payload brut complet | 90 jours, configurable selon licence et besoin |
| erreurs de validation | 30 jours, contenu redacted |
| logs applicatifs | 30 jours |
| agrégats | durée du projet |
| insights | durée du projet |
| jetons OAuth | jamais persistés dans le modèle métier |

La licence et les conditions de la source priment. Toute nouvelle contrainte doit mettre à jour cette section avant lancement.

---

## 25. Limites à afficher

- le périmètre dépend des offres accessibles via la source ;
- les formulations libres peuvent rester ambiguës ;
- une technologie citée n'est pas toujours obligatoire ;
- le site analyse des annonces, pas les recrutements réellement effectués ;
- le terme « junior » n'a pas une définition juridique unique ;
- un faible échantillon local peut varier fortement ;
- une offre peut être dupliquée entre partenaires ;
- une entreprise peut corriger son annonce après collecte ;
- l'expérience demandée ne résume pas toutes les barrières à l'entrée.

Ces limites ne doivent pas être reléguées dans des conditions illisibles. Un résumé est accessible depuis chaque insight.
