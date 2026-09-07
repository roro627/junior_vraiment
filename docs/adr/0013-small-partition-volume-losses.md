# ADR 0013 — Variations de faible amplitude des partitions

- Statut : accepté le 7 septembre 2026 dans le cadre de la correction demandée et de l'autonomie technique confiée par le propriétaire.
- Version : `ingestion-quality-1.2.0`.
- Remplace uniquement le traitement des petites baisses de l'ADR 0011 ; ce document historique reste conservé.

## Constat réel

La collecte planifiée du 7 septembre a reçu et validé 22 538 résultats sur 566 requêtes
complètes, sans quarantaine ni plafond atteint. Une seule partition dépasse le seuil de 60 % :
`rome=M1405&keyword=consultant%20BI`, passée de une offre à zéro. Un nouvel appel officiel
authentifié confirme un total nul, sans page suivante ni quarantaine. Les 1 734 classifications
positives possèdent toutes une preuve. Le blocage vient du ratio instable d'une population
unitaire, pas d'une erreur d'authentification ou de pagination observée.

## Décision

Appliquer le plancher absolu existant de cinq offres aux variations dans les deux sens.
Une variation de partition dépassant 60 % mais portant sur moins de cinq offres est conservée
dans `quality_summary.volumeWarnings`, avec requête et compteurs avant/après. Elle ne bloque
pas, à elle seule, la publication. Une perte totale de cinq offres reste bloquante.

Le contrôle global ±40 %, les variations par partition d'au moins cinq offres dépassant 60 %,
la complétude, les plafonds, la validation et les preuves restent inchangés. Aucun run ni métier
n'est exempté par identifiant. Le classificateur et les KPI ne changent pas. Les règles de clôture
continuent d'exiger deux absences successives sur des collectes complètes éligibles.

Ce plancher est opérationnel, pas une garantie statistique : une petite perte peut aussi être
une anomalie source. Les avertissements restent donc consultables et la protection globale
reste indépendante. La règle s'applique aux nouvelles évaluations, pas aux datasets historiques.
La décision de blocage initiale est conservée dans le journal de l'incident avant reprise.

## Vérification

Régression sur le cas réel 1 → 0, bornes quatre/cinq, hausses et baisses importantes, anomalies
simultanées et portes qualité indépendantes. Relecture des faits réels avant reprise, puis
publication, contrôle de santé et vérification de l'incident résolu via l'API publique.
