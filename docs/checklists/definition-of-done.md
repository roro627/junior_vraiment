# Definition of Done

Une tâche n'est terminée que lorsque les points applicables ci-dessous sont satisfaits. Une démonstration visuelle ou un fonctionnement « sur ma machine » ne suffit pas.

## Produit et périmètre

- [ ] Le comportement correspond à la spécification produit et à la maquette validée.
- [ ] Les états nominal, chargement, vide, erreur, données partielles et faible échantillon sont traités.
- [ ] Le parcours fonctionne à la souris, au clavier et sur écran tactile.
- [ ] Les textes visibles respectent [`../12-CONTENT-COPY.md`](../12-CONTENT-COPY.md).
- [ ] Aucun nouveau comportement ou indicateur n'a été ajouté sans définition, dénominateur et critère d'acceptation.

## Données

- [ ] Toute donnée externe est validée à l'entrée par un schéma Zod.
- [ ] Les noms de champs propres à France Travail restent dans l'adaptateur source.
- [ ] Toute classification sensible possède au moins une preuve, un identifiant de règle et une version de classificateur.
- [ ] Les valeurs absentes restent absentes : elles ne deviennent pas `0`, `false` ou « non » par défaut.
- [ ] Le calcul produit le même résultat à entrée et version identiques.
- [ ] Les tests couvrent les accents, négations, plages d'années, souhaits, faux positifs de diplôme et contradictions.
- [ ] Une modification de règle ou de taxonomie déclenche le versionnement approprié et met à jour les jeux de référence.
- [ ] Aucun pourcentage n'est présenté lorsque l'échantillon est inférieur au seuil défini.

## Interface

- [ ] Le composant est construit avec les primitives et tokens du design system.
- [ ] Aucun style arbitraire ne contourne les tokens sans justification documentée.
- [ ] Le responsive a été vérifié au minimum à 320, 375, 768, 1024, 1440 et 1920 px.
- [ ] Les contenus longs, les nombres importants et les libellés français réels ne cassent pas le rendu.
- [ ] Les graphiques ont un titre, une unité, une légende utile et une alternative tabulaire.
- [ ] La couleur n'est jamais le seul vecteur d'information.
- [ ] Les zones interactives tactiles font au moins 44 × 44 px, sauf exception conforme et justifiée.

## Mouvement

- [ ] L'animation indique une continuité, une causalité ou un changement d'état réel.
- [ ] Elle utilise les tokens centralisés de durée, easing ou ressort.
- [ ] Elle privilégie `transform` et `opacity`; aucune animation de layout coûteuse n'est introduite sans mesure.
- [ ] Une interaction répétée ne crée pas de file d'animations.
- [ ] Le comportement avec `prefers-reduced-motion: reduce` est correct.
- [ ] L'interface reste entièrement utilisable sans animation.
- [ ] Les tests de performance ne montrent pas de régression mesurable sur l'appareil cible bas de gamme.

## Accessibilité

- [ ] La structure des titres et landmarks est cohérente.
- [ ] Le focus est visible, ordonné et jamais piégé.
- [ ] Les contrôles ont un nom accessible correspondant au libellé visible.
- [ ] Les changements asynchrones importants sont annoncés sans bruit excessif.
- [ ] Les menus, dialogues, listes, onglets et infobulles suivent les patrons ARIA appropriés.
- [ ] Les erreurs sont identifiables, expliquées et associées au contrôle concerné.
- [ ] axe ne remonte aucune violation critique ou sérieuse.
- [ ] Le parcours manuel clavier et lecteur d'écran prévu par la matrice de tests a été exécuté.

## Code

- [ ] TypeScript strict passe sans erreur et aucun `any` non justifié n'est ajouté.
- [ ] Les Server Components restent la valeur par défaut.
- [ ] Un composant client ne reçoit que les données nécessaires.
- [ ] Les responsabilités métier ne sont pas enfouies dans les composants React.
- [ ] Les noms expriment le domaine; les abstractions prématurées sont évitées.
- [ ] Lint, format, vérification de types et détection de dépendances inutilisées passent.
- [ ] Aucune dépendance n'est ajoutée lorsqu'une primitive de la plateforme ou un outil déjà présent suffit.
- [ ] Toute nouvelle dépendance est active, maintenue, compatible avec la stack et justifiée dans la pull request.

## Tests

- [ ] Les tests unitaires couvrent les branches métier introduites.
- [ ] Les tests d'intégration vérifient les frontières base/API/cache concernées.
- [ ] Un test Playwright couvre le parcours utilisateur modifié lorsque celui-ci est critique.
- [ ] Les fixtures sont synthétiques ou autorisées; aucun secret ni donnée personnelle ne se trouve dans le dépôt.
- [ ] Les tests sont déterministes et ne dépendent pas de l'API France Travail en direct.
- [ ] Les snapshots visuels modifiés ont été relus, pas seulement régénérés.

## Performance et cache

- [ ] Le budget JavaScript de la route concernée est respecté.
- [ ] Aucun `use client` n'a été remonté inutilement dans l'arbre.
- [ ] Le cache possède une stratégie explicite : clé, portée, durée et invalidation.
- [ ] La navigation filtre sans rechargement complet et préserve retour/avance.
- [ ] Les requêtes SQL critiques ont été inspectées avec des données réalistes.
- [ ] Les Web Vitals et la taille de bundle ne régressent pas au-delà des seuils de la CI.

## Sécurité et confidentialité

- [ ] Les entrées sont validées et les sorties sensibles sont réduites au strict nécessaire.
- [ ] Aucun secret n'est présent dans le code, les logs, fixtures, captures ou variables publiques.
- [ ] Les URL externes et redirections sont contrôlées.
- [ ] Les logs n'enregistrent ni description complète d'offre, ni jeton, ni identifiant personnel.
- [ ] Les événements analytiques appartiennent à la liste autorisée.
- [ ] Les en-têtes de sécurité et la politique CSP restent compatibles.
- [ ] La licence et l'attribution de la source sont respectées.

## Exploitation et documentation

- [ ] Une erreur opérationnelle nouvelle possède un log structuré ou une métrique exploitable.
- [ ] Les alertes évitent les faux positifs et pointent vers une action ou un runbook.
- [ ] Une migration de base possède un chemin de déploiement sûr et, lorsque nécessaire, de retour arrière.
- [ ] Les contrats, ADR, documentation ou changelog affectés ont été mis à jour.
- [ ] La pull request explique la motivation, les risques, les captures et la méthode de test.
- [ ] Le comportement est vérifié sur l'environnement de prévisualisation avant fusion.
