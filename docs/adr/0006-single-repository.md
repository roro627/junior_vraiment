# ADR 0006 — Application unique, pas de monorepo

- Statut : accepté
- Date : 2026-09-02

## Contexte

Le projet est maintenu initialement par une personne et comporte une application web, des tâches et un domaine commun.

## Décision

Un seul dépôt et un seul package principal. Les tâches Trigger.dev importent le domaine partagé dans le même projet.

## Conséquences positives

- setup simple ;
- refactors atomiques ;
- une CI ;
- une version ;
- peu d'outillage.

## Conséquences négatives

- frontières imposées par conventions plutôt que packages ;
- build potentiellement plus large.

## Réévaluation

Monorepo uniquement si une deuxième application ou un SDK réellement indépendant apparaît.
