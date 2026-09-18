# ADR 0015 — Hausses locales signalées sans gel de publication

- Statut : accepté le 18 septembre 2026 dans le cadre de la correction opérationnelle demandée.
- Version : `ingestion-quality-1.3.0`.
- Remplace le blocage des hausses par partition des ADR 0011/0013, conservés comme historique.

## Diagnostic réel

Depuis le 12 septembre, les collectes complètes échouent uniquement sur le contrôle de volume.
Le 18 : 566 requêtes terminées, 30 274 résultats tous valides, aucune quarantaine, preuves
présentes. Le nombre distinct observé passe de 1 841 le 11 à 2 394 le 18 (+30,0 %), sous
le seuil global de 40 %. Toutes les variations locales bloquantes sont des hausses : par
exemple software engineer 24 → 44 le 12 puis 51 le 18, platform engineer 10 → 24 puis 21.
Des appels officiels du 18 confirment respectivement 50 et 21 offres après le même filtre
d'intitulé, sur des réponses entièrement paginées, sans quarantaine. La source reste mouvante.

Le dernier succès restant figé au 11, la comparaison devient cumulée sur plusieurs jours,
et les alertes Trigger puis GitHub se répètent pour le même blocage. Ce n'est pas une panne
de connexion ni une preuve de perte de couverture.

## Décision bornée

Les hausses locales dépassant 60 % sont enregistrées dans `quality_summary.volumeWarnings`,
quelle que soit leur amplitude, sans bloquer à elles seules. Les variations globales ±40 %,
les baisses locales >60 % portant sur au moins cinq offres, la pagination, le plafond source,
la validation et les preuves gardent leurs protections actuelles. Les petites baisses restent
signalées selon l'ADR 0013. Aucun seuil n'est augmenté et aucune requête n'est exemptée.

Une hausse peut aussi refléter une dérive source : elle reste à inspecter, pas une garantie de
pertinence. Cette décision distingue une alerte de distribution d'une perte de données et
évite de geler durablement le site pour une augmentation locale de résultats chevauchants.
Elle ne modifie ni le périmètre, ni les classifications, ni les KPI, ni la règle des deux absences.

## Reprise et validation

Préserver les runs et leurs décisions initiales. Recollecter avec une nouvelle tentative bornée
du 18, et non réécrire les jours échoués ou avancer artificiellement la fraîcheur. Vérifier les
gardes par tests, le run réel, le contrôle de santé enfant, l'API publique puis GitHub.
Un résultat prévu n'est pas une publication réussie ; l'état final est consigné dans docs/21.
