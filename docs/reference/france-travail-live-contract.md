# Contrat France Travail observé

**Observation :** 3 septembre 2026  
**Source :** documentation officielle France Travail et appels réels limités  
**Produit :** API Offres d'emploi v2.01

Ce document enregistre les faits nécessaires à l'adaptateur. Il ne contient ni identifiant client,
ni secret, ni jeton, ni contenu personnel issu d'une offre.

## Authentification

- flux : OAuth 2.0 Client Credentials ;
- endpoint : `POST https://entreprise.francetravail.fr/connexion/oauth2/access_token` ;
- query : `realm=/partenaire` ;
- content type : `application/x-www-form-urlencoded` ;
- scope confirmé : `api_offresdemploiv2 o2dsoffre` ;
- réponse réelle : HTTP 200, Bearer, expiration annoncée de 1 499 secondes.

## Recherche

- base : `https://api.francetravail.io/partenaire/offresdemploi` ;
- recherche : `GET /v2/offres/search` ;
- détail : `GET /v2/offres/{id}` ;
- pagination : paramètre `range=p-d`, 150 résultats maximum par plage ;
- borne documentée : index de départ au plus 3 000, index de fin au plus 3 149 ;
- résultat complet ou partiel : HTTP 200/206 avec `Content-Range: offres p-d/total` ;
- aucun résultat observé : HTTP 204 sans corps ni `Content-Range`, normalisé en page vide ;
- quota public annoncé : 10 appels/s. Le projet démarre volontairement à 5 appels/s.

Un appel limité réel `grandDomaine=M18`, `sort=1`, `range=0-4` a renvoyé HTTP 206,
cinq résultats et un total instantané de 7 895. Ce total est un diagnostic daté, pas un volume
produit ni une promesse de couverture.

## Payload observé

La racine contenait `resultats` et `filtresPossibles`. Les offres observées utilisaient notamment :

```text
id, intitule, description, dateCreation, dateActualisation,
lieuTravail, romeCode, romeLibelle, appellationlibelle,
entreprise, typeContrat, typeContratLibelle, natureContrat,
experienceExige, experienceLibelle, formations, competences,
salaire, dureeTravailLibelle, dureeTravailLibelleConverti,
alternance, contact, agence, nombrePostes, deplacementCode,
deplacementLibelle, qualificationCode, qualificationLibelle,
codeNAF, secteurActivite, secteurActiviteLibelle,
qualitesProfessionnelles, trancheEffectifEtab, origineOffre,
offresManqueCandidats, contexteTravail, entrepriseAdaptee,
employeurHandiEngage
```

Les champs sont optionnels selon l'offre : le premier résultat observé ne contenait par exemple
qu'un `commentaire` dans `salaire`. Le schéma source doit donc valider les champs réellement
nécessaires et accepter l'absence contrôlée des autres sans inventer une valeur.

Le smoke test de l'adaptateur a également observé `contexteTravail.horaires` sous forme de tableau
de chaînes, alors que le premier échantillon redacted le représentait comme une chaîne. Le schéma
accepte explicitement ces deux formes observées ; il ne les fusionne pas silencieusement dans le
modèle métier.

Un échantillon réel borné à 150 offres a confirmé les codes de contrat `CDI`, `CDD`, `MIS`
(intérim) et `SAI` (saisonnier). Le booléen `alternance` peut être vrai avec un contrat source
`CDD` et prévaut donc dans la normalisation. Les codes d'expérience observés sont `D` (débutant
accepté), `E` (expérience exigée) et `S` (expérience souhaitée). Une expérience souhaitée ne doit
jamais être transformée en exigence.

## Référentiels

- métiers ROME : `GET /v2/referentiel/metiers` ;
- réponse réelle : HTTP 200, `Content-Range: metiers */1911` ;
- payload réel : tableau de 1 911 objets dont les clés observées sont `code` et `libelle` ;
- les codes M18 utilisés dans le registre brouillon proviennent de cette réponse réelle.

Le smoke test applicatif du 3 septembre 2026 a validé avec le même adaptateur : authentification,
recherche d'une offre, lecture de son détail et chargement du référentiel. Il reste volontairement
exclu de la CI standard et ne s'exécute qu'avec les secrets serveur dédiés.

Un second probe borné du 4 septembre 2026 a observé quatre champs optionnels supplémentaires :
`accessibleTH` (booléen), `experienceCommentaire` (chaîne), ainsi que `langues` et `permis`
(tableaux d'objets dont les clés observées sont `libelle` et `exigence`). Ils sont validés dans
l'adaptateur et conservés uniquement dans la charge brute à durée de vie limitée ; ils ne changent
pas le modèle métier tant qu'une règle produit ne les utilise pas.

La collecte complète de validation du registre, le 4 septembre 2026, a aussi observé
`complementExercice` sous forme de chaîne et des réponses HTTP 204 sans corps pour les requêtes
vides. Ces deux formes font désormais partie du contrat source validé.

La recherche officielle précise aussi que plusieurs `motsCles` séparés par une virgule utilisent
un opérateur logique **ET**. Les synonymes « n'importe lequel » doivent donc devenir des requêtes
source séparées, puis être dédupliquées.

## Licence observée

La licence spécifique Offres d'emploi impose notamment :

- source France Travail et date de dernière mise à jour, avec lien vers la licence ;
- méthode ou fichier de modifications rendu accessible ;
- actualisation au moins toutes les 24 heures pour une réutilisation de rapprochement ;
- protection des contacts et minimisation des données personnelles ;
- stockage dans l'Union européenne ou un pays au niveau de protection équivalent ;
- après retrait d'une offre, anonymisation de la base dérivée en supprimant les informations
  d'entreprise, de contact, d'URL employeur et de localisation détaillée listées à l'article 7 ;
- aucune utilisation de logo sans accord exprès pour une finalité autre que le rapprochement.

Conséquence d'implémentation : le payload brut et les snapshots historiques ne doivent pas garder
indéfiniment les champs identifiants d'une offre retirée. La purge/anonymisation est un critère de
publication, pas une optimisation future.

## Liens officiels

- Documentation API : <https://francetravail.io/produits-partages/catalogue/offres-emploi/documentation#/>
- Client Credentials : <https://francetravail.io/produits-partages/documentation/utilisation-api-france-travail/client-credentials>
- Licence : <https://francetravail.io/produits-partages/documentation/conditions-dutilisation-api/licence-offres-emploi>
