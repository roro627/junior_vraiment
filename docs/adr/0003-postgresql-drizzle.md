# ADR 0003 — PostgreSQL 18 et Drizzle

- Statut : accepté
- Date : 2026-09-02

## Contexte

Le modèle exige identité, snapshots, contraintes, preuves, relations, agrégats et historique.

## Décision

PostgreSQL 18.x, fournisseur initial Neon, Drizzle ORM/Kit.

## Conséquences positives

- modèle relationnel ;
- JSONB lorsque utile ;
- transactions ;
- SQL contrôlé ;
- index ;
- portabilité.

## Conséquences négatives

- migrations à gérer ;
- requêtes analytiques à optimiser ;
- pooling serverless à configurer.

## Alternatives

MongoDB, Prisma, SQLite, ClickHouse. Rejetées pour le MVP.

## Réévaluation

ClickHouse ou entrepôt seulement si les agrégats historiques dépassent réellement PostgreSQL.
