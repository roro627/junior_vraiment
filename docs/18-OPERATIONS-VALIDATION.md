# 18 — Validation opérationnelle

Ce document consigne les exercices réellement exécutés pendant le hardening. Il complète le
runbook de `docs/09-DEPLOYMENT-OPERATIONS.md` sans modifier ses exigences.

## Rollback d’un dataset

Un game day a été exécuté le 4 septembre 2026 sur une branche Neon dédiée :

- duplication contrôlée du dataset courant pour simuler une publication défaillante ;
- publication atomique de cette version de test ;
- retrait de la version défaillante et restauration du dataset sain ;
- second appel de rollback sans effet, afin de vérifier la rejouabilité ;
- présence de l’événement d’audit `DATASET_ROLLBACK` ;
- nettoyage des lignes de test et confirmation que le dataset sain reste l’unique version
  courante.

Le premier montage de l’exercice ne rendait pas la base dédiée obligatoire. Il a été arrêté puis
durci : le test live exige désormais `ROLLBACK_GAME_DAY_DATABASE_URL` et ne peut pas retomber sur
`DATABASE_URL`. Le garde-fou est couvert par un test de schéma d’environnement.

Commande de reproduction, uniquement avec une base éphémère dédiée :

```powershell
$env:RUN_DATASET_ROLLBACK_GAME_DAY = "1"
pnpm vitest run src/db/rollback-dataset.live.test.ts
```

La tâche Trigger.dev `rollback-dataset` utilise la même primitive atomique, partage la file de
publication et demande ensuite la revalidation des vues publiques.

Le bundle Trigger.dev a été construit par le fournisseur puis déployé avec succès en production
le 5 septembre 2026 sous la version `20260904.11`.

## Restauration Neon

Un exercice de restauration Neon a été exécuté le 4 septembre 2026 dans une branche isolée. La
branche restaurée a été vérifiée par connexion réelle, contrôle des migrations, lecture du dataset
courant et exécution des contraintes d’intégration. La branche d’exercice a ensuite été supprimée.

Cet exercice valide la procédure technique, pas une durée de rétention contractuelle ni un RTO/RPO
fournisseur. Ces paramètres doivent rester alignés avec l’offre Neon effectivement souscrite.

## Déploiement et smoke tests

Le déploiement Vercel de production a été vérifié le 5 septembre 2026 sur
`https://junior-vraiment.vercel.app` :

- routes critiques, endpoints publics, `robots.txt` et sitemap en HTTP 200 ;
- canonical de production et absence de `noindex` accidentel ;
- CSP, HSTS et en-têtes de sécurité présents ;
- rendu des pages d’insight et cartes Open Graph vérifié par les tests de parcours.

Trois mesures Lighthouse 13.4.1 ont été prises pour chacune des routes `/`, `/explorer` et
`/methodologie`. Les médianes observées respectent les budgets du projet : score performance au
moins 0,92, accessibilité 1, LCP sous 2,5 s, CLS sous 0,1 et transfert JavaScript sous 200 Kio.
La CI utilise la même version de Lighthouse via un override pnpm explicite ; les contrôles Axe de
Playwright restent le filet accessibilité fonctionnel.

Le workflow GitHub Actions `End-to-end` a ensuite été déclenché manuellement le 5 septembre 2026
sur le commit `6ebd71e`. Il a exécuté avec succès les 72 scénarios Playwright contre l’URL de
production puis les neuf mesures Lighthouse soumises aux budgets. Les workflows `Quality` et
`Security` du même commit sont également passés. Le dépôt GitHub est relié au projet Vercel pour
les déploiements suivants.

Le signalement privé de vulnérabilité GitHub a été activé puis relu via l’API du dépôt le
5 septembre 2026. La page publique `/signaler` pointe vers ce canal distinct des issues de données.
L’attribution MIT a été finalisée au nom de Romain Lambert et reportée sur la page À propos ; les
exclusions relatives aux données et à la maquette restent explicites.

## Analytics préparé localement

Le contrat client couvre les événements définis dans `docs/reference/events.json`. Les vues
principales, changements de filtres, ouvertures de preuve, sorties vers l’offre source et partages
d’insight utilisent une capture manuelle avec propriétés agrégées ou identifiants de taxonomie.
L’initialisation est non bloquante, l’autocapture et le replay sont désactivés, les propriétés sont
filtrées par allowlist et l’hôte accepté est limité à PostHog EU.

Cette préparation ne vaut pas activation fournisseur : aucune collecte PostHog n’a été annoncée
comme opérationnelle. L’activation reste conditionnée à une configuration réelle et à la revue des
paramètres fournisseur de consentement, traitement de l’IP et conservation.

## Points non soldés

- la rotation des identifiants Neon est différée à la demande du propriétaire ; elle ne doit pas
  être considérée comme effectuée ;
- les preuves de sept ingestions quotidiennes consécutives nécessitent sept exécutions planifiées ;
- PostHog est reporté hors lancement MVP par l’ADR 0010 et reste désactivé ;
- les mentions légales et les paramètres réels de conservation restent à valider par le
  propriétaire.

## Raccordement Sentry

Le 5 septembre 2026, l’authentification réelle a permis de créer le projet `junior-vraiment`
dans l’organisation `roro000`, région Allemagne. La suppression des IP et les filtres de données
du fournisseur ont été activés puis relus. Le CLI 2.58.6 ne décode pas la liste des organisations
(champ `requireEmailVerification` absent de la réponse) ; l’API officielle a servi au diagnostic
et à la configuration.

Une erreur synthétique a été envoyée avec la configuration SDK serveur du dépôt et l’environnement
`development`. L’événement `f2237beeb14d436390d24a8c9faf9c6b` a été relu via l’API : les valeurs
de test d’e-mail, de token, d’IP et de corps d’offre étaient absentes. Ce test valide la réception
et le filtrage serveur, pas encore la chaîne de déploiement ni une notification e-mail reçue.

Le déploiement Vercel du commit `3800d44` a ensuite créé la release Sentry correspondante.
L’erreur navigateur synthétique `52dc1c9cb47341e88a313ca95bd0814a`, déclenchée depuis le site
de production, a été reçue avec l’environnement `production` et cette release. La relecture
confirme le filtrage des valeurs de test. Le diagnostic source maps de Sentry confirme la présence
du bundle et, pour la frame compilée, du fichier source et de la map associés au bon debug ID.
La frame créée par le test navigateur n’a naturellement pas de source map de l’application.

Les secrets ont été configurés dans Vercel Production. Le token autorisé par le propriétaire
sert au build ; il n’est pas envoyé au navigateur. Le DSN public est distinct d’un secret
d’administration. La réception effective d’une notification e-mail et les alertes opérationnelles
complètes restent à vérifier séparément.

Le filtrage local supprime également les variables des frames, les données et descriptions de
spans SQL/HTTP ainsi que les URL invalides. Les régressions correspondantes sont couvertes par
les tests unitaires.

### Budget JavaScript après activation

Le contrôle distant `33991244094` a détecté une régression après activation du SDK complet :
341 595 octets de JavaScript sur l’accueil et 368 852 sur Explorer, avec un LCP médian
d’Explorer à 4,08 s. Les 76 scénarios Playwright passaient, mais pas les budgets Lighthouse.

L’initialisation navigateur utilise désormais le `BrowserClient` explicite documenté par Sentry,
avec uniquement les intégrations de capture et déduplication des erreurs. Elle n’inclut ni
breadcrumbs, ni replay, ni traçage navigateur. Les traces serveur conservent leur échantillonnage
de 5 %. Cette réduction ne vaut donc pas validation d’une mesure Sentry des Web Vitals navigateur.
Les identifiants techniques de trace valides sont conservés par le filtre, sans leurs données,
afin de ne pas rendre les transactions serveur invalides.

Les options de tree shaking du plugin Sentry sont limitées à Webpack dans la version installée.
Le dépôt conserve Turbopack ; son entrée asynchrone restreinte évite l’import de toutes les
fonctionnalités du SDK. Aucun budget n’a été relevé.

La réception et la redaction ont été vérifiées à nouveau avec ce client minimal : événement
`ad1a8fa82af94cecb7fd51d4faa54512` pour la release `e215245`, puis
`31072946adff48669b9b31168fce4b1c` pour `3f6e402`, tous deux en production. Le diagnostic
Sentry de l’événement `ad1a8fa82af94cecb7fd51d4faa54512` confirme également le fichier source
et la source map associés au debug ID de la frame compilée.

Le panneau de preuve est ensuite chargé à la demande. Son échec de chargement et le réessai
sont couverts sur les quatre navigateurs/profils Playwright, avec conservation du focus clavier.
Les classes de son bouton sont calculées côté serveur depuis les variantes existantes ; le
navigateur ne charge plus le moteur de fusion des classes pour cette interaction.

Le commit applicatif `d164f76` a été déployé en production puis validé par le workflow
`End-to-end` `33993045248` : 79 parcours Playwright ont réussi au premier essai, un après
réessai, et les neuf mesures Lighthouse ont passé les seuils inchangés. Le test mobile concerné
sondait la présence des filtres avant la fin du streaming ; il attend désormais explicitement
leur visibilité. Les workflows `Quality` `33992980271` et `Security` `33992980282` sont
également verts, y compris lint, format, typecheck, tests, contrats, build web et Storybook.
Après correction de cette attente, le scénario a passé vingt exécutions contre la production
(cinq par navigateur/profil), sans réessai.

À cette étape, le raccordement exigeait une session PostHog EU : le 5 septembre 2026, aucun identifiant
PostHog n’est configuré dans l’environnement local ni dans Vercel Production, aucun connecteur
dédié n’est disponible et le navigateur affiche le formulaire de connexion EU. La collecte
analytics reste désactivée ; le compte et ses paramètres réels ne sont pas supposés existants.

### PostHog reporté — 6 septembre 2026

La connexion Chrome a ensuite permis de terminer l’assistant du projet EU `267342`.
Autocapture, heatmaps et collecte automatique des performances ont été désactivées ; le replay
a été refusé. L’option de suppression des IP est cochée. Aucun événement n’était reçu et aucun
DPA n’était enregistré. Aucun accord n’a été signé par l’agent.

Le propriétaire a explicitement reporté PostHog : voir [ADR 0010](adr/0010-defer-product-analytics.md).
La liste réelle des variables Vercel Production ne contient ni `ANALYTICS_ENABLED` ni clé
PostHog ; le lecteur de configuration retourne `enabled: false` par défaut. Aucun raccordement
n’est déclaré validé. La suite du lancement concerne les contrôles restants indépendants de
l’analytics, notamment les sept collectes quotidiennes et les alertes opérationnelles.

## Diagnostic des collectes — 6 septembre 2026

La lecture réelle de PostgreSQL confirme deux collectes complètes planifiées en échec les
5 et 6 septembre, avec le code expurgé `unexpected_error`. Le dernier run complet réussi
s’est terminé le 4 septembre à 13:55:26 UTC. Les sept succès quotidiens ne sont donc pas acquis.
Le rapport CLI Trigger.dev signale une télémétrie ancienne et ne permet pas d’attribuer la cause.

L’API publique annonçait encore `fresh` et `operational` : les seuils par défaut du code étaient
72/168 heures, contrairement aux 30/72 heures de SPEC §9 et de `.env.example`. Les défauts
sont corrigés ; un run en échec dégrade désormais aussi le statut, même si le dataset reste frais.
Cette correction locale ne constitue pas une résolution de l’échec d’ingestion.

Le workflow `Scheduled production health` ne vérifie actuellement que les réponses HTTP ;
son succès ne prouve donc pas la réussite des collectes. Son contrôle sémantique reste à compléter.

### Cause SQL identifiée avec la CLI

Le MCP en lecture seule fourni par la CLI Trigger.dev a permis de lire le run de production
du 6 septembre sans navigateur ni nouveau secret : `NeonDbError: column current_run.offers_closed
does not exist`. La requête a été reproduite en lecture seule sur le run réel. La colonne physique
existe ; seule sa projection dans la CTE `current_run` manquait. Cette projection a été corrigée,
avec trois tests couvrant `null`, zéro et une valeur positive.

Après correction, la lecture réelle renvoie 1 234 offres uniques, une pagination complète et
1 197 classifications positives avec autant de preuves. Elle révèle un verrou qualité distinct :
huit partitions sont passées de une à deux offres et dépassent ainsi le seuil relatif de 60 %.
Le code conserve le blocage `volume_anomaly_detected`. Aucun seuil n’a été relevé et aucune
publication forcée n’a été effectuée. La résolution SQL ne vaut donc pas réussite de collecte.

Le worker corrigé a été construit et déployé avec succès sur Trigger.dev Production sous
la version `20260906.1`, en conservant les variables distantes (`--skip-sync-env-vars`).
Le formatage, lint, typecheck, 192 tests unitaires et le build Next.js passent localement.
Les 80 parcours E2E ont donné 76 succès et quatre échecs dus à l’ancienne assertion imposant
des données fraîches sur l’accueil. Après correction du test pour comparer le badge à l’API
réelle, les seize parcours accueil (quatre profils) passent, y compris a11y et reduced motion.
