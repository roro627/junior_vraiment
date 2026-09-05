# ADR 0009 — Passe LLM A unique pour le jeu de référence

- Statut : accepté
- Date : 2026-09-04

## Contexte

La validation initiale imposait 200 annotations manuelles et une seconde passe sur les cas
difficiles. Ce coût empêche le porteur du projet de franchir le jalon de validation. Les 200 offres
réelles redacted ont déjà été annotées à l'aveugle avec des sorties structurées et des extraits de
preuve contrôlables.

## Décision

Le jeu de référence du MVP peut être produit par une unique passe LLM dite « passe A ». Le modèle
ne reçoit pas la prédiction du classificateur. Le modèle, l'effort de raisonnement, la version du
protocole et la date sont enregistrés. Chaque ligne contient un statut tri-état, les valeurs métier,
un rationnel court et au moins un extrait présent dans les champs source.

Cette décision ne modifie pas le chemin de production : aucune offre publique n'est classée par
LLM. Le moteur de règles reste pur, déterministe, versionné, reproductible et explicable. Une classe
absente du jeu rend son seuil non évaluable et impose un complément réel ciblé.

La même exception couvre l'annotation hors ligne de pertinence métier nécessaire pour valider le
registre de requêtes. Elle utilise un protocole et un rapport séparés ; elle ne rejoint jamais le
pipeline de classification ou d'ingestion en production.

## Conséquences positives

- validation réalisable sans campagne manuelle de 200 lignes ;
- protocole et modèle traçables ;
- annotations aveugles aux sorties évaluées ;
- preuves contrôlables automatiquement ;
- aucun coût LLM dans l'ingestion quotidienne.

## Conséquences négatives

- biais et erreurs corrélées possibles dans la référence ;
- absence d'arbitrage humain systématique ;
- changement de modèle nécessitant une nouvelle version du jeu ;
- transparence publique obligatoire sur la nature LLM des labels.

## Contrôles

- schéma strict sur chaque annotation ;
- extraits présents dans la source après normalisation déterministe ;
- invariants tri-état vérifiés automatiquement, avec rejet des sorties invalides ;
- séparation des prédictions et des entrées données au modèle ;
- rapport de confusion et cas non évaluables explicites ;
- jeu ciblé séparé lorsqu'une classe manque au corpus représentatif.
