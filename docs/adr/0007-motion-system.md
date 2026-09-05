# ADR 0007 — Motion centralisé

- Statut : accepté
- Date : 2026-09-02

## Contexte

Le produit vise une sensation premium, mais les animations incohérentes nuisent à l'expérience et à l'accessibilité.

## Décision

CSS pour transitions simples et Motion pour layout/coordination. Tokens uniques de durée, courbe, spring et distance.

## Conséquences positives

- cohérence ;
- reduced motion ;
- continuité ;
- revue facile.

## Conséquences négatives

- hydratation locale ;
- discipline nécessaire ;
- coût de bundle.

## Interdictions

- GSAP ;
- scrolljacking ;
- parallaxe ;
- boucle décorative ;
- valeurs locales arbitraires.
