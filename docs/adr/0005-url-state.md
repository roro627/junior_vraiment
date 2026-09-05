# ADR 0005 — URL comme source de vérité des filtres

- Statut : accepté
- Date : 2026-09-02

## Contexte

Les résultats doivent être partageables et restaurés par le navigateur.

## Décision

Stocker les filtres dans les search params, parsés avec Zod/nuqs. Aucun store global au MVP.

## Conséquences positives

- partage ;
- historique navigateur ;
- rendu serveur ;
- canonicalisation ;
- debug facile.

## Conséquences négatives

- validation et sérialisation ;
- limites de longueur ;
- transitions à soigner.

## Garde-fous

- defaults omis ;
- ordre canonique ;
- max trois technologies ;
- params invalides corrigés ;
- tests précédent/suivant.
