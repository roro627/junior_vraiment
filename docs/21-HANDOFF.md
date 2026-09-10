# Reprise — 10 septembre 2026

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
