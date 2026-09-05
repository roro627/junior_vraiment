# Notes d'implémentation de la maquette

## Références et priorité

- Référence principale retenue : `92cd2c5c-9fb9-41ae-b5ef-f68035f45605.png`.
- Référence secondaire : `fc7b793a-2954-4ae5-9f5d-9759d87ca627.png`.
- En cas de composition contradictoire, la première gagne. La seconde sert surtout aux états
  loading, faible échantillon et partial/stale.
- Les images sont des planches, pas des viewports à reproduire littéralement ; chaque cadre
  embarqué doit être validé aux tailles prévues dans la checklist.

## Tokens visuels

- `canvas` : blanc légèrement froid ; `surface` : blanc ; `surface-sunken` : lavande/gris très pâle.
- `foreground` : bleu nuit presque noir ; `foreground-muted` : gris bleuté.
- `accent` : violet profond dans la référence principale. La seconde emploie un indigo plus clair,
  qui ne remplace pas l'accent principal.
- `positive`, `warning` et `negative` utilisent chacun texte, icône et surface teintée : aucune
  signification uniquement par couleur.
- Typographie : sans-serif neutre et compacte. Aucune fonte n'est fournie ; Geist via `next/font`
  est donc le point de départ prévu par `STACK.md`.
- Chiffres KPI : graisse forte, tracking serré, chiffres tabulaires.
- Rayons : contrôles modérés, cartes plus généreuses, pills complètes pour chips et badges.
- Ombres : hairline/bordure en priorité ; ombre flottante réservée aux overlays.
- Les valeurs exactes sont centralisées dans `src/styles/tokens.css` et vérifiées par capture.

## Layout et responsive

- Desktop : shell stable, contenu centré, grille KPI + tendance, puis cartes secondaires.
- Mobile : KPI avant la tendance ; explorer en cartes ; barre de navigation compacte si nécessaire.
- Les filtres essentiels restent visibles sous forme de résumé. Le détail s'ouvre dans un drawer
  avec actions fixes et compteur de filtres.
- Les zones de KPI et skeleton réservent leur hauteur pour éviter le CLS.
- Le contenu fonctionnel ne descend pas sous 14 px et les cibles tactiles visent 44 × 44 CSS px.

## Accessibilité

- Le logo dessiné devient un lien texte nommé, sans texte raster.
- Le focus est renforcé par un token dédié, même si la planche ne le montre pas.
- Le panneau de preuve utilise les comportements Radix : focus initial, Escape, trap et retour focus.
- Chaque graphique reçoit un résumé et une table ou liste de valeurs ; le tooltip reste secondaire.
- Le jaune pâle des preuves est accompagné d'un libellé et son contraste texte est contrôlé.
- Les navigations mobile et desktop conservent le même ordre logique.

## Motion

- CSS pour hover, press, focus, badge et skeleton.
- Motion pour drawer/dialog, changement de KPI et continuité de layout.
- Tous les paramètres viennent de `docs/04-MOTION-SPEC.md` ; aucun comptage depuis zéro.
- En reduced motion : état final immédiat, suppression des translations/layout animations et
  fondu court uniquement lorsque cela reste utile.

## Composants shadcn prévus

- Button, Badge, Card, Select, Command, Dialog, Drawer, Sheet, Skeleton, Table, Pagination,
  Separator et Toggle Group, ajoutés seulement au moment de leur usage.
- Base Radix unique ; pas de mélange avec Base UI ou React Aria.

## Écarts intentionnels déjà identifiés

- Les états à faible échantillon afficheront « Pas assez de données » et jamais `0 %`.
- Les liens externes annonceront l'ouverture de l'offre source.
- Les métriques partielles ne pourront pas être partagées comme un insight normal.
- Le tableau desktop devient une liste de cartes sémantiques sur mobile.

## Validation à faire

- les couleurs sont centralisées en OKLCH dans `src/styles/tokens.css`; le contrôle Axe automatisé
  ne relève aucune violation sérieuse ou critique sur l'accueil ;
- l'accueil a été comparé à la référence principale en 1440 × 900 et 375 × 812 ; les trois autres
  viewports de la matrice restent à figer en régression visuelle ;
- les composants `KpiHero`, `MetricCard`, `DistributionCard`, `TrendCard`, `FilterBar` et
  `DataFreshnessBadge`, ainsi que les cartes et actions de partage des insights, disposent de
  stories avec données réelles ou fixtures UI explicitement bornées ;
- le reflow mobile transforme la grille en cartes et les filtres en panneau natif repliable ;
- tester clavier, zoom 200 %, contraste forcé et reduced motion ;
- faire confirmer visuellement la correspondance des deux noms UUID avec principale/secondaire
  avant de figer la baseline finale.
