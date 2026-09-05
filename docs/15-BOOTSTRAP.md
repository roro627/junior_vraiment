# 15 — Bootstrap du dépôt

Ce document décrit la création du dépôt exécutable à partir de cette documentation. Il doit être suivi dans l'ordre. Le but est d'obtenir un socle minimal, reproductible et déployable avant toute fonctionnalité métier.

---

## 1. Préconditions

Machine de développement :

```text
Git
Node.js 24.20.x
npm fourni avec Node
pnpm 11.25.0
PostgreSQL distant Neon ou PostgreSQL 18 local
```

Vérifier :

```bash
node --version
npm --version
git --version
```

Installer la version retenue de pnpm :

```bash
npm install --global pnpm@11.25.0
pnpm --version
```

Le résultat attendu pour pnpm est `11.25.0`. Une autre version ne doit pas créer ou modifier le lockfile.

---

## 2. Préserver la documentation existante

La racine contient déjà :

```text
README.md
SPEC.md
STACK.md
docs/
maquette/
```

Créer l'application Next.js dans un dossier temporaire adjacent pour éviter l'écrasement :

```bash
cd ..
pnpm dlx create-next-app@latest junior-vraiment-bootstrap \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --turbopack \
  --import-alias "@/*" \
  --use-pnpm
```

Copier ensuite les fichiers applicatifs dans le dépôt cible. Ne jamais remplacer silencieusement les fichiers de documentation.

Supprimer le dossier temporaire après contrôle du diff.

---

## 3. Verrouiller le runtime et le gestionnaire

Créer ou conserver :

```text
.nvmrc          24.20.0
.node-version   24.20.0
```

Ajouter à `package.json` :

```json
{
  "packageManager": "pnpm@11.25.0",
  "engines": {
    "node": "24.20.x",
    "pnpm": "11.25.x"
  }
}
```

Créer `.npmrc` :

```ini
save-exact=true
strict-peer-dependencies=true
auto-install-peers=false
engine-strict=true
```

Règles :

- toutes les dépendances sont enregistrées sans `^` ni `~` ;
- `pnpm-lock.yaml` est versionné ;
- `package-lock.json` et `yarn.lock` sont interdits ;
- la CI utilise la même version de Node et de pnpm ;
- une mise à jour du gestionnaire fait l'objet d'une pull request dédiée.

---

## 4. Initialiser shadcn/ui

Attendre que la maquette ait été inventoriée pour choisir le preset visuel le plus proche, puis exécuter :

```bash
pnpm dlx shadcn@latest init
```

Configuration finale imposée :

```text
framework             Next.js
primitive family      Radix
style                  un preset radix-*
React Server Components activés
TypeScript             activé
CSS variables          activées
Tailwind CSS           4.x
alias components       @/components
alias ui               @/components/ui
alias utils            @/lib/utils
monorepo                non
```

Après génération, vérifier dans `components.json` :

- que `style` commence par `radix-` ;
- que `rsc` vaut `true` ;
- que les chemins pointent vers `src/` ;
- qu'aucun registre tiers non approuvé n'est configuré.

Ne jamais mélanger des composants issus des familles `radix-*`, `base-*` et `aria-*`.

Ajouter les composants à la demande :

```bash
pnpm dlx shadcn@latest add button
pnpm dlx shadcn@latest add card
```

Ne pas exécuter une commande ajoutant toute la bibliothèque.

---

## 5. Installer les dépendances par responsabilité

L'installation se fait par petits groupes afin qu'un échec ou conflit reste identifiable.

### Domaine, validation et URL

```bash
pnpm add zod nuqs date-fns
```

### Interface

```bash
pnpm add motion recharts @tanstack/react-table lucide-react sonner
```

Les primitives Radix utiles sont ajoutées par le CLI shadcn. Ne pas installer un second kit complet.

### Données

```bash
pnpm add drizzle-orm @neondatabase/serverless
pnpm add -D drizzle-kit
```

### Tâches et observabilité

```bash
pnpm add @trigger.dev/sdk @sentry/nextjs posthog-js
```

PostHog reste inactif tant que la configuration de confidentialité n'est pas validée.

### Tests

```bash
pnpm add -D \
  vitest \
  @testing-library/react \
  @testing-library/user-event \
  @testing-library/jest-dom \
  playwright \
  @axe-core/playwright \
  msw
```

Initialiser Playwright avec uniquement les navigateurs requis par la stratégie CI :

```bash
pnpm exec playwright install
```

### Storybook

Utiliser l'initialiseur officiel compatible avec la version de Next.js installée :

```bash
pnpm dlx storybook@latest init
```

Conserver l'intégration Next.js/Vite générée si elle est officiellement recommandée et passe le build. Storybook ne doit pas répliquer le routeur ou la couche de données : MSW fournit les scénarios.

### Formatage et lint

```bash
pnpm add -D prettier prettier-plugin-tailwindcss eslint-plugin-jsx-a11y
```

Après chaque groupe :

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
```

Le nom exact d'un paquet généré par un CLI peut évoluer. La pull request de bootstrap doit enregistrer la version résolue et la source officielle consultée.

---

## 6. Scripts obligatoires

Le `package.json` doit offrir au minimum :

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "test:a11y": "playwright test --grep @a11y",
    "storybook": "storybook dev -p 6006",
    "storybook:build": "storybook build",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:check": "drizzle-kit check",
    "trigger:dev": "trigger.dev dev",
    "trigger:deploy": "trigger.dev deploy"
  }
}
```

Adapter uniquement les commandes dont le CLI officiel diffère dans la version réellement installée. Conserver les noms de scripts afin que la CI et la documentation restent stables.

---

## 7. TypeScript

Partir de la configuration générée par Next.js, puis activer :

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noPropertyAccessFromIndexSignature": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true
  }
}
```

Exceptions :

- un réglage incompatible avec le code généré par une dépendance doit être documenté ;
- `skipLibCheck` ne doit pas masquer une incompatibilité métier ;
- `any` n'est autorisé que dans un adaptateur externe, puis immédiatement validé par Zod.

---

## 8. Structure initiale

Créer avant la première fonctionnalité :

```text
src/
├── app/
│   ├── (site)/
│   └── api/
├── components/
│   ├── charts/
│   ├── filters/
│   ├── layout/
│   ├── product/
│   └── ui/
├── db/
│   ├── migrations/
│   ├── queries/
│   └── schema/
├── domain/
│   ├── classifier/
│   ├── metrics/
│   ├── offers/
│   └── taxonomy/
├── lib/
│   ├── analytics/
│   ├── france-travail/
│   ├── observability/
│   ├── security/
│   └── seo/
├── styles/
│   ├── globals.css
│   └── tokens.css
└── tests/
    ├── factories/
    └── fixtures/
```

Créer aussi :

```text
stories/
trigger/
```

Aucun dossier `packages/`, `apps/`, `services/` ou monorepo n'est créé.

---

## 9. Tailwind et tokens

Le fichier global ne doit contenir que les imports, resets nécessaires et règles globales stables.

Créer `src/styles/tokens.css` après l'analyse de `/maquette`.

Organisation recommandée :

```css
@theme {
  /* primitives visuelles issues de la maquette */
}

:root {
  /* tokens sémantiques clairs */
}

[data-theme="dark"] {
  /* uniquement si un thème sombre est réellement spécifié */
}
```

Ne pas créer automatiquement un dark mode. L'ajouter seulement si la maquette et le produit le justifient.

La première pull request UI doit démontrer :

- une surface ;
- un contrôle ;
- une carte de KPI ;
- une hiérarchie typographique ;
- un focus visible ;
- un état reduced motion.

---

## 10. Motion

Créer un module unique :

```text
src/lib/motion/tokens.ts
```

Il exporte les durées, easings, springs et distances décrites dans [`04-MOTION-SPEC.md`](./04-MOTION-SPEC.md).

Créer un provider client minimal :

```tsx
"use client";

import { MotionConfig } from "motion/react";

import { duration, easing } from "@/lib/motion/tokens";

export function MotionProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ duration: duration.base, ease: easing.standard }}
    >
      {children}
    </MotionConfig>
  );
}
```

Le provider ne doit pas transformer tout le layout en Client Component. Il reçoit des enfants rendus côté serveur.

---

## 11. Variables d'environnement

Copier :

```bash
cp .env.example .env.local
```

Créer `src/lib/env.ts` avec un schéma Zod séparant :

- variables serveur ;
- variables explicitement publiques préfixées `NEXT_PUBLIC_` ;
- options ;
- environnement de test.

Le processus doit échouer au démarrage si une variable obligatoire manque.

Interdictions :

- lire `process.env` directement dans les composants ;
- exposer un secret via `NEXT_PUBLIC_` ;
- journaliser la valeur d'une variable ;
- fournir les identifiants France Travail au navigateur.

---

## 12. Base de données

### Environnement

Créer trois bases ou branches isolées :

```text
development
preview/staging
production
```

Ne jamais exécuter les tests destructifs contre la production.

### Première migration

Traduire [`reference/schema.sql`](./reference/schema.sql) en schéma Drizzle. Le SQL de référence exprime le modèle et les contraintes ; le schéma Drizzle et les migrations deviennent exécutables.

Ordre :

1. définir les tables source et ingestion ;
2. générer la migration ;
3. relire le SQL ;
4. appliquer en développement ;
5. exécuter les tests de contraintes ;
6. appliquer en staging ;
7. sauvegarder le plan de rollback ;
8. seulement ensuite appliquer en production.

Aucun `drizzle-kit push` en production.

---

## 13. Adaptateur France Travail

La première intégration externe doit rester derrière :

```ts
interface JobOfferSource {
  search(params: SourceSearchParams): Promise<SourcePage>;
  getById(id: string): Promise<unknown>;
  getReferenceData(): Promise<SourceReferenceData>;
}
```

Étapes :

1. obtenir l'accès développeur ;
2. archiver la date et les conditions applicables ;
3. capturer des fixtures anonymisées représentatives ;
4. définir le schéma Zod du payload observé ;
5. mapper vers le modèle normalisé ;
6. tester pagination, expiration OAuth, `429`, `5xx`, réponse vide et champ inconnu ;
7. plafonner initialement les appels à cinq par seconde ;
8. ne jamais laisser le navigateur appeler la source.

Les noms de champs réels restent confinés à `src/lib/france-travail`.

---

## 14. Trigger.dev

Créer une tâche minimale de santé avant l'ingestion complète.

Ordre de livraison :

```text
verify-runtime
ingest-france-travail-daily
reclassify-offer-snapshots
compute-daily-metrics
publish-dataset
verify-data-health
```

La publication est une étape distincte. Une ingestion réussie ne rend pas automatiquement un dataset public.

Chaque tâche doit définir :

- identifiant stable ;
- clé d'idempotence ;
- concurrence ;
- timeout ;
- retry ;
- journal structuré ;
- métriques ;
- comportement sur annulation.

---

## 15. Tests avant premier commit fonctionnel

Le bootstrap est accepté lorsque les scénarios suivants passent :

```text
build Next.js de production
typecheck strict
lint
test Vitest exemple
test Testing Library exemple
test Playwright sur la page d'accueil
test axe sur la page d'accueil
build Storybook
connexion PostgreSQL de développement
migration à blanc
validation env
import Motion côté client seulement
aucun secret dans le bundle
```

Ajouter un test de dépendances serveur/client : `@neondatabase/serverless`, les secrets et l'adaptateur France Travail ne doivent pas apparaître dans un bundle navigateur.

---

## 16. Première pull request

La pull request `chore/bootstrap` contient uniquement :

- socle Next.js ;
- versions verrouillées ;
- shadcn configuré ;
- arborescence ;
- tokens temporaires clairement marqués ;
- outils de test ;
- CI minimale ;
- validation d'environnement ;
- connexion de base sans donnée métier ;
- page de santé technique non publique ou protégée ;
- documentation ajustée aux versions résolues.

Elle ne contient pas encore :

- classificateur ;
- collecte complète ;
- dashboard final ;
- animations décoratives ;
- analytics en production ;
- authentification ;
- contenu de démonstration présenté comme réel.

---

## 17. Contrôle final du bootstrap

- [ ] Node et pnpm sont exactement verrouillés.
- [ ] Une seule famille de lockfile existe.
- [ ] Toutes les dépendances sont exactes.
- [ ] shadcn utilise une base Radix et un preset `radix-*`.
- [ ] La maquette a été inventoriée avant de figer les tokens.
- [ ] Les Server Components restent la valeur par défaut.
- [ ] Les scripts obligatoires existent.
- [ ] Le build et tous les contrôles passent.
- [ ] Les environnements de base sont isolés.
- [ ] Les secrets ne sont jamais publics.
- [ ] Le projet peut être déployé sans donnée réelle.
- [ ] Aucun outil explicitement exclu dans `STACK.md` n'a été ajouté.

