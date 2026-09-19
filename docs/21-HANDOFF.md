# Reprise — 19 septembre 2026

## Intervention du 19 septembre — reprise des totaux mouvants

La collecte planifiée `run_06gbeian682jpjtrk6cjgubg01` a échoué à 01:34:40 UTC :
37/566 requêtes réussies puis total source passant de 1 720 à 1 721 pendant
la requête « développeur Python ». Le dataset du 18 est resté public ; les alertes
Trigger/GitHub et le retard de fraîcheur étaient réels.

Correctif décrit dans ADR 0016 : diagnostic après refus de pagination, recollecte
automatique après cinq minutes uniquement pour les totaux réellement mouvants,
trois tentatives au maximum, audits et portes qualité conservés.
Worker `20260919.1` déployé avec succès. Recollecte du 19 tentative 2 déclenchée :
`run_06gbkopdrvt71rvso16m29h201`. **Publication et santé encore à vérifier.**

Validations à ce stade : 369 tests unitaires réussis, 25 live ignorés ; format,
lint, typecheck et build Next réussis. Tests fonctionnels PostgreSQL réussis sur
QA `br-proud-frog-b2y1eu6n` (expiration 20 septembre 08:00 UTC), dont la
conservation des pages mouvantes et la création d'une tentative indépendante.
Le test de performance distant des KPI dépassait 100 ms (169,8 ms p95
en environnement Node isolé). Correction complémentaire : métadonnées et cartes lues
en un seul échange HTTP, dans une transaction en lecture seule Repeatable Read.
Les seuils restent inchangés ; test de performance exécuté sous Node et délai de campagne
des 40 lectures agrégées distingué du budget individuel de 500 ms.
Nouvelle suite QA complète : 60 tests réussis, trois opt-in ignorés, y compris les
budgets KPI/Explorer/agrégats ; 113 E2E locaux réussis, trois répétitions responsive ignorées.
Cette optimisation web est validée localement ; déploiement à vérifier après le push.

La section suivante est historique et ne prouve pas la santé du 19 septembre.

## Intervention du 18 septembre — collecte rétablie

Les collectes du 12 au 18 ont été bloquées par des hausses de volume locales, sans
perte de pagination ni quarantaine. La fraîcheur restait au 11 ; les échecs GitHub
de santé sont la conséquence du même incident, pas une panne GitHub. Voir ADR 0015.

- Worker `20260918.1` réellement déployé ; qualité `ingestion-quality-1.3.0`.
- Recollecte du 18, tentative 2 : `run_06gb6h443hlp71ja5p1uastl01`, réussie à
  07:07:39 UTC après 20,8 minutes. 566/566 requêtes, 696 pages, 30 176 résultats
  tous valides, zéro quarantaine ; 2 386 offres distinctes observées.
- Dataset `4238b7e6-ba2a-4313-96c1-5ba3f4f733bd` publié à 07:07:37.305 UTC,
  cutoff réel 07:07:32.961 UTC ; 3 008 membres (inclut les offres conservées selon
  les règles d'absence). Aucun ancien run réécrit, aucune clôture lors de cette reprise.
- Santé Trigger `run_06gb6lstc3eao4c5ps08d3qm01` réussie ; contrôle public réussi ;
  GitHub Scheduled production health `35318017486` réussi après publication.
- Les protections globales ±40 %, pertes locales, pagination, validation et preuves restent
  actives. Classificateur `1.3.7` et méthodologie KPI inchangés. Alertes non désactivées.
- Validation locale : format, lint, typecheck, 343 tests unitaires (25 live ignorés),
  rapports figés et build Next réussis ; suite DB sur QA : 52 réussis, 3 ignorés,
  incluant les deux tests d'ingestion. 113 E2E publics réussis avant puis après la nouvelle
  publication (3 répétitions responsive ignorées dans chaque campagne).
- Commit correctif `fa118cb`. CI Quality `35316580947`, Security `35316580921`,
  E2E et budgets Lighthouse `35316826409` réussis. Déploiement Vercel
  `dpl_37owVwFW3nijSiCGXdC1ZKGMfr7w` prêt et réellement aliasé au domaine public.
- QA dédiée `br-rough-queen-b2q3jba3`, expiration 19 septembre 06:00 UTC ; aucune fixture
  de cette intervention injectée dans la production.
- Vercel Ready, aucun log 5xx retourné sur 24 h ; audit des dépendances production sans
  vulnérabilité connue. Rétention Trigger du 13 terminée avec succès.
- Sentry vérifié ensuite le 18 via la session Chrome du propriétaire : projet
  `junior-vraiment`, tous environnements, aucun incident trouvé sur les sept derniers jours
  sans filtre de résolution. Les six tickets historiques `JUNIOR-VRAIMENT-1` à `-6`
  remontaient aux 5–6 septembre : tests de raccordement et erreurs locales de développement
  (`NoPublishedDatasetError` et rendu React, environnement development). Résolus dans
  l'interface après examen et contrôle de santé public réussi ; événements conservés,
  alertes et filtres inchangés. Aucun nouveau correctif applicatif nécessaire pour ce triage.
- L'accès Chrome est une session réelle mais non garanti dans un autre chat. Utiliser le
  skill Chrome, revérifier la connexion ; ne jamais extraire cookies ou jetons du profil.
  Le DSN ne fournit toujours pas d'accès API de lecture. Aucun blocage Sentry restant établi.

La section ci-dessous décrit les contrôles historiques du **10 septembre**, pas l'état actuel.

## Historique de reprise — 10 septembre 2026

Lire d'abord README, SPEC, AGENTS puis [le guide des services](20-SERVICES-RUNBOOK.md).
Ce fichier décrit des vérifications réelles, pas des accès garantis dans un nouveau checkout.

## Production vérifiée

- Site : https://junior-vraiment.vercel.app ; identité orange étendue à tout le site.
- Commit applicatif publié : `e9ac649`. Déploiement GitHub automatique réellement prêt et aliasé :
  `dpl_5kmivPeC4GYmvsW45DzqYvhGgC4R` (`junior-vraiment-mxf3cp2th-roro627s-projects.vercel.app`).
  Le contrôle public de santé réussit sur ce déploiement. D'éventuels commits documentaires suivants
  ne changent pas ce code applicatif ; utiliser la CLI pour lire le dernier déploiement courant.
- Worker Trigger : `20260910.2`, moteur déterministe `classifier-1.3.7`.
- Méthode publiée : `junior-contradiction-2.0.0` (ADR 0014).
- Republication réussie : `run_06g8mog128tp6vv5tkq40inl01`, enfant de santé terminé.
- Dataset courant : `e5158590-ed31-44d1-a827-4b6ab39ce76e`, 1 820 membres.
- Run source : `c9093be0-2437-47e9-8e4c-2b4867026b11`, collecte complète du 10 septembre.
  566/566 requêtes logiques réussies ; 657 appels, 22 704 résultats reçus et valides.
- Fraîcheur source inchangée : `2026-09-10T01:46:13.541Z`. Republication à
  `2026-09-10T12:54:19.295Z`, sans nouvelle collecte ni faux rafraîchissement.
- Dix migrations réellement appliquées à Neon production et QA. Les deux dernières sont
  additives : `20260909145652_medical_masque` et `20260910114930_open_skullbuster`.

### Chiffres vérifiés par API après publication

Sur les 30 jours par défaut : 1 184 offres, 59 contradictions observables / 407 offres junior
au seuil résolu = **14,5 %** ; 50 cas ambigus exclus parmi 457 offres junior.
Sur le jeu courant entier : 128 / 667 = **19,2 %**. Ne jamais mélanger ces périmètres.
Ce sont les offres observées via France Travail, pas une estimation représentative de tout le marché.

## Validation et limites

- Référence initiale 200 + 46 régressions validée ; nouveau holdout indépendant 7 : 200 textes,
  moteur figé avant annotation, 15 vrais positifs, aucun faux positif/faux négatif sur l'axe positif.
  Dénominateur : 81 TP, 3 FP, 3 FN, précision/rappel 96,4 %.
- Accord exact de tous les champs : 110/200. Les annotations IA ne sont pas une vérité humaine ;
  aucune promesse d'exactitude universelle ou de performance à 100 %.
- Campagnes précédentes et échecs conservés dans docs/reference ; annotations originales et
  corrections privées dans .local. Ne pas retoucher un rapport pour faire passer le contrôle.
- Aucun LLM dans le classificateur ou l'ingestion de production. Autorisation limitée à
  l'annotation hors ligne A Terra medium et à la relecture ciblée aveugle.
- Contrôles réels : 341 tests unitaires réussis, 25 live opt-in ignorés ; deux tests d'ingestion
  PostgreSQL sur QA réussis ; builds Next et Storybook réussis ; neuf audits Lighthouse passent
  leurs budgets inchangés ; 113 E2E locaux et 113 E2E publics après v2 réussis (3 ignorés).
  Au premier test après bascule, une réponse CDN v1 persistait temporairement alors que le rendu
  utilisait v2. Après renouvellement normal du cache, les 113 tests passent sans modification.
- CI du commit applicatif : Quality `34479941509`, Security `34479941613` et Database migration
  check `34479941316` réussis. Cela inclut les rapports figés, CodeQL, build et Storybook sur Linux.
- Audit dépendances production : aucune vulnérabilité connue lors du contrôle.

## Incident de release résolu

La première publication v2 produisait un identifiant de 101 caractères pour un contrat API limité
à 100. Retrait du dataset `f205dfd6-88ea-413e-8a4e-237ce07d81d7` puis rollback réel
`run_06g8mmquumittlcik7kj1d5301` sur v1, sans perte ni réécriture historique.
Indisponibilité mesurée : 12:45:36.397–12:46:56.835 UTC, événement public résolu
`13281582-8932-460e-a3ef-64334532bd19`.
Correction : suffixe court `kpi-2.0.0`, validation avant brouillon et garde SQL avant bascule,
tests de régression. La republication corrigée et le contrôle de santé réussissent.
Le dataset v1 précédent `03b59444-3710-40d8-ab56-b3755d1891be` reste conservé.

L'incident des 8–9 septembre provenait d'une variation du total France Travail entre pages.
Reprise bornée désormais typée, anciens checkpoints conservés ; la collecte planifiée du
10 septembre a réussi. Ne pas compter les reprises comme des journées de stabilité supplémentaires.

## Accès et reprise sans ce chat

GitHub, Neon, Vercel et Trigger ont répondu réellement pendant cette session.
Les commandes, identifiants non secrets, fichiers de configuration et diagnostics figurent dans
docs/20. Les vrais secrets restent dans les environnements sécurisés ; le guide ne confère pas
automatiquement l'accès. Sur une autre machine, revérifier authentification et variables sans valeurs.

- Remote Git : `junior_vraiment`, branche main. Ne pas supposer origin.
- Preview Vercel sans DATABASE_URL : candidat production non aliasé, vérification CLI, promotion.
- QA Neon `br-dark-credit-b2aw6pdy` expire le 10 septembre à 18:00 UTC.
- .local contient les annotations privées nécessaires à une reproduction complète ; transfert
  sécurisé ou nouvelle campagne explicitement autorisée, jamais commit ni valeurs inventées.
- Node local et Vercel 24.19.0 vs engines 24.20.x : avertissement connu, builds réussis.
- E2E Windows : deux workers pour éviter les timeouts sous charge.
- Anciennes maquettes supprimées volontairement par le propriétaire : ne pas restaurer.

## Suite opérationnelle

La release applicative est publiée, les contrôles ci-dessus réussissent et les accès sont présents.
Continuer la surveillance planifiée existante des collectes et alertes ; aucune nouvelle action
humaine nécessaire établie. Ne pas présenter l'historique encore court comme une longue stabilité
démontrée, ni confondre une nouvelle méthode avec une hausse réelle du marché.

Les suppressions de deux anciennes PNG décidées par le propriétaire sont versionnées ; elles
restent récupérables dans Git. Aucun secret ni annotation privée n'a été ajouté au commit.
