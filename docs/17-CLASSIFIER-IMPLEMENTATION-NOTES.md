# 17 — Notes d’implémentation du classificateur

Ce document décrit l’état exécutable du classificateur. Les définitions normatives restent dans
`SPEC.md` et `docs/02-DATA-METHODOLOGY.md`.

## Version en cours

`classifier-1.2.0` est la version courante validée hors ligne. Elle couvre la normalisation NFKC
avec correspondance vers le texte source, les preuves junior explicites, les négations, les durées
en mois ou années, les plages, les nombres écrits de un à dix, les préférences et plusieurs faux
positifs non professionnels.

Les contradictions entre débutant accepté et durée obligatoire, entre donnée structurée et texte,
ou entre niveaux explicites produisent `ambiguous`. Chaque valeur junior ou durée résolue conserve
une preuve et ses offsets.

La version 1.1 borne la modalité souhaitée à la proposition utile, reconnaît `plus de N ans` et
les plages en `XP`, exclut le motif institutionnel « forts de N ans d'expérience », distingue une
revendication junior d'une acceptation explicite des débutants et marque comme ambiguës les durées
obligatoires incompatibles entre le libellé structuré et le texte.

La version 1.2 ajoute trois enrichissements déterministes sans modifier la définition du KPI
principal : transparence d'un salaire structuré exploitable, modalité de télétravail explicitement
prouvée et technologies citées selon `initial-taxonomy.json`. Chaque valeur positive conserve un
extrait et ses offsets. La règle du motif le plus long empêche notamment de compter `react` dans
`react native`; les alias ambigus courts exigent le contexte prévu par la taxonomie. Un simple lieu
de travail ne produit jamais `onsite`.

La taxonomie initiale ne contient pas encore de catégorie stable par technologie alors que le
schéma interne l'exige. Le registre persiste donc la catégorie technique explicite
`uncategorized`, sans l'exposer comme une catégorie produit, jusqu'à une évolution versionnée de la
taxonomie.

## Validation

Le fichier `gold-v1.draft.json` contient les cas synthétiques de développement et
`no-experience.json` protège explicitement les formulations sans expérience. Un jeu réel local
représentatif de 200 offres et un complément ciblé de 46 offres ont reçu la passe LLM A définie par
`docs/reference/llm-annotation-protocol.md`. Le complément ne mesure pas la prévalence du marché.

Le rapport agrégé `docs/reference/classifier-validation-report.json` valide la version 1.2 avec :

- précision et rappel `contradictory_junior=true` : `1,00` sur trois cas positifs ciblés ;
- précision des durées obligatoires résolues : `0,975` sur 40 prédictions ;
- couverture des preuves positives et intégrité sémantique : `1,00` ;
- protection « sans expérience » : cinq cas sur cinq, sans faux positif.

La commande locale `pnpm classifier:validate:local` régénère les corpus fusionnés et le rapport à
partir des données ignorées par Git. `pnpm classifier:report:check`, exécutée en CI, vérifie que le
rapport publié est conforme à la version courante et aux empreintes des sources de code locales.
Une métrique non évaluable ne peut toujours pas être déclarée conforme.

Toute évolution d’une règle doit ajouter le cas à ce jeu, exécuter l’ensemble des fixtures et
documenter les changements de résultats avant d’incrémenter la version.
