import type { Pool } from 'pg';
import { selectGenealogicalDate } from '../../shared/genealogy/genealogical-date.repository.js';
import type { Person } from '../people/person.types.js';
import type {
    ParentChildRelationship,
    ParentChildRelationshipType,
} from '../relationships/parent-child-relationship.types.js';
import {
    MAX_FAMILY_TREE_PEOPLE,
    FamilyTreeTruncationReason,
    type FamilyTreeBranch,
    type TreeDirection,
} from './family-tree.types.js';

type Database = Pick<Pool, 'query'>;

type SerializedPerson = Omit<Person, 'createdAt' | 'updatedAt'> & {
    createdAt: string;
    updatedAt: string;
};

type SerializedParentChildRelationship = Omit<
    ParentChildRelationship,
    'createdAt' | 'updatedAt' | 'relationshipType'
> & {
    relationshipType: ParentChildRelationshipType;
    createdAt: string;
    updatedAt: string;
};

type FamilyTreeBranchRow = {
    people: SerializedPerson[];
    relationships: SerializedParentChildRelationship[];
    reached_depth: number;
    depth_truncated: boolean;
    size_truncated: boolean;
};

function mapPerson(person: SerializedPerson): Person {
    return {
        ...person,
        createdAt: new Date(person.createdAt),
        updatedAt: new Date(person.updatedAt),
    };
}

function mapRelationship(relationship: SerializedParentChildRelationship): ParentChildRelationship {
    return {
        ...relationship,
        createdAt: new Date(relationship.createdAt),
        updatedAt: new Date(relationship.updatedAt),
    };
}

export class FamilyTreeRepository {
    constructor(private readonly database: Database) {}

    async findBranch(
        rootPersonId: string,
        direction: TreeDirection,
        depth: number,
    ): Promise<FamilyTreeBranch | null> {
        const { rows } = await this.database.query<FamilyTreeBranchRow>(
            `WITH RECURSIVE
            root AS (
                SELECT id
                FROM persons
                WHERE id = $1
                    AND deleted_at IS NULL
            ),
            traversal AS (
                SELECT
                    root.id AS person_id,
                    0 AS depth
                FROM root

                UNION

                SELECT
                    next_person.id AS person_id,
                    traversal.depth + 1 AS depth
                FROM traversal
                INNER JOIN parent_child_relationships AS relationship
                    ON (
                        $2 = 'ancestors'
                        AND relationship.child_id = traversal.person_id
                    )
                    OR (
                        $2 = 'descendants'
                        AND relationship.parent_id = traversal.person_id
                    )
                    OR (
                        $2 = 'both'
                        AND (
                            relationship.parent_id = traversal.person_id
                            OR relationship.child_id = traversal.person_id
                        )
                    )
                INNER JOIN persons AS next_person
                    ON next_person.id = CASE
                        WHEN $2 = 'ancestors' THEN relationship.parent_id
                        WHEN $2 = 'descendants' THEN relationship.child_id
                        WHEN relationship.parent_id = traversal.person_id
                            THEN relationship.child_id
                        ELSE relationship.parent_id
                    END
                    AND next_person.deleted_at IS NULL
                WHERE traversal.depth < $3 + 1
            ),
            reachable_people AS (
                SELECT
                    person_id,
                    MIN(depth)::integer AS depth
                FROM traversal
                GROUP BY person_id
            ),
            candidate_people AS (
                SELECT person_id, depth
                FROM reachable_people
                WHERE depth <= $3
                ORDER BY depth ASC, person_id ASC
                LIMIT $4 + 1
            ),
            included_people AS (
                SELECT person_id, depth
                FROM candidate_people
                ORDER BY depth ASC, person_id ASC
                LIMIT $4
            )
            SELECT
                COALESCE(
                    (
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'id', person.id,
                                'firstName', person.first_name,
                                'middleNames', person.middle_names,
                                'lastName', person.last_name,
                                'birthName', person.birth_name,
                                'gender', person.gender,
                                'birthDate', ${selectGenealogicalDate('birth_date')},
                                'birthPlace', person.birth_place,
                                'deathDate', ${selectGenealogicalDate('death_date')},
                                'deathPlace', person.death_place,
                                'livingStatus', person.living_status,
                                'biography', person.biography,
                                'createdAt', person.created_at,
                                'updatedAt', person.updated_at
                            )
                            ORDER BY included.depth ASC, person.id ASC
                        )
                        FROM included_people AS included
                        INNER JOIN persons AS person
                            ON person.id = included.person_id
                        LEFT JOIN genealogical_dates AS birth_date
                            ON birth_date.id = person.birth_date_id
                        LEFT JOIN genealogical_dates AS death_date
                            ON death_date.id = person.death_date_id
                    ),
                    '[]'::jsonb
                ) AS people,
                COALESCE(
                    (
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'id', relationship.id,
                                'parentId', relationship.parent_id,
                                'childId', relationship.child_id,
                                'relationshipType', relationship.relationship_type,
                                'evidenceStatus', relationship.evidence_status,
                                'createdAt', relationship.created_at,
                                'updatedAt', relationship.updated_at
                            )
                            ORDER BY relationship.created_at ASC, relationship.id ASC
                        )
                        FROM parent_child_relationships AS relationship
                        INNER JOIN included_people AS parent
                            ON parent.person_id = relationship.parent_id
                        INNER JOIN included_people AS child
                            ON child.person_id = relationship.child_id
                    ),
                    '[]'::jsonb
                ) AS relationships,
                COALESCE(
                    (
                        SELECT MAX(included.depth)
                        FROM included_people AS included
                    ),
                    0
                )::integer AS reached_depth,
                EXISTS (
                    SELECT 1
                    FROM reachable_people AS reachable
                    WHERE reachable.depth > $3
                ) AS depth_truncated,
                (
                    SELECT COUNT(*) > $4
                    FROM candidate_people
                ) AS size_truncated
            FROM root`,
            [rootPersonId, direction, depth, MAX_FAMILY_TREE_PEOPLE],
        );
        const row = rows[0];

        if (row === undefined) {
            return null;
        }

        const truncationReasons: FamilyTreeTruncationReason[] = [];

        if (row.depth_truncated) {
            truncationReasons.push(FamilyTreeTruncationReason.DepthLimit);
        }

        if (row.size_truncated) {
            truncationReasons.push(FamilyTreeTruncationReason.SizeLimit);
        }

        return {
            people: row.people.map(mapPerson),
            relationships: row.relationships.map(mapRelationship),
            reachedDepth: row.reached_depth,
            truncationReasons,
        };
    }
}
