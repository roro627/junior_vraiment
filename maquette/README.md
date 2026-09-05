# Dossier `maquette`

Déposer ici les références visuelles fournies pour **Junior, vraiment ?**.

Ce dossier est la source de vérité visuelle du produit. Il est volontairement présent dans la documentation, mais aucune maquette n'est incluse dans cette archive.

---

## Formats acceptés

- images PNG/JPEG/WebP ;
- exports SVG ;
- PDF de présentation ;
- lien ou export Figma ;
- HTML/CSS de prototype ;
- vidéos courtes de transitions ;
- notes Markdown ;
- polices uniquement si leur licence autorise explicitement l'usage et le dépôt.

Ne pas ajouter de fichiers de fonte sans vérification de licence.

---

## Nommage recommandé

```text
maquette/
├── README.md
├── sources/
│   ├── home-desktop.png
│   ├── home-mobile.png
│   ├── explorer-desktop.png
│   ├── evidence-mobile.png
│   └── motion-filter.mp4
├── INVENTORY.md
└── IMPLEMENTATION-NOTES.md
```

Les fichiers originaux restent inchangés dans `sources/`.

---

## Travail attendu du développeur

Avant d'implémenter :

1. lister tous les écrans ;
2. lister tous les composants ;
3. relever les dimensions de référence ;
4. extraire couleurs et typographie ;
5. identifier les états non fournis ;
6. relever les interactions et animations ;
7. noter les ambiguïtés ;
8. créer `INVENTORY.md` ;
9. créer `IMPLEMENTATION-NOTES.md`.

---

## `INVENTORY.md`

Exemple :

```md
| Référence | Route | Viewport | État | Composants | Notes |
|---|---|---:|---|---|---|
| home-desktop.png | / | 1440×900 | success | header, filters, KPI | source principale |
```

---

## `IMPLEMENTATION-NOTES.md`

Doit enregistrer :

- mapping des tokens ;
- choix responsive absent de la maquette ;
- adaptation accessibilité ;
- composant shadcn utilisé ;
- différence intentionnelle ;
- animation ;
- question restant ouverte.

Exemple :

```md
## FilterBar

- Référence : `sources/home-desktop.png`
- Desktop : sticky à 16 px sous le header.
- Mobile : transformé en drawer car la maquette mobile ne montre pas les cinq filtres.
- Accessibilité : contraste de la bordure augmenté pour atteindre AA.
- Motion : token `base`, translation 4 px.
```

---

## Priorité en cas de conflit

1. sécurité ;
2. exactitude de la donnée ;
3. accessibilité ;
4. spécification ;
5. maquette ;
6. préférence du développeur.

Le développeur ne doit pas modifier silencieusement le design. Il documente toute adaptation.

---

## Design system

Les valeurs extraites doivent être transformées en tokens dans :

```text
src/styles/tokens.css
```

Interdiction de copier une couleur hexadécimale différente dans chaque composant.

Les composants sont construits dans Storybook avant assemblage.

---

## Animations

Une vidéo ou transition de maquette indique l'intention. L'implémentation utilise les tokens de `docs/04-MOTION-SPEC.md`.

Interdits même si suggérés par une référence :

- scrolljacking ;
- parallaxe forte ;
- animation permanente ;
- mouvement non réduit avec `prefers-reduced-motion` ;
- effet qui retarde la donnée.

---

## Responsive manquant

Si un viewport n'est pas fourni :

- mobile-first ;
- priorité à la donnée ;
- filtres secondaires dans un drawer ;
- tableau en cartes ;
- aucune miniature illisible ;
- note de décision ;
- capture de validation.

---

## Validation

Comparer au minimum :

```text
375 × 812
768 × 1024
1440 × 900
1920 × 1080
```

Conserver les baselines de régression visuelle une fois la traduction approuvée.
