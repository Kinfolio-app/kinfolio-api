# ADR 0013 — Persister les dates généalogiques dans une table dédiée

- **Statut :** Accepté
- **Date :** 2026-08-06

## Contexte

L'[ADR 0009](0009-represent-genealogical-dates-as-structured-values.md) définit
les dates généalogiques comme des valeurs structurées communes aux différents
modules. Elle impose de conserver leurs composantes et leurs contraintes dans
PostgreSQL, mais laisse ouvert le choix entre des colonnes intégrées à chaque
ressource et une table de valeurs dédiée.

Une date peut comporter un ou deux points, un calendrier, une époque, une
précision partielle, un qualificatif, une phrase et le texte d'origine. Ce
modèle doit servir aux personnes, puis aux relations de couple et aux futurs
événements généalogiques, sans dupliquer sa structure et ses contraintes dans
chaque table métier.

## Décision

Genealaine persiste les dates généalogiques dans une table dédiée
`genealogical_dates`. Ses colonnes représentent explicitement le type de date,
les composantes du premier et du second point, la phrase et le texte d'origine.
Des contraintes PostgreSQL garantissent la cohérence de la forme choisie et
des composantes présentes.

Les ressources métier portent une clé étrangère nullable vers cette table. Les
personnes utilisent ainsi `birth_date_id` et `death_date_id` à la place des
anciennes colonnes PostgreSQL `DATE`.

Une date reste un objet-valeur possédé par le champ qui la référence :

- elle n'est pas exposée comme une ressource HTTP autonome ;
- elle n'est pas partagée implicitement entre plusieurs champs ;
- sa création, son remplacement et sa suppression appartiennent à la même
  transaction que la ressource métier ;
- une valeur remplacée ou retirée est supprimée lorsqu'elle n'est plus
  référencée.

La migration convertit les anciennes dates en valeurs exactes, complètes,
grégoriennes et exprimées dans l'ère commune. Son retour arrière n'est autorisé
que si toutes les valeurs encore référencées peuvent être reconverties sans
perte vers PostgreSQL `DATE`.

## Conséquences

### Conséquences positives

- La structure et les contraintes ne sont définies qu'une fois.
- Les prochains modules peuvent réutiliser la même représentation persistée.
- Les tables métier conservent peu de colonnes liées aux dates.
- Les anciennes dates complètes sont migrées sans perte.

### Compromis et risques

- La lecture d'une ressource nécessite une jointure par champ de date.
- Le cycle de vie des objets-valeurs doit être géré transactionnellement pour
  éviter les lignes orphelines.
- Un retour vers de simples colonnes `DATE` devient impossible dès qu'une date
  partielle, qualifiée ou non grégorienne est référencée.
- Les recherches chronologiques complexes pourront nécessiter des index ou des
  bornes dérivées supplémentaires.

## Alternatives envisagées

### Intégrer les colonnes dans chaque table métier

Cette solution évite les jointures, mais répète de nombreuses colonnes et
contraintes pour chaque champ de date. Elle complique également l'ajout des
relations de couple et des événements.

### Stocker la valeur dans une colonne `JSONB`

Cette solution suit facilement le contrat applicatif, mais reporte une part
importante de la cohérence sur l'application et rend les contraintes et les
requêtes chronologiques moins explicites.

### Exposer les dates comme des ressources partageables

Cette solution permettrait à plusieurs champs de référencer la même ligne,
mais introduirait une identité et un cycle de vie qui ne correspondent pas au
modèle d'objet-valeur retenu par l'ADR 0009.
