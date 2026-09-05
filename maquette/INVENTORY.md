# Inventaire des maquettes

Les deux fichiers sources restent inchangés. Les noms attendus `reference-principale.png` et
`reference-secondaire.png` n'ont pas été conservés lors du dépôt. Le fichier le plus complet,
`92cd2c5c-9fb9-41ae-b5ef-f68035f45605.png`, est traité comme référence principale : il couvre
26 vues et le système de composants. L'autre référence complète les états absents.

| Référence | Rôle | Canevas | Routes / états couverts | Composants principaux |
|---|---|---:|---|---|
| `92cd2c5c-9fb9-41ae-b5ef-f68035f45605.png` | principale | 1536 × 1024 | accueil desktop/mobile, filtres desktop/drawer, variantes KPI, preuves desktop/mobile, explorer desktop/mobile, méthodologie, état des données normal/incident, insight, partage, aperçu responsive | header, filtres, KPI, cartes métriques, graphiques, cartes offre, table, badges, drawer/dialog, pagination, contrôles |
| `fc7b793a-2954-4ae5-9f5d-9759d87ca627.png` | secondaire | 1536 × 1024 | accueil desktop/mobile, filtres appliqués, loading, faible échantillon, partial/stale, explorer desktop/mobile, preuves, méthodologie, état des données normal/incident | variantes de composition, skeleton, état vide, navigation mobile |

## Écrans et états non dessinés explicitement

- erreurs réseau locales avec ancienne donnée encore disponible ;
- état `stale` au-delà de 72 heures et suspension du partage ;
- reflow exact à 320 CSS px et zoom 200 % ;
- états focus complets et navigation clavier de tous les overlays ;
- contenu très long, entreprise absente, huit technologies et salaire complexe ;
- pages `not-found`, `error` et `global-error` ;
- Open Graph avec échantillon insuffisant ou donnée corrigée ;
- états d'impression et contraste forcé.

## Primitives répétées

- shell avec header fin, navigation textuelle et fraîcheur visible ;
- panneaux blancs bordés sur canevas très clair ;
- contrôle compact arrondi, chip sélectionnée et bouton accent ;
- KPI dominant avec valeur tabulaire, fraction, variation et méthode ;
- carte métrique avec titre, valeur, détail et lien ;
- badge sémantique avec texte, icône et surface teintée ;
- graphique dans une carte avec résumé textuel ;
- offre présentée en carte mobile et ligne de table desktop ;
- panneau de preuve en dialog desktop et drawer plein écran mobile.
