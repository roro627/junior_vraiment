# Sources de données

## France Travail — API Offres d'emploi

**Statut :** accès technique réel vérifié le 3 septembre 2026 ; conditions de réutilisation et texte juridique final encore à valider avant lancement public.

- Producteur : France Travail
- Service : API Offres d'emploi
- Catalogue : https://www.data.gouv.fr/dataservices/api-offres-demploi
- Portail : https://francetravail.io/produits-partages/catalogue/offres-emploi
- Usage : recherche d'offres actives, détails et référentiels
- Fréquence prévue : quotidienne
- Attribution : visible dans le produit
- Périmètre : requêtes versionnées dans le dépôt
- Rétention brute proposée : 90 jours, à confirmer selon conditions
- Données publiques dérivées : agrégats, classifications avec extraits nécessaires, offres normalisées limitées

Le registre publié est versionné dans [`docs/reference/query-set.json`](./docs/reference/query-set.json). L’authentification, les champs observés, la pagination, les volumes et l’ingestion complète ont été vérifiés sur l’API réelle. Cette validation technique ne remplace pas la confirmation juridique des conditions de réutilisation.

## Actions avant lancement

- [x] créer le compte développeur ;
- [ ] accepter et archiver les conditions ;
- [ ] confirmer la licence ;
- [ ] confirmer les exigences d'attribution ;
- [ ] confirmer la rétention et la republication permises ;
- [x] confirmer les champs et la pagination sur le schéma actif ;
- [x] renseigner la date de validation technique : 3 septembre 2026 ;
- [ ] renseigner le contact ;
- [ ] adapter la politique de suppression ;
- [ ] valider le texte du footer.

## Deuxième source

Aucune deuxième source n'est incluse au MVP. Elle nécessitera :

- droit de réutilisation ;
- adaptateur ;
- identité ;
- déduplication inter-source ;
- couverture ;
- qualité ;
- nouvelle version de méthode.
