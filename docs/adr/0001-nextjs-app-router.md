# ADR 0001 — Next.js App Router

- Statut : accepté
- Date : 2026-09-02

## Contexte

Le site doit combiner dashboard React, rendu serveur, SEO, images sociales, routes API, cache et animations.

## Décision

Utiliser Next.js 16.3.x App Router avec React 19.2.7.

Server Components par défaut, Client Components localisés.

## Conséquences positives

- architecture unique ;
- SEO et métadonnées ;
- ImageResponse ;
- moins de JS client ;
- cache/revalidation ;
- previews Vercel.

## Conséquences négatives

- modèle serveur/client à maîtriser ;
- vigilance sur cache ;
- patchs de sécurité rapides ;
- certaines fonctions 16.3 restent expérimentales.

## Garde-fous

- aucune expérimentation essentielle ;
- documentation versionnée ;
- tests navigation/cache ;
- dernier patch stable ;
- domaine indépendant de Next.js.

## Alternatives

Vite SPA, Remix/React Router framework, Astro. Rejetées pour le compromis spécifique détaillé dans `STACK.md`.
