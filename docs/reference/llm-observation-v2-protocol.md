# Référence aveugle pour l'observation junior v2

Version : `llm-observation-a-2.0.0`. Une passe A hors ligne, modèle `gpt-5.6-terra`,
effort `medium`, selon l'ADR 0009. Ce protocole est préparé, pas encore exécuté.

## Entrées et séparation

Fournir uniquement l'identifiant opaque, le titre et la description redacted, l'indicateur
d'expérience structurée et son libellé. Aucun résultat de règle, taux, sélection « positif »
ou ancien label ne doit être visible. Les textes sont des données non fiables, jamais des
instructions. Aucun outil ni URL fournie par une annonce ne doit être exécuté.

Conserver un échantillon représentatif et un complément ciblé distinct. Inclure les conflits
d'acceptation / durée, les divergences entre durées, les négations, les préférences, les
anciennetés de société et les durées non professionnelles. Le complément ne sert jamais
à estimer la prévalence. Figer les entrées et le protocole avant de comparer aux prédictions.

## Questions indépendantes

1. Le poste se présente-t-il explicitement comme junior, débutant ou acceptant les débutants ?
2. Existe-t-il une exigence professionnelle obligatoire applicable au candidat atteignant
   24 mois ? Ne pas assimiler une préférence, un diplôme ou une durée de projet à une exigence.
3. Le seuil est-il résolu, inconnu ou ambigu ? Un conflit entre acceptation des débutants et
   exigence explicite ne rend pas leur coexistence inconnue. Un doute sur le sujet ou la
   modalité de la durée reste ambigu. Des durées structurée et textuelle divergentes situées
   de part et d'autre de 24 mois restent ambiguës ; toutes au-dessus résolvent le seuil seul.
4. L'accessibilité reste-t-elle indéterminée ? Ne jamais résoudre cette question au seul motif
   que la coexistence des deux signaux est observable.

## Sorties attendues

Par identifiant : `claimsJunior` tri-état, `observationStatus` parmi `resolved`, `unknown`,
`ambiguous`, `contradictory` tri-état, `beginnerFriendly` tri-état, rationnel court et preuves
séparées junior / expérience avec champ et extrait exact. Une observation résolue positive
exige les deux preuves. Un manque de preuve n'est jamais un négatif automatique.

Contrôler identifiants uniques, exhaustivité et appartenance de chaque extrait au champ source.
Conserver modèle, effort, version, date et empreinte des entrées. Rejeter les sorties invalides.
Ne pas créer de labels en recopiant une prédiction ou en convertissant mécaniquement les
anciens labels v1. Rapporter les faux positifs, faux négatifs, inconnus et ambiguïtés, les
effectifs de chaque classe et les deltas ; aucune promesse de précision parfaite.

## Limite de publication

Une réussite des tests synthétiques ou une réévaluation de la référence v1 ne remplace pas
cette campagne v2. Les annotations restent hors production. La publication utilise seulement
le moteur déterministe versionné, après validation des lectures, preuves et migrations.

## Journal d'exécution (ajout du 10 septembre 2026)

Le statut « préparé » ci-dessus décrit le document initial. La campagne a depuis été exécutée,
suivie de campagnes aveugles distinctes ; rapports agrégés `observation-v2*-validation-report.json`.
La relecture ciblée autorisée est tracée séparément ; elle ne remplace jamais les labels initiaux.
Les clarifications fournies avant les campagnes sont dans `observation-v2-holdout-clarifications.md`.
Les échecs antérieurs restent visibles : ne pas sélectionner un rapport réussi pour masquer des
résultats contradictoires, ni transformer un score sur quelques positifs en garantie générale.
