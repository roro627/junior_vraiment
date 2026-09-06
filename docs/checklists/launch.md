# Checklist de lancement public

Le lancement n'est autorisé que lorsque chaque bloc obligatoire est validé. Les éléments différés doivent être explicitement classés hors MVP, pas laissés dans un état ambigu.

## Produit

- [ ] Les routes `/`, `/explorer`, `/methodologie`, `/a-propos`, `/statut-donnees` et un `/insights/[slug]` fonctionnent.
- [ ] Le chiffre principal répond à la question fondatrice sans jargon.
- [ ] L'utilisateur peut passer du chiffre aux offres et aux preuves.
- [ ] Les filtres métier, technologie, territoire et période sont partageables par URL.
- [ ] Le retour navigateur restaure correctement les filtres et la position utile.
- [ ] Les états faible échantillon, données partielles, anciennes et indisponibles sont explicites.
- [ ] Le site ne se présente jamais comme exhaustif de tout le marché français.
- [ ] Aucun compte, paiement ou candidature interne n'apparaît dans le MVP.

## Données et crédibilité

- [ ] L'accès de production à l'API France Travail est autorisé et fonctionnel.
- [ ] La licence et les conditions de réutilisation ont été relues à la date du lancement.
- [ ] La source et la date de mise à jour sont visibles à proximité des chiffres.
- [ ] La méthodologie publique correspond exactement au code déployé.
- [ ] Le classificateur est figé dans une version évaluée et documentée (actuellement `classifier-1.2.0`).
- [ ] Un jeu annoté de référence et ses résultats sont conservés.
- [ ] La passe LLM A de référence permet d'évaluer et d'atteindre les seuils retenus.
- [ ] Au moins sept collectes quotidiennes cohérentes ont validé la chaîne complète.
- [ ] La page de statut signale les échecs et la couverture réelle.
- [ ] Le rollback vers le jeu précédent a été testé.

## Design et expérience

- [ ] La maquette validée est intégrée avec des contenus réels.
- [ ] Les animations sont cohérentes, interruptibles et non décoratives.
- [ ] `prefers-reduced-motion` supprime les déplacements non essentiels.
- [ ] Aucun layout shift visible n'est introduit par graphiques, polices ou skeletons.
- [ ] Le site reste lisible à 200 % de zoom et à 320 px de largeur.
- [ ] Les tableaux restent utilisables sur mobile sans masquer l'information essentielle.
- [ ] Les erreurs donnent une action possible et ne culpabilisent pas l'utilisateur.

## Accessibilité

- [ ] L'objectif WCAG 2.2 niveau AA est vérifié.
- [ ] Les parcours accueil → filtre → offre → preuve → source passent au clavier.
- [ ] Les principaux parcours ont été contrôlés avec NVDA + Firefox/Chrome et VoiceOver + Safari lorsque disponible.
- [ ] Les graphiques ont une alternative textuelle ou tabulaire équivalente.
- [ ] Les contrastes texte, contrôles, focus et graphiques passent les seuils.
- [ ] Aucun résultat critique/sérieux axe ne subsiste.
- [ ] Les animations, annonces live et dialogues ont été testés avec technologies d'assistance.

## Performance

- [ ] Les objectifs p75 sont atteints sur données de terrain ou, avant volume suffisant, sur tests représentatifs : LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1.
- [ ] Le JavaScript initial de la page d'accueil respecte le budget fixé.
- [ ] Les graphiques et l'explorateur sont chargés uniquement lorsqu'ils sont utiles.
- [ ] Les images Open Graph, polices et assets possèdent cache et dimensions.
- [ ] Une connexion mobile lente et un appareil Android médian ont été testés.
- [ ] Le cache et son invalidation ont été testés après publication d'un dataset.

## Sécurité et vie privée

PostHog est différé hors MVP par [ADR 0010](../adr/0010-defer-product-analytics.md).
Pour ce lancement, vérifier son inactivité ; les contrôles de consentement et de collecte
PostHog seront requis avant toute activation. Les autres contrôles restent obligatoires.

- [ ] Le modèle de menace a été relu.
- [ ] La CSP et les en-têtes de sécurité sont actifs en production.
- [ ] Les secrets sont exclusivement dans le gestionnaire d'environnement.
- [ ] Les routes internes de collecte sont authentifiées et non devinables par simple URL.
- [ ] Le rate limiting des endpoints publics est actif.
- [ ] Les dépendances ne comportent aucune vulnérabilité critique connue non traitée.
- [ ] Les logs, Sentry et PostHog ne collectent aucun contenu interdit.
- [ ] Le consentement analytics et les mentions légales ont reçu une revue adaptée au contexte réel.
- [ ] Le contact sécurité et la procédure de signalement fonctionnent.

## SEO, partage et contenu

- [ ] Les titres, descriptions, canonical, sitemap et robots sont corrects.
- [ ] Les pages de filtres combinatoires inutiles ne créent pas d'indexation infinie.
- [ ] Les cartes Open Graph sont nettes à 1200 × 630 et affichent date, périmètre, valeur et échantillon.
- [ ] Un partage LinkedIn ne divulgue ni paramètre interne ni donnée non publiée.
- [ ] Les textes de lancement distinguent observation, interprétation et opinion.
- [ ] Les claims sont reproduisibles à partir d'une URL publique et d'une version de dataset.
- [ ] Les contenus d'exemple ont été remplacés par des chiffres validés.

## Exploitation

- [ ] Production, prévisualisation et local sont séparés.
- [ ] Les sauvegardes de base et la restauration ont été testées.
- [ ] Les alertes couvrent collecte échouée, données anciennes, schéma source changé, publication échouée et erreur web élevée.
- [ ] Les runbooks sont accessibles au mainteneur.
- [ ] Le tableau de bord de supervision utilise les bons seuils.
- [ ] Le domaine, HTTPS, DNS et redirections sont vérifiés.
- [ ] La procédure d'incident et le mode maintenance ont été testés.
- [ ] Un responsable et un canal sont définis pour chaque alerte.

## Validation finale

- [ ] Une revue produit complète a été faite sur production candidate.
- [ ] Une revue méthodologique complète a été faite sur le dataset candidat.
- [ ] Une revue technique n'a identifié aucun blocage.
- [ ] Le propriétaire du projet accepte explicitement les limites documentées.
- [ ] Le tag de version, le changelog et le commit de lancement sont identifiables.
