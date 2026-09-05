# 08 — Sécurité, confidentialité et cadre de réutilisation

## 1. Périmètre

Le MVP est un site public sans compte utilisateur et sans écriture publique. Cela réduit la surface, mais ne supprime pas les risques :

- secrets d'API ;
- payloads externes malveillants ;
- dépendances ;
- endpoints coûteux ;
- injection ;
- publication de données incorrectes ;
- exposition de coordonnées présentes dans les offres ;
- analytics ;
- licences.

---

## 2. Actifs à protéger

| Actif | Risque |
|---|---|
| client ID / secret France Travail | usage abusif, quota |
| URL PostgreSQL | lecture/écriture du dataset |
| clés Trigger.dev | exécution de tâches |
| DSN et jetons Sentry | altération ou fuite |
| clé PostHog | faible secret côté client, configuration à protéger |
| endpoint de revalidation | invalidation abusive |
| intégrité des métriques | atteinte à la crédibilité |
| payload brut | coordonnées ou texte non nécessaire |
| pipeline de déploiement | code malveillant |
| domaine | phishing et perte de confiance |

---

## 3. Modèle de menace simplifié

### Source externe compromise ou inattendue

Un texte d'offre peut contenir du HTML, des liens ou des séquences conçues pour casser le rendu.

Réponse :

- traiter toute donnée comme texte ;
- validation ;
- encodage ;
- allowlist des liens ;
- `rel="noopener noreferrer"` ;
- URL protocoles `https:` ou `http:` seulement ;
- pas de `dangerouslySetInnerHTML`.

### Attaquant sur les endpoints

Réponse :

- validation et bornes ;
- cache ;
- timeout ;
- pagination ;
- aucun paramètre SQL brut ;
- rate limiting conditionnel ;
- CSP.

### Supply chain

Réponse :

- versions exactes ;
- lockfile ;
- scripts de dépendances contrôlés ;
- Renovate ;
- alertes GitHub ;
- CodeQL ;
- mise à jour rapide React/Next.js ;
- revue des nouveaux paquets.

### Mauvais dataset publié

Réponse :

- version immuable ;
- quality gate ;
- bascule atomique ;
- rollback ;
- incident public ;
- audit.

---

## 4. Secrets

### Règles

- jamais dans Git ;
- jamais préfixés `NEXT_PUBLIC_` sauf clé réellement publique ;
- variables différentes par environnement ;
- accès minimal ;
- rotation documentée ;
- masquage logs ;
- aucun secret dans une URL ;
- aucun secret dans les erreurs Sentry ;
- `.env.local` ignoré.

### Validation

Un module unique :

```ts
const serverEnv = ServerEnvSchema.parse(process.env);
```

Aucun autre fichier n'accède directement à `process.env`.

### Rotation

Tableau à compléter en production :

| Secret | Propriétaire | Rotation | Procédure |
|---|---|---|---|
| France Travail | mainteneur | incident / périodique | portail + redéploiement worker |
| PostgreSQL | mainteneur | incident | nouveau rôle/secret |
| Trigger.dev | mainteneur | incident | dashboard + rotation |
| revalidation HMAC | mainteneur | 90 jours | double-clé temporaire |
| Sentry auth | mainteneur | incident | dashboard |
| PostHog | mainteneur | incident | dashboard |

---

## 5. Authentification et administration

Pas d'administration publique dans le MVP.

Les tâches manuelles utilisent :

- dashboard fournisseur protégé ;
- authentification forte ;
- ou endpoint interne protégé par signature et contrôle d'accès plateforme.

Ne pas construire un back-office avant besoin. Un back-office augmente fortement la surface et impose une authentification complète.

---

## 6. Validation des entrées

Valider :

- search params ;
- JSON ;
- headers internes ;
- variables d'environnement ;
- payload source ;
- slugs ;
- curseurs ;
- redirections ;
- URL externes.

Bornes :

```text
query string totale
nombre de technologies
limit
période
longueur d'un slug
nombre de tags à revalider
taille d'un payload interne
```

Les curseurs sont signés ou opaques et validés. Ne pas décoder un JSON arbitraire fourni par le client sans signature.

---

## 7. Base

- TLS ;
- rôle runtime lecture principalement ;
- rôle worker écriture ;
- rôle migration séparé si possible ;
- pas de superuser ;
- prepared statements via driver/ORM ;
- timeout ;
- IP/access controls selon offre ;
- sauvegardes chiffrées par fournisseur ;
- audit des opérations de publication ;
- pas de payload brut dans les vues publiques.

---

## 8. Headers

Configuration attendue, à tester avec l'hébergement :

```text
Strict-Transport-Security
Content-Security-Policy
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy
Cross-Origin-Opener-Policy selon compatibilité
```

### CSP initiale

Construire une allowlist minimale :

- `self` ;
- scripts Next.js/Vercel nécessaires ;
- Sentry ;
- PostHog EU si activé ;
- aucune source générique `*` ;
- `object-src 'none'` ;
- `base-uri 'self'` ;
- `frame-ancestors 'none'` ou politique d'embed future ;
- nonce si la configuration le permet.

Ne pas affaiblir la CSP pour corriger rapidement un widget.

---

## 9. URL et redirections

Les liens d'offre viennent de la source.

Avant affichage :

- parse via `URL` ;
- protocoles autorisés ;
- pas de `javascript:` ;
- label « Ouvrir l'offre source » ;
- nouvel onglet facultatif, clairement annoncé ;
- `noopener noreferrer`.

Aucune route `redirect?url=` ouverte.

---

## 10. Journalisation

Logger structuré avec :

```text
timestamp
level
service
environment
release
run_id
request_id
event
counts
duration
```

Redaction :

- secrets ;
- authorization ;
- URL de base contenant credentials ;
- e-mail ;
- téléphone ;
- description complète ;
- jeton ;
- payload brut.

Un extrait de preuve peut être stocké en base pour la fonction produit, mais n'est pas envoyé dans les logs.

---

## 11. Sentry

Avant envoi :

- `beforeSend` redaction ;
- pas de request body pour endpoints sensibles ;
- pas de cookies ;
- pas de texte d'offre ;
- échantillonnage ;
- environnements séparés ;
- suppression des données conforme à la politique.

Tester une erreur synthétique et inspecter réellement l'événement reçu.

---

## 12. Analytics et vie privée

### MVP

- aucune authentification ;
- aucun profil ;
- pas de replay ;
- pas d'autocapture ;
- pas de texte libre ;
- événements manuels ;
- paramètres allowlistés ;
- région UE ;
- politique publique.

### Données autorisées

```text
route_name
insight_slug
job_family
technology_slugs limités
area_level
contract_count
action
referrer_category
dataset_version
```

### Données interdites

```text
description
company_name dans analytics
external_offer_id
email
phone
raw URL query
clipboard content
IP ajoutée par le code
fingerprint maison
```

La configuration fournisseur peut traiter des données techniques par défaut. Le responsable doit vérifier les obligations RGPD, contrat de sous-traitance, durée et consentement au moment du lancement.

---

## 13. Offres et données personnelles

Les annonces peuvent contenir les coordonnées d'un recruteur. Le produit n'en a pas besoin.

Règle :

- ne pas exposer les contacts dans le modèle public ;
- ne pas les indexer ;
- limiter la rétention brute ;
- permettre une correction/suppression lorsque juridiquement nécessaire ;
- renvoyer vers la source pour candidater.

---

## 14. Licence et attribution

Avant lancement, conserver dans le dépôt :

```text
DATA_SOURCES.md
LICENSE
PRIVACY.md
```

`DATA_SOURCES.md` doit inclure :

- producteur ;
- nom de l'API ;
- lien ;
- licence ;
- conditions ;
- date de consultation ;
- attribution affichée ;
- politique de cache/rétention ;
- restrictions éventuelles.

Le code peut être MIT. Cela ne relicencie pas les données.

### Attribution UI

Dans le footer et la méthodologie :

> « Données d'offres issues de France Travail et de partenaires participants, selon le périmètre décrit. Observatoire indépendant et non affilié à France Travail. »

Le libellé final doit être confronté aux conditions exactes du portail lors de l'obtention de l'accès.

---

## 15. Noms d'entreprise

Le projet peut afficher l'entreprise lorsqu'elle est fournie et que la licence le permet, mais :

- pas de score moral ;
- pas de classement accusatoire au MVP ;
- pas de logo récupéré sans droit ;
- pas d'agrégation nominative sur faible volume ;
- droit de correction ;
- date et preuve.

Une analyse par entreprise est une fonctionnalité future nécessitant revue juridique et méthodologique.

---

## 16. Politique de correction

En cas d'erreur :

- corriger la règle ;
- garder l'audit ;
- recalculer ;
- indiquer la correction ;
- ne pas supprimer silencieusement une publication importante ;
- répondre factuellement ;
- préserver la preuve autorisée.

---

## 17. Dépendances et correctifs

### Cadence

- sécurité critique : analyse immédiate, objectif 24 h ;
- sécurité élevée : 72 h ;
- patchs courants : hebdomadaire ;
- majors : ADR ou PR dédiée.

### Réaction React/Next.js

Les versions React Server Components ont connu des avis de sécurité. Le projet doit :

- suivre les canaux officiels ;
- ne pas rester sur une version vulnérable ;
- automatiser les alertes ;
- reconstruire et redéployer après patch ;
- vérifier les previews et Storybook.

---

## 18. CI sécurité

- secret scanning ;
- dependency review ;
- CodeQL ;
- lockfile diff ;
- build ;
- tests ;
- audit des headers sur preview ;
- scan de licence optionnel ;
- blocage d'un paquet provenant d'une source non standard.

Les résultats sont examinés ; un audit automatique n'est pas une preuve absolue de sécurité.

---

## 19. Réponse à incident

### Sévérités

| Niveau | Exemple |
|---|---|
| SEV-1 | fuite de secret/base, compromission |
| SEV-2 | métrique massivement fausse publiée |
| SEV-3 | ingestion interrompue, données périmées |
| SEV-4 | bug limité sans risque de données |

### Étapes

1. contenir ;
2. révoquer/rotater ;
3. rollback ;
4. préserver les preuves ;
5. évaluer l'impact ;
6. informer si nécessaire ;
7. corriger ;
8. post-mortem ;
9. action préventive.

### Intégrité de données

Un incident méthodologique est traité avec autant de sérieux qu'une panne : le produit repose sur la confiance.

---

## 20. Checklist avant lancement

- [ ] conditions de l'API relues ;
- [ ] attribution validée ;
- [ ] licence du code ajoutée ;
- [ ] politique de confidentialité publiée ;
- [ ] variables scannées ;
- [ ] CSP testée ;
- [ ] headers testés ;
- [ ] rôles de base minimaux ;
- [ ] Sentry redaction inspectée ;
- [ ] PostHog configuré sans autocapture/replay ;
- [ ] données de contact exclues ;
- [ ] endpoint interne signé ;
- [ ] rotation testée ;
- [ ] rollback dataset testé ;
- [ ] sauvegarde restaurée ;
- [ ] alertes GitHub actives ;
- [ ] procédure de signalement publiée.
