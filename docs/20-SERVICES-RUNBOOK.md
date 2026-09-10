# Reprendre le projet et utiliser ses services

Ce guide est destiné à un développeur ou agent sans historique de conversation. Lire d'abord
`README.md`, `SPEC.md`, `AGENTS.md`, puis ce guide et `docs/21-HANDOFF.md`. Les décisions de
méthode restent dans les ADR ; les vérifications passées sont dans `docs/18-OPERATIONS-VALIDATION.md`.
Une vérification datée n'est jamais une garantie de connexion actuelle.

## 1. Cartographie et règles de sécurité

| Service | Rôle | Configuration faisant autorité |
|---|---|---|
| GitHub | Sources, CI, incidents | `git remote -v`, `.github/workflows/` |
| France Travail | Source officielle | `src/lib/france-travail/`, variables worker |
| Neon | PostgreSQL et branches | `.neon` ignoré, variables DB, migrations versionnées |
| Vercel | Application publique | `.vercel/project.json` ignoré, variables par environnement |
| Trigger.dev | Collecte et maintenance | `trigger.config.ts`, `trigger/`, variables distantes |
| Sentry | Erreurs et traces | configurations Sentry, DSN et projet réels |
| PostHog | Analytics optionnel | ADR 0010 : désactivé, pas nécessaire au lancement |

Ne pas copier de secret dans un message, une commande affichée, un rapport ou Git. Les commandes
qui affichent une connection string, une valeur d'environnement ou un jeton ne doivent pas être
exécutées avec sortie visible. Ne jamais lire les profils/cookies du navigateur pour extraire
un token. Utiliser l'authentification officielle CLI, MCP ou l'interface fournisseur.

## 2. Poste local et diagnostic sans secrets

Commandes depuis la racine du dépôt, PowerShell :

```powershell
git status --short
git remote -v
node --version
pnpm --version
pnpm install --frozen-lockfile
Get-ChildItem -Force -Name .env*
Get-Content .env.local | ForEach-Object {
  if ($_ -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
    '{0}: {1}' -f $Matches[1], [bool]($Matches[2].Trim())
  }
}
```

Le projet demande Node 24.20.x et pnpm 11.25.x. Le poste vérifié le 9 septembre utilisait
Node 24.19.0 : avertissement connu, pas une raison pour modifier silencieusement `engines`.
Préserver les modifications préexistantes et les suppressions de maquettes décidées par l'auteur.

`.env.local` contient la connexion web et le secret de curseur. `.env.trigger.local` contient
les variables worker récupérées auprès de Trigger.dev. Ce dernier fichier peut désigner la
production : **ne pas le charger pour servir une preview publique ou lancer un test destructif**.
Next charge `.env.local` automatiquement ; les scripts tsx exigent un chargement explicite.
Une variable déjà définie dans le processus peut primer sur le fichier : vérifier la cible.

Exemple de diagnostic de collecte en lecture seule :
`pnpm exec tsx --env-file=.env.local scripts/inspect-latest-collections.ts`.
Sans `--env-file`, une erreur « configuration absente » ne démontre pas une panne fournisseur.

```powershell
pnpm dev --port 3001
# Ou, après build :
pnpm build
pnpm start --port 3001
```

Preview locale : `http://localhost:3001/`. Vérifier HTTP et contenu avant d'annoncer qu'elle tourne.
Un serveur de production local doit être redémarré après un nouveau build.

## 3. GitHub : source et CI

Remote observé : `https://github.com/roro627/junior_vraiment.git`, nommé `junior_vraiment`.
Ne pas présumer un remote nommé `origin`.

```powershell
gh api user --jq .login
gh repo view roro627/junior_vraiment
gh run list --repo roro627/junior_vraiment --limit 10
```

Si non authentifié : `gh auth login`, intervention utilisateur pour le navigateur. Vérifier ensuite
la lecture du dépôt. Ne pas utiliser `gh auth token` dans une sortie visible.
Workflows : Quality (inclut Storybook), Security, Database migration check, End-to-end et
Scheduled production health. Lire leur YAML avant dispatch ; End-to-end peut cibler la production.
Un push peut déclencher Vercel : traiter push/merge comme une publication, pas une simple sauvegarde.

## 4. Neon : connexion, migration et restauration

Projet observé : `muddy-glitter-23668169`, région `aws-eu-central-1`. Le fichier `.neon` indique
la branche choisie par la CLI ; il ne prouve pas que `DATABASE_URL` pointe vers cette branche.
`DATABASE_URL` sert aux lectures ; `DATABASE_DIRECT_URL` aux migrations. L'alias
`DATABASE_URL_UNPOOLED` est accepté par `src/lib/env.ts`.

```powershell
pnpm dlx neon@4.14.0 projects list --no-analytics
pnpm exec tsx --env-file=.env.local scripts/inspect-migration-state.ts
```

En cas de session absente : `pnpm dlx neon@4.14.0 login --no-analytics`. Le keyring de cette CLI
ne fonctionne pas sur le poste Windows testé : ne pas ajouter `--keyring`. Sans cet argument,
le fournisseur conserve sa session dans son fichier local ; ce n'est pas une variable à commiter.

Pour une nouvelle base, récupérer la vraie connexion depuis la branche voulue et la configurer
hors chat. Ne jamais inventer d'URL. Pour une migration : générer avec `pnpm db:generate`,
inspecter le SQL et les contraintes, exécuter sur une branche isolée, vérifier l'application,
puis seulement `pnpm db:migrate` sur la cible approuvée. **Jamais `drizzle-kit push` en production.**
`drizzle.migrate.config.ts` charge `.env.local` : contrôler la cible avant invocation.

Les tests de rollback/purge exigent `ROLLBACK_GAME_DAY_DATABASE_URL` distinct et
`RUN_DATASET_ROLLBACK_GAME_DAY=1`. Ne pas faire pointer ce secret vers la production.
Restaurer dans une branche séparée, comparer comptes, migrations et dataset ; ne pas restaurer
par-dessus la production pour tester. Les exercices précédents et leurs limites sont dans docs/18.

## 5. France Travail : preuve d'accès et limites

Uniquement l'API officielle configurée, aucun scraping. Variables serveur :
`FRANCE_TRAVAIL_CLIENT_ID`, `FRANCE_TRAVAIL_CLIENT_SECRET`, `FRANCE_TRAVAIL_TOKEN_URL`,
`FRANCE_TRAVAIL_API_BASE_URL`, `INGESTION_REQUESTS_PER_SECOND`.
Le registre effectivement publié est `docs/reference/query-set.active.json`.
Les noms de payload restent dans `src/lib/france-travail/`.

L'accès se vérifie par authentification réelle puis recherche bornée, validation Zod et détail.
Le test `src/lib/france-travail/client.live.test.ts` exige `RUN_LIVE_FRANCE_TRAVAIL=1` et les
variables source dans le processus ; il lit une offre, son détail et le référentiel, sans écrire
en base ni journaliser les textes. Vérifier le chargement d'environnement avant le test :
Vitest seul ne garantit pas celui de `.env.trigger.local`.

Les réponses peuvent changer entre deux pages. Une variation du total ne peut pas être déclarée
collecte complète en supprimant le contrôle. Examiner `ingestion_query_pages`, conserver les pages
et checkpoint d'origine et utiliser une nouvelle tentative versionnée pour refaire la collecte.
Un retry qui relit uniquement le même checkpoint terminal incohérent ne répare rien.

## 6. Trigger.dev : accès, variables, tâches

La référence du projet est dans `trigger.config.ts` : `proj_psqbbfjgsudzjyknrsir`.
La CLI installée dans le dépôt est 4.5.15 ; préférer `pnpm exec trigger` à un `dlx latest`.

```powershell
pnpm exec trigger whoami
pnpm exec trigger env pull --help
# Écrire dans un NOUVEAU fichier ignoré, sans écraser .env.local :
pnpm exec trigger env pull --env prod --output .env.trigger.fresh.local --skip-telemetry
```

La commande par défaut écrit `.env.local` : **toujours fournir `--output`**. Ne pas ajouter
`--force` sans avoir comparé la cible et préservé les variables locales. `env get` révèle une
valeur : ne pas l'utiliser dans une sortie de chat. Authentification si nécessaire :
`pnpm exec trigger login`, puis vérifier `whoami` et le bon projet.

Pour les runs, utiliser le MCP officiel démarré par `pnpm exec trigger mcp --help` puis découvrir
les schémas des outils, ou le dashboard. La CLI 4.5.15 n'a pas de sous-commande `runs`.
Ne pas reproduire les anciens scripts `.local/` avec leurs dates/IDs codés en dur.

Le helper versionné utilise ce MCP officiel et la session CLI, sans extraire de token :

```powershell
node scripts/trigger-operations.mjs tools
node scripts/trigger-operations.mjs worker
node scripts/trigger-operations.mjs run IDENTIFIANT_REEL_TRIGGER
```

Après diagnostic d'une pagination incohérente, la tâche manuelle
`recover-france-travail-collection` accepte la date planifiée originale et une tentative 2 ou 3.
La tentative précédente doit être échouée/annulée ; ses pages ne sont jamais supprimées.
`recover DATE_ISO_ORIGINALE TENTATIVE --confirm-recollection` déclenche cette opération, facturable.
Ne pas inventer une date ou augmenter la tentative pour contourner un contrôle qualité.

Diagnostics base sans payload brut :

```powershell
pnpm exec tsx --env-file=.env.local scripts/inspect-latest-collections.ts
pnpm exec tsx --env-file=.env.local scripts/inspect-ingestion-run.ts IDENTIFIANT_REEL_DU_RUN
```

Tâches principales : `ingest-france-travail-daily` (03:30 Europe/Paris), `check-data-health`
(12:30 et après ingestion), `maintain-data-retention` (dimanche 04:30), `rollback-dataset`,
`verify-alert-delivery` (manuelle). Lire le fichier de chaque tâche pour son payload actuel.
La réception de l'e-mail d'alerte a été confirmée par le propriétaire ; cela ne prouve pas
qu'un futur incident sera traité ni que le canal n'a pas été modifié depuis.

Déploiement, seulement après contrôles et vérification de la cible :

```powershell
pnpm trigger:deploy --env prod --env-file .env.trigger.local --skip-update-check
```

Attention : `syncEnvVars` dans `trigger.config.ts` synchronise des variables depuis le processus.
Un mauvais fichier peut écraser la configuration distante. Vérifier les noms/cibles sans valeurs
avant de lancer. Un déploiement worker n'est pas un déploiement web ; vérifier version active,
run réel, dataset et revalidation séparément. Ne pas déclencher une collecte depuis Storybook.

## 7. Vercel : site, environnement et déploiement

Site connu : `https://junior-vraiment.vercel.app`. La liaison locale est dans
`.vercel/project.json` (projet `junior-vraiment`). Vérifier le compte ET cette liaison.
CLI vérifiée le 9 septembre : 59.14.0 ; le compte répond à `whoami`, avec un avertissement
du worker de recherche de mise à jour. Cet avertissement ne prouve pas un déploiement réussi.

```powershell
pnpm dlx vercel@59.14.0 whoami
pnpm dlx vercel@59.14.0 --help
```

Si session absente : `pnpm dlx vercel@59.14.0 login`. Lire l'aide de la version utilisée pour
`env pull`, `env ls`, `inspect`, `deploy` et `rollback`. Télécharger les variables vers un nouveau
fichier ignoré explicitement nommé, jamais par-dessus la configuration de travail.
Ne jamais ajouter les secrets France Travail à `NEXT_PUBLIC_*`.

Preview : build avec DB isolée et indexation désactivée. Production : contrôles verts, migrations
compatibles N/N-1, liaison confirmée, puis déploiement ; attendre Ready et tester les routes/API.
Un retour CLI ou une URL seule ne suffit pas. Après déploiement :

Le 9 septembre, l'environnement Preview ne contenait pas de connexion DB. Il ne faut pas
considérer une preview comme fonctionnelle sans vérifier ses variables. Pour une release réelle,
la CLI permet `deploy --prod --skip-domain` : cible Production avec ses vraies variables, sans
basculer le domaine public. Ce n'est **pas** une base isolée. Tester cette URL, puis `promote`
vers le domaine seulement après les contrôles. Vérifier l'aide de la CLI avant invocation.

Une URL candidate peut être protégée par la connexion Vercel. Un HTTP 401 n'est alors pas une
panne de la DB : `vercel curl /api/v1/data-status --deployment URL_REELLE` emploie l'accès CLI
officiel et peut créer automatiquement un jeton de contournement dans sa configuration sécurisée.
Ne jamais extraire ni afficher ce jeton. Ne pas désactiver la protection du projet pour tester.
Le 10 septembre, huit routes ont ainsi été vérifiées avant `vercel promote URL_REELLE --yes`.

```powershell
pnpm exec tsx scripts/check-production-health.ts https://junior-vraiment.vercel.app
```

Le rollback web ne répare pas une base ni un dataset. Suivre le runbook docs/09 pour ces deux
opérations distinctes. Ne pas publier un candidat de méthode au motif que le nouveau style est validé.

## 8. Secrets internes

`API_CURSOR_SECRET` signe les curseurs de pagination ; ce n'est pas une clé à obtenir chez
un fournisseur. `REVALIDATION_SECRET` protège la publication du cache et doit être identique côté
web et worker. Générer de l'aléa cryptographique (au moins 32 octets) et l'écrire directement dans
le mécanisme sécurisé, sans imprimer la valeur. La rotation du curseur invalide les anciens liens
paginés ; l'application doit revenir à un curseur sûr. Ne pas régénérer à chaque build.

## 9. Sentry et PostHog

Sentry : organisation `roro000`, projet `junior-vraiment`, région Allemagne selon docs/18.
Les DSN locaux sont configurés ; un DSN permet l'envoi, pas l'administration. Les opérations
d'administration/source maps nécessitent une session ou `SENTRY_AUTH_TOKEN` adéquat.
Utiliser l'interface officielle ou le connecteur disponible, vérifier l'organisation, le projet,
l'environnement et l'événement reçu. Les preuves historiques et filtres de données sont dans docs/18.
Ne pas créer une exception dans la vraie collecte pour tester Sentry. Ne pas considérer une capture
locale ou un HTTP 200 comme preuve de réception fournisseur.

PostHog : `ANALYTICS_ENABLED=false`, pas de replay/autocapture. Aucune activation sans revue de
confidentialité et configuration réelle. L'absence d'accès PostHog n'empêche pas le MVP.

## 10. Validation métier et reprise

Le classificateur reste déterministe en production. L'exception LLM est uniquement hors ligne :
une passe A aveugle, modèle/effort/protocole figés, preuves exactes et labels séparés des prédictions.
La campagne v2 est dans `.local/observation-v2/` ; scripts versionnés de préparation et évaluation :
`prepare-observation-reference.ts`, `evaluate-observation-reference.ts`.
La préparation refuse d'écraser une campagne existante. Les sorties privées ne sont pas dans Git ;
un autre checkout doit disposer d'un transfert sécurisé ou refaire une campagne autorisée.
Les rapports agrégés et empreintes sont publics. Ne pas fabriquer les fichiers manquants.

La relecture ciblée de septembre est explicitement autorisée et tracée dans
`docs/reference/observation-v2-targeted-review.md`. Les labels A originaux restent intacts.
Le premier holdout de 200 nouvelles offres a échoué ; son rapport est conservé, pas remplacé
par un résultat ultérieur. Les corrections exigent un autre holdout sans textes déjà utilisés.
`prepare-observation-holdout.ts --round=2` refuse d'écraser la seconde campagne ;
`evaluate-observation-reference.ts --holdout --round=2` vérifie aussi que le code n'a pas changé
depuis son gel. Les fichiers d'annotation sont privés, uniquement les agrégats sont versionnés.

## 11. QA locale et diagnostics Windows

La campagne finale du candidat 1.3.7 est la septième :
`pnpm exec tsx scripts/evaluate-observation-reference.ts --holdout --round=7`.
`pnpm observation:report:check` vérifie les seuils du numérateur et du dénominateur ainsi que
les empreintes du moteur ; la CI et `pnpm trigger:deploy` incluent cette porte. Les annotations
ne sont pas nécessaires pour vérifier le rapport figé en CI, mais le sont pour le reproduire.
Les six campagnes antérieures ont servi à trouver des défauts et restent archivées, pas effacées.

`pnpm exec vitest run --maxWorkers=4` exécute toute la suite avec une concurrence bornée si
le lancement par défaut mobilise trop de processus Windows. Ce n'est pas une sélection de tests.
Pour Lighthouse, `node scripts/lighthouse-local.mjs` utilise les mêmes trois audits par page
et les budgets de `lighthouserc.json`, avec un profil Chrome jetable dans `.local/`.
Il ne touche ni au Chrome connecté du propriétaire ni à ses cookies. Les profils sont conservés
après fermeture pour éviter une erreur Windows de suppression de fichiers encore verrouillés.
Une erreur de trace `NO_NAVSTART` n'est pas un audit réussi : refaire la campagne complète.
Éviter build, tests lourds et audit de performance simultanés. Ne pas abaisser les budgets.
Sur le poste Windows, les 116 parcours ont été exécutés avec `pnpm exec playwright test --workers=2` :
113 réussis, trois répétitions responsive volontairement ignorées. Quatre workers ont provoqué
des timeouts de navigation intermittents. Conserver les contrôles, réduire la concurrence.

### Recalcul versionné sans nouvelle collecte

`republish-current-methodology` vérifie le run du dataset courant et le périmètre actif, puis
reprend le run source déjà terminé. La tâche conserve son cutoff ; elle ne prétend pas avoir
recollecté aujourd'hui. Déployer d'abord les lectures web compatibles, ensuite le worker validé.
Lire l'identifiant courant depuis la base avant l'appel, jamais recopier un ancien UUID aveuglément :

```powershell
node scripts/trigger-operations.mjs republish IDENTIFIANT_REEL_DU_RUN --confirm-publication
```

Le placeholder ci-dessus n'est pas une valeur utilisable. Attendre le run réel, vérifier la nouvelle
version du dataset, les métriques, les preuves, les tags revalidés et le contrôle de santé.
Le rapport du candidat doit correspondre à son code : les migrations seules n'autorisent pas v2.

Lecture des vrais identifiants et des trois métriques globales, sans texte d'offre ni secret :
`pnpm exec tsx --env-file=.env.local scripts/inspect-current-publication.ts`.
Les métriques globales du dataset peuvent différer des filtres par défaut « 30 jours » : comparer
le même périmètre (`period=current` pour le jeu entier), jamais deux dénominateurs différents.

Pour les E2E contre le domaine public, définir aussi `PLAYWRIGHT_EXPECT_PUBLIC_INDEXING=true`
avec `PLAYWRIGHT_BASE_URL=https://junior-vraiment.vercel.app`. Laisser ce drapeau absent pour une
preview non indexable. Un test de sitemap configuré en preview échouera légitimement en production.

Les branches Neon QA sont temporaires. Celle du 9 septembre, `br-dark-credit-b2aw6pdy`, expire
le 10 septembre à 18:00 UTC. Après expiration, créer une nouvelle branche isolée officielle,
pas une connexion fictive. La sortie de `connection-string` doit être capturée dans une
variable de processus, jamais imprimée. Définir les deux variables DB de ce processus, appliquer
les migrations, puis lancer les tests live. Les variables du shell isolé doivent primer sur
`.env.local` ; vérifier que la branche n'est pas la production avant toute fixture destructive.

Avant handoff : enregistrer changements, commandes et résultats réels, état des services,
prochaine étape et blocages précis dans docs/21. Ne jamais recopier les secrets ou les textes des offres.

### Retour arrière d'une publication de données

Lire la version exacte d'un ancien dataset publié et conservé dans la base ; ne pas utiliser un
UUID à la place du champ dataset_version. Pour un incident de contrat de publication :

```powershell
node scripts/trigger-operations.mjs rollback VERSION_REELLE_DU_DATASET --confirm-rollback
```

Le script appelle la tâche officielle avec le motif PUBLICATION_CONTRACT_MISMATCH.
Vérifier le run terminé, le dataset courant, la revalidation et le contrôle public de santé.
Après un rollback confirmé, l'événement résolu peut être enregistré depuis les timestamps audités :

```powershell
pnpm exec tsx --env-file=.env.local scripts/record-recovered-publication.ts UUID_REEL_DU_DATASET_RETIRE --confirm-recording
```

Les deux placeholders ne sont pas exécutables. Ce dernier script refuse un dataset non retiré ou
sans audit de rollback et est idempotent. Il n'invente ni date de résolution ni durée d'incident.
Une publication/revalidation doit ensuite rendre le statut frais côté cache.
Le contrat datasetVersion est limité à 100 caractères ; le builder, le cycle de vie et la garde
SQL contrôlent cette limite avant bascule. Ne pas allonger silencieusement le contrat pour une release.
