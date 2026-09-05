# Instructions pour développeurs et agents de code

Ce fichier est normatif pour toute personne ou agent automatisé intervenant sur le dépôt.

## 1. Lire avant de modifier

Ordre obligatoire :

1. `README.md`
2. `SPEC.md`
3. `maquette/README.md`
4. document de domaine concerné dans `docs/`
5. ADR associés
6. code et tests existants

Ne jamais déduire une règle métier depuis le seul rendu visuel.

---

## 2. Priorités

En cas de conflit :

1. sécurité et licence ;
2. exactitude des données ;
3. accessibilité ;
4. spécification fonctionnelle ;
5. maquette ;
6. performance ;
7. préférence d'implémentation.

Un écart doit être expliqué dans la PR.

---

## 3. Stack

Utiliser les choix de `STACK.md`.

Interdictions sans ADR :

- autre framework ;
- store global ;
- LLM dans le classificateur ou l'ingestion de production ; les annotations hors ligne des jeux de
  référence et de pertinence suivent l'exception bornée de `SPEC.md` §15 et l'ADR 0009 ;
- Redis ;
- moteur de recherche externe ;
- monorepo ;
- nouvelle bibliothèque d'animation ;
- autre ORM ;
- GraphQL ;
- compte utilisateur ;
- CMS.

---

## 4. Maquette

Le dossier `/maquette` est fourni par le porteur.

Avant d'implémenter une page :

- inventorier les références ;
- extraire les tokens ;
- créer/mettre à jour `maquette/IMPLEMENTATION-NOTES.md` ;
- vérifier les états non dessinés ;
- préserver l'accessibilité.

Ne jamais modifier les fichiers originaux de la maquette. Ajouter des notes séparées.

---

## 5. Architecture

- Server Components par défaut.
- Client Components au niveau le plus bas possible.
- Domaine pur sans import Next/React/Drizzle.
- Données externes validées avec Zod.
- Requêtes dans la couche application/infrastructure.
- Composants sans accès direct à PostgreSQL.
- Filtres dans l'URL.
- Aucune donnée source brute dans l'UI.
- Aucune logique métier dans une classe Tailwind.

---

## 6. Classificateur

Toute modification doit :

1. reproduire le cas dans une fixture ;
2. ajouter une preuve attendue ;
3. exécuter le gold set ;
4. produire les deltas ;
5. conserver les cas ambigus ;
6. incrémenter la version si nécessaire ;
7. mettre à jour la méthodologie.

Il est interdit de :

- forcer une classification pour améliorer un taux ;
- utiliser un appel non déterministe ;
- modifier une ancienne ligne de classification ;
- supprimer une preuve ;
- interpréter `souhaité` comme `obligatoire` sans règle explicite.

---

## 7. UI

- tokens uniquement ;
- composants shadcn adaptés ;
- Storybook ;
- tous les états ;
- mobile réel ;
- clavier ;
- reduced motion ;
- aucun effet décoratif permanent ;
- aucune valeur accessible seulement par tooltip ;
- aucun texte dans une image.

---

## 8. Animation

Utiliser `docs/04-MOTION-SPEC.md`.

- CSS pour transitions simples ;
- Motion pour layout/coordination ;
- tokens centralisés ;
- pas de GSAP ;
- pas de courbe locale ;
- pas de scrolljacking ;
- pas de compteur depuis zéro ;
- test reduced motion.

---

## 9. Code

- TypeScript strict ;
- fonctions petites et nommées ;
- noms métier ;
- erreurs typées ;
- pas de `any` ;
- pas de `console.log` ;
- pas de duplication de taxonomie ;
- commentaires sur le pourquoi, pas sur l'évidence ;
- tests proches du domaine ;
- pas d'abstraction prématurée.

---

## 10. Données et sécurité

- secrets server-only ;
- logs redacted ;
- URL externes validées ;
- HTML externe jamais injecté ;
- requêtes bornées ;
- migrations contrôlées ;
- payload brut durée limitée ;
- attribution conservée.

---

## 11. Dépendances

Avant ajout :

- problème ;
- solution native ;
- taille ;
- maintenance ;
- sécurité ;
- accessibilité ;
- suppression.

Épingler exactement et mettre à jour le lockfile. Ne pas ajouter deux bibliothèques au même rôle.

---

## 12. Tests requis par type de changement

| Changement | Tests |
|---|---|
| règle | unit + gold + regression |
| base | migration + integration |
| API | Zod + contract + integration |
| composant | Storybook + Testing Library + a11y |
| parcours | Playwright |
| motion | reduced motion + interaction |
| SEO/OG | metadata + image snapshot |
| ingestion | idempotence + retry + partial |
| sécurité | validation + headers/secret selon cas |

---

## 13. Avant de terminer

Exécuter :

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Puis vérifier la Definition of Done.

Ne jamais déclarer terminé si un contrôle requis n'a pas été exécuté ; indiquer honnêtement ce qui ne l'a pas été.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
