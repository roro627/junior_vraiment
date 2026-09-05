# Checklist de publication d'un jeu de données

La publication est atomique : un jeu est soit entièrement visible, soit entièrement absent. Le dernier jeu valide reste servi tant que cette checklist n'est pas satisfaite.

## Collecte

- [ ] Le run possède un identifiant unique, des dates de début/fin et la version des requêtes.
- [ ] Toutes les requêtes attendues ont été exécutées ou l'absence est explicitement marquée.
- [ ] Les pages de résultats ont été parcourues sans trou détecté.
- [ ] Le nombre de réponses, doublons, nouvelles offres, mises à jour et disparitions est enregistré.
- [ ] Les limites et conditions d'utilisation de la source ont été respectées.
- [ ] Les erreurs transitoires ont suivi la politique de retry avec backoff et jitter.
- [ ] Aucune réponse brute contenant un secret ou une donnée inutile n'est conservée.

## Schéma et normalisation

- [ ] Le schéma externe passe la validation.
- [ ] Aucun changement de champ, type, enum ou structure inattendu n'est masqué.
- [ ] Les dates sont normalisées en UTC et rendues en Europe/Paris dans l'interface.
- [ ] Les codes géographiques et contrats inconnus restent traçables.
- [ ] La déduplication n'a pas fusionné des offres distinctes.
- [ ] Les offres retirées sont historisées sans rester présentées comme actives.
- [ ] Les descriptions et preuves respectent la politique de conservation.

## Classification

- [ ] La version du classificateur et de la taxonomie est enregistrée.
- [ ] Chaque offre reçoit exactement un `status` (`classified`, `ambiguous` ou `unclassified`) et des booléens dérivés cohérents.
- [ ] Chaque décision `contradictory_junior` possède une preuve junior et une preuve d'expérience obligatoire.
- [ ] Les conflits entre champ structuré et texte produisent `status=ambiguous`.
- [ ] Le taux d'offres sans preuve, ambiguës ou inconnues reste sous les seuils d'alerte.
- [ ] Le jeu de référence a reçu la passe LLM A selon le protocole versionné.
- [ ] La précision mesurée sur le jeu annoté de référence ne régresse pas au-delà du seuil accepté.
- [ ] Les écarts avec le jeu précédent sont expliqués lorsqu'ils dépassent les bandes attendues.

## Agrégats

- [ ] Les numérateurs et dénominateurs sont recomputables depuis les lignes sources.
- [ ] Les catégories sont mutuellement exclusives lorsque la métrique l'exige.
- [ ] Les filtres combinés retournent le même total entre API, base et interface.
- [ ] Les faibles échantillons reçoivent le statut `hidden` ou `caution` attendu.
- [ ] Les tendances utilisent la bonne version de méthodologie.
- [ ] Une rupture de méthode n'est pas présentée comme une évolution du marché.
- [ ] Les bornes, arrondis et valeurs manquantes ont été vérifiés.

## Qualité et fraîcheur

- [ ] La couverture des requêtes est au-dessus du seuil de publication.
- [ ] La fraîcheur est compatible avec la promesse publique.
- [ ] Le volume total et par famille se trouve dans les bandes de plausibilité.
- [ ] Les principaux taux sont comparés au jour précédent et à la médiane glissante.
- [ ] Aucun avertissement critique ne reste ouvert.
- [ ] Les avertissements non critiques sont visibles sur `/statut-donnees` et dans les réponses API concernées.

## Publication

- [ ] Les agrégats, métadonnées et preuves référencent le même `dataset_id`.
- [ ] La transaction de publication marque exactement un jeu comme actif.
- [ ] L'invalidation des tags de cache intervient après le commit.
- [ ] Les routes clés répondent avec le nouveau jeu en environnement de prévisualisation.
- [ ] La carte Open Graph d'un insight de contrôle a été régénérée.
- [ ] Le jeu précédent reste disponible pour rollback.
- [ ] Le journal de publication indique auteur/processus, heure, versions et contrôles.
- [ ] La page de statut expose l'heure réelle de dernière collecte réussie, sans la confondre avec l'heure de publication.

## Rollback

Déclencher un rollback immédiat si, après publication :

- un taux est impossible ou change brutalement sans explication;
- des offres d'un mauvais périmètre dominent un segment;
- les preuves ne correspondent plus aux décisions;
- un secret ou contenu interdit est exposé;
- les endpoints mélangent deux `dataset_id`;
- la source signale une violation de ses conditions.

Le rollback réactive le dernier jeu valide, invalide le cache, ouvre un incident et conserve le jeu défectueux hors exposition pour analyse.
