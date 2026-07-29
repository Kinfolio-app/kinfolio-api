import type { Pool } from 'pg';
import { LivingStatus, type Person } from './person.types.js';
import type { CreatePersonDto } from './person.schema.js';

type Database = Pick<Pool, 'query'>;

type PersonRow = {
    id: string;
    first_name: string | null;
    middle_names: string | null;
    last_name: string | null;
    birth_name: string | null;
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
                birth_date,
                birth_place,
                death_date,
                death_place,
                living_status,
                biography
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *`,
            [
                person.firstName ?? null,
                person.middleNames ?? null,
                person.lastName ?? null,
                person.birthName ?? null,
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
            `SELECT * FROM persons WHERE id = $1`,
            [id],
        );

        const row = rows[0];

        if (row === undefined) {
            return null;
        }

        return mapPersonRow(row);
    }

    async findBy(limit: number, page: number, orderBy: PersonOrderBy[]): Promise<PersonPage> {
        let query = 'SELECT * FROM persons';
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
            'SELECT COUNT(*) AS total_items FROM persons',
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
}
