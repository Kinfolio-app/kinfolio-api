# ADR 0003 — Utiliser RFC 9457 pour les erreurs de l'API

- **Statut :** Accepté
- **Date :** 2026-07-24

## Contexte

Genealaine API doit retourner des erreurs compréhensibles par les clients tout en
conservant un format cohérent entre les erreurs de validation, les erreurs
métier, les routes inexistantes et les erreurs internes.

Le format d'erreur fourni par défaut par Fastify contient les champs
`statusCode`, `error` et `message`. Utiliser directement ce format exposerait le
contrat de l'API aux choix internes de la bibliothèque backend. Définir un
format entièrement personnalisé rendrait également son interprétation et sa
documentation spécifiques à Genealaine.

Les erreurs internes peuvent contenir des informations techniques ou sensibles,
notamment des requêtes, des contraintes PostgreSQL et des traces d'exécution.
Elles doivent être enregistrées dans les journaux sans être exposées aux
clients.

## Décision

J'utilise la
[RFC 9457 — Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html)
pour représenter les erreurs HTTP de Genealaine API. Cette RFC remplace la
RFC 7807.

Les réponses d'erreur utilisent le type de contenu
`application/problem+json` et peuvent contenir les membres standards suivants :

- `type` identifie de manière stable la catégorie du problème ;
- `title` fournit un résumé court et stable de cette catégorie ;
- `status` reprend le statut de la réponse HTTP ;
- `detail` décrit cette occurrence particulière du problème ;
- `instance` pourra identifier une occurrence particulière lorsqu'un mécanisme
  adapté sera défini.

Genealaine ajoute le membre d'extension `requestId`. Il permet de relier une
réponse reçue par un client aux journaux du serveur sans exposer les détails
internes de l'erreur.

Les erreurs HTTP génériques utilisent initialement `about:blank` comme valeur de
`type`. Des URI stables et documentées pourront être introduites pour les
problèmes métier lorsque leurs catégories et le domaine public de l'API seront
définis.

La gestion des erreurs est centralisée dans Fastify :

- `setErrorHandler()` transforme les erreurs contrôlées, les erreurs de
  validation et les erreurs inattendues ;
- `setNotFoundHandler()` produit le même format pour les routes inexistantes ;
- les erreurs contrôlées héritent de `AppError` ;
- les erreurs inconnues sont journalisées avec leur cause puis transformées en
  une réponse générique `500 Internal Server Error`.

Les détails techniques, les traces d'exécution, les requêtes SQL et les
informations sensibles ne sont jamais inclus dans les réponses. Le détail
public d'une erreur `500` reste volontairement générique.

## Conséquences

### Conséquences positives

- Les clients reçoivent un format d'erreur standard et homogène.
- Le contrat d'erreur ne dépend pas du format par défaut de Fastify.
- Les erreurs métier pourront être identifiées par des types stables.
- Le `requestId` facilite la corrélation entre une réponse et les journaux.
- Les informations internes restent disponibles pour le diagnostic sans être
  exposées aux clients.

### Compromis et risques

- Les erreurs produites par Fastify et les dépendances doivent être
  explicitement transformées.
- Les futurs types de problèmes métier devront disposer d'URI stables et être
  documentés.
- Le statut contenu dans le corps doit toujours rester cohérent avec le statut
  HTTP réel.
- Les extensions au format standard doivent être limitées, documentées et
  maintenues comme une partie du contrat public.

## Alternatives envisagées

### Format d'erreur par défaut de Fastify

Le format fourni par défaut par Fastify a été écarté, car il lie le contrat
public de l'API à une bibliothèque d'implémentation et ne fournit pas
directement les garanties de stabilité recherchées.

### Format personnalisé

Un format propre à Genealaine, par exemple composé de `statusCode`, `code` et
`message`, a été envisagé. Il n'a pas été retenu, car il reproduirait une
solution déjà standardisée et demanderait aux clients une intégration
spécifique.

### RFC 7807

La RFC 7807 définit la version précédente du format Problem Details. Elle n'a
pas été retenue, car elle a été remplacée par la RFC 9457.
