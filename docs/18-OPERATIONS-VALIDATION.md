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

## Points non soldés

- la rotation des identifiants Neon est différée à la demande du propriétaire ; elle ne doit pas
  être considérée comme effectuée ;
- les preuves de sept ingestions quotidiennes consécutives nécessitent sept exécutions planifiées ;
- Sentry et PostHog restent désactivés tant que leurs vraies variables sécurisées ne sont pas
  configurées et vérifiées ; leur absence a été contrôlée dans l’environnement local, Vercel et
  Trigger.dev le 5 septembre 2026 ;
- les mentions légales et les paramètres réels de conservation restent à valider par le
  propriétaire.
