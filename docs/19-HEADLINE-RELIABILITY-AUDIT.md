# Audit de fiabilité du KPI principal — 8 septembre 2026

## Portée et statut

Audit correctif demandé par le propriétaire. Les lectures portent sur le dataset publié du
7 septembre, fenêtre 30 jours. Aucune écriture en base, reclassification publiée ou mise en
production n'est réalisée par cet audit. La nouvelle direction graphique locale est indépendante.

## Défauts reproduits

Les preuves stockées montrent des durées d'existence d'entreprise comptées comme expérience
du candidat (« fondé il y a plus de 30 ans », croissance depuis 40 ans), une durée niée
(« pas besoin d'avoir 10 ans »), une borne haute retenue pour « entre 5 et 10 ans » et des
modalités qui débordent d'une durée ou phrase sur une autre. Ces erreurs sont reproduites
dans les fixtures anonymisées `src/tests/fixtures/classifier/exclusion-audit.json`.

Le correctif candidat `classifier-1.2.1` resserre les frontières de mots et d'unités, reconnaît
les plages « entre … et … », isole les modalités par occurrence/phrase et exclut les signaux
d'entreprise et de négation identifiés. Les exclusions explicites gardent une preuve dédiée.
Il ne transforme pas automatiquement un conflit de données en expérience certaine.
Ce correctif n'est pas une promesse de compréhension exhaustive du langage naturel.

## Reproduction

Avec le véritable environnement serveur configuré, sans afficher ses valeurs :

```text
pnpm exec tsx --env-file=.env.local scripts/audit-classifier-exclusions.ts
pnpm classifier:validate:local
```

Le premier outil effectue uniquement des SELECT bornés, recalcule en mémoire les axes junior /
expérience et écrit un rapport local de deltas sans textes d'offres ni identifiants source.
Les valeurs candidates ne remplacent jamais les métriques publiées. Le rapport de validation
antérieur reste conservé dans `docs/reference/classifier-validation-report-1.2.0.json`.

## Ce que la validation ne démontre pas

Sur les 1 114 offres du périmètre figé audité, le candidat modifie 55 résultats d'expérience /
statut. Le KPI simulé reste à 0 / 361 contre 0 / 354 publié ; les cas junior ambigus passent
de 80 à 73, sur une même population de 434 offres junior. Il s'agit de deltas techniques,
pas de 55 décisions certifiées exactes par une nouvelle annotation indépendante. Ces chiffres
ne sont pas publiés dans l'application et ne constituent pas une estimation corrigée du marché.

La référence est une unique annotation LLM sur 200 offres, complétée par 46 cas ciblés.
La précision et le rappel de contradiction reposent seulement sur **trois cas positifs**.
Une réussite des seuils existants ne prouve donc ni une précision de 100 % dans la population,
ni la représentativité nationale, ni l'absence de faux négatifs dans les exclusions.
Les deltas sur les offres publiées ne constituent pas un nouveau jeu de vérité indépendant.

## Décision de méthode nécessaire avant de remplacer le KPI

Contrôles du lot correctif exécutés : 290 tests unitaires réussis (24 tests conditionnels non
activés), dont 13 nouvelles fixtures de régression ; 113 tests E2E réussis (trois répétitions
responsive ignorées), format, lint, TypeScript et build Next réussis. Référence 200 + 46
réévaluée avec ses annotations inchangées et rapport vérifié. Audit réel en lecture seule
rejoué sur les 1 114 offres. Aucun déploiement ni test d'écriture / migration en production.

La spécification actuelle classe comme ambigu tout conflit entre « débutant accepté » et
expérience exigée, puis l'exclut du KPI. Corriger l'extraction ne corrige pas ce choix de mesure.
Il serait trompeur de requalifier en bloc ces lignes ou d'ajouter leurs volumes au numérateur.

Recommandation : distinguer trois questions, avec résolution et preuves propres à chaque axe :

1. L'annonce se positionne-t-elle explicitement comme junior ?
2. Affiche-t-elle une exigence professionnelle explicite d'au moins deux ans ?
3. Ses champs sont-ils cohérents, et l'accessibilité peut-elle être résolue ?

Une coexistence vérifiée des signaux 1 et 2 pourrait être une contradiction observable de
l'annonce, sans affirmer que le candidat est réellement accepté/refusé ni forcer l'accessibilité.
Les négations, préférences, anciennetés d'entreprise, durées de mission et vrais doutes resteraient
exclus. Cela modifie le contrat actuel : nouvelle version de métrique, évolution des invariants,
corpus indépendant ciblé sur ces conflits, migrations et rupture historique explicitement annotée.
Cette décision doit être validée avant implémentation et publication ; le taux n'est pas choisi
à l'avance. Le périmètre doit toujours rester « offres observées », pas « tout le marché français ».

## Accord et premier lot candidat — 9 septembre 2026

Le propriétaire a accepté cette évolution. L'ADR 0014 enregistre la décision et la frontière
entre v1 publiée et v2 candidate. Le nouveau résolveur pur est séparé du classificateur v1 :
il ne modifie ni le statut global ni l'accessibilité. Son intégration en production n'est
pas encore réalisée. Les anciens contrats et classifications restent inchangés.

Rejeu réel en lecture seule du 9 septembre sur le même dataset figé du 7 septembre :
68 observations positives / 434 résolues, soit 15,668 % ; zéro inconnu et zéro ambigu sur
ce nouvel axe pour cet échantillon. Les 73 ambiguïtés globales du candidat v1 demeurent
inchangées. Cette couverture de résolution n'est pas une mesure d'exactitude.
Ce résultat technique n'est ni publié ni validé par une nouvelle référence indépendante.

Les tests candidats couvrent les conflits d'acceptation, les durées de part et d'autre du
seuil, les durées contradictoires au-dessus du seuil, les préférences, l'ancienneté de société,
les négations, le maintien de l'accessibilité indéterminée, la traçabilité des extraits,
les seuils d'échantillon et l'exclusion par défaut des futurs warnings bloquants.

À suivre avant activation : référence aveugle v2, revue des deltas et erreurs, persistance
additive du nouvel axe, contrats de lecture et preuves publiques, annotation de rupture
historique, tests d'intégration et validation de publication. Les anciens labels v1 ne
certifient pas la nouvelle définition. Aucun taux cible n'est imposé.

Contrôles du premier lot v2 : 298 tests unitaires réussis, 24 conditionnels ignorés ;
54 tests ciblés du classificateur réussis ; format, lint, TypeScript et build réussis.
La référence v1 (200 + 46) a été réévaluée sans changer ses labels et passe ses seuils.
E2E : 112 réussites, trois répétitions ignorées et un timeout de navigation Firefox
avant analyse a11y. Le rejeu isolé de ce dernier test réussit (4,3 s), sans modification
de code ni augmentation du timeout. La suite complète initiale n'est donc pas déclarée
entièrement verte. Aucun déploiement ni écriture en base.

## Clôture du candidat — 10 septembre 2026

Le moteur 1.3.7 a passé le septième échantillon indépendant (200 nouveaux textes, figé avant
annotation) : 15 TP, 0 FP, 0 FN ; dénominateur 81 TP, 3 FP, 3 FN (96,4 % précision/rappel).
Les campagnes précédentes restent conservées. Accord exact tous champs : 110/200 ; ce n'est
ni une validation humaine exhaustive ni une garantie universelle. Les seuils du rapport sont
vérifiés avant déploiement et en CI.

Méthode v2 réellement publiée : dataset e5158590-ed31-44d1-a827-4b6ab39ce76e.
L'API publique affiche 59/407 = 14,5 % sur 30 jours, avec 50 cas ambigus exclus ; le périmètre
courant entier donne 128/667 = 19,2 %. Aucun taux cible n'a été imposé. Les incohérences
d'accessibilité restent visibles sans supprimer une coexistence junior/exigence prouvée.
Le changement de méthode est explicite et les datasets v1 restent inchangés.
L'incident technique de publication, son rollback et sa correction sont tracés dans docs/18.
