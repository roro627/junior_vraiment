# 14 — Références officielles

**Dernière vérification : 2 septembre 2026**

Les versions et décisions de ce dossier doivent être revérifiées au moment du bootstrap, puis suivies par Renovate et les avis de sécurité. Les liens ci-dessous sont les sources de référence, pas des tutoriels tiers.

---

## React

- [React — Versions](https://react.dev/versions)  
  Référence des versions React. La page listait React `19.2.7` comme correctif le plus récent de la branche 19.2 lors de la vérification.
- [React — React 19.2](https://react.dev/blog/2025/10/01/react-19-2)
- [React — React Compiler v1.0](https://react.dev/blog/2025/10/07/react-compiler-1)
- [React — Security advisories](https://react.dev/blog)  
  À surveiller avant chaque déploiement important.

## Next.js

- [Next.js 16.3](https://nextjs.org/blog/next-16-3)  
  Version annoncée le 3 août 2026. Contient notamment des améliorations de build, rendu serveur, préchargement et navigation ; certaines fonctions restent expérimentales et ne sont pas imposées.
- [Next.js documentation](https://nextjs.org/docs)
- [App Router](https://nextjs.org/docs/app)
- [Caching](https://nextjs.org/docs/app/guides/caching)
- [Metadata and OG images](https://nextjs.org/docs/app/getting-started/metadata-and-og-images)
- [ImageResponse](https://nextjs.org/docs/app/api-reference/functions/image-response)
- [Next.js security updates](https://nextjs.org/blog)

## Tailwind CSS

- [Tailwind CSS v4.3](https://tailwindcss.com/blog/tailwindcss-v4-3)  
  Publié le 8 mai 2026.
- [Tailwind CSS documentation](https://tailwindcss.com/docs)
- [Theme variables](https://tailwindcss.com/docs/theme)

## UI et mouvement

- [shadcn/ui](https://ui.shadcn.com/)
- [shadcn/ui — installation Next.js](https://ui.shadcn.com/docs/installation/next)  
  Le CLI permet de choisir une base Radix, Base UI ou Aria. Le projet verrouille Radix et interdit le mélange de familles.
- [shadcn/ui — Tailwind v4](https://ui.shadcn.com/docs/tailwind-v4)
- [Radix Primitives](https://www.radix-ui.com/primitives)
- [Motion for React](https://motion.dev/docs/react)
- [Motion — accessible animations](https://motion.dev/docs/react-accessibility)  
  Référence pour `MotionConfig reducedMotion="user"` et `useReducedMotion`.
- [Recharts](https://recharts.org/)
- [TanStack Table](https://tanstack.com/table/latest)

## Runtime et paquets

- [Node.js releases](https://nodejs.org/en/about/previous-releases)  
  Node 24 était en statut LTS ; Node recommande les versions Active LTS ou Maintenance LTS pour les applications de production.
- [pnpm — installation](https://pnpm.io/installation)
- [pnpm 11.25](https://pnpm.io/blog/releases/11.25)  
  Branche retenue au bootstrap. Elle restait la branche publiée sous le tag npm `latest`.
- [pnpm 12.1](https://pnpm.io/blog/releases/12.1)  
  Version native stable disponible, volontairement différée le temps de valider son intégration avec toute la chaîne.
- [pnpm — `package.json`](https://pnpm.io/package_json)
- [TypeScript](https://www.typescriptlang.org/)
- [TypeScript releases](https://github.com/microsoft/TypeScript/releases)  
  TypeScript `7.0.2` était la dernière version listée lors de la vérification.
- [Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)

## Données

- [data.gouv.fr — API Offres d'emploi](https://www.data.gouv.fr/dataservices/api-offres-demploi)  
  Décrit les recherches paginées, détails, référentiels, filtres et la limite publiée de 10 appels par seconde.
- [France Travail IO — catalogue Offres d'emploi](https://francetravail.io/produits-partages/catalogue/offres-emploi)
- [France Travail IO — inscription](https://francetravail.io/inscription)
- [data.gouv.fr — licences](https://www.data.gouv.fr/pages/legal/licences)

Les conditions exactes obtenues avec l'accès développeur doivent être archivées dans le dépôt avant lancement.

## Base

- [PostgreSQL versioning policy](https://www.postgresql.org/support/versioning/)  
  PostgreSQL `18.6` était le correctif courant de la branche 18 le 13 août 2026 ; le projet recommande toujours le dernier correctif disponible.
- [PostgreSQL documentation](https://www.postgresql.org/docs/)
- [Neon documentation](https://neon.com/docs/introduction)
- [Neon roadmap](https://neon.com/docs/introduction/roadmap)  
  Confirme la prise en charge de PostgreSQL 14 à 18.
- [Neon regions](https://neon.com/docs/introduction/regions)
- [Drizzle ORM](https://orm.drizzle.team/docs/overview)
- [Drizzle migrations](https://orm.drizzle.team/docs/migrations)
- [Zod](https://zod.dev/)

## Tâches

- [Trigger.dev — Scheduled tasks](https://trigger.dev/docs/tasks/scheduled)
- [Trigger.dev — Retrying](https://trigger.dev/docs/errors-retrying)
- [Trigger.dev — Concurrency](https://trigger.dev/docs/queue-concurrency)
- [Trigger.dev — Idempotency](https://trigger.dev/docs/idempotency)
- [Trigger.dev — Observability](https://trigger.dev/docs/observability)

## Qualité

- [Vitest](https://vitest.dev/)
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Playwright](https://playwright.dev/)
- [axe-core](https://github.com/dequelabs/axe-core)
- [Storybook](https://storybook.js.org/)
- [MSW](https://mswjs.io/)

## Accessibilité

- [W3C — WCAG 2.2](https://www.w3.org/TR/WCAG22/)  
  Le projet vise le niveau AA.
- [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [MDN — prefers-reduced-motion](https://developer.mozilla.org/docs/Web/CSS/@media/prefers-reduced-motion)

## Performance

- [web.dev — Web Vitals](https://web.dev/articles/vitals)  
  Cibles de référence : LCP ≤ 2,5 s, INP ≤ 200 ms et CLS ≤ 0,1 au 75e percentile.
- [web.dev — Optimize INP](https://web.dev/articles/optimize-inp)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)

## Hébergement et observabilité

- [Vercel — Next.js](https://vercel.com/docs/frameworks/nextjs)
- [Sentry — Next.js](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [PostHog — JavaScript Web](https://posthog.com/docs/libraries/js)
- [PostHog — EU hosting](https://posthog.com/docs/privacy/data-storage)

## SEO

- [Google Search — structured data](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data)
- [Schema.org — Dataset](https://schema.org/Dataset)
- [Open Graph protocol](https://ogp.me/)

---

## Politique de mise à jour des références

- vérifier React, Next.js et avis de sécurité chaque semaine via Renovate et canaux officiels ;
- vérifier la documentation France Travail lors de toute erreur de contrat ou au moins trimestriellement ;
- vérifier WCAG/Web Vitals lors d'une modification officielle ;
- enregistrer la date de toute décision de version ;
- ne jamais remplacer une source officielle par un billet de comparaison non maintenu.
