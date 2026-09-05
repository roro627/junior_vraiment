# 03 — UX, interface et design system

## 1. Source de vérité

La maquette déposée dans `/maquette` est la source de vérité pour :

- composition ;
- hiérarchie ;
- couleurs ;
- typographie ;
- iconographie ;
- rayons ;
- ombres ;
- densité ;
- responsive explicitement dessiné ;
- états montrés.

Elle n'est pas une autorisation à reproduire :

- un contraste insuffisant ;
- un composant non accessible ;
- un texte dans une image ;
- une cible trop petite ;
- une interaction impossible au clavier ;
- un layout cassé sur des tailles non dessinées ;
- un effet coûteux ou inconfortable.

Tout écart nécessaire est documenté dans `maquette/IMPLEMENTATION-NOTES.md`.

---

## 2. Ordre de travail obligatoire

Avant toute page finale :

1. inventorier les écrans et états ;
2. extraire les tokens ;
3. identifier les patterns répétitifs ;
4. créer les primitives ;
5. construire les composants dans Storybook ;
6. tester les tailles extrêmes et contenus réels ;
7. assembler la page ;
8. comparer visuellement ;
9. tester au clavier et en reduced motion ;
10. mesurer la performance.

Il est interdit de coder chaque écran avec ses propres valeurs puis d'essayer de « factoriser plus tard ».

---

## 3. Principes visuels

### 3.1 La donnée est le héros

- un nombre principal par section ;
- unité immédiatement visible ;
- contexte près du chiffre ;
- détails secondaires plus calmes ;
- aucune illustration décorative concurrente.

### 3.2 Hiérarchie calme

La sensation premium vient de l'espace et de la cohérence, pas d'un empilement d'ombres, gradients et glassmorphism.

Préférer :

- surfaces discrètes ;
- bordures légères ;
- contraste typographique ;
- alignements stricts ;
- espaces réguliers ;
- un accent coloré maîtrisé.

### 3.3 Densité progressive

- accueil : narration et respiration ;
- explorer : densité fonctionnelle ;
- méthodologie : lecture longue ;
- mobile : priorité à la compréhension, pas réduction miniature du desktop.

### 3.4 Transparence visible

Les éléments suivants sont des composants de premier rang :

- date de fraîcheur ;
- taille d'échantillon ;
- badge de méthode ;
- état partiel ;
- preuve ;
- source.

Ils ne doivent pas être cachés dans un footer.

---

## 4. Tokens

Créer `src/styles/tokens.css`.

### 4.1 Couleurs sémantiques

```text
canvas
surface
surface-raised
surface-sunken
foreground
foreground-muted
foreground-subtle
border
border-strong
accent
accent-foreground
positive
positive-surface
warning
warning-surface
negative
negative-surface
info
focus
chart-1 ... chart-8
```

Ne pas nommer une couleur `blue-500` dans l'API d'un composant produit. Les valeurs peuvent utiliser OKLCH.

### 4.2 Typographie

Tokens minimum :

```text
font-sans
font-mono
text-display
text-title-1
text-title-2
text-title-3
text-body
text-body-small
text-label
text-caption
text-data-large
text-data-medium
```

Chaque token définit :

- taille ;
- hauteur de ligne ;
- graisse ;
- tracking ;
- variante tabulaire si donnée.

Les nombres de KPI utilisent des chiffres tabulaires lorsque les valeurs changent.

### 4.3 Espacement

Échelle recommandée à adapter à la maquette :

```text
0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96
```

Éviter plus de deux exceptions. Une exception fréquente devient un token.

### 4.4 Rayons

```text
radius-xs
radius-sm
radius-control
radius-card
radius-panel
radius-pill
```

### 4.5 Ombres

```text
shadow-none
shadow-hairline
shadow-card
shadow-floating
shadow-dialog
```

Les ombres ne doivent pas être le seul moyen de distinguer une surface.

### 4.6 Layout

```text
content-max
reading-max
gutter-mobile
gutter-tablet
gutter-desktop
header-height
section-gap
```

---

## 5. Grille responsive

Breakpoints définis par le contenu, pas par un appareil marketing.

Référence initiale à confirmer avec la maquette :

| Nom | Largeur |
|---|---:|
| `sm` | 640 px |
| `md` | 768 px |
| `lg` | 1024 px |
| `xl` | 1280 px |
| `2xl` | 1536 px |

Règles :

- mobile-first ;
- cartes en une colonne avant de comprimer le contenu ;
- filtres essentiels visibles, secondaires dans un drawer ;
- tableaux transformés en cartes ;
- aucun texte sous 14 px pour le contenu fonctionnel ;
- aucun scroll horizontal global ;
- graphiques simplifiés, pas rognés ;
- grandes tailles limitées par `content-max`.

---

## 6. Composants fondamentaux

## 6.1 `AppHeader`

États :

- initial ;
- compact après défilement si la maquette le demande ;
- menu mobile ouvert ;
- statut données dégradé.

Règles :

- pas de header qui masque le focus ;
- hauteur stable ;
- navigation toujours dans le même ordre ;
- lien méthodologie visible ;
- logo texte accessible.

## 6.2 `FilterBar`

Contient :

- famille de métier ;
- technologie ;
- territoire ;
- action réinitialiser ;
- indicateur du nombre de filtres.

Comportement :

- desktop : barre ou panneau stable ;
- mobile : résumé + drawer ;
- application immédiate ou explicite selon maquette, mais cohérente partout ;
- URL mise à jour avec transition ;
- `aria-live` annonce le nombre de résultats une fois la mise à jour terminée, sans annoncer chaque frappe.

## 6.3 `KpiHero`

Contient :

- libellé ;
- valeur ;
- fraction ;
- variation ;
- période ;
- fraîcheur ;
- badge méthode ;
- action preuve.

Ne jamais animer la valeur depuis zéro si cela donne une fausse impression de comptage réel. Une interpolation courte est acceptable uniquement entre deux valeurs connues et avec valeur finale immédiatement disponible pour les technologies d'assistance.

## 6.4 `MetricCard`

API conceptuelle :

```ts
type MetricCardProps = {
  title: string;
  value: string;
  detail?: string;
  trend?: Trend;
  state: DataState;
  help?: ReactNode;
  action?: ReactNode;
};
```

La carte ne décide pas de la couleur à partir d'un nombre sans sémantique métier fournie.

## 6.5 `ChartCard`

Contient :

- titre ;
- question ;
- graphique ;
- légende ;
- résumé ;
- action « Voir les données » ;
- état.

Le tooltip n'est jamais l'unique endroit contenant une valeur.

## 6.6 `EvidencePanel`

Contient :

- offre ;
- classification ;
- preuves junior ;
- preuves expérience ;
- règles ;
- avertissements ;
- lien source ;
- version.

Desktop : panneau latéral ou dialog selon maquette.  
Mobile : drawer plein écran ou page dédiée.

Exigences :

- focus envoyé dans le panneau ;
- fermeture au clavier ;
- retour du focus ;
- extraits avec surlignage accessible ;
- pas de texte coupé sans action « Afficher plus ».

## 6.7 `DataFreshnessBadge`

États :

```text
fresh
delayed
stale
partial
incident
```

Le libellé accompagne toujours la couleur et l'icône.

## 6.8 `ShareInsight`

Comportement :

- aperçu de la carte ;
- copier le lien ;
- Web Share API si disponible ;
- lien de partage LinkedIn optionnel ;
- confirmation non intrusive ;
- UTM propre ;
- pas de pop-up bloquée comme unique méthode.

---

## 7. Composants de graphiques

### Ligne

Utilisée pour une tendance. Axe temporel lisible, points limités, annotation de changement de méthode.

### Barres horizontales

Utilisées pour technologies et métiers. Le libellé reste lisible ; éviter les légendes séparées.

### Histogramme / barres par tranches

Utilisé pour l'expérience. Montrer la catégorie inconnue.

### Donut

À utiliser seulement pour deux à quatre catégories simples. Une barre empilée est souvent plus lisible.

### Carte géographique

Hors MVP. Une carte n'est ajoutée que si elle répond mieux qu'un classement ou une recherche.

---

## 8. États de données

### Loading

- skeleton de même géométrie ;
- ne pas utiliser un spinner plein écran ;
- conserver le shell ;
- indiquer le chargement seulement si perceptible ;
- pas de shimmer agressif en reduced motion.

### Empty

Expliquer :

- aucun résultat ;
- pourquoi c'est plausible ;
- quel filtre élargir ;
- ne pas afficher de graphiques vides décoratifs.

### Error

- message humain ;
- action de réessai ;
- ancienne donnée si disponible ;
- date ;
- identifiant de support non sensible.

### Partial

- bannière locale ;
- parties concernées ;
- dernière donnée complète ;
- pas de carte sociale trompeuse.

### Stale

- valeur utilisable mais datée ;
- libellé « Dernière mise à jour réussie… » ;
- couleur d'avertissement modérée ;
- explication sur le statut.

---

## 9. Accessibilité des couleurs

Objectifs minimum :

- texte normal : 4,5:1 ;
- grand texte : 3:1 ;
- composants et objets graphiques nécessaires : 3:1 ;
- focus très visible ;
- état de sélection distinguable sans couleur.

Tester les tokens, pas seulement des captures.

Pour les graphiques :

- palette compatible avec déficiences de vision des couleurs ;
- motifs, formes ou labels lorsque les séries doivent être distinguées ;
- ordre logique dans la légende et le DOM.

---

## 10. Clavier

Ordre attendu :

1. lien d'évitement ;
2. navigation ;
3. filtres ;
4. contenu principal ;
5. actions des cartes ;
6. footer.

Règles :

- aucun piège hors dialog ;
- Escape ferme un overlay ;
- flèches uniquement selon le pattern ARIA du composant ;
- Enter/Espace activent un bouton ;
- focus non masqué par sticky header ;
- tooltips non indispensables ;
- contenu hover également disponible au focus.

---

## 11. Texte et nombres

### Format français

- espace insécable avant `%` ;
- dates : `2 septembre 2026` dans le contenu ;
- dates compactes : `02/09/2026` seulement dans tableaux denses ;
- milliers avec espace insécable ;
- décimale avec virgule ;
- durée : `2 ans`, pas `24m` dans le contenu grand public ;
- écarts : `+8 points`, pas `+8 %` si différence de taux.

Utiliser `Intl.NumberFormat` et `Intl.DateTimeFormat`.

### Troncature

Ne pas tronquer :

- titre principal ;
- valeur ;
- source ;
- avertissement ;
- preuve essentielle.

Une troncature d'intitulé d'offre doit être ouvrable et avoir un nom accessible complet.

---

## 12. Contenu réel

Tester les composants avec :

- entreprise absente ;
- titre de 120 caractères ;
- commune longue ;
- 8 technologies ;
- salaire complexe ;
- valeur 0 ;
- valeur 100 ;
- échantillon 1 ;
- échantillon 100 000 ;
- texte avec caractères accentués ;
- preuve en anglais ;
- source indisponible ;
- changement de méthode.

Le lorem ipsum est interdit pour la validation finale.

---

## 13. Storybook

Organisation :

```text
Foundations/
  Colors
  Typography
  Spacing
  Motion
UI/
  Button
  Select
  Dialog
Product/
  KpiHero
  MetricCard
  EvidencePanel
  DataFreshnessBadge
Charts/
  TrendChart
  ExperienceDistribution
Pages/
  Home
  Explorer
  Methodology
```

Chaque story documente :

- rôle ;
- usage ;
- non-usage ;
- variantes ;
- accessibilité ;
- tokens ;
- motion ;
- contenu limite.

---

## 14. Comparaison à la maquette

La revue visuelle se fait sur :

```text
375 × 812
768 × 1024
1024 × 768
1440 × 900
1920 × 1080
```

Méthode :

1. capture Playwright ;
2. overlay avec référence ;
3. comparaison des écarts ;
4. correction ;
5. snapshot de régression.

Une différence de pixel n'est pas forcément un bug si elle améliore le reflow ou l'accessibilité. Elle doit être intentionnelle.

---

## 15. Mode sombre

Ne pas ajouter automatiquement un mode sombre.

Il est implémenté si :

- la maquette le fournit ;
- tous les tokens sont définis ;
- tous les graphiques sont testés ;
- les cartes sociales gardent un rendu déterministe ;
- aucune couleur métier ne perd son sens.

Sinon, le MVP reste clair et parfaitement fini.

---

## 16. Critères de validation design

- [ ] Tokens extraits et documentés.
- [ ] Aucune couleur brute dans les composants produit.
- [ ] Aucune valeur d'espacement arbitraire répétée.
- [ ] Tous les composants clés dans Storybook.
- [ ] États loading/empty/error/partial/stale.
- [ ] Navigation clavier.
- [ ] Contrastes.
- [ ] Reduced motion.
- [ ] Reflow mobile.
- [ ] Captures comparées à la maquette.
- [ ] Texte réel.
- [ ] Aucun layout shift.
- [ ] Graphiques avec alternative textuelle.
- [ ] Les données principales sont comprises en cinq secondes lors d'un test utilisateur.
