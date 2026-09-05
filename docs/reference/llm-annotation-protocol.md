# Protocole d'annotation LLM A

**Version :** `llm-review-a-1.0.0`  
**Modèle initial :** `gpt-5.6-terra`  
**Effort :** `medium`  
**Nombre de passes :** une

## Entrées autorisées

Le modèle reçoit uniquement l'identifiant opaque de revue, le titre redacted, la description
redacted, l'indicateur d'expérience structurée et son libellé. Il ne reçoit aucun champ
`predicted*`, aucune sortie du classificateur et aucun résultat d'une autre passe.

## Instruction de décision

Appliquer strictement les définitions de `SPEC.md` et `docs/02-DATA-METHODOLOGY.md`. Ne jamais
transformer une absence de preuve en certitude. Distinguer exigence obligatoire, souhait,
préférence, durée de mission, diplôme et expérience. Retourner `ambiguous` ou `unclassified`
lorsque les preuves ne permettent pas une valeur certaine.

## Sortie par offre

```json
{
  "reviewId": "identifiant opaque",
  "status": "classified | ambiguous | unclassified",
  "claimsJunior": true,
  "minimumExperienceMonths": 24,
  "beginnerFriendly": false,
  "contradictoryJunior": true,
  "rationale": "raison courte",
  "evidenceExcerpts": ["extrait exact"]
}
```

Les cinq valeurs métier acceptent `null` lorsque la méthode l'exige. Au moins un extrait est requis
et chaque extrait doit être retrouvé dans les champs source après normalisation Unicode, casse,
espaces et ponctuation. Le pipeline rejette une ligne mal formée, manquante, dupliquée ou dont une
preuve ne provient pas de la source.

## Versionnement et usage

Le jeu généré enregistre le modèle, l'effort, cette version de protocole, la date de collecte et la
version du classificateur évalué. Toute modification d'instruction, de modèle ou d'effort crée une
nouvelle version. Le corpus réel reste dans `.local/` et n'est pas commité. Seuls le protocole et
les rapports agrégés sans contenu d'offre peuvent être publiés.

La fusion vérifie automatiquement les identifiants uniques, la présence des extraits dans la
source et les invariants tri-état. Une sortie qui enfreint ces invariants est rejetée comme invalide
et corrigée dans la même passe A ; elle n'est pas arbitrée par une seconde passe indépendante.

Les labels servent à l'évaluation hors ligne. Ils ne sont jamais appelés par l'ingestion, ne sont
pas stockés comme classifications publiques et ne calculent pas directement le KPI du marché.
