# ADR 0007 — Utiliser la suppression logique pour les personnes

- **Statut :** Accepté
- **Date :** 2026-07-29

## Contexte

Une personne constituera progressivement le point d'ancrage de relations
familiales, photos, documents, événements et souvenirs. Supprimer
immédiatement sa ligne rendrait plus difficile la préservation de ces données,
leur restauration et le traitement cohérent des futures relations.

La première version de l'API doit néanmoins permettre à un client de retirer
une personne des consultations courantes, sans définir dès maintenant toutes
les règles de purge des contenus associés.

## Décision

Les personnes utilisent une **suppression logique**. La table `persons`
possède une colonne nullable `deleted_at` de type `TIMESTAMPTZ` :

- `deleted_at IS NULL` indique une personne active ;
- une valeur non nulle indique la date et l'heure de sa suppression.

`DELETE /people/:id` renseigne `deleted_at`, met à jour `updated_at` et retourne
`204 No Content`.

Les opérations publiques suivantes ignorent les personnes supprimées :

- consultation par identifiant ;
- consultation d'une collection et calcul de son total ;
- modification ;
- nouvelle suppression.

Une personne inexistante ou déjà supprimée produit une réponse
`404 Not Found`. Le champ `deleted_at` n'est pas exposé dans les DTO publics.

La suppression est réalisée par une seule requête conditionnelle afin d'éviter
une lecture préalable et de rendre l'opération atomique.

Aucune route de restauration ni de purge définitive n'est ajoutée pour le
moment. Leur sécurité, leurs autorisations et le traitement des futures
relations devront être décidés séparément.

## Conséquences

### Conséquences positives

- Les données d'une personne ne sont pas détruites immédiatement.
- Les futurs contenus associés peuvent rester rattachés à leur personne.
- Une restauration ou une purge contrôlée pourra être ajoutée ultérieurement.
- Les lectures publiques présentent un comportement identique à celui d'une
  ressource inexistante.
- Une deuxième suppression ne modifie pas à nouveau la ligne.

### Compromis et risques

- Toutes les requêtes de lecture et de modification doivent exclure
  explicitement les lignes supprimées.
- Les lignes supprimées continuent d'occuper de l'espace dans PostgreSQL.
- Les contraintes d'unicité futures devront préciser si elles s'appliquent aux
  personnes supprimées.
- Une politique de conservation et de purge devra être définie avant
  l'utilisation de données personnelles réelles.
- Les accès administratifs devront éviter de réexposer involontairement les
  personnes supprimées.

## Alternatives envisagées

### Suppression physique immédiate

Une requête `DELETE FROM persons` serait plus simple et libérerait la ligne,
mais compliquerait la conservation des futures relations et rendrait la
restauration impossible sans sauvegarde.

### Interdiction temporaire de supprimer

La suppression aurait pu être reportée jusqu'à la modélisation de tous les
contenus associés. Cette option n'a pas été retenue, car la colonne
`deleted_at` fournit dès maintenant un comportement réversible au niveau des
données sans imposer les règles de purge futures.

### Archivage dans une table séparée

Déplacer les personnes dans une table d'archive séparerait physiquement les
données actives, mais demanderait de dupliquer ou déplacer leurs futures
relations. Cette complexité n'est pas justifiée à ce stade.
