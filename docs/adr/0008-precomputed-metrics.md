# ADR 0008 — Métriques pré-calculées et datasets versionnés

- Statut : accepté
- Date : 2026-09-02

## Contexte

Recalculer les métriques à chaque page ralentit, complique la reproductibilité et risque des incohérences pendant une ingestion.

## Décision

Calculer les agrégats après ingestion, les associer à un dataset immuable, puis basculer atomiquement la version publique.

## Conséquences positives

- rapidité ;
- cohérence ;
- rollback ;
- insights reproductibles ;
- cache simple.

## Conséquences négatives

- stockage supplémentaire ;
- pipeline de publication ;
- dimensions à anticiper.

## Réévaluation

Calcul à la demande autorisé pour combinaisons rares, bornées et mises en cache.
