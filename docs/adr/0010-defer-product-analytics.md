# ADR 0010 — Reporter la mesure d’audience PostHog

- Statut : accepté par le propriétaire le 6 septembre 2026.
- Décision : reporter PostHog hors du lancement MVP, sans fournisseur de remplacement.

## Contexte

Le propriétaire ne souhaite pas signer le DPA PostHog pour le moment et a explicitement
approuvé le report. Le produit ne dépend pas de cette mesure pour fonctionner, conformément
à `STACK.md` §7.3.

## Conséquences

- Conserver `ANALYTICS_ENABLED=false` ou absent (valeur par défaut : false).
- Ne pas configurer les clés PostHog dans les déploiements et ne pas envoyer d’événements.
- Conserver l’instrumentation existante inactive ; ne pas supprimer le compte externe.
- Ne pas présenter les visites, usages et partages comme mesurés.
- Les critères propres à l’activation analytics sont différés, pas déclarés validés.
- Les exigences de confidentialité des autres traitements et de Sentry restent applicables.

## Reprise éventuelle

Une nouvelle décision explicite du propriétaire précédera la revue du DPA, des traitements,
de la rétention, du consentement et de l’information publique. Le raccordement, les événements
réellement reçus et les budgets de performance devront ensuite être vérifiés avant activation.
