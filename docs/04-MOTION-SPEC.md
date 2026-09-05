# 04 — Spécification du mouvement

## 1. Intention

Le mouvement doit donner la sensation d'un produit soigné, rapide et cohérent. Il ne doit pas donner l'impression d'une démonstration d'effets.

Trois fonctions seulement :

1. **Orientation** — montrer d'où vient un élément et où il va.
2. **Continuité** — relier deux états d'une même information.
3. **Feedback** — confirmer immédiatement une action.

Une animation sans l'une de ces fonctions est supprimée.

---

## 2. Principes

### P1 — Le contenu est disponible avant l'effet

Le mouvement ne retarde jamais la lecture. Un chiffre peut apparaître avec une légère transition, mais sa valeur accessible est déjà présente.

### P2 — Un geste, une réponse

Une interaction reçoit un retour visuel en moins de 100 ms :

- pression ;
- sélection ;
- changement d'état ;
- chargement.

### P3 — Continuité plutôt que spectacle

Le filtre sélectionné se déplace ou change de surface. La page entière ne fait pas un grand slide.

### P4 — Entrées rares

Les animations d'entrée servent au premier affichage d'une section importante. Elles ne se rejouent pas à chaque scroll mineur.

### P5 — Sorties plus rapides

Une sortie ne bloque pas l'utilisateur. Elle est généralement 20 à 35 % plus courte qu'une entrée.

### P6 — Reduced motion complet

Le produit reste élégant lorsque les transformations et animations de layout sont désactivées.

---

## 3. Tokens temporels

```ts
export const duration = {
  instant: 0.09,
  fast: 0.16,
  base: 0.24,
  slow: 0.36,
  page: 0.44,
} as const;
```

Usage :

| Token | Usage |
|---|---|
| `instant` | press, focus décoratif, changement d'icône |
| `fast` | hover, tooltip, badge, sortie |
| `base` | filtre, accordion, petit layout |
| `slow` | graphique, panneau, section importante |
| `page` | transition de shell rare |

Aucune animation d'interface normale ne dépasse 500 ms.

---

## 4. Courbes

```ts
export const easing = {
  standard: [0.22, 1, 0.36, 1],
  enter: [0.16, 1, 0.3, 1],
  exit: [0.4, 0, 1, 1],
  linear: [0, 0, 1, 1],
} as const;
```

- `standard` : mouvement général ;
- `enter` : panneau ou contenu ;
- `exit` : disparition ;
- `linear` : progression temporelle réelle uniquement.

Ne pas inventer une courbe différente par composant.

---

## 5. Springs

```ts
export const spring = {
  control: {
    type: "spring",
    stiffness: 420,
    damping: 34,
    mass: 0.75,
  },
  layout: {
    type: "spring",
    stiffness: 360,
    damping: 32,
    mass: 0.85,
  },
  panel: {
    type: "spring",
    stiffness: 300,
    damping: 34,
    mass: 0.95,
  },
} as const;
```

Les valeurs finales doivent être ajustées sur la maquette et testées sur appareils réels. Elles sont centralisées.

Éviter le rebond visible. Une spring premium s'arrête proprement.

---

## 6. Distances

```text
micro translation    2 px
control translation  4 px
content translation  8 px
panel translation    16–24 px
```

Une section ne doit pas entrer depuis 100 px. Les grandes distances donnent une sensation lente et instable.

---

## 7. MotionConfig

À la racine des composants interactifs :

```tsx
import { MotionConfig } from "motion/react";

<MotionConfig
  reducedMotion="user"
  transition={{ duration: duration.base, ease: easing.standard }}
>
  {children}
</MotionConfig>
```

En reduced motion :

- transformations de grands éléments supprimées ;
- layout animations supprimées ;
- parallaxe interdite dans tous les cas ;
- opacity courte autorisée ;
- progression des graphiques remplacée par l'état final ;
- smooth scroll désactivé si préférence utilisateur.

---

## 8. Matrice des interactions

| Interaction | Animation | Durée |
|---|---|---:|
| hover bouton | légère variation surface/ombre | 160 ms |
| press bouton | scale `0.98` maximum | 90 ms |
| focus | anneau sans délai | 0–90 ms |
| sélection chip | fond + shared layout optionnel | 240 ms |
| ouverture popover | opacity + y 4 px | 160–240 ms |
| ouverture drawer mobile | translation axe principal | spring panel |
| fermeture overlay | opacity + translation réduite | 160 ms |
| changement KPI | crossfade + y 4 px, valeur finale accessible | 240 ms |
| mise à jour graphique | interpolation des formes | 360 ms |
| apparition section | opacity + y 8 px une fois | 360 ms |
| toast | opacity + y 4 px | 240 ms |
| skeleton → contenu | crossfade | 160 ms |
| route | shell persistant, contenu fade/y 8 | 240–440 ms |

---

## 9. Navigation

### Shell persistant

L'en-tête, l'arrière-plan et les filtres partagés ne doivent pas disparaître entre accueil et explorer lorsque l'architecture le permet.

### Chargement

Au clic :

1. le contrôle répond immédiatement ;
2. l'URL entre en transition ;
3. les zones concernées indiquent le chargement ;
4. le reste reste stable ;
5. les nouvelles valeurs apparaissent ensemble par groupe logique.

Ne pas faire clignoter toute la page.

### Retour navigateur

Aucune animation spéciale longue. Restaurer l'état et la position naturellement.

---

## 10. Filtres

### Chip

- hover : surface légère ;
- press : scale 0.98 ;
- sélection : couleur, icône et éventuellement `layoutId` pour le fond ;
- suppression : sortie rapide ;
- compteur de résultats mis à jour après le serveur.

### Select / Command

- popover ancré visuellement au contrôle ;
- origine de transformation cohérente ;
- hauteur bornée ;
- pas de scroll animé forcé ;
- sélection ferme ou conserve selon pattern, identique partout.

### Drawer mobile

- backdrop opacity ;
- panneau depuis le bas ;
- poignée décorative non obligatoire ;
- focus trap ;
- contenu immédiatement disponible ;
- actions fixes si la maquette le prévoit ;
- reduced motion : fade simple.

---

## 11. KPI

### Premier rendu

Option A recommandée :

- libellé et contexte statiques ;
- valeur opacity 0 → 1 et y 4 → 0 ;
- durée 360 ms ;
- aucun comptage depuis 0.

### Changement de filtre

- ancienne valeur reste visible en état atténué si nouvelle donnée charge ;
- nouvelle valeur crossfade ;
- unité ne saute pas ;
- largeur réservée avec chiffres tabulaires ;
- variation apparaît après la valeur, délai max. 60 ms.

### Accessibilité

Le DOM expose directement la valeur finale. Ne jamais émettre chaque étape d'un compteur dans `aria-live`.

---

## 12. Graphiques

### Premier affichage

- axes et labels immédiats ;
- séries révélées sur 360 ms ;
- léger stagger maximum 30 ms entre séries ;
- aucun stagger par barre si plus de dix barres.

### Changement de filtre

- morphing si les catégories restent identiques ;
- crossfade si la structure change ;
- axe recalculé sans saut excessif ;
- tooltip fermé pendant transition.

### Ligne

Utiliser un reveal ou interpolation horizontale discrète, pas un tracé lent théâtral.

### Barres

Partir de la baseline ou interpoler depuis la valeur précédente. Ne pas faire tomber les barres depuis le haut.

### Donut

Rotation minimale ou nulle. Préférer interpolation de valeur.

---

## 13. Panneau de preuve

Ouverture desktop :

- backdrop 160 ms ;
- panneau y/x 16 px et opacity ;
- durée 240–360 ms ;
- titre et contenu ensemble, pas de cascade lente.

Fermeture :

- 160–240 ms ;
- retour focus après fin ou immédiatement selon test ;
- ne pas bloquer navigation.

Le surlignage de preuve peut apparaître par couleur de fond en 160 ms, sans clignotement.

---

## 14. Scroll

Interdits :

- scrolljacking ;
- sections épinglées longues ;
- parallaxe ;
- transformation basée en permanence sur `scrollY` ;
- autoplay déclenché à chaque passage.

Autorisé :

- révélation unique d'une section ;
- barre de progression de lecture sur méthodologie si discrète ;
- retour à l'ancre natif ;
- sticky raisonnable pour les filtres, testé avec focus.

---

## 15. Performance

Règles :

- animer `transform` et `opacity` en priorité ;
- éviter `filter: blur()` animé sur grandes surfaces ;
- éviter box-shadow complexe animé ;
- ne pas animer hauteur d'une grande liste à chaque item ;
- profiler les graphiques ;
- pas d'animation en boucle ;
- limiter les composants Motion au sous-arbre utile ;
- ne pas hydrater une section statique seulement pour l'animer.

Objectif : aucune tâche longue liée à l'animation sur les parcours clés.

---

## 16. Tests

### Playwright

Tester :

- valeur finale ;
- overlay ouvert/fermé ;
- absence de layout shift ;
- reduced motion ;
- retour focus ;
- interaction pendant une transition ;
- clic rapide répété ;
- navigation lente simulée.

### Visual regression

Captures :

- début ;
- état final ;
- reduced motion ;
- drawer ;
- filtre sélectionné ;
- graphique changé.

Ne pas snapshotter un frame instable. Désactiver les animations dans les tests visuels sauf test dédié.

### Test manuel

- écran 60 Hz ;
- écran 120/144 Hz si disponible ;
- mobile milieu de gamme ;
- Safari ;
- clavier ;
- préférence reduced motion.

---

## 17. Checklist par animation

- [ ] Fonction définie : orientation, continuité ou feedback.
- [ ] Token utilisé.
- [ ] Valeur finale accessible immédiatement.
- [ ] Sortie plus rapide.
- [ ] Aucun layout shift.
- [ ] Fonctionne sous clics répétés.
- [ ] Reduced motion prévu.
- [ ] Testée sur mobile.
- [ ] Pas de dépendance au hover.
- [ ] Coût bundle et runtime acceptable.
- [ ] Ne retarde pas l'information.
