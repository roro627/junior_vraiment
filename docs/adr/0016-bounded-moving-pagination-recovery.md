# ADR 0016 — Reprise bornée des totaux source mouvants

- Statut : accepté, correction opérationnelle du 19 septembre 2026
- Périmètre : orchestration uniquement, aucune modification de méthode ou de seuil qualité

## Constat

La collecte automatique du 19 septembre, tentative 1, a échoué : le total de la requête
« développeur Python » est passé de 1 720 à 1 721 entre ses pages. Le contrôle de
complétude a refusé correctement ces pages, mais le worker arrêtait définitivement
la journée. Réessayer le même checkpoint terminal ne pouvait pas corriger l'écart.

## Décision

Après refus de la porte SQL existante, un diagnostic lit les totaux réellement conservés.
Uniquement si leur minimum et maximum diffèrent, le worker programme une nouvelle collecte
complète après cinq minutes : tentative 2, puis 3 au maximum. Chaque tentative utilise un
run distinct, conserve le timestamp planifié initial et exige la précédente en échec ou annulée.
Les autres erreurs de pagination, qualité, schéma ou autorisation ne déclenchent pas cette reprise.

La clé Trigger est globale, stable par timestamp et numéro de tentative, conservée sept jours.
La contrainte unique PostgreSQL protège également l'identité métier. La tâche parente n'attend
pas sa fille dans la file de publication à concurrence 1. Elle reste en échec et conserve
ses alertes ; la reprise n'est jamais présentée comme une collecte réussie avant publication.

Les pages, checkpoints et observations antérieurs ne sont ni effacés ni fusionnés pour
fabriquer une pagination complète. Chaque nouvelle collecte doit repasser toutes les portes,
y compris volumes, validation, preuves et absences. Un total stable reste un contrôle de
cohérence de pagination, pas la garantie d'un snapshot atomique fourni par France Travail.

## Limites et exploitation

Au maximum trois collectes complètes par date/version, coût et durée supplémentaires possibles.
Si la troisième échoue, l'ancien dataset reste public avec statut dégradé : diagnostic humain
ou agent nécessaire, pas de boucle infinie, pas de tentative 4 automatique.
Avant une reprise manuelle, vérifier les runs différés/en file/en cours pour ne pas lancer
un second opérateur sur la même journée. Voir docs/20 et docs/21 pour l'état réellement vérifié.

Référence fournisseur : [idempotence et portée globale Trigger](https://trigger.dev/docs/idempotency).
