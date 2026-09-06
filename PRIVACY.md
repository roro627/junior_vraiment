# Données et confidentialité — état technique du MVP

État vérifié le 6 septembre 2026. Ce document décrit l'implémentation ; il ne constitue pas
une validation juridique des mentions ni des contrats fournisseurs.

## Responsable et contact

Le projet est maintenu par Romain Lambert. Les corrections de données sont accessibles depuis
[/signaler](https://junior-vraiment.vercel.app/signaler). Ne pas publier de coordonnées personnelles
dans une issue GitHub ; utiliser le canal privé indiqué pour les vulnérabilités.

## Données utilisées

L'observatoire traite des annonces issues de l'API officielle France Travail. Les modèles publics
ne contiennent pas les charges brutes complètes ni les champs de contact du fournisseur. Les
offres normalisées, snapshots, classifications, extraits de preuve et agrégats servent à expliquer
et reproduire les chiffres. Il n'y a ni compte utilisateur, ni CV, ni candidature interne.

## Services effectivement utilisés

- Vercel : hébergement et livraison du site.
- Neon : PostgreSQL, projet en région européenne.
- Trigger.dev : collecte et tâches d'exploitation ; ne pas présenter son hébergement comme européen.
- Sentry : diagnostic des erreurs. Les événements sont filtrés avant envoi ; les textes d'offres,
  jetons, cookies, corps de requêtes et coordonnées de test sont exclus par les contrôles du dépôt.
- GitHub : code et signalements ; un signalement public est visible des autres visiteurs.
- PostHog : désactivé pour le lancement MVP, conformément à l'ADR 0010. Aucun replay de session.

Les fournisseurs peuvent traiter des données techniques pour acheminer les requêtes. La suppression
de champs dans les événements applicatifs ne signifie pas qu'aucune adresse IP n'est traitée
par l'infrastructure réseau.

## Conservation applicative

Chaque charge brute a une échéance enregistrée à sa collecte. La maintenance purge uniquement
les charges arrivées à échéance, sans prolonger les anciennes échéances. Les diagnostics expurgés
de validation sont purgés après 30 jours lorsque leur collecte est terminée. L'exécution hebdomadaire
peut introduire un délai de purge inférieur à une semaine, hors incident signalé.

Les offres normalisées, preuves, snapshots utiles, agrégats et insights sont conservés pour la
reproductibilité selon la méthodologie. La purge ne les efface pas. Une demande de correction ou
de retrait nécessite un traitement distinct conservant la traçabilité des chiffres affectés.

## Validation avant annonce publique

Restent à confirmer par le responsable : mentions légales complètes adaptées à sa situation,
droits de réutilisation et de republication, durées finales autorisées et rétention réelle des
logs/sauvegardes chez les fournisseurs. Les durées applicatives ne garantissent pas l'effacement
instantané des sauvegardes. Aucun accord fournisseur n'a été signé automatiquement.
