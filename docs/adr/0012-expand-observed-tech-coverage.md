# ADR 0012 — Élargir la couverture tech observée

- Statut : accepté ; activation conditionnée au rapport de pertinence
- Date : 2026-09-06

## Contexte

Le propriétaire demande davantage de données. Sept collectes quotidiennes mesurent la fiabilité
et les changements du stock, mais ne corrigent pas un périmètre trop étroit. Le registre 2.0
écarte des intitulés réellement observés comme « Développeur Java H/F », « Développeur C# .NET H/F »
et « Ingénieur logiciel embarqué Linux (H/F) ». Il ne collecte pas explicitement Data scientist.

L'audit des codes déjà utilisés a récupéré 2 195 offres distinctes ; 1 327 ne passent pas leurs
filtres de titre actuels. Ce nombre inclut des postes hors sujet et ne constitue pas un gain acquis.
Les libellés et codes supplémentaires proviennent du référentiel officiel authentifié, pas d'une
liste supposée. Le diagnostic et les textes expurgés restent dans `.local/`.

## Décision

Préparer `queries-3.0.0` : élargir les expressions explicites des familles existantes, ajouter le
code observé Data scientist et activer `software` et `ai-ml`, déjà définis dans la taxonomie initiale.
Un langage seul n'impose pas une famille frontend ou backend ; le développement général entre
dans `software`. Les postes seniors ne sont pas exclus de la collecte.

Le protocole de pertinence 2.0 ajoute uniquement les définitions des deux familles. Les seuils
de la politique `query-relevance-gate-1.0.0` restent inchangés. Une nouvelle collecte complète et
300 paires aveugles (30 par groupe), annotées en une passe A Terra medium, précèdent l'activation.
Aucune prédiction junior ni annotation antérieure n'est fournie aux annotateurs.

Une requête source partagée conserve les seules familles dont le filtre d'intitulé est satisfait
pour l'offre, via `offer_query_matches.matched_job_families`. Les anciens liens sans cette
information restent lisibles sans réécriture. La migration additive précède le nouveau worker.

Les familles sont également figées dans `published_dataset_offers.job_families`. Les lectures
publiques n'utilisent pas les correspondances évolutives pour filtrer un ancien dataset. Le
rattrapage initial conserve les associations jusque-là lues ; les futurs gels capturent les leurs
une seule fois, sans modification lors des rejeux.

## Conséquences

- Les chiffres avant/après ne constituent pas une évolution du marché à périmètre constant.
  L'API annote la rupture et le graphique ne relie pas ces points.
- Le classificateur, les seuils des KPI et les anciennes classifications restent inchangés.
- La précision de pertinence estimée ne démontre ni exhaustivité ni rappel national.
- Les sources restent France Travail et ses partenaires accessibles par l'API ; aucun scraping
  ou nouveau fournisseur n'est introduit.
- Les volumes sont dédupliqués par identité source ; les occurrences entre requêtes ne s'additionnent
  pas pour annoncer un nombre d'offres.

## Vérification

Rapport public agrégé `docs/reference/query-set-v3-validation-report.json`, empreinte du candidat,
preuves présentes dans les textes, tests d'admission/exclusion, migration, collecte réelle,
contrôles des familles persistées, modèles de lecture, E2E et builds. Un candidat refusé reste
désactivé ; ses annotations ne sont pas modifiées pour atteindre les seuils.
