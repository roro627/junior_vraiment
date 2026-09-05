# Stack technique imposée et décisions de sélection

**Référence technique : 2 septembre 2026**

Ce document indique les outils à utiliser, leur rôle exact et ce qui ne doit pas être ajouté sans preuve de besoin. Le mot « meilleur » signifie ici : **meilleur compromis pour ce produit précis**, pas outil le plus récent ni plus grande collection de dépendances.

---

## 1. Principes de sélection

Un outil entre dans la stack uniquement s'il satisfait au moins un besoin indispensable parmi :

- qualité de rendu public ;
- fiabilité des données ;
- traçabilité ;
- accessibilité ;
- rapidité de développement ;
- exploitation ;
- capacité de partage ;
- sécurité.

Une dépendance est rejetée si la plateforme, React, CSS ou PostgreSQL résolvent déjà correctement le problème.

Les critères pondérés sont :

| Critère | Poids |
|---|---:|
| Adéquation au produit | 30 % |
| Maintenabilité par une personne | 20 % |
| Qualité et maturité | 15 % |
| Performance | 10 % |
| Accessibilité | 10 % |
| Écosystème et documentation | 10 % |
| Portabilité | 5 % |

---

## 2. Socle applicatif

## 2.1 Next.js 16.3.x App Router

**Décision : retenu et obligatoire.**

### Pourquoi

Le projet est public, indexable et orienté partage. Il a besoin simultanément :

- de contenu rendu côté serveur ;
- de routes dynamiques ;
- de métadonnées ;
- d'images Open Graph calculées ;
- de cache et revalidation ;
- de chargements progressifs ;
- d'une faible quantité de JavaScript client ;
- d'une bonne intégration Vercel.

Next.js 16.3 fournit une architecture cohérente pour tous ces besoins. Les Server Components permettent de garder la majorité du dashboard côté serveur et de réserver React client aux filtres, graphiques et micro-interactions.

### Configuration imposée

- App Router ;
- dossier `src/` ;
- alias `@/*` ;
- Turbopack ;
- Server Components par défaut ;
- routes typées ;
- `cacheComponents: true` après validation des comportements ;
- chargements locaux avec `Suspense` ;
- `ImageResponse` pour les cartes sociales ;
- dernier correctif de sécurité `16.3.x`.

### Règle sur les nouveautés expérimentales

Aucune fonction marquée expérimentale ne doit être indispensable au fonctionnement du MVP. Elle peut être testée derrière un flag, avec chemin stable de repli.

Le compilateur React Rust expérimental de Next.js 16.3 n'est donc pas activé par défaut. Le React Compiler stable peut être activé via la voie officiellement supportée après mesure du build et vérification Storybook/tests.

### Alternatives rejetées

| Alternative | Motif |
|---|---|
| Vite + React Router | Exigerait de recomposer SSR, SEO, routes serveur, cache et OG dynamique |
| Remix / React Router framework | Solide, mais moins direct pour l'écosystème Vercel et `next/og` attendu |
| Astro | Excellent pour du contenu statique, moins naturel pour ce dashboard React interactif et ses routes de données |
| SPA pure | Mauvaise base SEO, partage et premier rendu ; trop de données transférées au client |

---

## 2.2 React 19.2.7

**Décision : version stable épinglée au bootstrap.**

Utiliser les fonctions React modernes supportées par Next.js, sans construire d'abstraction maison autour de Suspense, des transitions ou du cache.

Règles :

- pas de `useEffect` pour charger une donnée accessible au serveur ;
- pas de mémorisation manuelle systématique ;
- pas de Context global pour les filtres ;
- pas de composant client englobant toute la page ;
- mise à niveau immédiate vers tout correctif de sécurité compatible.

---

## 2.3 TypeScript 7.x strict

**Décision : retenu.**

Le projet manipule des données externes changeantes et des catégories métier sensibles. TypeScript réduit les incohérences entre :

- payload source ;
- modèle normalisé ;
- classification ;
- requêtes SQL ;
- contrat d'API ;
- composants de visualisation.

### Configuration attendue

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

Les erreurs TypeScript sont bloquantes en CI. `any` est interdit sauf frontière externe isolée, commentée et immédiatement validée.

---

## 3. Interface

## 3.1 Tailwind CSS 4.3.x

**Décision : retenu et obligatoire.**

Le projet bénéficie de :

- tokens CSS centralisés ;
- utilities cohérentes ;
- container queries ;
- propriétés logiques ;
- faible friction pour traduire la maquette ;
- suppression fiable des styles inutilisés.

### Règles

- les tokens sémantiques vivent dans `src/styles/tokens.css` ;
- la maquette détermine couleurs, typographie, rayons, ombres et espaces ;
- les composants utilisent des noms sémantiques, pas des couleurs métier en dur ;
- les valeurs arbitraires sont interdites sauf exception documentée ;
- aucune duplication d'un système de thème dans JavaScript.

Exemple :

```css
@theme {
  --color-canvas: oklch(...);
  --color-surface: oklch(...);
  --color-foreground: oklch(...);
  --color-muted-foreground: oklch(...);
  --color-accent: oklch(...);
  --radius-control: ...;
  --shadow-elevated: ...;
}
```

---

## 3.2 shadcn/ui + Radix

**Décision : retenu comme base, jamais comme design final.**

shadcn fournit le code source des composants. Le projet peut donc :

- adapter complètement le rendu à la maquette ;
- conserver les primitives accessibles ;
- éviter une dépendance de thème opaque ;
- tester chaque état dans Storybook.

### Famille de primitives imposée

Le CLI shadcn actuel permet de choisir plusieurs bases. Le projet verrouille **Radix** :

- `components.json.style` doit utiliser un preset `radix-*` ;
- ne jamais mélanger dans le même projet des composants `radix-*`, `base-*` et `aria-*` ;
- le preset exact n'est choisi qu'après extraction des tokens de `/maquette` ;
- le preset reste un échafaudage technique : couleurs, rayons, typographie, densité et mouvement viennent de la maquette et du design system du projet.

Radix est retenu ici pour sa maturité, ses comportements accessibles et la stabilité de ses primitives complexes. Ce choix ne transforme pas shadcn en identité visuelle.

### Composants autorisés au MVP

```text
Button, Badge, Card, Dialog, Drawer, Popover, Select,
Command, Tooltip, Tabs, Sheet, Skeleton, Separator,
Table, Pagination, Toggle Group, Sonner
```

N'ajouter un composant qu'au moment de son utilisation. Ne jamais générer toute la bibliothèque.

### Alternative rejetée : Material UI

MUI est robuste, mais imposerait davantage son système visuel et augmenterait l'effort pour atteindre une identité très spécifique issue de la maquette.

### Alternative rejetée : Tailwind Plus/Catalyst

Utile comme inspiration, mais la maquette fournie doit rester la source de vérité et le projet doit pouvoir être publié sans dépendre d'éléments de licence payante.

---

## 3.3 Motion pour React

**Décision : retenu pour le langage de mouvement.**

Motion résout exactement les besoins :

- transitions d'entrée/sortie ;
- continuité des filtres ;
- animations de layout ;
- nombres et graphiques ;
- gestes simples ;
- réduction des mouvements.

### Usage obligatoire

- import depuis `motion/react` selon la documentation de la version installée ;
- `MotionConfig reducedMotion="user"` à la racine interactive ;
- tokens partagés ;
- pas de paramètres de spring copiés au hasard dans les composants ;
- LazyMotion ou import minimal si l'analyse du bundle le justifie.

### Pourquoi pas GSAP

GSAP est excellent pour des timelines complexes et expériences éditoriales. Le produit n'en a pas besoin. Il ajouterait un deuxième paradigme d'animation et encouragerait des effets trop démonstratifs.

### Pourquoi pas seulement CSS

CSS couvre les hovers et transitions simples, mais pas proprement la continuité de layout et la coordination des changements de données. CSS reste toutefois la solution par défaut pour les états simples.

---

## 3.4 Recharts via shadcn Charts

**Décision : retenu pour le MVP.**

Les graphiques nécessaires sont standards :

- ligne ;
- barres ;
- histogramme ;
- donut limité ;
- barres horizontales.

Recharts offre une API React suffisante. shadcn Charts facilite la cohérence des tokens.

### Règles

- chaque graphique a un titre, une unité et un résumé textuel ;
- une alternative tabulaire est disponible ;
- aucune visualisation 3D ;
- aucune animation au premier rendu lorsque `prefers-reduced-motion` est activé ;
- pas de légende uniquement par couleur ;
- nombre de points borné côté serveur ;
- tooltip au clavier si l'interaction est indispensable.

### Quand passer à Visx ou D3

Seulement si une visualisation signature exige un calcul ou une géométrie indisponible dans Recharts. D3 ne doit alors servir qu'au calcul ; React conserve le rendu et le cycle de vie.

### Alternative rejetée : ECharts

Très complet, mais plus lourd et plus généraliste que nécessaire. L'avantage n'apparaît pas sur les graphiques simples du MVP.

---

## 3.5 TanStack Table

**Décision : retenu pour l'explorer.**

Le moteur headless gère le modèle de table sans imposer de style. Le tri, les filtres et la pagination restent pilotés par le serveur et reflétés dans l'URL.

Ne pas activer de virtualisation avant preuve qu'une page paginée de 25 à 50 offres ne suffit pas.

---

## 3.6 nuqs et URL comme état

**Décision : retenu.**

L'état des filtres doit être :

- partageable ;
- restauré par précédent/suivant ;
- lisible côté serveur ;
- canonique ;
- indépendant d'un compte utilisateur.

`nuqs` fournit une couche typée autour des paramètres de recherche.

### Alternatives rejetées

| Outil | Motif |
|---|---|
| Redux Toolkit | Aucun état client complexe ou transverse ne le justifie |
| Zustand | Simple, mais rendrait l'état de filtre moins naturellement partageable |
| TanStack Query | Les données sont rendues serveur et mises à jour quotidiennement ; l'ajout n'est justifié que si un vrai rafraîchissement client apparaît |
| React Context global | Trop large et risque de rerenders ; l'URL est déjà la source de vérité |

---

## 3.7 Typographie et icônes

- `next/font` pour charger localement et éviter le décalage ;
- **Geist** comme valeur de départ uniquement si la maquette ne définit pas une police ;
- **Lucide React** pour les icônes d'interface ;
- aucun emoji comme icône fonctionnelle ;
- aucune fonte ajoutée au dépôt sans vérification de licence ;
- pas d'image contenant du texte pour reproduire une maquette.

---

## 4. Données

## 4.1 PostgreSQL 18.x

**Décision : retenu.**

Le produit a besoin :

- d'identités stables ;
- de snapshots ;
- de relations offre–technologie ;
- de contraintes ;
- de transactions ;
- d'agrégations ;
- de JSONB pour conserver un payload brut contrôlé ;
- d'index textuels simples ;
- d'un historique fiable.

PostgreSQL suffit largement au lancement. ClickHouse, Elasticsearch et Redis sont interdits sans mesure démontrant un problème.

### Pourquoi pas MongoDB

Les offres ont une part semi-structurée, mais les analyses, relations, contraintes et agrégats sont centrales. JSONB apporte la souplesse nécessaire sans perdre le modèle relationnel.

### Pourquoi pas SQLite

Excellent localement, mais moins adapté à l'ingestion concurrente, aux environnements distants et à l'exploitation managée du produit public.

---

## 4.2 Neon

**Décision : fournisseur managé initial.**

Raisons :

- PostgreSQL standard ;
- branchements de base utiles pour les previews ;
- pooling ;
- fonctionnement adapté à une charge publique irrégulière ;
- intégration courante avec Vercel.

Contraintes :

- choisir une région européenne proche de l'hébergement ;
- vérifier PostgreSQL 18 et la région au moment de créer le projet ;
- utiliser une URL poolée pour le runtime serverless ;
- utiliser une URL directe pour les migrations si recommandé ;
- tester restauration et export ;
- ne dépendre d'aucune extension propriétaire essentielle.

La couche SQL doit rester portable vers un autre PostgreSQL managé.

---

## 4.3 Drizzle ORM + Drizzle Kit

**Décision : retenu.**

Drizzle garde le SQL visible et permet :

- schéma TypeScript typé ;
- migrations versionnées ;
- requêtes lisibles ;
- contrôle des index ;
- moindre abstraction sur les agrégats.

### Alternative rejetée : Prisma

Prisma est productif, mais ce projet profite davantage d'un accès proche du SQL pour les fenêtres temporelles, agrégats, `jsonb`, index partiels et requêtes d'analyse.

### Règles de migration

- jamais de `push` direct en production ;
- migration SQL relue ;
- migration additive avant destructive ;
- backfill séparé et réessayable ;
- test sur copie de staging ;
- rollback documenté, même lorsqu'il consiste en une migration corrective.

---

## 4.4 Zod 4.5.x

**Décision : retenu à chaque frontière.**

Schémas distincts :

```text
FranceTravailRawOfferSchema
NormalizedOfferSchema
ClassificationResultSchema
FilterSearchParamsSchema
PublicApiResponseSchema
EnvironmentSchema
```

Ne pas réutiliser aveuglément le type de la base comme contrat public. Chaque frontière a son modèle.

---

## 5. Ingestion et tâches

## 5.1 Trigger.dev

**Décision : retenu.**

L'ingestion est multi-étapes, paginée et doit survivre aux erreurs temporaires. Trigger.dev fournit le cadre pour :

- cron ;
- traces ;
- retries ;
- files et concurrence ;
- idempotence ;
- versionnement de tâche ;
- exécution manuelle ;
- alertes.

### Tâches prévues

```text
ingest-france-travail-daily
reclassify-offer-snapshots
compute-daily-metrics
verify-data-health
publish-insight-snapshots
```

### Concurrence

- une seule ingestion complète active ;
- cinq appels source par seconde maximum au départ ;
- partitionnement contrôlé par requête ;
- retry exponentiel sur 429 et 5xx ;
- pas de retry aveugle sur erreur de validation.

### Alternative rejetée : simple Vercel Cron

Un route handler cron suffirait à une requête courte. Ici, l'ingestion doit paginer, reprendre, tracer et recalculer. Le gain de simplicité apparent disparaît dès le premier incident partiel.

---

## 6. Tests et qualité

## 6.1 Vitest

Tests purs :

- parsing d'expérience ;
- détection junior ;
- détection technologie ;
- normalisation ;
- agrégations ;
- parsing de paramètres ;
- fonctions de formatage.

Le domaine ne doit pas importer Next.js pour rester exécutable dans Vitest.

## 6.2 Testing Library

Teste les comportements perçus, pas l'implémentation :

- intitulé accessible ;
- interaction clavier ;
- annonce de statut ;
- choix de filtre ;
- panneau de preuve ;
- état vide.

## 6.3 Playwright

Parcours :

- accueil → filtre → explorer ;
- précédent/suivant ;
- ouverture de preuve ;
- partage/copier ;
- méthodologie ;
- erreurs et données périmées ;
- viewport mobile, tablette et bureau ;
- clavier uniquement ;
- reduced motion ;
- cartes Open Graph ;
- navigation instantanée si l'API Next.js correspondante est stable.

## 6.4 axe-core

`@axe-core/playwright` est exécuté sur les pages et états clés. L'absence de violation automatisée ne remplace pas les tests manuels clavier et lecteur d'écran.

## 6.5 Storybook + MSW

Chaque composant de donnée doit exposer :

```text
Default, Loading, Empty, Partial, Stale, Error,
LongContent, HighValue, LowValue, ReducedMotion, Mobile
```

MSW fournit des scénarios réalistes sans dépendre de la production.

---

## 7. Exploitation

## 7.1 Vercel

- application Next.js ;
- preview par pull request ;
- domaines et TLS ;
- variables séparées ;
- protection des previews ;
- Analytics Vercel non requise si PostHog/Sentry suffisent ;
- region runtime proche de PostgreSQL.

Le code ne doit pas dépendre de Vercel au point d'empêcher un déploiement Node standard, hors optimisations explicitement isolées.

## 7.2 Sentry

Configurer :

- erreurs serveur ;
- erreurs navigateur ;
- source maps ;
- traces échantillonnées ;
- Cron/Check-in si compatible ;
- redaction des données ;
- release liée au commit.

Interdiction d'envoyer les descriptions complètes d'offres ou les secrets.

## 7.3 PostHog EU

Usage minimal :

- région UE ;
- autocapture désactivée ;
- replay désactivé au MVP ;
- événements manuels ;
- paramètres allowlistés ;
- pas d'identité utilisateur ;
- conservation minimale utile ;
- consentement adapté à la configuration juridique retenue.

Si la conformité ou le coût devient disproportionné, l'alternative est Plausible ou une mesure serveur minimale. Le produit ne doit pas dépendre de PostHog pour fonctionner.

---

## 8. Outils de développement

## 8.1 pnpm 11.25.x

**Décision : retenu.**

- lockfile déterministe ;
- installation efficace ;
- contrôle des scripts de build ;
- version exacte épinglée dans `package.json` et vérifiée par `engines` ;
- versions exactes.

Le passage à pnpm 12 est une décision explicite, accompagnée d'une exécution complète de CI et d'un test de déploiement.

## 8.2 ESLint + Prettier

- ESLint avec configuration Next.js et règles a11y ;
- Prettier pour le formatage ;
- plugin Tailwind pour l'ordre des classes ;
- aucune guerre de style en revue ;
- linter bloquant.

Biome n'est pas retenu au lancement afin de garder les règles Next.js/a11y les plus directement supportées. Cette décision peut être revue si la couverture devient équivalente.

## 8.3 GitHub Actions

Pipelines :

```text
quality.yml
e2e.yml
database-migration-check.yml
security.yml
scheduled-health.yml
```

## 8.4 Renovate

- exécution hebdomadaire ;
- correctifs de sécurité immédiats ;
- regroupement des paquets liés ;
- automerge uniquement pour patch de devDependency après CI ;
- pas d'automerge React, Next.js, base ou tâches ;
- dashboard de dépendances.

---

## 9. Dépendances explicitement non retenues au MVP

| Outil / catégorie | Décision |
|---|---|
| Redux / Zustand | Non |
| GraphQL / Apollo | Non |
| tRPC | Non |
| Redis / Upstash | Non, sauf abus ou verrou distribué démontré |
| Elasticsearch / Meilisearch | Non |
| ClickHouse | Non |
| Turborepo / Nx | Non |
| Docker obligatoire en local | Non ; fichier optionnel possible pour PostgreSQL |
| Kubernetes | Non |
| Auth.js | Non, aucun compte |
| CMS | Non |
| LLM de classification | Non |
| GSAP | Non |
| Three.js | Non |
| Mapbox / MapLibre au MVP | Non |
| PWA / service worker | Non |
| WebSocket | Non |
| Web worker | Non avant mesure |
| Feature flag SaaS | Non ; variables/config interne suffisantes |
| Design system npm séparé | Non |

---

## 10. Procédure pour ajouter un outil

Toute proposition de dépendance doit répondre dans la pull request :

1. Quel problème observable résout-elle ?
2. Quelle solution native a été essayée ?
3. Quel est son coût client et serveur ?
4. Est-elle maintenue et compatible avec les versions du projet ?
5. Quel est son impact accessibilité ?
6. Quel risque de verrouillage introduit-elle ?
7. Comment la tester ?
8. Comment la supprimer ?

Une dépendance de production qui ne répond pas à ces questions ne doit pas être ajoutée.
