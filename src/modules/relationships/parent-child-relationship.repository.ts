import type { Pool } from 'pg';
import {
    DuplicateParentChildRelationshipError,
    ParentChildRelationshipCycleError,
    RelatedPersonNotFoundError,
} from './parent-child-relationship.error.js';
import type { CreateParentChildRelationshipDto } from './parent-child-relationship.schema.js';
import {
    ParentChildRelationshipEvidenceStatus,
    ParentChildRelationshipType,
    type ParentChildRelationship,
} from './parent-child-relationship.types.js';

type Database = Pick<Pool, 'connect' | 'query'>;

type ParentChildRelationshipRow = {
    id: string;
    parent_id: string;
    child_id: string;
    relationship_type: ParentChildRelationshipType;
    evidence_status: ParentChildRelationshipEvidenceStatus;
    created_at: Date;
    updated_at: Date;
};

export type ParentChildRelationshipPage = {
    data: ParentChildRelationship[];
    totalItems: number;
};

type PostgreSqlError = Error & {
    code?: string;
};

function isPostgreSqlError(error: unknown): error is PostgreSqlError {
    return error instanceof Error && 'code' in error;
}

function mapParentChildRelationshipRow(row: ParentChildRelationshipRow): ParentChildRelationship {
    return {
        id: row.id,
        parentId: row.parent_id,
        childId: row.child_id,
        relationshipType: row.relationship_type,
        evidenceStatus: row.evidence_status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export class ParentChildRelationshipRepository {
    constructor(private readonly database: Database) {}

    async create(relationship: CreateParentChildRelationshipDto): Promise<ParentChildRelationship> {
        const client = await this.database.connect();

        try {
            await client.query('BEGIN');
            await client.query(
                "SELECT pg_advisory_xact_lock(hashtext('parent_child_relationships'))",
            );

            const { rows: countRows } = await client.query<{ count: number }>(
                `SELECT COUNT(*)::integer AS count
                FROM persons
                WHERE id = ANY($1::uuid[])
                    AND deleted_at IS NULL`,
                [[relationship.parentId, relationship.childId]],
            );

            if (countRows[0]?.count !== 2) {
                throw new RelatedPersonNotFoundError();
            }

            const { rows: cycleRows } = await client.query<{ would_create_cycle: boolean }>(
                `WITH RECURSIVE descendants AS (
                    SELECT child_id
                    FROM parent_child_relationships
                    WHERE parent_id = $1

                    UNION

                    SELECT relationship.child_id
                    FROM parent_child_relationships AS relationship
                    INNER JOIN descendants
                        ON relationship.parent_id = descendants.child_id
                )
                SELECT EXISTS (
                    SELECT 1
                    FROM descendants
                    WHERE child_id = $2
                ) AS would_create_cycle`,
                [relationship.childId, relationship.parentId],
            );

            if (cycleRows[0]?.would_create_cycle === true) {
                throw new ParentChildRelationshipCycleError();
            }

            const { rows } = await client.query<ParentChildRelationshipRow>(
                `INSERT INTO parent_child_relationships (
                    parent_id,
                    child_id,
                    relationship_type,
                    evidence_status
                )
                VALUES ($1, $2, $3, $4)
                RETURNING *`,
                [
                    relationship.parentId,
                    relationship.childId,
                    relationship.relationshipType ?? ParentChildRelationshipType.Unspecified,
                    relationship.evidenceStatus ?? ParentChildRelationshipEvidenceStatus.Unassessed,
                ],
            );
            const row = rows[0];

            if (row === undefined) {
                throw new Error('PostgreSQL did not return the created parent-child relationship.');
            }

            await client.query('COMMIT');

            return mapParentChildRelationshipRow(row);
        } catch (error) {
            await client.query('ROLLBACK');

            if (isPostgreSqlError(error) && error.code === '23505') {
                throw new DuplicateParentChildRelationshipError({
                    cause: error,
                });
            }

            if (isPostgreSqlError(error) && error.code === '23503') {
                throw new RelatedPersonNotFoundError({
                    cause: error,
                });
            }

            throw error;
        } finally {
            client.release();
        }
    }

    async findById(id: string): Promise<ParentChildRelationship | null> {
        const { rows } = await this.database.query<ParentChildRelationshipRow>(
            `SELECT relationship.*
            FROM parent_child_relationships AS relationship
            INNER JOIN persons AS parent
                ON parent.id = relationship.parent_id
            INNER JOIN persons AS child
                ON child.id = relationship.child_id
            WHERE relationship.id = $1
                AND parent.deleted_at IS NULL
                AND child.deleted_at IS NULL`,
            [id],
        );
        const row = rows[0];

        return row === undefined ? null : mapParentChildRelationshipRow(row);
    }

    async findByPersonId(
        personId: string,
        limit: number,
        page: number,
    ): Promise<ParentChildRelationshipPage | null> {
        const { rows: personRows } = await this.database.query<{ exists: boolean }>(
            `SELECT EXISTS (
                SELECT 1
                FROM persons
                WHERE id = $1
                    AND deleted_at IS NULL
            ) AS exists`,
            [personId],
        );

        if (personRows[0]?.exists !== true) {
            return null;
        }

        const values = [personId, limit, (page - 1) * limit];
        const { rows } = await this.database.query<ParentChildRelationshipRow>(
            `SELECT relationship.*
            FROM parent_child_relationships AS relationship
            INNER JOIN persons AS parent
                ON parent.id = relationship.parent_id
            INNER JOIN persons AS child
                ON child.id = relationship.child_id
            WHERE (
                relationship.parent_id = $1
                OR relationship.child_id = $1
            )
                AND parent.deleted_at IS NULL
                AND child.deleted_at IS NULL
            ORDER BY relationship.created_at ASC, relationship.id ASC
            LIMIT $2
            OFFSET $3`,
            values,
        );
        const { rows: countRows } = await this.database.query<{ total_items: number }>(
            `SELECT COUNT(*)::integer AS total_items
            FROM parent_child_relationships AS relationship
            INNER JOIN persons AS parent
                ON parent.id = relationship.parent_id
            INNER JOIN persons AS child
                ON child.id = relationship.child_id
            WHERE (
                relationship.parent_id = $1
                OR relationship.child_id = $1
            )
                AND parent.deleted_at IS NULL
                AND child.deleted_at IS NULL`,
            [personId],
        );
        const countRow = countRows[0];

        if (countRow === undefined) {
            throw new Error('PostgreSQL did not return the parent-child relationships count.');
        }

        return {
            data: rows.map(mapParentChildRelationshipRow),
            totalItems: countRow.total_items,
        };
    }
}
