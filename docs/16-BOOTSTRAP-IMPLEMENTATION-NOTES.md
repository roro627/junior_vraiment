# 16 — Notes d’implémentation du bootstrap

Ce document consigne uniquement les écarts vérifiés pendant le bootstrap. Il ne remplace ni
`STACK.md` ni `docs/15-BOOTSTRAP.md`.

## Versions résolues

- Node.js `24.20.0` et pnpm `11.25.0` ;
- Next.js `16.3.4`, dernier correctif `16.3.x` disponible lors du bootstrap ;
- React et React DOM `19.2.7`, conformément à la stack ;
- TypeScript `7.0.2` ;
- Tailwind CSS `4.3.3` ;
- shadcn CLI `4.20.1`, base Radix, preset `radix-nova`.

Toutes les dépendances applicatives sont épinglées sans plage de version.

## Compatibilité des outils

TypeScript 7 ne fournit pas encore d’API programmatique. Conformément à la recommandation
officielle de l’équipe TypeScript, `@typescript/native` fournit le binaire TypeScript 7 utilisé par
`tsc`, tandis que la dépendance nommée `typescript` pointe vers `@typescript/typescript6@6.0.2`
pour les outils qui ont besoin de l’API, notamment `typescript-eslint`. Le typecheck applicatif
reste donc bien exécuté par TypeScript 7.

La politique locale de sécurité pnpm impose un délai minimal de publication. Les versions stables
les plus récentes antérieures à ce délai sont retenues pour Storybook (`10.5.10`), Vitest
(`4.1.11`), Trigger.dev (`4.5.15`), Motion (`13.1.1`) et Lucide (`1.39.0`). Aucune exclusion de
sécurité n’est enregistrée pour forcer des paquets publiés depuis moins de 24 heures.

Storybook et Vitest sont configurés séparément afin de garder un bootstrap minimal ; l’addon
Vitest de Storybook pourra être ajouté avec les paquets navigateur lorsqu’un test d’interaction le
nécessitera réellement.

L'intégration `@storybook/nextjs-vite@10.5.10` a été retirée après audit : sa dépendance
`image-size` est touchée par deux avis de sécurité élevés sans version corrigée. Le framework
officiel `@storybook/react-vite@10.5.10` couvre les composants actuels sans cette dépendance.
Les transitifs `tar`, `ws` et `deepmerge-ts` utilisés par Trigger.dev sont verrouillés sur leurs
versions corrigées via les overrides pnpm. Les résolutions vulnérables d’`esbuild` sont ciblées
par version afin de préserver celle de Vite, et `@opentelemetry/core@2.7.1` est remplacé par son
correctif compatible `2.8.0` sans rétrograder la branche `2.11.x` déjà utilisée par Sentry.

## Scripts de construction de dépendances

pnpm autorise les scripts de construction uniquement pour `esbuild`, `sharp` et
`unrs-resolver`, nécessaires aux outils retenus. Les CLIs optionnels Sentry/Depot, `core-js` et
MSW n’exécutent aucun script d’installation.

## Historique des offres

Le schéma de référence rendait `(offer_id, content_hash)` unique. Cette contrainte empêchait de
représenter une offre dont le contenu revient à une version antérieure après une modification.
L’implémentation conserve un index non unique sur ces colonnes et garantit séparément qu’un seul
snapshot est courant. L’idempotence repose sur le hash du snapshot courant, pas sur tout
l’historique.
