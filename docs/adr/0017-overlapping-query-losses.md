# ADR 0017 — Pertes réelles dans des requêtes chevauchantes

- Statut : accepté le 19 septembre 2026, correction opérationnelle
- Version : `ingestion-quality-1.4.0`

## Diagnostic

La tentative 2 du 19 septembre conserve 566 requêtes réussies, 698 pages et 31 081
résultats valides, zéro quarantaine. Son union contient 2 462 offres, contre 2 386
au succès précédent. Une seule baisse locale bloque : M1818 + « développeur logiciel »,
8 → 3. Un appel officiel indépendant confirme neuf résultats bruts, trois admis
par le même filtre d'intitulé, aucune page suivante ni quarantaine.

Deux des huit offres précédentes restent dans cette requête, une nouvelle y entre.
Deux autres sont observées par d'autres requêtes du même run. Quatre offres précédentes
seulement sont absentes de l'union. Leur absence n'est pas interprétée comme un retrait
certain de la source. Le contrôle local traitait la perte nette de cinq résultats dans
une requête chevauchante comme une perte matérielle de cinq offres dans la collecte.

## Décision

Pour chaque requête, compter aussi les identifiants précédemment observés absents de
**toutes** les observations persistées de la nouvelle collecte. Une baisse locale
reste bloquante lorsqu'elle dépasse 60 %, atteint cinq offres en valeur absolue et
qu'au moins cinq identifiants précédents manquent de l'union courante. Sinon elle
reste un avertissement audité, avec `previous`, `current` et `missingFromRun`.
En l'absence de ce nouveau diagnostic, conserver le comportement bloquant précédent.

Ce changement corrige la mesure de couverture de requêtes non disjointes : aucune
requête n'est exemptée, aucun seuil relevé. Les changements de distribution locale
restent visibles même lorsqu'ils ne représentent pas une perte dans le jeu complet.
Une observation ailleurs n'affirme pas que le texte ou les attributs sont inchangés :
le snapshot réel et sa classification versionnée continuent à être utilisés.

La garde globale ±40 %, la pagination complète, les plafonds source, la validation,
les preuves et les deux absences nécessaires pour fermer une offre sont inchangés.
L'évaluation ne peut donc pas autoriser un run incomplet sous prétexte de chevauchement.
Ni le périmètre, ni les classifications, ni les KPI ne changent.

## Validation et reprise

Fixtures isolées : 8 → 3 avec quatre absents avertit ; cinq absents bloquent malgré
un volume global identique. Un autre blocage n'est pas neutralisé par un chevauchement.
Tester aussi le comptage SQL sur Neon QA. La tentative 2 bloquée et son résumé 1.3.0
restent conservés ; une nouvelle tentative 3 doit repasser l'ensemble des contrôles.
Le résultat effectivement publié est documenté dans docs/21, jamais déduit des tests.
