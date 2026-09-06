# Protocole d'annotation LLM A — pertinence des requêtes

**Version :** `query-relevance-llm-a-2.0.0`  
**Modèle initial :** `gpt-5.6-terra`  
**Effort :** `medium`  
**Nombre de passes :** une

## But

Mesurer hors ligne si une offre trouvée pour un groupe métier appartient réellement à ce groupe.
Cette annotation valide le périmètre de collecte ; elle ne classifie aucune offre publiée et ne
mesure pas la prévalence du marché.

## Entrées autorisées

Le modèle reçoit uniquement un identifiant opaque, le groupe candidat et sa famille, le titre et
la description redacted, l'expérience structurée et les canaux de découverte. Il ne reçoit aucune
sortie du classificateur, aucun label antérieur et aucun résultat d'une autre passe.

Un registre candidat peut appliquer avant échantillonnage un filtre déterministe et versionné sur
l'intitulé. Ce filtre fait alors partie du périmètre évalué : l'annotation ne le corrige pas et le
rapport conserve l'empreinte exacte du registre. Les identifiants de requête restent hors de
l'entrée fournie au modèle et sont rattachés après la passe pour le diagnostic agrégé.

## Définitions des groupes

- `software` : conception et développement de logiciels, applications, ERP ou systèmes embarqués ; inclut les développeurs désignés par langage sans imposer frontend ou backend. Exclut support seul, intégration sans développement, vente, formation et management seul ;
- `ai-ml` : construction et mise en production de modèles ou systèmes d’apprentissage automatique / intelligence artificielle. Une simple utilisation d’outils IA ne suffit pas ;
- `frontend` : interfaces web exécutées principalement côté client ;
- `backend` : services, API et logique serveur ;
- `fullstack` : responsabilité substantielle à la fois frontend et backend ;
- `mobile` : applications mobiles natives ou multiplateformes ;
- `data` : analyse, science, ingénierie ou plateforme de données ;
- `devops-cloud` : infrastructure, cloud, SRE, CI/CD et exploitation automatisée ;
- `cybersecurity` : prévention, détection, réponse ou gouvernance de sécurité informatique ;
- `qa-test` : qualité logicielle, validation et automatisation de tests.

Une simple mention d'une technologie, un produit vendu, une formation, du recrutement, du
management sans pratique du métier ou un secteur client ne suffit pas. Un poste hybride peut être
pertinent pour plusieurs groupes, mais `primaryFamily` désigne sa responsabilité dominante.

## Sortie par paire offre × groupe

```json
{
  "reviewId": "identifiant opaque",
  "status": "classified | ambiguous",
  "relevantToGroup": true,
  "primaryFamily": "frontend | backend | fullstack | mobile | data | devops-cloud | cybersecurity | qa-test | software | ai-ml | other-tech | non-tech | unclear",
  "falsePositiveReason": null,
  "rationale": "raison courte",
  "evidenceExcerpts": ["extrait exact"]
}
```

`relevantToGroup` vaut `null`, `primaryFamily` vaut `unclear` et `falsePositiveReason` vaut
`insufficient-context` lorsque le texte ne permet pas de trancher. Pour une offre classée non
pertinente, `falsePositiveReason` vaut l'une des valeurs `adjacent-role`,
`technology-mention-only`, `training-only`, `sales-or-recruitment`, `management-only`,
`other-domain` ou `insufficient-context`. Pour une offre pertinente, ce champ vaut `null`.

Chaque ligne contient au moins un extrait retrouvé dans la source après normalisation Unicode,
casse, espaces et ponctuation. Le pipeline rejette les identifiants manquants ou dupliqués, les
valeurs incohérentes et les preuves absentes. Une correction de forme ou d'invariant reste dans la
même passe A ; aucune seconde passe indépendante n'arbitre le fond.

## Politique d'activation 1.0

La politique est fixée avant lecture des annotations :

- au moins 30 paires par groupe ;
- couverture résolue globale et par groupe `>= 0,90` ;
- précision de pertinence globale `>= 0,80` ;
- précision de pertinence de chaque groupe `>= 0,70` ;
- pagination complète, zéro requête au-dessus du plafond et zéro offre en quarantaine.

Un groupe ou une métrique non évaluable ne passe pas. Le rapport public reste agrégé ; les textes
réels et annotations détaillées demeurent dans `.local/`.
