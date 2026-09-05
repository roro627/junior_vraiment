# ADR 0002 — Classificateur déterministe et explicable

- Statut : accepté
- Date : 2026-09-02

## Contexte

Le produit publie des chiffres potentiellement contestés. Un LLM peut produire des résultats non reproductibles, coûteux et difficiles à expliquer.

## Décision

Utiliser un moteur de règles pur, versionné et testé. Chaque résultat stocke preuves et rule IDs. Les cas non résolus deviennent ambigus.

## Conséquences positives

- reproductibilité ;
- audit ;
- coût maîtrisé ;
- tests ;
- corrections transformées en fixtures ;
- confiance.

## Conséquences négatives

- travail de taxonomie ;
- couverture linguistique progressive ;
- rappel initial potentiellement inférieur à un modèle opaque.

## Usage futur d'un LLM

Possible uniquement comme outil de revue hors chemin critique :

- proposer des cas ;
- regrouper des formulations ;
- aider à annoter ;
- jamais comme source unique du KPI ;
- sorties vérifiées et non publiées directement.

L'ADR 0009 autorise depuis le 4 septembre 2026 une exception hors production : une passe LLM
unique et aveugle peut constituer le jeu de référence du MVP. Le moteur qui classe les offres et
produit les données publiques reste intégralement déterministe.
