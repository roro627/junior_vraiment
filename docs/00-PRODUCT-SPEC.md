# 00 — Spécification produit

## 1. Vision

Le discours public sur l'emploi tech junior repose souvent sur des impressions : « il n'y a plus de postes juniors », « toutes les offres demandent trois ans », « telle technologie recrute davantage ». **Junior, vraiment ?** doit transformer ces affirmations en questions mesurables.

La vision est de devenir la référence française la plus claire pour comprendre les conditions réellement présentes dans les offres tech destinées aux profils débutants.

Le produit est réussi lorsqu'une personne peut :

1. découvrir un constat en quelques secondes ;
2. comprendre comment il a été calculé ;
3. l'explorer par métier, technologie ou territoire ;
4. vérifier les preuves ;
5. le partager sans déformer son sens.

---

## 2. Positionnement

### Catégorie

Observatoire public de données sur le recrutement tech.

### Promesse

> « Des chiffres actuels, une méthode ouverte et les offres derrière chaque conclusion. »

### Différence avec un job board

Un job board optimise la recherche et la candidature. L'observatoire optimise la compréhension du marché.

Le produit peut rediriger vers une offre, mais ne doit pas :

- recopier toute l'expérience de candidature ;
- classer les annonces selon une préférence personnelle ;
- vendre une mise en avant ;
- présenter une estimation comme une donnée officielle.

### Différence avec un article

Un article fige une analyse à une date. L'observatoire met à jour les données, garde l'historique et permet au lecteur de changer le périmètre.

### Différence avec un dashboard interne

Le produit doit raconter une histoire. Une visualisation n'est retenue que si elle répond à une question humaine précise.

---

## 3. Utilisateurs

## 3.1 Candidat junior

### Situation

- termine une formation ou possède moins de deux ans d'expérience ;
- cherche à évaluer ses chances ;
- lit des offres contradictoires ;
- compare plusieurs villes ou technologies ;
- dispose de peu de temps.

### Besoins

- savoir si « junior » signifie réellement débutant ;
- distinguer exigence et préférence ;
- voir des volumes, pas uniquement des pourcentages ;
- repérer les technologies demandées ;
- éviter les conclusions trop générales.

### Moment de valeur

L'utilisateur choisit « Développement mobile », « React Native » et « Lille », puis voit immédiatement le nombre d'offres, la part accessible et les exemples.

## 3.2 Développeur expérimenté / communauté tech

### Besoins

- vérifier une affirmation circulant sur LinkedIn ;
- comparer plusieurs périodes ;
- partager une visualisation crédible ;
- examiner la méthodologie.

### Moment de valeur

Il ouvre la preuve d'un chiffre, trouve la règle exacte et partage l'URL filtrée.

## 3.3 Recruteur / RH / entreprise

### Besoins

- comparer une formulation à la réalité observée ;
- comprendre pourquoi une annonce « junior + 3 ans » provoque des réactions ;
- améliorer la transparence salariale et le niveau attendu.

### Moment de valeur

Il consulte les tendances de sa famille de métiers et détecte une incohérence avant publication.

## 3.4 École, journaliste, créateur de contenu

### Besoins

- obtenir un chiffre daté ;
- citer la source et la méthode ;
- télécharger ou intégrer une carte ;
- éviter une capture d'écran sans contexte.

### Moment de valeur

Il ouvre un insight stable avec valeur, période, échantillon et lien de vérification.

---

## 4. Jobs-to-be-done

| Quand… | Je veux… | Afin de… |
|---|---|---|
| je vois une offre intitulée junior | savoir si ses attentes sont communes | remettre l'annonce en contexte |
| je choisis une stack | comparer la demande et l'accessibilité | orienter mon apprentissage |
| je prépare une recherche d'emploi | comparer plusieurs villes | choisir où concentrer mes candidatures |
| je lis une affirmation sur LinkedIn | retrouver les données | vérifier avant de repartager |
| je rédige une offre junior | voir les exigences habituelles | éviter une annonce incohérente |
| je publie un bilan | générer une carte sourcée | communiquer clairement |

---

## 5. Questions produit prioritaires

Le site doit répondre dans cet ordre :

1. **Combien d'offres sont réellement étudiées ?**
2. **Quelle part se présente comme junior ?**
3. **Quelle part de ces offres exige au moins deux ans ?**
4. **Quelle part accepte explicitement un débutant ?**
5. **Comment le chiffre évolue-t-il ?**
6. **Quelles offres produisent le résultat ?**
7. **Quelles phrases ont déclenché le classement ?**
8. **Quelles technologies, contrats et modalités reviennent ?**
9. **Le résultat change-t-il selon le métier ou la ville ?**
10. **Quelles sont les limites de l'analyse ?**

---

## 6. Architecture de l'information

```text
Accueil
├── Chiffre principal
├── Filtres
├── Tendances
├── Expérience
├── Salaire
├── Contrats
├── Technologies
├── Exemples vérifiables
└── Méthodologie courte

Explorer
├── Filtres détaillés
├── Résultats
├── Preuve d'une offre
└── Lien source

Insights
├── Histoire éditorialisée
├── Chiffre et comparaison
├── Méthode
├── Échantillon
└── Partage

Méthodologie
├── Source
├── Collecte
├── Périmètre
├── Classification
├── Calculs
├── Qualité
├── Versions
└── Limites

État des données
├── Fraîcheur
├── Exécutions
├── Couverture
├── Incidents
└── Version
```

---

## 7. Parcours critiques

## Parcours A — Comprendre sans filtrer

1. L'utilisateur arrive depuis LinkedIn.
2. Il voit une phrase d'accroche et le KPI France.
3. Il comprend le numérateur et le dénominateur.
4. Il lit une phrase d'interprétation prudente.
5. Il ouvre un exemple.
6. Il vérifie les preuves.
7. Il revient sans perdre sa position.

**Succès :** `evidence_opened` après `insight_viewed`, sans sortie immédiate.

## Parcours B — Explorer sa situation

1. L'utilisateur choisit une famille.
2. Il ajoute une technologie.
3. Il choisit une zone.
4. Les cartes se mettent à jour sans saut.
5. L'URL change.
6. Il ouvre l'explorer.
7. Les filtres sont conservés.

**Succès :** `filters_applied` puis `explorer_opened`.

## Parcours C — Partager

1. L'utilisateur trouve un résultat intéressant.
2. Il choisit « Partager ».
3. Un aperçu de la carte et du texte est présenté.
4. Il copie le lien ou ouvre le partage natif.
5. Le lien restitue le même résultat.

**Succès :** `share_link_copied` ou `share_clicked`.

## Parcours D — Vérifier la méthode

1. L'utilisateur clique sur le badge « Méthode v1.x ».
2. Il voit une définition courte en contexte.
3. Il peut ouvrir le détail complet.
4. Il retrouve un exemple de règle et les exclusions.

**Succès :** compréhension sans devoir lire tout le document.

---

## 8. Contenu de l'accueil

### Hero

Contient :

- nom ;
- promesse ;
- fraîcheur ;
- KPI principal ;
- échantillon ;
- action explorer ;
- filtre principal.

Le hero ne doit pas contenir un grand visuel décoratif qui repousse le chiffre sous la ligne de flottaison.

### Interprétation

Format recommandé :

> « Sur les offres se présentant explicitement comme junior et classables dans ce périmètre, **X sur Y** demandent au moins deux ans d'expérience. »

Ne jamais écrire :

> « X % des entreprises mentent sur leurs offres junior. »

Le produit mesure des annonces, pas l'intention d'une entreprise.

### Tendance

Répond à :

> « Est-ce mieux ou pire qu'il y a un mois ? »

Afficher l'évolution absolue en points, pas uniquement un pourcentage relatif.

### Preuves

Trois exemples :

- une contradiction nette ;
- une offre réellement débutant ;
- un cas ambigu.

Ce choix montre que la méthode ne cherche pas uniquement les résultats sensationnels.

---

## 9. Priorisation

### Must — lancement

- collecte France Travail ;
- normalisation et historique ;
- classificateur déterministe ;
- KPI principal ;
- filtres famille, technologie, territoire ;
- tendances ;
- explorer ;
- preuves ;
- méthodologie ;
- statut des données ;
- cartes sociales ;
- analytics essentiels ;
- accessibilité et tests.

### Should — après stabilité

- comparateur de deux périmètres ;
- pages SEO par technologie et ville ;
- salaire médian lorsque suffisamment structuré ;
- rapport mensuel ;
- export CSV agrégé ;
- mécanisme de correction public ;
- intégration d'une deuxième source autorisée.

### Could — croissance

- alertes de changement ;
- widget intégrable ;
- newsletter mensuelle ;
- API publique versionnée ;
- cartes régionales ;
- historique annuel ;
- édition communautaire des taxonomies avec revue.

### Won't — horizon initial

- comptes ;
- CV ;
- coaching ;
- scoring d'entreprises ;
- annonces sponsorisées ;
- chat IA ;
- recrutement ou mise en relation.

---

## 10. Métrique nord

La métrique nord n'est pas le nombre brut de pages vues.

> **Nombre hebdomadaire de sessions ayant effectué au moins une action de compréhension ou vérification.**

Une session qualifiée comporte au moins l'un de ces événements :

- changement de filtre ;
- ouverture d'une preuve ;
- ouverture de la méthodologie ;
- consultation de l'explorer ;
- partage ;
- ouverture de l'offre source.

Cette métrique récompense un produit utile, pas un titre trompeur.

---

## 11. Métriques produit

### Acquisition

- visiteurs uniques ;
- référents LinkedIn, GitHub, recherche ;
- vues d'insight ;
- taux d'ouverture depuis une carte sociale.

### Activation

- part des sessions comprenant le KPI et poursuivant une action ;
- temps jusqu'au premier filtre ;
- taux d'ouverture d'une preuve ;
- taux de passage accueil → explorer.

### Engagement

- nombre de filtres appliqués ;
- profondeur d'exploration ;
- comparaisons ;
- cartes partagées ;
- retours à 7 et 30 jours.

### Confiance

- part des sessions ouvrant la méthodologie ;
- signalements valides ;
- corrections publiées ;
- disponibilité des données ;
- taux d'offres avec preuve complète.

### Réputation / buzz

- clics de partage ;
- trafic référent LinkedIn ;
- backlinks ;
- mentions publiques suivies manuellement ;
- forks/stars GitHub si dépôt public ;
- citations par des médias ou écoles.

Ne pas prétendre mesurer les impressions LinkedIn si la plateforme ne les fournit pas au projet.

---

## 12. Garde-fous éditoriaux

Le potentiel viral ne doit jamais primer sur l'exactitude.

Interdits :

- classement nominatif d'entreprises sur un échantillon insuffisant ;
- titre accusatoire ;
- généralisation « le marché français » à partir d'une sous-requête ;
- suppression de la marge d'incertitude ;
- comparaison de périodes de couverture différente sans avertissement ;
- carte sociale sans date ;
- arrondi qui change le sens ;
- sélection manuelle d'exemples comme si elle représentait tout le jeu.

Autorisé :

- titre direct ;
- contraste visuel fort ;
- comparaison surprenante ;
- formulation interrogative ;
- chiffre majeur, à condition de rendre sa méthode immédiatement accessible.

---

## 13. Risques produit

| Risque | Impact | Réponse |
|---|---|---|
| trop peu d'offres sur un filtre | résultat instable | seuil d'échantillon, élargissement suggéré |
| API source indisponible | données périmées | historique, statut, retries, alerte |
| classification contestée | perte de confiance | preuves, versions, cas ambigu, jeu de vérité |
| concurrence d'un job board | dilution | rester focalisé sur l'observation |
| interface trop « dashboard » | faible partage | narration et insights éditorialisés |
| animations excessives | lenteur / inconfort | tokens, reduced motion, budget |
| accusation envers une entreprise | risque réputationnel | parler de formulations d'offres, pas d'intention |
| changement du schéma source | ingestion cassée | adapter, validation, quarantaine |
| biais du périmètre | conclusions trompeuses | couverture et limites visibles |
| faible renouvellement LinkedIn | projet oublié | rapport mensuel et insights récurrents |

---

## 14. Hypothèses à valider

| Hypothèse | Test |
|---|---|
| le KPI « junior + 2 ans » attire l'attention | post prototype avec carte statique |
| les utilisateurs veulent vérifier les exemples | mesurer `evidence_opened` |
| trois filtres suffisent au premier usage | tests utilisateurs |
| le public comprend « offres classables » | test de compréhension sans explication |
| le format ville × technologie produit assez de données | analyse de couverture |
| les cartes sociales entraînent des visites | UTM + référent |
| une mise à jour quotidienne est utile | retour à 7 jours et comparaison hebdo |

---

## 15. Recherche utilisateur minimale

Avant le design final :

- 3 candidats juniors ;
- 2 développeurs expérimentés ;
- 2 recruteurs ;
- 1 personne travaillant en école ou média.

Tâches :

1. expliquer le KPI avec leurs mots ;
2. filtrer sur une situation ;
3. trouver pourquoi une offre est classée ;
4. identifier la date des données ;
5. partager un résultat ;
6. dire ce qui leur semble contestable.

Le développement peut commencer avant ces tests sur la couche données, mais la page d'accueil ne doit pas être figée avant leur réalisation.

---

## 16. Stratégie de contenu de lancement

Le produit doit pouvoir produire au moins six publications sans nouvelle fonctionnalité :

1. résultat France ;
2. Lille contre Paris ;
3. React contre Java ;
4. frontend contre mobile ;
5. transparence salariale ;
6. évolution après 30 jours.

Chaque publication renvoie vers un insight stable et non vers une capture isolée.

---

## 17. Définition d'une expérience « niveau produit Apple »

Cette expression ne signifie pas copier Apple ni multiplier les effets visuels.

Elle signifie :

- hiérarchie évidente ;
- interaction prévisible ;
- réponse immédiate ;
- continuité entre états ;
- typographie soignée ;
- détails cohérents ;
- absence de bruit ;
- excellente sensation tactile ;
- performance réelle ;
- accessibilité ;
- animations discrètes et intentionnelles.

Le produit doit sembler calme, solide et précis. Une animation qui attire davantage l'attention que la donnée est probablement mauvaise.
