# Clarifications de conformité du holdout — 10 septembre 2026

Ces précisions reprennent SPEC §5 et ADR 0014, sans sortie du moteur ni taux attendu.
Elles sont figées avant annotation du troisième lot. Une passe A, aucune copie des anciens labels.

- `structuredExperienceRequired=false` signifie **débutant accepté**, même pour un métier
  technique. Ne jamais ignorer ce signal dans les annotations. Son libellé est la preuve.
- Alternance, apprentissage, stage, métier d'architecte, RSSI, « expert en [domaine] » ne
  suffisent pas, à eux seuls, à décider d'un niveau de séniorité. Ne pas déduire le niveau
  depuis le métier. Rechercher un signal junior ou un niveau explicitement senior/lead/
  confirmé/expérimenté applicable au poste. Un collègue expérimenté ne définit pas le candidat.
- `0 à 3 ans` est **une seule plage**, minimum 0. Ne pas la confondre avec deux exigences
  obligatoires divergentes (exemple : 1 an structuré et au moins 3 ans dans le texte).
- Une exigence « expérience avérée/significative » ne donne aucun nombre. Avec une acceptation
  explicite des débutants et sans conflit de niveau, elle ne permet pas d'inventer ≥ 24 mois.
  L'acceptation explicite peut résoudre un négatif ; sans cette acceptation, le seuil reste inconnu.
- Un libellé `0 An(s)` accompagné de `structuredExperienceRequired=true` n'est pas le signal
  structuré « débutant accepté ». Ne pas changer la signification de l'indicateur booléen.
- Le rationnel et les extraits doivent correspondre aux champs fournis, pas aux habitudes du marché.

Ces contrôles s'appliquent aux négatifs et au dénominateur, pas seulement aux contradictions.

## Quatrième campagne : consignes fournies avant annotation

Le moteur 1.3.4 a été figé avant les 200 nouvelles offres, excluant les campagnes précédentes.
Les annotateurs ont reçu en complément : lire les textes complets par groupes d'au plus cinq
offres pour éviter la troncature ; deux ans correspondent exactement à 24 mois et le seuil est
inclusif ; une présentation générique de carrières de l'entreprise ne positionne pas forcément
le poste comme junior. Aucun résultat du moteur ne leur a été montré.

Une correction d'extrait non littéral est une correction de conformité, pas un changement de
jugement : conserver le fichier initial et tracer la correction avant évaluation.

## Cinquième campagne

La quatrième campagne a reproduit deux erreurs du moteur (préférence en fin de phrase longue,
profil explicitement expérimenté). Elles sont corrigées et testées dans le candidat 1.3.5 avant
gel du cinquième échantillon. Un intitulé de métier ou de fonction, y compris « Manager », ne
remplace pas un niveau explicitement senior/confirmé/expérimenté/lead : on ne déduit pas de
séniorité depuis les responsabilités supposées du métier. Les autres règles restent identiques.
Les quatre rapports initiaux et la relecture de la quatrième campagne restent conservés.
