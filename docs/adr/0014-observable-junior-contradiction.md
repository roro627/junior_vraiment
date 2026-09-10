# ADR 0014 — Contradiction observable, résolution par axe

- Statut : accepté le 9 septembre 2026 ; version 2 publiée et vérifiée le 10 septembre 2026
- Remplace la définition du KPI-01 uniquement lors de la publication de sa version 2

## Décision

Mesurer la coexistence d'un positionnement junior explicite et d'une exigence professionnelle
explicite d'au moins 24 mois. Une incohérence entre acceptation des débutants et expérience
exigée ne suffit plus à exclure cette observation. L'accessibilité reste indéterminée et le
statut global reste `ambiguous` : aucune promesse sur le recrutement réel n'en découle.

La résolution du nouvel axe conserve ses preuves junior et expérience. Un conflit sur le
positionnement junior, une durée non résolue, une préférence, une négation ou un problème
d'interprétation non couvert reste exclu. Seuls les conflits de cohérence explicitement
énumérés sont admissibles ; un nouveau warning bloquant est exclu par défaut.

Un conflit entre deux durées obligatoires ne permet pas de choisir arbitrairement une durée.
Pour le seuil seul, des durées toutes supérieures ou égales à 24 mois peuvent confirmer la
coexistence ; des durées situées de part et d'autre du seuil restent ambiguës.

## Versionnement et déploiement

Le nouvel axe porte `junior-observation-2.0.0`, le taux `junior-contradiction-2.0.0`.
Le contrat v1 et ses données historiques restent inchangés. Le calcul candidat est isolé
du chemin publié jusqu'à validation indépendante, migration additive, adaptation des lectures,
preuves et annotation de rupture historique. Il est interdit de mélanger les deux versions
dans une tendance ou de présenter les deltas techniques comme des annotations indépendantes.

Les seuils d'échantillon et l'unité de comptage ne changent pas. Le taux n'est pas choisi
à l'avance. Il décrit les annonces observées, pas tout le marché français.

## Validation

Tests de régression par axe, invariants du dénominateur et preuves attendues ; comparaison
au moteur précédent ; nouvelle référence aveugle suivant l'ADR 0009. Les anciens labels
restent une référence de non-régression v1, pas une certification de cette nouvelle définition.
