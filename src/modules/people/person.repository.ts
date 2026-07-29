import type { Pool } from 'pg';
import { Gender, LivingStatus, type Person } from './person.types.js';
import type { CreatePersonDto } from './person.schema.js';

type Database = Pick<Pool, 'query'>;

type PersonRow = {
    id: string;
    first_name: string | null;
    middle_names: string | null;
    last_name: string | null;
    birth_name: string | null;
    gender: Gender;
    birth_date: Date | null;
    birth_place: string | null;
    death_date: Date | null;
    death_place: string | null;
    living_status: LivingStatus;
    biography: string | null;
    created_at: Date;
    updated_at: Date;
};

const SORT_COLUMNS = {
    firstName: 'first_name',
    birthDate: 'birth_date',
} as const;
export type PersonOrderBy = {
    field: keyof typeof SORT_COLUMNS;
    direction: 'ASC' | 'DESC';
};

type ParamValues = (string | number)[];

export type PersonPage = {
    data: Person[];
    totalItems: number;
};

function formatDateOnly(date: Date | null): string | null {
    if (date === null) {
        return null;
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

function mapPersonRow(row: PersonRow): Person {
    return {
        id: row.id,
        firstName: row.first_name,
        middleNames: row.middle_names,
        lastName: row.last_name,
        birthName: row.birth_name,
        gender: row.gender,
        birthDate: formatDateOnly(row.birth_date),
        birthPlace: row.birth_place,
        deathDate: formatDateOnly(row.death_date),
        deathPlace: row.death_place,
        livingStatus: row.living_status,
        biography: row.biography,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export class PersonRepository {
    constructor(private readonly database: Database) {}

    async create(person: CreatePersonDto): Promise<Person> {
        const { rows } = await this.database.query<PersonRow>(
            `INSERT INTO persons (
                first_name,
                middle_names,
                last_name,
                birth_name,
                gender,
                birth_date,
                birth_place,
                death_date,
                death_place,
                living_status,
                biography
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *`,
            [
                person.firstName ?? null,
                person.middleNames ?? null,
                person.lastName ?? null,
                person.birthName ?? null,
                person.gender ?? Gender.Unspecified,
                person.birthDate ?? null,
                person.birthPlace ?? null,
                person.deathDate ?? null,
                person.deathPlace ?? null,
                person.livingStatus ?? LivingStatus.Unknown,
                person.biography ?? null,
            ],
        );

        const row = rows[0];

        if (row === undefined) {
            throw new Error('PostgreSQL did not return the created person.');
        }

        return mapPersonRow(row);
    }

    async findById(id: string): Promise<Person | null> {
        const { rows } = await this.database.query<PersonRow>(
            `SELECT *
            FROM persons
            WHERE id = $1
                AND deleted_at IS NULL`,
            [id],
        );

        const row = rows[0];

        if (row === undefined) {
            return null;
        }

        return mapPersonRow(row);
    }

    async findBy(limit: number, page: number, orderBy: PersonOrderBy[]): Promise<PersonPage> {
        let query = 'SELECT * FROM persons WHERE deleted_at IS NULL';
        let nbParams = 1;
        const values: ParamValues = [];

        const orderByClause = orderBy.map(({ field, direction }) => {
            return `${SORT_COLUMNS[field]} ${direction}`;
        });

        orderByClause.push('id ASC');
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
        const { rows } = await this.database.query<PersonRow>(
            `UPDATE persons
            SET
                first_name = $2,
                middle_names = $3,
                last_name = $4,
                birth_name = $5,
                gender = $6,
                birth_date = $7,
                birth_place = $8,
                death_date = $9,
                death_place = $10,
                living_status = $11,
                biography = $12,
                updated_at = NOW()
            WHERE id = $1
                AND deleted_at IS NULL
            RETURNING *`,
            [
                person.id,
                person.firstName,
                person.middleNames,
                person.lastName,
                person.birthName,
                person.gender,
                person.birthDate,
                person.birthPlace,
                person.deathDate,
                person.deathPlace,
                person.livingStatus,
                person.biography,
            ],
        );

        const row = rows[0];

        if (row === undefined) {
            throw new Error('PostgreSQL did not return the updated person.');
        }

        return mapPersonRow(row);
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
