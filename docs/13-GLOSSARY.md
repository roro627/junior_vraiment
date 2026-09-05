# 13 — Glossaire

## Agrégat

Résultat pré-calculé à partir d'un ensemble d'offres pour accélérer et stabiliser l'affichage.

## Ambiguë

Classification pour laquelle des preuves se contredisent ou ne permettent pas une conclusion assez fiable.

## Classable

Offre dont les informations permettent de déterminer la condition nécessaire au calcul d'une métrique donnée.

## Classificateur

Ensemble versionné de règles déterministes transformant une offre normalisée en catégories et preuves.

## Contradictory junior / junior contradictoire

Offre se présentant explicitement comme junior tout en demandant au moins 24 mois d'expérience obligatoire dans la version initiale de la métrique.

## Couverture

Part de la population d'une métrique pour laquelle la condition mesurée est résolue : `denominator / populationCount`. Elle est toujours publiée avec les taux qui excluent des cas inconnus ou ambigus.

## Dataset

Version cohérente des offres, classifications et agrégats préparée pour une publication.

## Dénominateur

Nombre d'observations sur lequel un taux est calculé.

## Dimension

Critère de découpage d'une métrique : métier, technologie, territoire, contrat ou modalité.

## Evidence / preuve

Extrait textuel ou donnée structurée ayant déclenché une règle.

## Fraîcheur

Durée depuis la dernière collecte complète ayant produit le dataset public.

## Gold set / jeu de vérité

Ensemble d'offres annotées hors ligne par la passe LLM A versionnée, aveugle aux prédictions,
utilisé pour mesurer la précision et le rappel du classificateur déterministe.

## Insight

Résultat éditorialisé, figé et partageable avec son périmètre, ses versions et son image sociale.

## Junior non résolu

Offre possédant une preuve explicite de positionnement junior, mais dont les données ne permettent pas encore de déterminer l'accessibilité débutant ou le franchissement du seuil de contradiction.

## KPI

Indicateur clé. Le KPI principal est la part d'offres junior contradictoires.

## Métrique

Définition versionnée d'un calcul comprenant population, exclusions, numérateur et dénominateur.

## Normalisation

Transformation d'une réponse source en un modèle interne stable et comparable.

## Numérateur

Nombre d'observations correspondant à la condition mesurée.

## Offre active

Offre considérée disponible dans la dernière collecte complète, selon la politique de fermeture.

## Payload brut

Réponse originale de la source, conservée temporairement côté serveur pour audit et adaptation.

## Périmètre

Ensemble défini par les requêtes, dates et filtres utilisés.

## Population métrique

Ensemble des observations pertinentes avant exclusion des cas inconnus et ambigus propres à une métrique. Dans le contrat public : `populationCount = denominator + unknownCount + ambiguousCount`.

## Precision / précision

Parmi les offres classées positives, part réellement positive selon le jeu de vérité.

## Query set / registre de requêtes

Liste versionnée des requêtes source composant le dataset.

## Recall / rappel

Parmi les offres réellement positives du jeu de vérité, part détectée par le classificateur.

## Résolvabilité

Propriété indiquant que les preuves disponibles suffisent pour répondre à la question exacte d'une métrique. Une offre peut être résolue pour le salaire et non résolue pour l'expérience.

## Run d'ingestion

Exécution planifiée de collecte, validation, normalisation, classification et publication.

## Salaire transparent

Annonce fournissant une rémunération chiffrée exploitable selon la définition publiée.

## Server Component

Composant React exécuté côté serveur dans l'App Router et n'ajoutant pas nécessairement de JavaScript client.

## Snapshot

Version immuable du contenu pertinent d'une offre à un instant.

## Source

Producteur ou API fournissant les offres.

## Taxonomie

Liste versionnée de catégories, règles et alias pour métiers, technologies, contrats ou géographie.

## Technologie citée

Technologie reconnue dans le texte ou les données d'une offre, sans affirmer qu'elle est obligatoire.

## Version de méthode

Identifiant permettant de savoir quelles règles et définitions ont produit un résultat.

## WCAG

Recommandations internationales d'accessibilité du contenu web.
