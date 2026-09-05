# 10 — SEO, partage et analytics

## 1. Objectif

La diffusion ne doit pas reposer sur une page d'accueil générique. Chaque constat important doit devenir une ressource :

- stable ;
- compréhensible hors contexte ;
- indexable lorsqu'elle apporte une valeur durable ;
- partageable ;
- sourcée ;
- mesurable.

Le produit vise une réputation fondée sur la qualité de ses insights, pas sur des titres trompeurs.

---

## 2. Types de pages

### Indexables

- accueil ;
- méthodologie ;
- à propos ;
- statut ;
- insights éditorialisés ;
- pages technologie validées ;
- pages ville/région validées ;
- rapports mensuels.

### Non indexables par défaut

- combinaisons arbitraires de filtres ;
- pages paginées profondes ;
- résultats avec échantillon insuffisant ;
- previews ;
- staging ;
- routes API ;
- vues techniques.

Utiliser canonical vers la page propre correspondante.

---

## 3. Metadata

Chaque page doit fournir :

```ts
title
description
alternates.canonical
openGraph
twitter
robots
```

Modèle :

```text
{Insight} | Junior, vraiment ?
```

Exemple :

```text
38 % des offres React junior demandent déjà 2 ans d'expérience | Junior, vraiment ?
```

La description ajoute :

- périmètre ;
- période ;
- échantillon ;
- caractère sourcé.

Ne pas dépasser les limites pratiques au point de tronquer l'information essentielle.

---

## 4. Données structurées

### `WebSite`

Accueil :

- nom ;
- URL ;
- description ;
- auteur/organisation selon réalité.

### `Dataset`

Rapport ou page méthodologique :

- nom ;
- description ;
- créateur ;
- dateModified ;
- temporalCoverage ;
- spatialCoverage ;
- license ;
- distribution si export public ;
- variableMeasured.

### `Article` / `Report`

Insights éditorialisés :

- headline ;
- datePublished ;
- dateModified ;
- author ;
- image ;
- citation/source.

Ne pas déclarer un type dont le contenu ne respecte pas réellement la définition.

---

## 5. Sitemap

Inclure :

- routes statiques ;
- insights publiés ;
- pages programmatiques validées.

Exclure :

- paramètres arbitraires ;
- faible échantillon ;
- pages privées ;
- erreurs.

Mettre à jour après publication d'un insight. Les dates `lastModified` doivent refléter une vraie modification.

---

## 6. Open Graph

### Format

```text
1200 × 630
PNG
safe area généreuse
texte réel rendu par ImageResponse
```

### Contenu

1. marque ;
2. titre court ;
3. valeur ;
4. fraction ;
5. périmètre ;
6. période ;
7. source ;
8. domaine ;
9. version/méthode discrète.

### Exemple

```text
Junior, vraiment ?

38 %
des offres React « junior »
demandent au moins 2 ans

123 sur 324 • France • août 2026
Données France Travail • méthode v1.0
```

### Règles

- pas plus de deux tailles de texte majeures ;
- aucun graphique minuscule illisible ;
- fort contraste ;
- pas de logo tiers non autorisé ;
- pas de titre accusatoire ;
- date obligatoire ;
- résultat figé pour un insight ;
- alternative textuelle précise.

---

## 7. Génération d'image

Utiliser `next/og` et `ImageResponse`.

Architecture :

```text
src/app/insights/[slug]/opengraph-image.tsx
src/lib/seo/build-og-model.ts
src/components/og/InsightCard.tsx
```

Le modèle est chargé côté serveur depuis l'insight stocké. L'image ne recalculera pas une statistique à partir des offres.

### Polices

Charger une police locale autorisée et optimisée. Ne pas récupérer une fonte distante à chaque rendu.

### Cache

Un insight versionné produit une image immuable ou longuement cacheable.

---

## 8. URL partageable

### Dashboard filtré

Exemple :

```text
/?job=mobile&tech=react-native&area=commune%3A59350&period=current
```

### Insight stable

```text
/insights/react-native-junior-lille-aout-2026
```

Le dashboard peut évoluer ; l'insight conserve sa valeur, son échantillon et ses versions.

### UTM

Les liens sortants générés pour un post peuvent ajouter :

```text
utm_source=linkedin
utm_medium=social
utm_campaign=launch_2026_09
utm_content=react_lille
```

Le produit ne doit pas stocker arbitrairement tous les UTM dans ses URLs canoniques.

---

## 9. Partage LinkedIn

Fonctions :

- copier le lien ;
- Web Share API ;
- ouvrir l'URL de partage LinkedIn si encore officiellement supportée au moment de l'implémentation ;
- télécharger une carte seulement si cela ne complexifie pas inutilement le MVP ;
- proposer un texte court modifiable.

Ne pas automatiser la publication sur le compte de l'utilisateur sans intégration officielle et besoin explicite.

### Texte proposé

```text
J'ai analysé {sample} offres {scope} à partir de données actualisées.

{value} % des offres se présentant comme « junior » demandent pourtant au moins deux ans d'expérience.

Méthode, période et offres vérifiables :
{url}
```

Le texte reste prudent et évite « toutes les entreprises ».

---

## 10. Insights

### Création

Un insight contient :

```ts
type Insight = {
  slug: string;
  title: string;
  summary: string;
  datasetVersion: string;
  metricVersion: string;
  filters: CanonicalFilters;
  value: number | null;
  numerator: number;
  denominator: number;
  populationCount: number;
  unknownCount: number;
  ambiguousCount: number;
  coverage: number | null;
  periodStart: string;
  periodEnd: string;
  publishedAt: string;
  correctedAt: string | null;
  status: "draft" | "published" | "corrected" | "withdrawn";
};
```

### Publication

Au lancement, une commande ou script contrôlé suffit. Aucun CMS requis.

### Correction

Une correction conserve :

- ancienne valeur ;
- nouvelle valeur ;
- raison ;
- date ;
- versions ;
- lien de changelog.

---

## 11. Stratégie SEO programmatique

Ne pas générer des milliers de pages faibles.

Une page technologie/territoire est créée si :

- échantillon suffisant ;
- contenu unique ;
- tendance disponible ;
- exemples ;
- méthode ;
- mise à jour fiable ;
- intérêt confirmé.

Template :

```text
Marché junior React à Lille
- chiffre principal
- volume
- évolution
- expérience
- salaire
- contrats
- technologies associées
- exemples
- méthode
```

Si une page ne fait que substituer un mot dans le titre, elle ne doit pas être indexée.

---

## 12. Performance SEO

- HTML utile au premier rendu ;
- titres corrects ;
- peu de JS ;
- LCP sans image lourde ;
- liens crawlables ;
- canonical ;
- pas de contenu caché uniquement après clic si essentiel ;
- pagination ou liens vers explorer ;
- sitemap ;
- erreurs 404 réelles ;
- redirections permanentes propres.

---

## 13. Analytics

### Fournisseur

PostHog EU avec :

- capture manuelle ;
- autocapture OFF ;
- session replay OFF ;
- personnes anonymes ;
- propriétés allowlistées ;
- respect DNT selon politique ;
- proxy uniquement si justifié.

### Événements

La liste normative est dans [`reference/events.json`](./reference/events.json).

### Propriétés communes

```text
app_version
dataset_version
route_name
device_category
referrer_category
```

Ne pas envoyer le texte brut de l'URL.

---

## 14. Funnel principal

```text
landing_viewed
  -> insight_viewed
  -> evidence_opened OU filters_applied
  -> explorer_opened
  -> share_clicked
```

Tous les utilisateurs ne doivent pas atteindre le partage. Le funnel sert à repérer les points de compréhension.

---

## 15. Mesure du buzz

### Mesurable directement

- sessions issues de LinkedIn ;
- clics de partage ;
- liens copiés ;
- visiteurs nouveaux ;
- backlinks détectés ;
- étoiles/forks GitHub ;
- retours ;
- pages les plus partagées.

### Mesure externe manuelle

- impressions du post ;
- réactions ;
- commentaires ;
- republications ;
- invitations/conversations générées ;
- mentions par comptes tiers.

Créer un tableau mensuel séparé. Ne pas prétendre que le site connaît une métrique LinkedIn non accessible.

### KPI de qualité du buzz

```text
qualified_visits_from_linkedin
/
linkedin_referred_visits
```

Une visite qualifiée comporte une action de compréhension. Cela évite de considérer un rebond provoqué par un titre agressif comme une réussite.

---

## 16. Confidentialité analytics

- aucune identité ;
- aucune offre complète ;
- aucune entreprise comme propriété analytics ;
- aucune saisie ;
- rétention limitée ;
- politique publiée ;
- fournisseur désactivable ;
- interface fonctionnelle si le script est bloqué.

L'analytics ne doit jamais bloquer le rendu ni provoquer un CLS.

---

## 17. A/B tests

Pas d'A/B testing au MVP.

Les volumes initiaux et le coût méthodologique ne le justifient pas. Préférer :

- tests utilisateurs ;
- comparaison avant/après ;
- métriques de compréhension ;
- retours qualitatifs.

---

## 18. Calendrier de publication suggéré

### Semaine de lancement

- J1 : question fondatrice et résultat France ;
- J3 : méthode et architecture ;
- J6 : Lille vs Paris.

### Puis

- une donnée forte par semaine ;
- un rapport mensuel ;
- un post technique lors d'une amélioration réelle ;
- une correction publique lorsqu'elle est instructive.

Ne pas publier quotidiennement un chiffre sans valeur nouvelle.

---

## 19. Checklist insight

- [ ] question claire ;
- [ ] échantillon ;
- [ ] date ;
- [ ] périmètre ;
- [ ] méthode ;
- [ ] version ;
- [ ] preuve ;
- [ ] comparaison valide ;
- [ ] titre non accusatoire ;
- [ ] carte lisible ;
- [ ] canonical ;
- [ ] UTM ;
- [ ] analytics ;
- [ ] correction possible ;
- [ ] test de partage réel.
