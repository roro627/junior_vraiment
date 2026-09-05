# 05 — Base de données

## 1. Choix

- PostgreSQL 18.x ;
- schéma géré par Drizzle ;
- migrations SQL versionnées ;
- fournisseur initial Neon ;
- UTC en stockage ;
- `jsonb` uniquement lorsque la structure source ou la dimension est réellement flexible ;
- contraintes de base considérées comme une protection, pas uniquement le typage TypeScript.

Le schéma SQL de référence est dans [`reference/schema.sql`](./reference/schema.sql).

---

## 2. Concepts

### Source

Décrit un fournisseur de données et son attribution.

### Requête source

Décrit un fragment du périmètre de collecte. Une offre peut être trouvée par plusieurs requêtes.

### Run d'ingestion

Représente une exécution et sa qualité.

### Offre

Identité stable chez une source.

### Snapshot

Version du contenu pertinent d'une offre.

### Classification

Résultat versionné appliqué à un snapshot.

### Preuve

Élément textuel ou structuré expliquant une classification.

### Technologie

Taxonomie versionnée et relation plusieurs-à-plusieurs.

### Agrégat journalier

Valeur calculée pour une combinaison de dimensions et une version de dataset.

### Dataset publié

Version cohérente actuellement exposée au public.

### Insight

Snapshot éditorialisé et partageable d'un résultat.

---

## 3. Identifiants

Utiliser des UUID v7 si la bibliothèque et PostgreSQL choisis le supportent proprement ; sinon `gen_random_uuid()`.

Les identifiants publics ne doivent pas exposer un entier séquentiel utile à l'énumération.

Pour les slugs d'insight :

```text
react-lille-junior-2026-09
```

Le slug est humain, mais la clé interne reste un UUID.

---

## 4. Tables principales

```text
sources
source_queries
ingestion_runs
ingestion_run_queries
offers
offer_query_matches
offer_snapshots
classifications
classification_evidence
technologies
technology_aliases
offer_snapshot_technologies
published_datasets
daily_metrics
data_quality_events
insights
```

---

## 5. Contraintes essentielles

### `offers`

```text
UNIQUE(source_id, external_id)
CHECK(first_seen_at <= last_seen_at)
```

### `offer_snapshots`

```text
UNIQUE(offer_id, content_hash)
CHECK(valid_to IS NULL OR valid_to >= valid_from)
```

Un seul snapshot courant par offre via index unique partiel :

```sql
CREATE UNIQUE INDEX ... ON offer_snapshots(offer_id)
WHERE valid_to IS NULL;
```

### `classifications`

```text
UNIQUE(snapshot_id, classifier_version)
```

### `classification_evidence`

Chaque classification positive doit posséder au moins une preuve. Cette règle est contrôlée au niveau applicatif/transaction et par audit, car une contrainte SQL inter-table simple ne suffit pas.

### `daily_metrics`

Clé logique :

```text
dataset_version
metric_key
metric_version
period_start
period_end
dimension_hash
```

Le JSON de dimensions doit être canonisé avant hachage.

### `insights`

Un insight éditorialisé fige le dataset, la version de métrique, les filtres, les volumes, la couverture et `sample_quality`. Il ne peut pas être publié avec une valeur non nulle lorsque `sample_quality=insufficient`. Une correction crée une trace (`previous_snapshot`, `correction_note`, dates) au lieu de réécrire silencieusement le chiffre historique.

---

## 6. Modèle de snapshot

Un snapshot est créé uniquement si `content_hash` change.

Le hash porte sur un objet canonique :

```ts
const hashInput = {
  title,
  descriptionText,
  companyName,
  location,
  contract,
  structuredExperience,
  salary,
  applicationUrl,
  sourceUpdatedAt,
};
```

Ne pas inclure :

- date du run ;
- ordre des clés ;
- champs de télémétrie ;
- payload inconnu sans effet métier.

Le payload brut peut être différent sans créer de snapshot si aucun champ métier ne change. Conserver alors un événement de schéma si nécessaire.

---

## 7. Historique

### Offre

```text
first_seen_at
last_seen_at
closed_at
reopened_at, optionnel ou événements séparés
```

### Snapshot

```text
valid_from
valid_to
source_published_at
source_updated_at
ingestion_run_id
```

### Classification

Immuable pour :

```text
snapshot_id + classifier_version
```

Une reclassification crée une nouvelle ligne, jamais un `UPDATE` qui efface l'ancienne version.

---

## 8. Dataset publié

La table `published_datasets` contient :

```text
id
dataset_version
classifier_version
query_set_version
taxonomy_versions
source_cutoff_at
computed_at
published_at
status
is_current
quality_summary
```

Bascule :

```sql
BEGIN;
UPDATE published_datasets SET is_current = false WHERE is_current = true;
UPDATE published_datasets SET is_current = true, published_at = now()
WHERE dataset_version = $1;
COMMIT;
```

Un index unique partiel garantit une seule version courante.

---

## 9. Agrégats

### Grain

Une ligne par :

```text
dataset_version
metric
période
dimensions canoniques
```

Exemple :

```json
{
  "job": "mobile",
  "tech": ["react-native"],
  "area": "commune:59350",
  "contract": ["cdi"]
}
```

### Colonnes

```text
numerator
denominator
population_count
unknown_count
ambiguous_count
value_numeric
coverage_numeric
sample_quality
metadata
```

Ne stocker `value_numeric` et `coverage_numeric` que pour faciliter la lecture. À chaque écriture, recalculer et valider les invariants suivants :

```text
numerator <= denominator <= population_count
population_count = denominator + unknown_count + ambiguous_count
value_numeric = numerator / denominator si denominator > 0 et sample_quality != insufficient ; sinon null
coverage_numeric = denominator / population_count, ou null si population_count = 0

`sample_quality` vaut `insufficient`, `caution` ou `normal` selon le dénominateur résolu. La qualité globale de collecte reste portée par `published_datasets.quality_summary` et par les événements de qualité ; elle ne doit pas être confondue avec la taille de l’échantillon.
```

### Dimensions

Utiliser des colonnes dédiées pour les dimensions les plus filtrées :

```text
job_family
technology_slug
region_code
department_code
commune_code
contract_kind
remote_mode
```

Le JSONB reste pour une combinaison ou métadonnée secondaire. Cela permet des index efficaces.

---

## 10. Index initiaux

### Offres

```text
(source_id, external_id)
(last_seen_at DESC)
(closed_at) WHERE closed_at IS NULL
```

### Snapshots

```text
(offer_id, valid_from DESC)
(content_hash)
(source_published_at DESC)
```

### Classification

```text
(classifier_version, contradictory_junior)
(classifier_version, claims_junior)
(classifier_version, minimum_experience_months)
(snapshot_id, classifier_version)
```

### Géographie

```text
(region_code)
(department_code)
(commune_code)
```

### Technologies

```text
(technology_id, snapshot_id)
(snapshot_id, technology_id)
```

### Explorer

Index composite à déterminer à partir des requêtes réelles, par exemple :

```text
(classifier_version, job_family, commune_code, source_published_at DESC)
```

Ne pas créer toutes les combinaisons imaginables. Activer `pg_stat_statements` si disponible et mesurer.

---

## 11. Recherche textuelle

Hors cœur du MVP. Si ajoutée :

1. colonne `tsvector` pour titre + description ;
2. configuration française ;
3. index GIN ;
4. trigramme pour titres ou entreprise ;
5. requêtes bornées ;
6. surlignage sûr.

Ne pas installer un moteur de recherche externe avant d'avoir mesuré les limites de PostgreSQL.

---

## 12. Connexions

### Runtime Vercel

- URL poolée ;
- nombre de connexions faible ;
- requêtes courtes ;
- timeout ;
- transactions courtes.

### Migrations

- URL directe si recommandée ;
- exécution unique dans CI ou étape contrôlée ;
- jamais à chaque démarrage d'instance.

### Trigger.dev

- pooling adapté à la durée des tâches ;
- transactions par lot ;
- pas de connexion globale supposée éternelle ;
- reprise après erreur.

---

## 13. Migrations

Convention :

```text
0001_initial_schema.sql
0002_add_dataset_publication.sql
0003_add_evidence_offsets.sql
```

Chaque migration contient en commentaire :

- objectif ;
- risque ;
- taille estimée ;
- verrou possible ;
- stratégie de retour ;
- backfill associé.

### Changements destructifs

Approche expand/contract :

1. ajouter nouvelle colonne/table ;
2. écrire dans les deux ;
3. backfill ;
4. lire la nouvelle ;
5. vérifier ;
6. arrêter l'ancienne écriture ;
7. supprimer dans une migration ultérieure.

---

## 14. Seeds et fixtures

### Local

- taxonomies ;
- 100 à 500 offres synthétiques réalistes ;
- cas d'erreur ;
- 90 jours de métriques ;
- insights.

### Interdictions

- aucun secret ;
- aucune donnée personnelle ;
- aucune copie incontrôlée de production ;
- aucun texte dont la licence interdit la redistribution.

### Preview

Chaque branche de base reçoit les seeds, pas une ingestion réelle complète.

---

## 15. Sauvegarde

Exigences :

- sauvegarde managée activée ;
- export logique régulier des tables critiques ;
- conservation de la configuration des taxonomies dans Git ;
- restauration testée avant lancement puis trimestriellement ;
- RPO cible : 24 heures pour données collectées, inférieur si fournisseur le permet ;
- RTO cible : 4 heures pour remise en ligne raisonnable.

Les objectifs sont internes, pas un SLA public.

---

## 16. Rétention et purge

Tâches :

```text
purge_raw_payloads
purge_validation_errors
compact_old_logs
verify_retention
```

La purge :

- respecte la licence ;
- ne supprime pas les preuves nécessaires aux chiffres publiés sans alternative ;
- laisse un audit du volume supprimé ;
- s'exécute par petits lots ;
- ne bloque pas l'ingestion.

---

## 17. Données sensibles

Le produit ne collecte pas de compte utilisateur. Les offres peuvent toutefois contenir :

- noms de contact ;
- e-mails ;
- numéros de téléphone ;
- texte libre.

Le modèle public ne doit pas réexposer inutilement ces champs. Le payload brut est serveur uniquement, durée limitée et accès restreint.

Les logs ne doivent pas contenir une offre complète.

---

## 18. Requêtes type

### Dataset courant

```sql
SELECT *
FROM published_datasets
WHERE is_current = true
LIMIT 1;
```

### Offre et classification courante

```sql
SELECT o.*, s.*, c.*
FROM offers o
JOIN offer_snapshots s
  ON s.offer_id = o.id
 AND s.valid_to IS NULL
JOIN classifications c
  ON c.snapshot_id = s.id
WHERE o.id = $1
  AND c.classifier_version = $2;
```

### KPI

Lire l'agrégat correspondant. Un calcul de contrôle peut être exécuté hors chemin utilisateur pour vérifier les agrégats.

---

## 19. Tests base

- contraintes uniques ;
- snapshot inchangé ;
- nouveau snapshot sur changement ;
- fermeture après deux runs complets ;
- réouverture ;
- deux classificateurs sur un snapshot ;
- bascule dataset atomique ;
- dimensions canoniques ;
- purge ;
- migration up ;
- restauration d'un dump de test ;
- performance d'explorer avec volume simulé.

---

## 20. Revue avant production

- [ ] PostgreSQL 18.x réellement disponible.
- [ ] Région européenne.
- [ ] Pooling configuré.
- [ ] SSL obligatoire.
- [ ] Rôles séparés migration/runtime/worker si possible.
- [ ] Sauvegarde.
- [ ] Point-in-time restore selon offre.
- [ ] Limites de connexion.
- [ ] Timeout de requête.
- [ ] Index vérifiés avec `EXPLAIN ANALYZE`.
- [ ] Aucune migration automatique au runtime.
- [ ] Secret de base absent du client.
- [ ] Dataset rollback testé.
