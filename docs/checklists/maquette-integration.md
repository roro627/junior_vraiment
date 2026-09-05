# Checklist d'intégration de la maquette

Cette checklist s'applique dès que la maquette est déposée dans `/maquette`. Elle évite deux échecs fréquents : reproduire aveuglément une image non fonctionnelle, ou s'en éloigner au nom de préférences techniques.

## 1. Inventaire

- [ ] Tous les fichiers attendus sont présents et lisibles.
- [ ] Un fichier `maquette/INDEX.md` liste les écrans, variantes et liens éventuels.
- [ ] Chaque écran possède un nom correspondant à une route ou un état identifiable.
- [ ] Les versions desktop, tablette et mobile sont distinguées.
- [ ] Les états interactifs fournis sont recensés : repos, survol, focus, actif, chargement, vide, erreur, succès.
- [ ] Les polices, icônes, illustrations et photographies ont une licence et un format exploitables.
- [ ] Les éléments purement décoratifs sont distingués des contenus nécessaires.

## 2. Extraction des fondations

Avant d'écrire les composants, relever et proposer dans une pull request dédiée :

- [ ] palette sémantique claire et sombre éventuelle;
- [ ] échelle typographique;
- [ ] grille, largeur maximale et gouttières;
- [ ] échelle d'espacement;
- [ ] rayons, bordures et ombres;
- [ ] tailles minimales des contrôles;
- [ ] comportements responsive;
- [ ] vocabulaire des animations;
- [ ] composants récurrents.

Les valeurs proches doivent être regroupées en tokens cohérents plutôt que copiées au pixel près de manière désordonnée.

## 3. Arbitrages obligatoires

Pour chaque conflit, documenter la décision :

| Conflit | Règle |
|---|---|
| Maquette vs accessibilité | Corriger la maquette; ne jamais réduire l'accessibilité |
| Maquette vs exactitude des données | Préserver le sens statistique, ajouter l'espace nécessaire |
| Maquette vs petits écrans | Réorganiser, ne pas simplement miniaturiser |
| Maquette vs performance | Chercher un rendu équivalent moins coûteux |
| Maquette vs texte réel | Adapter le composant aux données réelles |
| Maquette vs composant natif/primitif accessible | Conserver le rendu mais partir de la primitive robuste |
| Maquette vs spécification produit | Faire remonter le conflit avant implémentation |

## 4. Prototype vertical

Construire d'abord une tranche réelle comprenant :

- [ ] navigation;
- [ ] bloc chiffre principal;
- [ ] un filtre synchronisé dans l'URL;
- [ ] un graphique avec alternative tabulaire;
- [ ] une ligne d'offre;
- [ ] le panneau de preuves;
- [ ] un état de données partielles;
- [ ] le comportement mobile;
- [ ] le mode réduction des mouvements.

Cette tranche valide les tokens, la densité, le mouvement, les contrastes et les données avant duplication.

## 5. Fidélité contrôlée

- [ ] Les écarts majeurs de mise en page sont justifiés.
- [ ] Les mesures sont comparées sur les dimensions de référence.
- [ ] Le rendu est testé avec les contenus extrêmes définis dans Storybook.
- [ ] Les éléments interactifs possèdent un focus visible, même s'il n'est pas dessiné.
- [ ] Les animations de la maquette sont traduites en intentions, pas reproduites comme des vidéos figées.
- [ ] Les captures de comparaison n'utilisent pas de données fictives flatteuses uniquement.
- [ ] La hiérarchie reste claire à 200 % de zoom.

## 6. Validation

La maquette est considérée intégrée lorsque :

- [ ] le propriétaire produit valide la fidélité globale;
- [ ] le développeur valide la maintenabilité;
- [ ] les tests d'accessibilité automatisés et manuels passent;
- [ ] les budgets de performance passent;
- [ ] le produit fonctionne avec de vraies données et tous les états;
- [ ] les décisions nouvelles sont remontées dans le design system et non laissées en styles locaux.
