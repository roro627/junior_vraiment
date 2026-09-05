# ADR 0004 — Trigger.dev pour les tâches

- Statut : accepté
- Date : 2026-09-02

## Contexte

La collecte est planifiée, paginée, réessayable, idempotente et multi-étapes.

## Décision

Utiliser Trigger.dev pour l'ingestion, la reclassification, les agrégats et les contrôles.

## Conséquences positives

- cron avec timezone ;
- observabilité ;
- retries ;
- concurrence ;
- tâches longues ;
- exécution manuelle.

## Conséquences négatives

- service externe ;
- coût et lock-in d'orchestration ;
- déploiement supplémentaire.

## Réduction du lock-in

- logique métier dans des fonctions pures ;
- tâches minces ;
- payloads simples ;
- possibilité de porter vers un worker Node.

## Alternative

Vercel Cron seul, rejeté pour la reprise et la visibilité opérationnelle.
