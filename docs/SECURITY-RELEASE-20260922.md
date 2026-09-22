# Livraison de sécurité — 22 septembre 2026

## Périmètre séparé du candidat classificateur

Le scan du 19 septembre a cinq constats. Cette livraison traite uniquement les quatre
frontières indépendantes du moteur métier. Le classificateur et ses rapports de release
restent strictement ceux du commit de base `d7e8146`. Aucune migration, collecte forcée,
reclassification, réécriture historique ni modification de seuil n'est nécessaire.

| Frontière | Invariant et contrôle de compatibilité |
| --- | --- |
| Revalidation HTTP | Au plus 16 Kio réellement lus avant authentification, flux annulé au dépassement. HMAC, fraîcheur, allowlist, corps valide et UTF-8/BOM fragmenté restent compatibles. |
| Offre source vers PostgreSQL | Aucun NUL ni substitut isolé dans les clés ou valeurs JSONB retenues, même inconnues/imbriquées. Quarantaine par offre, indices, compteurs et Unicode valide conservés. |
| Décodage des entités numériques | Aucun codepoint invalide transmis à String.fromCodePoint ni NUL généré. Entités invalides conservées littérales, entités Unicode valides décodées. |
| Lecture historique d'une offre fermée | Entreprise, localisation détaillée et les deux URL masquées dès fermeture confirmée, y compris après rollback. Appartenance, preuves, attribution et offres seulement absentes une fois conservées. |

Fichiers : route de revalidation et `src/lib/security/read-bounded-body.ts`,
`src/lib/france-travail/{schemas,storage-text,normalize}.ts`,
`src/db/queries/public-offers.ts`, leurs tests et
`src/db/security-fixes.live.test.ts`.

L'anonymisation du stockage historique est une obligation distincte ; le masquage des
lectures publiques ne la certifie pas.

## Cinquième constat : non livré

Le correctif de consommation de ressources des durées répétées reste dans le checkout
principal. Sa comparaison complète avant/après ne trouve aucun delta sur 583 cas.
Cependant, sa nouvelle campagne aveugle de 200 offres échoue aux seuils de qualification :
16 TP, 2 FP, 3 FN, 179 TN ; précision 88,89 %, rappel 84,21 %.
Le dénominateur donne 69 TP, 9 FP, 1 FN, 121 TN.

Une relecture IA ciblée, autorisée et sans prédictions, confirme des désaccords métier :
16 TP, 2 FP, 1 FN, 181 TN ; précision 88,89 %, rappel 94,12 %.
Le dénominateur relu donne 70 TP, 8 FP, 0 FN, 122 TN.
Ces références IA ne sont pas une vérité humaine. Le résultat initial et la relecture
sont conservés séparément ; aucune porte n'est abaissée et aucune nouvelle méthode
n'est activée par cette livraison de sécurité.

Les erreurs confirmées incluent une durée d'évolution de carrière future interprétée
comme une exigence à l'embauche et certaines formulations de rôle senior non reconnues.
Elles ne sont pas démontrées comme des régressions de l'optimisation. Leur correction
métier exige fixtures, nouvelle version, deltas et nouvelle qualification indépendante.
Le KPI publié ne doit pas être présenté comme une vérité nationale ni comme entièrement
certifié par les contrôles techniques.

## Vérification et livraison

État avant publication : quatre correctifs validés dans le candidat isolé ; pas encore
déployés. Les identifiants réels de livraison seront ajoutés après vérification.

| Contrôle exécuté sur le lot isolé | Résultat |
| --- | --- |
| format, lint, typecheck | Réussis |
| Tests unitaires complets, un worker | 408 réussis, 27 live opt-in ignorés |
| Régressions des quatre frontières | 34 réussies |
| Schémas source | 24 réussis |
| Rapports classificateur, observation et query set historiques | Réussis ; moteur et fichiers de référence identiques au commit de base |
| PostgreSQL QA complet | 66 réussis, 3 ignorés, un dépassement p95 à 119 ms sous charge parallèle |
| Rejeu isolé des trois budgets PostgreSQL | 3 réussis, assertions et budget 100 ms inchangés |
| France Travail réel, recherche/détail/référentiel | Réussi, sans journalisation des contenus |
| Build Next sans données externes au build | Réussi |
| Build Storybook | Réussi ; avertissements de bundle préexistants |

L'installation Windows du worktree avait converti les fichiers en CRLF. Après
normalisation des fins de ligne, les fichiers de provenance sont byte-à-byte identiques
aux blobs Git ; aucun rapport, seuil ou hash historique n'a été régénéré pour cette livraison.
Le runtime local reste Node 24.19.0 (avertissement engines 24.20.x) ; la CI utilise 24.20.0.

Les campagnes échouées sont conservées dans
[le rapport initial](reference/observation-v2-holdout-8-validation-report.json) et
[la relecture séparée](reference/observation-v2-holdout-8-reviewed-validation-report.json).
Elles concernent le candidat optimisé non livré et ne sont pas substituées à un test passant.

La QA Neon dédiée `br-lively-haze-b2swnlxa` expire le 23 septembre à 18:00 UTC.
Les tests injectent seulement des fixtures explicitement synthétiques puis les nettoient ;
aucune bascule du dataset courant. Les vraies connexions restent hors Git.
