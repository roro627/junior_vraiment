# Spécification fonctionnelle et technique exécutable

**Projet :** Junior, vraiment ?  
**Version :** 1.0.0  
**Référence :** 2 septembre 2026  
**Statut :** approuvée pour implémentation

Ce document transforme la vision du produit en exigences vérifiables. Les termes **DOIT**, **NE DOIT PAS**, **DEVRAIT** et **PEUT** sont utilisés au sens normatif.

---

## 1. Résumé du produit

Le site DOIT mesurer la réalité du marché tech junior français à partir d'offres d'emploi officielles et actualisées.

L'expérience principale DOIT permettre de répondre en moins de dix secondes à la question :

> « Dans le périmètre que j'ai choisi, quelle part des offres qui se présentent comme junior demande pourtant au moins deux ans d'expérience ? »

L'utilisateur DOIT ensuite pouvoir vérifier :

- le nombre d'offres étudiées ;
- la période et la fraîcheur des données ;
- la définition exacte de l'indicateur ;
- les offres incluses ;
- les extraits ayant déclenché la classification ;
- la version du classificateur.

---

## 2. Objectifs

### O1 — Produire un indicateur crédible

Le produit DOIT publier un indicateur principal reproductible, accompagné d'un numérateur, d'un dénominateur, d'une définition et d'une version de méthode.

### O2 — Rendre la donnée compréhensible

Les informations importantes DOIVENT être lisibles sans connaissance en statistiques. Tout pourcentage principal DOIT aussi afficher son volume absolu.

Exemple :

```text
38 %
123 offres sur 324
```

### O3 — Permettre l'exploration

Chaque visualisation DOIT être reliée à un sous-ensemble d'offres consultable. L'utilisateur NE DOIT PAS être contraint de croire un graphique sans pouvoir voir les observations qui le composent.

### O4 — Générer des contenus partageables

Chaque combinaison de filtres supportée DOIT avoir une URL canonique et PEUT produire une carte sociale. Les insights éditorialisés DOIVENT produire une image Open Graph 1200 × 630.

### O5 — Renforcer la réputation technique du projet

Le dépôt et le produit DOIVENT démontrer :

- une architecture React moderne ;
- une forte qualité visuelle ;
- une gestion sérieuse des données ;
- de l'accessibilité ;
- des tests ;
- de la transparence méthodologique ;
- une exploitation fiable.

---

## 3. Non-objectifs du MVP

Le MVP NE DOIT PAS :

- héberger des candidatures ;
- collecter des CV ;
- créer des comptes candidats ou recruteurs ;
- prédire la réussite d'une candidature ;
- recommander un employeur ;
- noter moralement une entreprise ;
- scraper LinkedIn, Indeed ou un site dont les conditions l'interdisent ;
- inférer un salaire absent ;
- inférer une expérience minimale sans preuve explicite ;
- résumer une offre avec un LLM pour produire le classement ;
- couvrir tous les métiers de France dès le premier jour ;
- fournir une API publique sans protection ni politique de stabilité ;
- contenir de publicité ou de paiement.

---

## 4. Périmètre métier initial

### 4.1 Familles de métiers

Le lancement DOIT couvrir au minimum :

| Identifiant | Libellé |
|---|---|
| `frontend` | Développement frontend |
| `backend` | Développement backend |
| `fullstack` | Développement full-stack |
| `mobile` | Développement mobile |
| `data` | Data engineering / data science |
| `devops-cloud` | DevOps, SRE et cloud |
| `cybersecurity` | Cybersécurité |
| `qa-test` | QA, test et automatisation |

La taxonomie DOIT associer ces familles à des codes métier source et à des motifs textuels versionnés.

### 4.2 Technologies prioritaires

Le lancement DOIT au minimum reconnaître :

```text
JavaScript, TypeScript, React, Next.js, React Native, Expo,
Vue, Angular, Node.js, Java, Spring, .NET, C#, PHP, Symfony,
Python, Django, FastAPI, SQL, PostgreSQL, Docker, Kubernetes,
AWS, Azure, GCP, Git, CI/CD
```

La reconnaissance DOIT éviter les faux positifs connus. Par exemple, `React` ne doit pas être détecté dans un mot non technique contenant cette chaîne.

### 4.3 Territoires

Le produit DOIT permettre :

- France entière ;
- région ;
- département ;
- commune lorsque la source fournit une référence exploitable.

Le MVP DOIT mettre en avant Lille, Paris, Lyon, Bordeaux, Nantes, Toulouse, Rennes et Montpellier dans les raccourcis, sans limiter la recherche à ces villes.

---

## 5. Définitions métier

### 5.1 Offre « se présentant comme junior »

`claims_junior = true` lorsque l'offre contient au moins une preuve explicite reconnue, par exemple :

- `junior` dans un contexte de niveau de poste ;
- `débutant accepté` ;
- `débutante acceptée` ;
- `jeune diplômé` ou variante inclusive ;
- `première expérience` lorsqu'elle signifie qu'une longue expérience n'est pas exigée ;
- une donnée structurée de la source indiquant que les débutants sont acceptés.

Chaque détection DOIT stocker :

```ts
type Evidence = {
  ruleId: string;
  field: string;
  excerpt: string;
  start?: number;
  end?: number;
  normalizedValue?: string;
};
```

### 5.2 Expérience minimale

`minimum_experience_months` représente le minimum explicite exigé.

Exemples :

| Texte | Valeur |
|---|---:|
| « Débutant accepté » | `0` |
| « Une première expérience appréciée » | `null`, préférence non obligatoire |
| « 6 mois minimum » | `6` |
| « 1 à 2 ans » | `12` |
| « Au moins 2 ans » | `24` |
| « 3 ans ou plus » | `36` |
| « Profil confirmé » | `null`, pas de conversion numérique |
| « 5 ans souhaités » | `null` pour le minimum obligatoire, preuve secondaire conservée |

La présence de plusieurs exigences DOIT produire une liste de preuves. Le minimum obligatoire retenu DOIT être le plus strict des minima explicitement obligatoires applicables au poste.

### 5.3 Offre réellement accessible au débutant

Le résultat est tri-état : `true`, `false` ou `null`. Une absence d'information n'est jamais convertie en `false`.

```text
accessibility_resolvable =
  classification_status = "classified"
  AND no_hard_contradiction
  AND (
    evidence_beginner_accepted
    OR minimum_experience_months IS NOT NULL
  )

beginner_friendly =
  null,  si accessibility_resolvable = false
  true,  si evidence_beginner_accepted
  true,  si minimum_experience_months <= 12
  false, sinon
```

Conséquences normatives :

- « Débutant accepté » produit `beginner_friendly=true` et un minimum de `0` mois ;
- un minimum obligatoire connu supérieur à `12` mois produit `false` ;
- une expérience seulement souhaitée ne résout pas l'accessibilité ;
- une offre sans information exploitable produit `null`, jamais `false` ;
- un conflit bloquant produit `status="ambiguous"` et `beginner_friendly=null`.

### 5.4 Offre junior contradictoire

Évolution approuvée le 9 septembre 2026 : l'[ADR 0014](docs/adr/0014-observable-junior-contradiction.md)
définit la version 2, avec résolution séparée de la contradiction observable et de
l'accessibilité. Les formules v1 ci-dessous décrivent les datasets déjà publiés et restent
applicables tant que la validation et l'activation v2 ne sont pas réalisées. Elles ne doivent
pas servir à exclure automatiquement les conflits de cohérence dans le calcul candidat v2.

Le résultat est également tri-état :

```text
threshold_resolvable =
  classification_status = "classified"
  AND claims_junior = true
  AND minimum_experience_months IS NOT NULL

contradictory_junior =
  null,  si classification_status != "classified"
  null,  si claims_junior IS NULL
  false, si claims_junior = false
  null,  si claims_junior = true AND minimum_experience_months IS NULL
  true,  si claims_junior = true AND minimum_experience_months >= 24
  false, sinon
```

Le seuil de 24 mois DOIT être configurable par version de métrique, mais le changement d'un seuil crée une nouvelle version ; il ne réécrit pas silencieusement l'historique.

### 5.5 Offre ambiguë

Une offre est `ambiguous` lorsque :

- des preuves explicites se contredisent ;
- l'exigence concerne clairement une technologie et non l'expérience professionnelle totale, sans règle permettant de trancher ;
- le texte est tronqué ;
- la donnée structurée contredit le texte ;
- une négation ou formulation complexe empêche une conclusion robuste.

Les offres ambiguës sont visibles dans l'explorer, mais exclues de l'indicateur principal. Leur volume DOIT apparaître dans la méthodologie ou dans l'état des données.

---

## 6. Indicateurs du MVP

### KPI-01 — Part d'offres junior contradictoires

Population métrique : offres actives du périmètre possédant une preuve explicite de positionnement junior, après validation, déduplication et application de la version de requêtes publiée.

```text
numérateur = count(
  claims_junior = true
  AND status = "classified"
  AND minimum_experience_months >= 24
)

dénominateur = count(
  claims_junior = true
  AND status = "classified"
  AND threshold_resolvable = true
)

inconnues = offres junior classées dont le seuil n'est pas résolvable
ambiguës  = offres avec preuve junior et status = "ambiguous"
couverture = dénominateur / (dénominateur + inconnues + ambiguës)
valeur = numérateur / dénominateur × 100
```

Les offres junior sans durée obligatoire exploitable NE DOIVENT PAS entrer dans le dénominateur. Elles sont publiées dans `unknownCount`. Une expérience seulement souhaitée ne rend pas le seuil résolvable.

Affichage obligatoire pour chaque taux :

- pourcentage arrondi à une décimale maximum, ou `null` si le dénominateur est nul ou insuffisant ;
- numérateur ;
- dénominateur ;
- population métrique ;
- nombre inconnu ;
- nombre ambigu ;
- couverture de classification ;
- qualité de l'échantillon ;
- période ;
- date de fraîcheur ;
- version de méthode ;
- lien « Voir les offres ».

### KPI-02 — Accessibilité réelle

Population métrique : toutes les offres actives, valides et non dupliquées du périmètre.

```text
numérateur = count(beginner_friendly = true)

dénominateur = count(
  status = "classified"
  AND accessibility_resolvable = true
)

inconnues = count(status IN ("classified", "unclassified") AND beginner_friendly IS NULL)
ambiguës  = count(status = "ambiguous")
couverture = dénominateur / population_métrique
valeur = numérateur / dénominateur × 100
```

Les offres sans signal suffisant ne sont ni accessibles ni inaccessibles : elles restent inconnues et sont exclues du dénominateur. Le produit DOIT afficher la couverture à côté du taux pour éviter une interprétation excessive.

### KPI-03 — Transparence salariale

Population métrique et dénominateur : toutes les offres actives, valides et non dupliquées du périmètre dont le payload complet a été traité. L'ambiguïté de l'expérience n'exclut pas une offre de cet indicateur.

```text
numérateur   = count(salary_transparent = true)
dénominateur = count(offres de la population métrique)
valeur       = numérateur / dénominateur × 100
couverture   = 1 pour un dataset publié complet
```

Une offre sans mention salariale exploitable est observable et compte donc `false`, contrairement à une offre que le pipeline n'a pas pu traiter : cette dernière est mise en quarantaine avant publication et signalée dans l'état des données.

Ne pas compter comme salaire transparent :

- « selon profil » seul ;
- « rémunération attractive » ;
- un avantage sans rémunération ;
- une estimation externe.

### KPI-04 — Expérience demandée

Distribution :

```text
0 mois
1–12 mois
13–23 mois
24–35 mois
36–59 mois
60 mois et plus
inconnue
ambiguë
```

### KPI-05 — Types de contrat

Répartition des contrats fournis par la source, regroupés dans une taxonomie publique et versionnée.

### KPI-06 — Technologies citées

Fréquence des technologies reconnues dans les offres du périmètre. L'interface DOIT préciser qu'une citation ne signifie pas toujours une exigence obligatoire.

### KPI-07 — Télétravail

Répartition minimale :

```text
remote
hybrid
onsite
unknown
```

Une catégorie ne peut être attribuée que sur preuve structurée ou textuelle explicite.

### KPI-08 — Tendance

Évolution journalière ou hebdomadaire du KPI-01 sur 30 et 90 jours. Les jours incomplets ou incidents de collecte DOIVENT être signalés et ne doivent pas créer une fausse chute.

---

## 7. Pages et exigences

## 7.1 Accueil `/`

### Contenu obligatoire

1. En-tête et proposition de valeur.
2. Date de mise à jour et état de la collecte.
3. Groupe de filtres principal.
4. KPI-01.
5. Tendance du KPI-01.
6. Distribution de l'expérience.
7. Transparence salariale.
8. Types de contrat.
9. Technologies principales.
10. Trois exemples d'offres avec leurs preuves.
11. Bloc méthodologie.
12. Action de partage.
13. Pied de page avec attribution et limites.

### Critères d'acceptation

- [ ] Le KPI principal est visible sans défilement sur un écran ordinateur courant.
- [ ] Le sens du chiffre est compréhensible sans ouvrir la méthodologie.
- [ ] Chaque filtre modifie l'URL.
- [ ] Le retour arrière restaure l'état précédent.
- [ ] Une navigation avec des filtres invalides revient à une valeur sûre et annonce la correction.
- [ ] Les cartes ne changent pas de taille pendant le chargement.
- [ ] Le contenu principal reste utilisable sans animation.
- [ ] Le bouton « Voir les offres » ouvre l'explorer avec les mêmes filtres.

## 7.2 Explorer `/explorer`

### Colonnes ou informations obligatoires

- intitulé ;
- entreprise si fournie ;
- lieu ;
- contrat ;
- date de publication ;
- expérience structurée ;
- expérience extraite ;
- statut de classification ;
- technologies détectées ;
- salaire, s'il est explicite ;
- action « Voir la preuve » ;
- action vers l'offre source.

### Critères d'acceptation

- [ ] Pagination serveur.
- [ ] Tri limité à des colonnes réellement indexées ou pré-calculées.
- [ ] Filtres synchronisés avec l'URL.
- [ ] Version mobile sous forme de cartes, pas de tableau horizontal illisible.
- [ ] Le panneau de preuve est accessible au clavier.
- [ ] L'URL externe est clairement annoncée.
- [ ] Une offre indisponible depuis la dernière collecte est signalée comme telle.
- [ ] Aucun contenu HTML non fiable n'est injecté.

## 7.3 Méthodologie `/methodologie`

Doit expliquer :

- la source ;
- le périmètre ;
- la collecte ;
- la déduplication ;
- les catégories ;
- les règles ;
- les exclusions ;
- les limites ;
- les versions ;
- les incidents connus ;
- la procédure de correction.

Le document DOIT proposer un exemple complet de classification du texte brut au KPI.

## 7.4 À propos `/a-propos`

Doit contenir :

- l'objectif non commercial ;
- l'indépendance du projet ;
- l'auteur ou l'équipe lorsqu'ils sont renseignés ;
- le lien vers le dépôt public ;
- le lien de signalement d'erreur ;
- la licence du code et l'attribution des données.

## 7.5 État des données `/statut-donnees`

Doit afficher :

- dernière exécution réussie ;
- durée de l'exécution ;
- nombre de requêtes ;
- nombre d'offres reçues, nouvelles, modifiées et fermées ;
- taux de validation ;
- taux d'ambiguïté ;
- éventuelles requêtes partielles ;
- version du classificateur ;
- incidents sur 30 jours.

Aucun secret, corps d'erreur sensible ou identifiant d'infrastructure ne doit être public.

## 7.6 Insight `/insights/[slug]`

Un insight est une vue éditorialisée et stable, créée à partir d'un snapshot de métrique.

Exigences :

- titre humain ;
- chiffre principal ;
- comparaison éventuelle ;
- période ;
- filtres ;
- méthode ;
- échantillon ;
- lien vers les offres ;
- date de génération ;
- image Open Graph dédiée ;
- URL canonique ;
- avertissement si les données ont été corrigées depuis la publication.

---

## 8. Filtres

### Filtres MVP

| Paramètre URL | Type | Exemple |
|---|---|---|
| `job` | enum | `frontend` |
| `tech` | slug multiple, max. 3 | `react,typescript` |
| `area` | identifiant géographique | `commune:59350` |
| `contract` | enum multiple | `cdi,cdd` |
| `remote` | enum | `hybrid` |
| `period` | enum | `30d` |
| `metric` | enum | `contradiction` |
| `page` | entier positif | `2` |
| `sort` | enum autorisée | `published_desc` |

Règles :

- les valeurs DOIVENT être validées côté serveur ;
- les paramètres par défaut NE DOIVENT PAS encombrer l'URL canonique ;
- l'ordre des valeurs multiples DOIT être normalisé ;
- trois technologies maximum dans le MVP ;
- l'utilisateur DOIT pouvoir tout réinitialiser en une action ;
- toute mise à jour de filtre DOIT fournir un retour visuel immédiat ;
- une requête lente DOIT conserver l'ancienne visualisation jusqu'à la disponibilité de la nouvelle ou montrer un squelette dimensionné.

---

## 9. États d'interface

Chaque composant de donnée DOIT avoir les états suivants dans Storybook et dans l'application :

```text
idle
loading
success
empty
partial
stale
error
```

### `partial`

Utilisé lorsque certaines partitions de collecte ont échoué. Le produit affiche les résultats disponibles, mais annonce clairement que le périmètre est incomplet.

### `stale`

Utilisé lorsque la dernière collecte réussie dépasse le seuil de fraîcheur :

- avertissement léger après 30 heures ;
- avertissement important après 72 heures ;
- suspension des cartes sociales automatiques après 72 heures, sauf override explicite.

### `empty`

Ne jamais afficher `0 %` si aucun échantillon n'existe. Afficher « Pas assez de données pour ce filtre » avec des suggestions de périmètre plus large.

---

## 10. Animation et sensation produit

Les animations DOIVENT :

- renforcer la continuité spatiale ;
- confirmer une action ;
- rendre les changements de données compréhensibles ;
- respecter `prefers-reduced-motion` ;
- utiliser principalement `transform` et `opacity` ;
- conserver une durée courte ;
- ne jamais retarder l'accès à l'information.

Les animations NE DOIVENT PAS :

- bloquer le défilement ;
- produire de parallaxe ;
- faire rebondir des éléments décoratifs en permanence ;
- rejouer à chaque petit défilement ;
- animer simultanément tous les nombres et graphiques ;
- masquer un chargement réel derrière une animation artificielle ;
- modifier le layout de manière saccadée.

Les tokens obligatoires sont définis dans [`docs/04-MOTION-SPEC.md`](./docs/04-MOTION-SPEC.md).

---

## 11. Accessibilité

Le produit vise **WCAG 2.2 niveau AA**.

Exigences minimales :

- navigation clavier complète ;
- focus visible et non masqué ;
- lien d'évitement ;
- titres hiérarchisés ;
- contrôles nommés ;
- cibles tactiles au moins conformes au minimum WCAG et idéalement 44 × 44 CSS px ;
- contraste texte et composants contrôlé ;
- aucune information transmise uniquement par couleur ;
- graphiques accompagnés d'un résumé textuel ou tableau ;
- changements de statut annoncés avec parcimonie ;
- réduction des mouvements ;
- zoom à 200 % sans perte ;
- reflow à 320 CSS px ;
- langue `fr` déclarée ;
- dates, pourcentages et nombres compréhensibles par les lecteurs d'écran.

Un composant qui ressemble à un bouton DOIT être un `<button>`. Un lien qui navigue DOIT être un `<a>` ou un composant Link produisant un lien.

---

## 12. Performance

Objectifs au 75e percentile mobile et desktop :

| Mesure | Objectif |
|---|---:|
| LCP | `≤ 2,5 s` |
| INP | `≤ 200 ms` |
| CLS | `≤ 0,1` |
| Lighthouse Performance, pages clés | `≥ 90` |
| Lighthouse Accessibility | `≥ 95`, objectif `100` |
| JavaScript client initial total accueil | `≤ 200 Ko gzip` |
| JavaScript métier spécifique accueil | `≤ 75 Ko gzip` |
| Réponse API agrégée p95 hors cold start | `≤ 500 ms` |
| Interaction visuelle initiale | `≤ 100 ms` |

Les budgets sont des portes de revue. Une dérogation doit inclure une mesure avant/après et une justification.

---

## 13. Collecte et qualité des données

### Fréquence

- ingestion complète quotidienne à `03:30 Europe/Paris` ;
- rattrapage manuel sécurisé ;
- petit contrôle de santé à `12:30 Europe/Paris` ;
- agrégats recalculés après une ingestion validée.

### Limitation

Le client source DOIT rester sous la limite publiée par France Travail. La configuration initiale est de cinq requêtes par seconde avec backoff et jitter.

### Idempotence

Relancer une collecte pour une même date et une même version NE DOIT PAS créer de doublons ni doubler les métriques.

### Validation

Chaque payload DOIT être validé. Les champs inconnus PEUVENT être conservés dans la charge brute et générer une télémétrie non bloquante. Un champ obligatoire absent DOIT mettre l'enregistrement en quarantaine.

### Déduplication

Ordre :

1. identifiant externe stable ;
2. source et identifiant partenaire ;
3. empreinte normalisée prudente pour signaler des doublons probables.

Un doublon probable NE DOIT PAS être fusionné automatiquement si cela fait perdre la traçabilité.

---

## 14. Classification

Le classificateur DOIT être :

- pur et déterministe ;
- versionné ;
- testé sur fixtures ;
- indépendant de l'interface ;
- explicable ;
- relançable sur les snapshots historiques ;
- capable de produire `classified`, `ambiguous` ou `unclassified`.

Exemple de sortie :

```ts
type ClassificationResult = {
  classifierVersion: string;
  status: "classified" | "ambiguous" | "unclassified";
  claimsJunior: boolean | null;
  beginnerFriendly: boolean | null;
  contradictoryJunior: boolean | null;
  minimumExperienceMonths: number | null;
  remoteMode: "remote" | "hybrid" | "onsite" | "unknown";
  salaryTransparent: boolean;
  evidence: Evidence[];
  ruleIds: string[];
  warnings: string[];
};
```

Aucune information temporelle ou aléatoire ne doit influencer la même entrée à version identique.

---

## 15. Jeu de vérité

Avant publication du KPI principal :

- annoter au moins 200 offres représentatives avec une unique passe LLM aveugle dite « passe A » ;
- fixer et enregistrer le modèle, l'effort de raisonnement, la version du protocole et la date ;
- ne jamais montrer au modèle les sorties du classificateur évalué ;
- exiger un raisonnement court et des extraits de preuve présents dans les champs source ;
- conserver les fixtures sous forme anonymisée ou conformément à la licence ;
- séparer jeu de développement et jeu de validation.

Cette passe LLM unique constitue la référence autorisée pour les seuils de validation du MVP. Elle
reste un traitement hors ligne : le classificateur de production demeure déterministe, pur,
versionné et sans appel LLM. Si une classe nécessaire au calcul de précision ou de rappel est
absente de l'échantillon représentatif, le seuil est déclaré non évaluable et un échantillon réel
ciblé complète le jeu ; il ne sert jamais à estimer la prévalence du marché.

La même exception hors ligne autorise une unique passe LLM A pour étiqueter la pertinence métier
d'un échantillon de résultats du registre de requêtes. Ce corpus, son protocole et ses seuils sont
séparés du jeu du classificateur. Il ne fournit aucune classification publique et ne peut pas être
utilisé pour estimer la prévalence du marché.

Seuils de lancement :

| Tâche | Seuil |
|---|---:|
| Précision `contradictory_junior=true` | `≥ 0,92` |
| Rappel `contradictory_junior=true` | `≥ 0,85` |
| Précision extraction expérience obligatoire | `≥ 0,90` |
| Aucun faux positif sur « sans expérience » | `100 %` dans les fixtures dédiées |
| Chaque résultat positif possède une preuve | `100 %` |

Si le seuil n'est pas atteint, l'indicateur peut être publié en bêta uniquement avec un avertissement proéminent et sans formulation définitive.

---

## 16. API publique de lecture

Les routes de référence sont :

```text
GET /api/v1/overview
GET /api/v1/trends
GET /api/v1/offers
GET /api/v1/taxonomies
GET /api/v1/data-status
```

Elles DOIVENT :

- valider les paramètres ;
- inclure `generatedAt`, `dataAsOf`, `classifierVersion` et `sampleSize` ;
- renvoyer une erreur RFC 9457 ou structure Problem Details équivalente ;
- définir une politique de cache ;
- ne jamais exposer les charges brutes complètes ;
- paginer toute liste ;
- limiter la taille maximale des paramètres multiples.

Le contrat détaillé est dans [`docs/reference/openapi.yaml`](./docs/reference/openapi.yaml).

---

## 17. SEO et partage

Chaque page indexable DOIT inclure :

- titre unique ;
- description ;
- canonical ;
- Open Graph ;
- Twitter/X card lorsque pertinent ;
- données structurées adaptées ;
- liens internes ;
- contenu serveur utile sans attendre JavaScript.

Les pages de filtres arbitraires ne sont pas toutes indexées. Seuls les insights éditorialisés et pages territoriales/technologiques validées sont canoniques et indexables.

La carte sociale DOIT afficher :

- nom du produit ;
- insight ;
- valeur ;
- échantillon ;
- période ;
- territoire ;
- source ;
- domaine.

Elle NE DOIT PAS afficher de logo d'entreprise ni de texte d'offre pouvant être trompeur hors contexte.

---

## 18. Analytics

Seuls les événements définis dans [`docs/reference/events.json`](./docs/reference/events.json) sont autorisés.

Interdictions :

- envoyer le texte d'une offre ;
- envoyer une adresse e-mail ;
- envoyer un identifiant source complet si non nécessaire ;
- activer le replay de session au MVP ;
- utiliser l'autocapture globale ;
- enregistrer des paramètres URL non filtrés.

Les événements de succès principaux sont :

```text
insight_viewed
filters_applied
evidence_opened
methodology_opened
share_clicked
share_link_copied
source_offer_opened
return_visit
```

---

## 19. Sécurité

Le système DOIT :

- conserver les identifiants France Travail côté serveur ;
- utiliser les secrets d'environnement ;
- redacter les secrets des logs ;
- appliquer une Content Security Policy ;
- imposer HTTPS ;
- valider et borner chaque entrée ;
- encoder le texte externe ;
- limiter les endpoints coûteux ;
- scanner les dépendances ;
- utiliser les versions React/Next.js corrigées ;
- disposer d'une procédure de rotation ;
- journaliser les opérations d'administration.

Le public n'a aucune route d'écriture au MVP, hors éventuel endpoint de télémétrie fourni par un tiers.

---

## 20. Observabilité et incidents

Alertes obligatoires :

- échec total d'ingestion ;
- ingestion partielle au-dessus du seuil ;
- taux de validation sous 98 % ;
- chute du volume supérieure à 40 % sans explication saisonnière ou changement de requête ;
- durée supérieure à deux fois la médiane sur sept jours ;
- absence de collecte réussie depuis 30 heures ;
- erreur 5xx anormale ;
- dégradation Core Web Vitals.

Chaque incident de données public DOIT produire une entrée visible sur `/statut-donnees` lorsque l'intégrité des indicateurs peut être affectée.

---

## 21. Environnements

| Environnement | Données | Usage |
|---|---|---|
| Local | fixtures + bac à sable explicite | développement |
| Preview | branche PostgreSQL isolée, données synthétiques ou copie contrôlée | revue PR |
| Staging | source réelle limitée, non indexé | validation préproduction |
| Production | source réelle, tâches officielles | public |

Une preview NE DOIT PAS déclencher de collecte complète automatique contre l'API réelle.

---

## 22. Critères de sortie MVP

Le produit peut être annoncé publiquement uniquement lorsque :

- [ ] la maquette a été traduite en tokens et composants ;
- [ ] tous les écrans obligatoires existent ;
- [ ] la collecte a fonctionné sept jours consécutifs ;
- [ ] les métriques ont été vérifiées manuellement sur deux journées ;
- [ ] les seuils du jeu de vérité sont atteints ;
- [ ] les tests unitaires, intégration, E2E, a11y et visuels passent ;
- [ ] le build de production passe sans avertissement bloquant ;
- [ ] les pages d'erreur et états vides sont terminés ;
- [ ] l'attribution et les mentions sont présentes ;
- [ ] la politique de confidentialité est cohérente avec les outils activés ;
- [ ] la sauvegarde et la restauration ont été testées ;
- [ ] une alerte réelle a été simulée ;
- [ ] trois cartes LinkedIn ont été testées avec le débogueur de partage ;
- [ ] le dépôt ne contient aucun secret ;
- [ ] le lancement peut être désactivé par feature flag ou rollback de déploiement.
