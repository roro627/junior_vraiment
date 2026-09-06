# ADR 0011 — Hausses de faible amplitude des partitions

- Statut : accepté le 6 septembre 2026, dans le cadre de l’autonomie décisionnelle confiée par le propriétaire.
- Version : `ingestion-quality-1.1.0`.

## Constat réel

La collecte du 6 septembre contient huit partitions passant de une à deux offres. La règle
purement relative bloquait toute publication pour ces variations de 100 %, malgré une pagination
complète, une validation de 100 % et des preuves pour toutes les classifications positives.

## Décision

Conserver les seuils relatifs globaux et par partition. Pour une hausse par partition strictement
inférieure à cinq offres, conserver un avertissement avec identifiant de requête et compteurs
précédent/courant dans le résumé qualité, sans blocage automatique à lui seul. Toute baisse
dépassant le seuil relatif reste bloquante, même sur un petit volume. Les autres portes qualité
restent inchangées ; aucun identifiant de run ne bénéficie d’une exception codée en dur.

Cinq est un plancher opérationnel conservateur, non une significativité statistique. Il permet
de distinguer les petites additions discrètes d’une variation exigeant une investigation, sans
tolérer silencieusement une perte de couverture. Il devra être réévalué sur l’historique réel.

## Vérification

Tests déterministes des bornes, pertes, hausses, compteurs invalides et anomalies simultanées.
Lecture de la requête réelle sur le run du 6 septembre avant reprise ; validation complète et
publication réelle nécessaires avant de déclarer la collecte réussie.
