# Contribuer

## Branches

```text
main              production
feat/...          fonctionnalité
fix/...           correction
data/...          règles/taxonomies
docs/...          documentation
chore/...         outillage
```

Branches courtes. Pas de développement direct sur `main`.

---

## Commits

Conventional Commits :

```text
feat:
fix:
docs:
test:
refactor:
perf:
chore:
ci:
data:
```

Exemples :

```text
feat(filters): synchronise le territoire avec l'URL
data(classifier): distingue expérience souhaitée et exigée
fix(evidence): conserve l'offset après normalisation Unicode
```

---

## Pull request

La description doit inclure :

```text
Contexte
Décision
Ce qui change
Ce qui ne change pas
Captures / données
Tests
Accessibilité
Performance
Risques
Rollback
Documentation
```

Pour une règle :

```text
Fixture reproduisant le cas
Métriques avant/après
Nombre de classifications modifiées
Cas ambigus
Version
```

Pour l'UI :

```text
Référence maquette
Viewports
États
Clavier
Reduced motion
Capture avant/après
```

---

## Revue

Une PR ne peut être fusionnée si :

- CI rouge ;
- secret ;
- migration non testée ;
- chiffre sans preuve ;
- baisse de précision sous seuil ;
- composant inaccessible ;
- dépendance non justifiée ;
- écart maquette non documenté ;
- état d'erreur absent ;
- bundle hors budget sans décision.

---

## Maquette

Ne pas écraser les fichiers originaux. Ajouter :

```text
maquette/INVENTORY.md
maquette/IMPLEMENTATION-NOTES.md
```

Les captures générées peuvent vivre dans un sous-dossier ignoré ou dans les artefacts CI.

---

## Méthode de développement

1. issue ;
2. critères ;
3. test ou fixture ;
4. implémentation minimale ;
5. états ;
6. docs ;
7. revue ;
8. mesure ;
9. fusion.

---

## Données de test

Utiliser des données synthétiques ou fixtures autorisées et redacted. Aucun secret, e-mail ou téléphone réel dans Git.

---

## Migrations

- nom clair ;
- SQL relu ;
- taille/lock ;
- test staging ;
- rollback ;
- migration séparée du gros backfill.

---

## Version métier

Mettre à jour :

- classificateur ;
- métrique ;
- taxonomie ;
- changelog ;
- méthodologie

selon le changement.

---

## Signalement d'un bug de classification

Une issue doit contenir :

- identifiant public ou URL ;
- résultat ;
- résultat attendu ;
- preuve ;
- version ;
- raison.

Ne pas coller de coordonnées personnelles présentes dans l'annonce.

---

## Licence

En contribuant, la contribution est proposée sous la licence du dépôt. Les données externes restent sous leurs propres conditions.
