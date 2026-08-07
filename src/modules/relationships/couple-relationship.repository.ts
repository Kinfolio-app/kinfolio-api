import { runInTransaction, type Database } from '../../shared/database/transaction.js';
import type { CoupleRelationship, CoupleRelationshipPage } from './couple-relationship.types.js';
import type { CreateCoupleRelationshipDto } from './couple-relationship.schema.js';
import {
    CoupleRelationshipPersonNotFoundError,
    SelfCoupleRelationshipError,
} from './couple-relationship.error.js';

type CoupleRelationshipRow = {
    id: string;
    partner_1_id: string;
    partner_2_id: string;
    created_at: Date;
    updated_at: Date;
};

function mapCoupleRelationshipRow(row: CoupleRelationshipRow): CoupleRelationship {
    return {
        id: row.id,
        partner1Id: row.partner_1_id,
        partner2Id: row.partner_2_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function canonicalizePartnerIds(partner1Id: string, partner2Id: string): [string, string] {
    return partner1Id < partner2Id ? [partner1Id, partner2Id] : [partner2Id, partner1Id];
}

export class CoupleRelationshipRepository {
    constructor(private readonly database: Database) {}

    async create(input: CreateCoupleRelationshipDto): Promise<CoupleRelationship> {
        if (input.partner1Id === input.partner2Id) {
            throw new SelfCoupleRelationshipError();
        }

        const [partner1Id, partner2Id] = canonicalizePartnerIds(input.partner1Id, input.partner2Id);

        return runInTransaction(this.database, async (database) => {
            const { rows: partnerRows } = await database.query<{ id: string }>(
                `SELECT id
                FROM persons
                WHERE id = ANY($1::uuid[])
                AND deleted_at IS NULL
                FOR UPDATE`,
                [[partner1Id, partner2Id]],
            );

            if (partnerRows.length !== 2) {
                throw new CoupleRelationshipPersonNotFoundError();
            }

            const { rows } = await database.query<CoupleRelationshipRow>(
                `INSERT INTO couple_relationships (
                    partner_1_id,
                    partner_2_id
                ) VALUES ($1, $2)
                RETURNING *`,
                [partner1Id, partner2Id],
            );

            const row = rows[0];

            if (row === undefined) {
                throw new Error('PostgreSQL did not return the couple relationship.');
            }

            return mapCoupleRelationshipRow(row);
        });
    }

    async findById(id: string): Promise<CoupleRelationship | null> {
        const { rows } = await this.database.query<CoupleRelationshipRow>(
            `SELECT relationship.*
            FROM couple_relationships AS relationship
            INNER JOIN persons AS partner_1
                ON partner_1.id = relationship.partner_1_id
            INNER JOIN persons AS partner_2
                ON partner_2.id = relationship.partner_2_id
            WHERE relationship.id = $1
                AND partner_1.deleted_at IS NULL
                AND partner_2.deleted_at IS NULL`,
            [id],
        );
        const row = rows[0];

        return row === undefined ? null : mapCoupleRelationshipRow(row);
    }

    async findByPersonId(
        personId: string,
        limit: number,
        page: number,
    ): Promise<CoupleRelationshipPage | null> {
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
        const { rows } = await this.database.query<CoupleRelationshipRow>(
            `SELECT relationship.*
            FROM couple_relationships AS relationship
            INNER JOIN persons AS partner_1
                ON partner_1.id = relationship.partner_1_id
            INNER JOIN persons AS partner_2
                ON partner_2.id = relationship.partner_2_id
            WHERE (
                relationship.partner_1_id = $1
                OR relationship.partner_2_id = $1
            )
                AND partner_1.deleted_at IS NULL
                AND partner_2.deleted_at IS NULL
            ORDER BY relationship.created_at ASC, relationship.id ASC
            LIMIT $2
            OFFSET $3`,
            values,
        );
        const { rows: countRows } = await this.database.query<{ total_items: number }>(
            `SELECT COUNT(*)::integer AS total_items
            FROM couple_relationships AS relationship
            INNER JOIN persons AS partner_1
                ON partner_1.id = relationship.partner_1_id
            INNER JOIN persons AS partner_2
                ON partner_2.id = relationship.partner_2_id
            WHERE (
                relationship.partner_1_id = $1
                OR relationship.partner_2_id = $1
            )
                AND partner_1.deleted_at IS NULL
                AND partner_2.deleted_at IS NULL`,
            [personId],
        );
        const countRow = countRows[0];

        if (countRow === undefined) {
            throw new Error('PostgreSQL did not return the couple relationships count.');
        }

        return {
            data: rows.map(mapCoupleRelationshipRow),
            totalItems: Number(countRow.total_items),
        };
    }
}
