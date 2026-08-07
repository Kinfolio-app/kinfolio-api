import { isDeepStrictEqual } from 'node:util';
import {
    GenealogicalDateRepository,
    normalizeGenealogicalDate,
    selectGenealogicalDate,
} from '../../shared/genealogy/genealogical-date.repository.js';
import type { GenealogicalDate } from '../../shared/genealogy/genealogical-date.types.js';
import {
    runInTransaction,
    type Database,
    type QueryableDatabase,
} from '../../shared/database/transaction.js';
import { CoupleRelationshipNotFoundError } from './couple-relationship.error.js';
import type {
    CreateCoupleRelationshipEventDto,
    UpdateCoupleRelationshipEventDto,
} from './couple-relationship.schema.js';
import type {
    CoupleRelationshipEvent,
    CoupleRelationshipEventPage,
    CoupleRelationshipEventType,
} from './couple-relationship.types.js';

type CoupleRelationshipEventRow = {
    id: string;
    couple_relationship_id: string;
    event_type: CoupleRelationshipEventType;
    date: GenealogicalDate | null;
    place: string | null;
    description: string | null;
    created_at: Date;
    updated_at: Date;
};

type CoupleRelationshipEventStateRow = CoupleRelationshipEventRow & {
    date_id: string | null;
};

const COUPLE_RELATIONSHIP_EVENT_SELECT = `
    SELECT
        event.id,
        event.couple_relationship_id,
        event.event_type,
        ${selectGenealogicalDate('date')} AS date,
        event.place,
        event.description,
        event.created_at,
        event.updated_at
    FROM couple_relationship_events AS event
    INNER JOIN couple_relationships AS relationship
        ON relationship.id = event.couple_relationship_id
    INNER JOIN persons AS partner_1
        ON partner_1.id = relationship.partner_1_id
    INNER JOIN persons AS partner_2
        ON partner_2.id = relationship.partner_2_id
    LEFT JOIN genealogical_dates AS date
        ON date.id = event.date_id
`;

function mapCoupleRelationshipEventRow(row: CoupleRelationshipEventRow): CoupleRelationshipEvent {
    return {
        id: row.id,
        coupleRelationshipId: row.couple_relationship_id,
        eventType: row.event_type,
        date: row.date,
        place: row.place,
        description: row.description,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

async function createDate(
    database: QueryableDatabase,
    date: GenealogicalDate | null | undefined,
): Promise<string | null> {
    if (date == null) {
        return null;
    }

    return new GenealogicalDateRepository(database).create(date);
}

export class CoupleRelationshipEventRepository {
    constructor(private readonly database: Database) {}

    private async findByIdWithDatabase(
        database: QueryableDatabase,
        id: string,
    ): Promise<CoupleRelationshipEvent | null> {
        const { rows } = await database.query<CoupleRelationshipEventRow>(
            `${COUPLE_RELATIONSHIP_EVENT_SELECT}
            WHERE event.id = $1
                AND partner_1.deleted_at IS NULL
                AND partner_2.deleted_at IS NULL`,
            [id],
        );
        const row = rows[0];

        return row === undefined ? null : mapCoupleRelationshipEventRow(row);
    }

    async create(
        coupleRelationshipId: string,
        input: CreateCoupleRelationshipEventDto,
    ): Promise<CoupleRelationshipEvent> {
        return runInTransaction(this.database, async (database) => {
            const { rows: relationshipRows } = await database.query<{ id: string }>(
                `SELECT relationship.id
                FROM couple_relationships AS relationship
                INNER JOIN persons AS partner_1
                    ON partner_1.id = relationship.partner_1_id
                INNER JOIN persons AS partner_2
                    ON partner_2.id = relationship.partner_2_id
                WHERE relationship.id = $1
                    AND partner_1.deleted_at IS NULL
                    AND partner_2.deleted_at IS NULL
                FOR UPDATE OF relationship, partner_1, partner_2`,
                [coupleRelationshipId],
            );

            if (relationshipRows[0] === undefined) {
                throw new CoupleRelationshipNotFoundError();
            }

            const dateId = await createDate(database, input.date);
            const { rows } = await database.query<{ id: string }>(
                `INSERT INTO couple_relationship_events (
                    couple_relationship_id,
                    event_type,
                    date_id,
                    place,
                    description
                )
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id`,
                [
                    coupleRelationshipId,
                    input.eventType,
                    dateId,
                    input.place ?? null,
                    input.description ?? null,
                ],
            );
            const row = rows[0];

            if (row === undefined) {
                throw new Error('PostgreSQL did not return the created couple relationship event.');
            }

            const createdEvent = await this.findByIdWithDatabase(database, row.id);

            if (createdEvent === null) {
                throw new Error('PostgreSQL did not return the created couple relationship event.');
            }

            return createdEvent;
        });
    }

    async findById(id: string): Promise<CoupleRelationshipEvent | null> {
        return this.findByIdWithDatabase(this.database, id);
    }

    async findByRelationshipId(
        coupleRelationshipId: string,
        limit: number,
        page: number,
    ): Promise<CoupleRelationshipEventPage | null> {
        const { rows: relationshipRows } = await this.database.query<{ exists: boolean }>(
            `SELECT EXISTS (
                SELECT 1
                FROM couple_relationships AS relationship
                INNER JOIN persons AS partner_1
                    ON partner_1.id = relationship.partner_1_id
                INNER JOIN persons AS partner_2
                    ON partner_2.id = relationship.partner_2_id
                WHERE relationship.id = $1
                    AND partner_1.deleted_at IS NULL
                    AND partner_2.deleted_at IS NULL
            ) AS exists`,
            [coupleRelationshipId],
        );

        if (relationshipRows[0]?.exists !== true) {
            return null;
        }

        const { rows } = await this.database.query<CoupleRelationshipEventRow>(
            `${COUPLE_RELATIONSHIP_EVENT_SELECT}
            WHERE event.couple_relationship_id = $1
                AND partner_1.deleted_at IS NULL
                AND partner_2.deleted_at IS NULL
            ORDER BY event.created_at ASC, event.id ASC
            LIMIT $2
            OFFSET $3`,
            [coupleRelationshipId, limit, (page - 1) * limit],
        );
        const { rows: countRows } = await this.database.query<{ total_items: number }>(
            `SELECT COUNT(*)::integer AS total_items
            FROM couple_relationship_events
            WHERE couple_relationship_id = $1`,
            [coupleRelationshipId],
        );
        const countRow = countRows[0];

        if (countRow === undefined) {
            throw new Error('PostgreSQL did not return the couple relationship events count.');
        }

        return {
            data: rows.map(mapCoupleRelationshipEventRow),
            totalItems: Number(countRow.total_items),
        };
    }

    async update(
        id: string,
        input: UpdateCoupleRelationshipEventDto,
    ): Promise<CoupleRelationshipEvent | null> {
        return runInTransaction(this.database, async (database) => {
            const { rows: stateRows } = await database.query<CoupleRelationshipEventStateRow>(
                `SELECT
                    event.id,
                    event.couple_relationship_id,
                    event.event_type,
                    event.date_id,
                    ${selectGenealogicalDate('date')} AS date,
                    event.place,
                    event.description,
                    event.created_at,
                    event.updated_at
                FROM couple_relationship_events AS event
                INNER JOIN couple_relationships AS relationship
                    ON relationship.id = event.couple_relationship_id
                INNER JOIN persons AS partner_1
                    ON partner_1.id = relationship.partner_1_id
                INNER JOIN persons AS partner_2
                    ON partner_2.id = relationship.partner_2_id
                LEFT JOIN genealogical_dates AS date
                    ON date.id = event.date_id
                WHERE event.id = $1
                    AND partner_1.deleted_at IS NULL
                    AND partner_2.deleted_at IS NULL
                FOR UPDATE OF event`,
                [id],
            );
            const state = stateRows[0];

            if (state === undefined) {
                return null;
            }

            const nextDate = input.date === undefined ? state.date : input.date;
            const normalizedNextDate =
                nextDate === null ? null : normalizeGenealogicalDate(nextDate);
            const dateChanged = !isDeepStrictEqual(state.date, normalizedNextDate);
            const dateId = dateChanged
                ? await createDate(database, normalizedNextDate)
                : state.date_id;

            await database.query(
                `UPDATE couple_relationship_events
                SET
                    event_type = $2,
                    date_id = $3,
                    place = $4,
                    description = $5,
                    updated_at = NOW()
                WHERE id = $1`,
                [
                    id,
                    input.eventType ?? state.event_type,
                    dateId,
                    input.place === undefined ? state.place : input.place,
                    input.description === undefined ? state.description : input.description,
                ],
            );

            if (dateChanged && state.date_id !== null) {
                await new GenealogicalDateRepository(database).deleteOrphaned([state.date_id]);
            }

            const updatedEvent = await this.findByIdWithDatabase(database, id);

            if (updatedEvent === null) {
                throw new Error('PostgreSQL did not return the updated couple relationship event.');
            }

            return updatedEvent;
        });
    }
}
