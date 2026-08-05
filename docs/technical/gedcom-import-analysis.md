# Analyse d'un import GEDCOM

## Objectif

L'analyse examine un fichier GEDCOM sans modifier la base de données.
Elle fournit un contrat commun à GEDCOM 5.5.1 et GEDCOM 7.0.x, quelle que soit
l'implémentation du parseur sélectionné.

Elle permet au client de connaître :

- la version GEDCOM détectée ;
- la validité du document ;
- le nombre de structures normalisées reconnues ;
- les extensions ignorées ou ambiguës ;
- les erreurs, avertissements et informations produits pendant l'analyse.

L'analyse ne réalise ni correspondance avec les entités Kinfolio, ni
détection de doublons, ni écriture en base de données.

Lorsque l'analyse et le parsing ont produit un document normalisé valide, la
projection vers un plan d'import est décrite par la
[note sur les correspondances GEDCOM vers Kinfolio](gedcom-to-kinfolio-mapping.md).

## Contrat HTTP

La route `POST /gedcom-imports/analysis` accepte une requête
`multipart/form-data` contenant un unique champ fichier obligatoire nommé
`file`.

Le fichier doit respecter le [contrat d'import GEDCOM](../domain/gedcom-import.md) :

- conteneur `.ged` non compressé ;
- encodage UTF-8 ;
- version GEDCOM 5.5.1 ou 7.0.x prise en charge par le détecteur ;
- taille maximale de 10 Mio.

La requête n'accepte aucun champ texte supplémentaire. Un fichier dépassant
la limite produit une réponse `413 Payload Too Large`. Une requête multipart
incomplète ou dont le corps ne respecte pas le schéma produit une réponse
`400 Bad Request`.

La validité du contenu GEDCOM fait partie du résultat de l'analyse et non du
statut de la requête. Un fichier reçu correctement peut donc produire une
réponse `200 OK` avec `valid: false` et des diagnostics expliquant les erreurs.

## Réponse

La réponse suit cette structure :

```json
{
    "version": "7.0.18",
    "valid": true,
    "summary": {
        "individuals": 1,
        "families": 0,
        "events": 1,
        "sources": 0,
        "repositories": 0,
        "media": 0,
        "notes": 0
    },
    "ignored": [],
    "ambiguous": [],
    "diagnostics": []
}
```

`version` vaut `null` lorsque le détecteur ne peut pas identifier une version
prise en charge. Lorsque la version est connue mais que le parseur trouve une
erreur, elle reste renseignée et `valid` vaut `false`.

Le résumé comptabilise les structures présentes dans le document normalisé :

- `individuals` : enregistrements individuels ;
- `families` : enregistrements familiaux ;
- `events` : événements portés par les individus et les familles ;
- `sources` : enregistrements de source partagés ;
- `repositories` : dépôts partagés ;
- `media` : enregistrements de média partagés ;
- `notes` : notes partagées.

Les structures imbriquées, comme les citations, références de média ou notes
locales, ne sont pas ajoutées à ces compteurs. Elles restent néanmoins
analysées et leurs extensions sont collectées.

## Classement des extensions

Les parseurs conservent toute structure qu'ils ne projettent pas dans un champ
normalisé dédié sous forme de `NormalizedExtension`. Le service d'analyse les
classe de manière prudente :

| Résultat    | Règle actuelle                                                                                              |
| ----------- | ----------------------------------------------------------------------------------------------------------- |
| `ignored`   | L'extension possède un URI résolu, notamment grâce à `HEAD.SCHMA`, mais Kinfolio ne la prend pas en charge. |
| `ambiguous` | Aucun URI unique n'a pu être associé à l'extension.                                                         |

Chaque élément expose son tag, son URI éventuel, son chemin normalisé, sa
position dans le fichier et la raison du classement. Une extension enfant
reste rattachée à son extension racine et n'est pas comptabilisée une seconde
fois.

L'absence d'URI ne permet pas encore de distinguer une déclaration absente,
une déclaration non unique ou une structure issue de GEDCOM 5.5.1. Ces cas
restent donc ambigus plutôt que d'être interprétés automatiquement.

Les structures prises en charge apparaissent dans le document normalisé et
dans le résumé ; elles ne sont pas répétées dans une collection `recognized`.
Les structures invalides sont représentées par les diagnostics de sévérité
`error`. Les avertissements et informations restent également disponibles dans
`diagnostics`.

## Pipeline réutilisable

```text
route multipart
    |
    v
GedcomImportService.analyze(Uint8Array)
    |
    +--> détection du fichier et de la version
    +--> sélection du parseur 5.5.1 ou 7.0.x
    +--> document normalisé et diagnostics
    +--> résumé et classement des extensions
    |
    v
mapper HTTP --> réponse d'analyse
```

Le traitement multipart et la transformation en DTO appartiennent à la route.
Le service reçoit uniquement les octets du fichier et retourne un résultat
d'analyse indépendant de HTTP. La future route d'import pourra ainsi réutiliser
la détection, le parsing, le résumé et le classement avant d'ajouter les étapes
de correspondance, de validation utilisateur et de persistance
transactionnelle.

## Limites actuelles

L'analyse ne couvre pas encore :

- GEDZIP et les fichiers médias embarqués ;
- ANSEL ou les encodages propriétaires ;
- la correspondance entre le document normalisé et les entités Kinfolio ;
- la détection des doublons et le réimport ;
- l'import transactionnel et son rapport final ;
- les tests avec des exports réels anonymisés et les mesures sur de grands
  arbres.

Les tests automatisés utilisent uniquement des contenus synthétiques. Tout
fichier réel ajouté ultérieurement devra être anonymisé conformément à la
[roadmap](../roadmap.md).
