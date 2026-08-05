# ADR 0011 — Publier le contrat HTTP au format OpenAPI

- **Statut :** Accepté
- **Date :** 2026-08-05

## Contexte

Kinfolio API expose ses entrées et ses réponses au moyen de schémas TypeBox
associés aux routes Fastify. Ces schémas assurent la validation à l’exécution et
servent à produire les types TypeScript utilisés dans l’API.

Kinfolio Web est développé dans un dépôt séparé. Il doit connaître les chemins,
paramètres, corps, réponses et erreurs de l’API sans recopier manuellement les
DTO ni dépendre des détails d’implémentation du backend. De futurs clients
pourraient par ailleurs utiliser un autre langage que TypeScript.

Le contrat doit donc être publié dans un format indépendant des clients,
versionnable et généré depuis la source déjà utilisée pour valider les routes.

## Décision

Kinfolio API publie son contrat HTTP au format **OpenAPI 3** dans un document
`openapi.json`.

Les schémas TypeBox enregistrés sur les routes Fastify restent la source de
vérité. Le document est généré avec **`@fastify/swagger`**, enregistré avant les
routes afin qu’elles soient toutes découvertes. Il n’est pas maintenu
manuellement en parallèle des schémas applicatifs.

Une commande dédiée produit un `openapi.json` déterministe sans démarrer un
serveur accessible sur le réseau. Le fichier généré est versionné avec l’API et
inclus dans ses tags ou releases afin que les clients puissent sélectionner une
référence immuable du contrat.

La CI régénère le document et échoue lorsqu’il diffère de la version enregistrée
dans le dépôt. Elle valide également sa structure avant sa publication.

Chaque opération publique doit posséder une description suffisante pour
produire un contrat exploitable, notamment :

- un `operationId` stable ;
- des paramètres de chemin et de requête correctement sérialisés ;
- les corps et réponses pour chaque contenu pris en charge ;
- les réponses sans contenu ;
- les erreurs RFC 9457 pertinentes ;
- les futurs mécanismes de sécurité ;
- le transfert de fichiers GEDCOM sous une forme représentable par OpenAPI.

Une interface Swagger UI pourra être ajoutée pour faciliter la consultation
humaine du contrat. Elle reste optionnelle et ne constitue pas la source du
document.

## Conséquences

### Conséquences positives

- Le contrat publié est dérivé des mêmes schémas que la validation Fastify.
- Les clients peuvent générer leurs types ou leur SDK sans dépendre du code
  TypeScript interne de l’API.
- Les changements de chemins, paramètres et réponses deviennent visibles dans
  le diff d’`openapi.json`.
- Une version du client peut référencer une version immuable du contrat.
- Le format reste utilisable par de futurs clients web, mobiles ou externes.
- Le document peut servir à la documentation et aux tests de compatibilité.

### Compromis et risques

- Les schémas de routes doivent contenir les métadonnées nécessaires à une
  description OpenAPI complète.
- Certaines représentations, notamment les fichiers binaires et les paramètres
  de tableau, peuvent demander des annotations spécifiques.
- Un document généré peut devenir obsolète si la vérification CI est contournée.
- OpenAPI décrit le contrat attendu, mais ne remplace pas les tests vérifiant le
  comportement réel des routes.
- La publication du document doit être coordonnée avec le versionnement de
  l’API et l’adoption du contrat par ses clients.

## Alternatives envisagées

### Maintenir manuellement un document OpenAPI

Cette approche offrirait un contrôle direct sur la spécification, mais créerait
une seconde source de vérité distincte des schémas TypeBox utilisés à
l’exécution.

### Partager directement les types TypeScript de l’API

Un package commun éviterait de générer certains modèles, mais couplerait les
clients à TypeScript et aux choix internes du backend. Il ne décrirait pas à lui
seul les méthodes, chemins, statuts et contenus HTTP.

### Exposer uniquement un endpoint OpenAPI dynamique

Un endpoint fournirait toujours le contrat de l’instance en cours d’exécution.
Il ne garantirait cependant pas qu’un client puisse reconstruire plus tard les
types associés à une version précise et rendrait sa génération dépendante d’un
service disponible.

### Générer un SDK pour chaque client dans le dépôt API

Cette approche centraliserait davantage les intégrations, mais imposerait à
Kinfolio API les langages, outils et cycles de publication propres à chaque
client. L’API publie plutôt un contrat neutre que chaque client peut consommer.
