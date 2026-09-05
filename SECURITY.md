# Politique de sécurité

## Versions prises en charge

Seule la version déployée sur la branche `main` et les correctifs en cours sont pris en charge.

## Signaler une vulnérabilité

Ne pas ouvrir une issue publique pour :

- fuite de secret ;
- accès non autorisé ;
- injection ;
- contournement d'un endpoint interne ;
- exposition de données ;
- supply-chain compromise.

Configurer avant publication une adresse dédiée ou GitHub Private Vulnerability Reporting et remplacer cette section par le canal exact.

Informations utiles :

- description ;
- impact ;
- étapes minimales ;
- route/version ;
- preuve non destructive ;
- proposition éventuelle.

Ne pas accéder à plus de données que nécessaire et ne pas perturber le service.

## Délais visés

- accusé de réception : 72 heures ;
- évaluation : 7 jours ;
- critique : correction prioritaire ;
- publication coordonnée après correctif.

Ces objectifs ne sont pas un SLA contractuel.

## Données incorrectes

Une erreur de classification ou de statistique n'est pas nécessairement une vulnérabilité, mais elle est importante. Utiliser le mécanisme de correction public prévu, sauf si elle résulte d'une compromission.

## Dépendances

Le projet suit les avis React, Next.js, Node.js, PostgreSQL et services utilisés. Les correctifs critiques sont traités rapidement.

## Secrets exposés

En cas de secret commité :

1. révoquer ;
2. rotater ;
3. rechercher l'usage ;
4. purger si nécessaire ;
5. redéployer ;
6. documenter ;
7. ne pas considérer la suppression du commit comme suffisante.
