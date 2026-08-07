import { isDeepStrictEqual } from 'node:util';
import { Pool, type PoolClient } from 'pg';
import {
    GenealogicalDateRepository,
    normalizeGenealogicalDate,
    selectGenealogicalDate,
} from '../../shared/genealogy/genealogical-date.repository.js';
import type { GenealogicalDate } from '../../shared/genealogy/genealogical-date.types.js';
import type { CreatePersonDto } from './person.schema.js';
import { Gender, LivingStatus, type Person } from './person.types.js';
import { runInTransaction } from '../../shared/database/transaction.js';

type QueryableDatabase = Pick<Pool, 'query'>;
type Database = Pool | PoolClient;

type PersonRow = {
    id: string;
    first_name: string | null;
    middle_names: string | null;
    last_name: string | null;
    birth_name: string | null;
    gender: Gender;
    birth_date: GenealogicalDate | null;
    birth_place: string | null;
    death_date: GenealogicalDate | null;
    death_place: string | null;
    living_status: LivingStatus;
    biography: string | null;
    created_at: Date;
    updated_at: Date;
};

type PersonDateStateRow = {
    birth_date_id: string | null;
    birth_date: GenealogicalDate | null;
    death_date_id: string | null;
    death_date: GenealogicalDate | null;
};

const PERSON_SELECT = `
    SELECT
        person.id,
        person.first_name,
        person.middle_names,
        person.last_name,
        person.birth_name,
        person.gender,
        ${selectGenealogicalDate('birth_date')} AS birth_date,
        person.birth_place,
        ${selectGenealogicalDate('death_date')} AS death_date,
        person.death_place,
        person.living_status,
        person.biography,
        person.created_at,
        person.updated_at
    FROM persons AS person
    LEFT JOIN genealogical_dates AS birth_date ON birth_date.id = person.birth_date_id
    LEFT JOIN genealogical_dates AS death_date ON death_date.id = person.death_date_id
`;

const BIRTH_DATE_SORT_EXPRESSION = `
    CASE
        WHEN COALESCE(birth_date.first_calendar, birth_date.second_calendar) = 'gregorian'
        THEN
            CASE COALESCE(birth_date.first_epoch, birth_date.second_epoch)
                WHEN 'before_common' THEN
                    (1 - COALESCE(birth_date.first_year, birth_date.second_year)) * 10000
                ELSE COALESCE(birth_date.first_year, birth_date.second_year) * 10000
            END
            + COALESCE(birth_date.first_month, birth_date.second_month, 0) * 100
            + COALESCE(birth_date.first_day, birth_date.second_day, 0)
        ELSE NULL
    END
`;

export type PersonOrderBy = {
    field: 'firstName' | 'birthDate';
    direction: 'ASC' | 'DESC';
};

type ParamValues = (string | number)[];

export type PersonPage = {
    data: Person[];
    totalItems: number;
};

function mapPersonRow(row: PersonRow): Person {
    return {
        id: row.id,
        firstName: row.first_name,
        middleNames: row.middle_names,
        lastName: row.last_name,
        birthName: row.birth_name,
        gender: row.gender,
        birthDate: row.birth_date,
        birthPlace: row.birth_place,
        deathDate: row.death_date,
        deathPlace: row.death_place,
        livingStatus: row.living_status,
        biography: row.biography,
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

export class PersonRepository {
    constructor(private readonly database: Database) {}

    private async findByIdWithDatabase(
        database: QueryableDatabase,
        id: string,
    ): Promise<Person | null> {
        const { rows } = await database.query<PersonRow>(
            `${PERSON_SELECT}
            WHERE person.id = $1
                AND person.deleted_at IS NULL`,
            [id],
        );
        const row = rows[0];

        return row === undefined ? null : mapPersonRow(row);
    }

    async create(person: CreatePersonDto): Promise<Person> {
        return runInTransaction(this.database, async (database) => {
            const birthDateId = await createDate(database, person.birthDate);
            const deathDateId = await createDate(database, person.deathDate);
            const { rows } = await database.query<{ id: string }>(
                `INSERT INTO persons (
                    first_name,
                    middle_names,
                    last_name,
                    birth_name,
                    gender,
                    birth_date_id,
                    birth_place,
                    death_date_id,
                    death_place,
                    living_status,
                    biography
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING id`,
                [
                    person.firstName ?? null,
                    person.middleNames ?? null,
                    person.lastName ?? null,
                    person.birthName ?? null,
                    person.gender ?? Gender.Unspecified,
                    birthDateId,
                    person.birthPlace ?? null,
                    deathDateId,
                    person.deathPlace ?? null,
                    person.livingStatus ?? LivingStatus.Unknown,
                    person.biography ?? null,
                ],
            );
            const row = rows[0];

            if (row === undefined) {
                throw new Error('PostgreSQL did not return the created person.');
            }

            const createdPerson = await this.findByIdWithDatabase(database, row.id);

            if (createdPerson === null) {
                throw new Error('PostgreSQL did not return the created person.');
            }

            return createdPerson;
        });
    }

    async findById(id: string): Promise<Person | null> {
        return this.findByIdWithDatabase(this.database, id);
    }

    async findBy(limit: number, page: number, orderBy: PersonOrderBy[]): Promise<PersonPage> {
        let query = `${PERSON_SELECT} WHERE person.deleted_at IS NULL`;
        let nbParams = 1;
        const values: ParamValues = [];
        const orderByClause = orderBy.flatMap(({ field, direction }) => {
            if (field === 'firstName') {
                return [`person.first_name ${direction}`];
            }

            return [`${BIRTH_DATE_SORT_EXPRESSION} ${direction} NULLS LAST`];
        });

        orderByClause.push('person.id ASC');
        query += ` ORDER BY ${orderByClause.join(', ')}`;

        if (limit > 0) {
            query += ` LIMIT $${nbParams++}`;
            values.push(limit);
        }

        if (page > 1) {
            query += ` OFFSET $${nbParams}`;
            values.push((page - 1) * limit);
        }

        const { rows } = await this.database.query<PersonRow>(query, values);
        const { rows: countRows } = await this.database.query<{ total_items: string }>(
            'SELECT COUNT(*) AS total_items FROM persons WHERE deleted_at IS NULL',
        );
        const countRow = countRows[0];

        if (countRow === undefined) {
            throw new Error('PostgreSQL did not return the persons count.');
        }

        return {
            data: rows.map(mapPersonRow),
            totalItems: Number(countRow.total_items),
        };
    }

    async update(person: Person): Promise<Person> {
        return runInTransaction(this.database, async (database) => {
            const { rows: stateRows } = await database.query<PersonDateStateRow>(
                `SELECT
                    person.birth_date_id,
                    ${selectGenealogicalDate('birth_date')} AS birth_date,
                    person.death_date_id,
                    ${selectGenealogicalDate('death_date')} AS death_date
                FROM persons AS person
                LEFT JOIN genealogical_dates AS birth_date ON birth_date.id = person.birth_date_id
                LEFT JOIN genealogical_dates AS death_date ON death_date.id = person.death_date_id
                WHERE person.id = $1
                    AND person.deleted_at IS NULL
                FOR UPDATE OF person`,
                [person.id],
            );
            const state = stateRows[0];

            if (state === undefined) {
                throw new Error('PostgreSQL did not return the updated person.');
            }

            const normalizedBirthDate =
                person.birthDate === null ? null : normalizeGenealogicalDate(person.birthDate);
            const normalizedDeathDate =
                person.deathDate === null ? null : normalizeGenealogicalDate(person.deathDate);
            const birthDateChanged = !isDeepStrictEqual(state.birth_date, normalizedBirthDate);
            const deathDateChanged = !isDeepStrictEqual(state.death_date, normalizedDeathDate);
            const birthDateId = birthDateChanged
                ? await createDate(database, normalizedBirthDate)
                : state.birth_date_id;
            const deathDateId = deathDateChanged
                ? await createDate(database, normalizedDeathDate)
                : state.death_date_id;
            const { rows } = await database.query<{ id: string }>(
                `UPDATE persons
                SET
                    first_name = $2,
                    middle_names = $3,
                    last_name = $4,
                    birth_name = $5,
                    gender = $6,
                    birth_date_id = $7,
                    birth_place = $8,
                    death_date_id = $9,
                    death_place = $10,
                    living_status = $11,
                    biography = $12,
                    updated_at = NOW()
                WHERE id = $1
                    AND deleted_at IS NULL
                RETURNING id`,
                [
                    person.id,
                    person.firstName,
                    person.middleNames,
                    person.lastName,
                    person.birthName,
                    person.gender,
                    birthDateId,
                    person.birthPlace,
                    deathDateId,
                    person.deathPlace,
                    person.livingStatus,
                    person.biography,
                ],
            );

            if (rows[0] === undefined) {
                throw new Error('PostgreSQL did not return the updated person.');
            }

            const replacedDateIds = [
                birthDateChanged ? state.birth_date_id : null,
                deathDateChanged ? state.death_date_id : null,
            ].filter((id): id is string => id !== null);

            await new GenealogicalDateRepository(database).deleteOrphaned(replacedDateIds);

            const updatedPerson = await this.findByIdWithDatabase(database, person.id);

            if (updatedPerson === null) {
                throw new Error('PostgreSQL did not return the updated person.');
            }

            return updatedPerson;
        });
    }

    async deleteById(id: string): Promise<boolean> {
        const { rows } = await this.database.query<{ id: string }>(
            `UPDATE persons
            SET
                deleted_at = NOW(),
                updated_at = NOW()
            WHERE id = $1
                AND deleted_at IS NULL
            RETURNING id`,
            [id],
        );

        return rows[0] !== undefined;
    }
}
