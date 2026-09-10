# Notes d'implémentation de la maquette

## Raffinement du pilote orange — 7 septembre 2026

À la demande du propriétaire, la direction orange reste limitée à la page pilote locale.
La capture approuvée reste intacte. Le contenu est resserré à 78 rem, le KPI est isolé sur
une surface blanche dans le hero glacier, son unité est plus discrète et les contrôles utilisent
un rayon de 12 px. Les titres des indicateurs précèdent leurs valeurs ; les filtres sont regroupés
avant les indicateurs secondaires. Les sections détaillées suivent une numérotation continue.
La version mobile reste linéaire, sans nouvelles dépendances ni animation permanente.

Audit en lecture seule du dataset publié, fenêtre 30 jours au 7 septembre : l'API et les lignes
figées en base donnent 0 / 354 pour le KPI principal. Les 354 offres junior résolues comprennent
353 minima à zéro mois et un à douze mois. Les 80 offres junior ambiguës portent toutes les
avertissements de conflit entre acceptation des débutants et expérience exigée ; elles sont
exclues conformément à la méthode, jamais reclassées pour modifier le taux. Aucun chiffre
n'a été changé. Un encart conditionnel explique désormais qu'un zéro confirmé ne signifie pas
absence de difficultés sur le marché. Une absence de données conserve son état distinct.
Validation du raffinement : format, lint, TypeScript, build Next et Storybook réussis.
277 tests unitaires réussis (24 tests conditionnels ignorés dans cette suite), plus deux tests
réels de lecture Neon exécutés séparément ; 113 tests navigateur réussis sur quatre projets
(trois répétitions de la matrice responsive réservée à Chromium ignorées). Le nouveau test
vérifie aussi le détail du zéro au clavier et son accessibilité après ouverture.
Captures desktop/mobile revues, sans débordement de 320 à 1920 px. L'audit manuel avec lecteur
d'écran et les mesures Lighthouse/Web Vitals ne sont pas exécutés pour ce raffinement.
Le skill Browser a servi à revoir la hiérarchie réelle, les filtres et les états chargés.
Les validations des versions précédentes ci-dessous restent historiques. Aucun déploiement.

## Pilote orange retenu — 7 septembre 2026

Le propriétaire a retenu la troisième proposition claire/orange et fourni sa capture
`sources/home-orange-approved.png` (1457 × 1079), copie inchangée de la capture fournie.
Elle remplace la direction éditoriale du pilote décrite ci-dessous. La validation concerne
uniquement une implémentation locale de `/`, pas une propagation ni un déploiement.

Inventaire : en-tête horizontal avec signature soulignée, hero bleu glacier avec introduction
et KPI côte à côte, pied de hero avec territoire/source/fraîcheur, trois métriques sur une
surface blanche, sélecteur de période et barre de filtres. Seul l'état desktop nominal est
dessiné. Les données de l'image ne sont jamais codées en dur.

Tokens isolés `.home-pilot` : blanc, bleu glacier `#edf4fa`, encre `#252a31`, gris `#59616c`,
orange de signature `#ef501c`, orange interactif `#cb3f12` (contraste texte blanc AA), séparateurs
abricot. Geist conservé, sans italique ni nouvelle fonte. Hero/panneaux à 24 px de rayon,
contrôles à 8 px ; gouttières fluides, contenu maximal 86 rem. Pas d'ombre décorative.

Adaptations : fractions/couvertures et alertes conservées même lorsqu'absentes de la capture ;
liens des preuves visibles ; filtres secondaires repliables, période partageable via URL ;
mobile en une colonne et navigation repliable. Les sections non dessinées reprennent les mêmes
surfaces, filets et hiérarchie sans bande sombre ni typographie éditoriale. Boutons shadcn
existants, disclosures natifs et transitions CSS centralisées ; reduced motion sans translation.

Les validations de la version précédente ci-dessous ne valent pas validation de cette révision.

Validation de cette révision : format, lint, TypeScript, build Next et build Storybook réussis ;
276 tests unitaires réussis (24 tests conditionnels non activés), 109 tests E2E réussis sur
Chromium, Firefox, WebKit et mobile (3 répétitions de la matrice responsive volontairement
réservée à Chromium ignorées). Les tests couvrent notamment axe, clavier, reduced motion,
les filtres et la synchronisation de leur formulaire après changement de période par lien.
Aucun débordement horizontal aux largeurs 320, 375, 768, 1024, 1440 et 1920 px.
Captures locales revues : `.local/orange-pilot-1440-viewport.png` et
`.local/orange-pilot-375-viewport.png`. Le lecteur d'écran manuel et les mesures de performance
restent à vérifier avant publication ; aucun nouveau score Lighthouse n'est revendiqué.
Validation artistique du propriétaire en attente, sans déploiement ni propagation.

## Pilote de refonte — 7 septembre 2026

Le propriétaire a supprimé les deux images et demandé une nouvelle direction artistique autonome.
Ces suppressions sont préservées. Les notes historiques ci-dessous décrivent l'ancien design,
pas une contrainte visuelle pour le pilote. Seule la route `/` est refondue, en local, avant sa
validation ; les autres pages et le site de production restent inchangés.

Direction : observatoire éditorial, papier clair et encre, accent vermillon, titrage Geist et
contrepoint italique Georgia (fonte système, aucun téléchargement). Une grille asymétrique met
en regard la question et sa mesure. Filets et alignements structurent les informations ; les
surfaces colorées ont une fonction de lecture. Les valeurs restent celles des lectures serveur.

Les tokens du pilote sont isolés sous `.home-pilot` dans `src/styles/tokens.css`. Primitives :
en-tête typographique, section numérotée, valeur/fraction, barre proportionnelle et lien fléché.
Les composants ont leurs stories ; filtres GET et badges de fraîcheur sont réutilisés.
La tendance du pilote utilise une échelle fixe 0–100 %, l'espacement calendaire réel et un tableau
consultable au clavier ; les jours absents, points non publiables et changements de périmètre
ne sont pas reliés. Son lien de données conserve les filtres de la page.
Les distributions n'imposent pas une longueur minimale aux valeurs nulles ou égales à zéro.

États prévus : normal, zéro réel, échantillon insuffisant, données partielles/anciennes, erreur,
chargement, filtres actifs, historique court, navigation mobile et reduced motion. La hiérarchie
mobile est linéaire, avec des cibles de 44 px et les détails de filtre repliables.
Motion : apparition courte de 8 px au rendu, liens et contrôles réactifs ; aucun compteur,
scrolljacking, boucle, ni hydratation ajoutée uniquement pour une décoration.

Contrôles du pilote exécutés le 7 septembre : format, lint, TypeScript, 272 tests unitaires
réussis (24 tests conditionnels non activés), 104 parcours E2E réussis sur Chromium,
Firefox, WebKit et mobile, build Next et build Storybook. Les contrôles axe incluent l'historique
déplié ; le clavier, reduced motion et les filtres partagés par URL sont couverts. Revue visuelle
dans le navigateur aux largeurs 320, 375, 768, 900, 1024, 1440 et 1920 px ; état vide vérifié
avec le filtre réel « Stage ». Le lecteur d'écran manuel reste à vérifier avant généralisation.
Les disclosures natifs conservent aussi une ouverture effectuée avant l'hydratation : la tolérance
est limitée à leurs attributs, jamais aux valeurs métier. Un test retient les scripts jusqu'à
l'ouverture du menu, puis vérifie que l'action est conservée après leur chargement.

Les deux tentatives Lighthouse 13.4.1 sous Windows échouent sur `NO_NAVSTART` et une erreur
de nettoyage temporaire `EPERM`. Aucun score de performance, LCP ou CLS n'est donc validé.
Le runtime Docker local est également indisponible après tentative de démarrage. Cette mesure
reste à refaire avant publication de la refonte ; elle ne remplace pas la validation artistique.

Validation visuelle du propriétaire en attente. Aucune propagation aux autres routes autorisée
avant ce retour.

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

- La confidentialité est une section textuelle de la page À propos, accessible depuis le pied
  de page. Elle réutilise `TrustPage` et les tokens existants, sans nouvel écran ni animation.
- À 320 px, les identifiants de métriques peuvent être plus larges que leur carte : les libellés
  longs se replient et les items de grille peuvent rétrécir, sans cacher ni tronquer la valeur.

- Les états à faible échantillon afficheront « Pas assez de données » et jamais `0 %`.
- Les liens externes annonceront l'ouverture de l'offre source.
- Les métriques partielles ne pourront pas être partagées comme un insight normal.
- Le tableau desktop devient une liste de cartes sémantiques sur mobile.
- Les changements de périmètre interrompent la ligne de tendance et portent une explication
  textuelle visible. Une valeur non publiable n'est jamais reliée par interpolation. Le composant
  reste serveur, avec les tokens existants et sans animation supplémentaire (6 septembre 2026).

## Validation à faire

- le code du panneau de preuve est chargé au clic, sans modifier son rendu ; le bouton donne
  immédiatement l’état « Ouverture… », puis rétablit son libellé. Un échec de chargement affiche
  un statut réessayable. Le focus initial et son retour restent explicites et testés.
- les classes du bouton d’ouverture sont résolues côté serveur depuis les mêmes variantes du
  design system ; ni les tokens ni le rendu ne changent.

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
# Extension approuvée — 9 septembre 2026

Le propriétaire autorise l'extension du pilote orange à toutes les routes. La référence
`sources/home-orange-approved.png` et le pilote affiné restent la direction de composition.
Les anciens fichiers supprimés par le propriétaire ne sont pas restaurés.

Les tokens orange, encre et bleu pâle deviennent globaux, y compris dans les portails de
preuves et Storybook. Navigation et footer réutilisent les mêmes composants serveur.
Explorer conserve sa densité de travail ; les pages de confiance gardent un sommaire et une
largeur de lecture ; les insights reprennent le contraste surface bleue / mesure blanche.
Les pages d'erreur, les états vides et les squelettes héritent des tokens sans fausses données.
Les interactions existantes et reduced motion sont conservés. Storybook ajoute les compositions
de lecture avec et sans sommaire. Cette extension ne publie pas le KPI v2 candidat.
