import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PersonRepository } from '../../../../src/modules/people/person.repository.js';
import { Gender, LivingStatus } from '../../../../src/modules/people/person.types.js';

const TEST_DATABASE_NAME = 'kinfolio_test';

function getTestDatabaseUrl(): string {
    const databaseUrl = process.env.DATABASE_URL;

    if (databaseUrl === undefined) {
        throw new Error('DATABASE_URL is required for integration tests.');
    }

    const url = new URL(databaseUrl);
    const databaseName = decodeURIComponent(url.pathname.slice(1));

    if (databaseName !== TEST_DATABASE_NAME) {
        throw new Error(
            `Integration tests require database "${TEST_DATABASE_NAME}", received "${databaseName}".`,
        );
    }

    return databaseUrl;
}

describe('PersonRepository integration', () => {
    let pool: Pool;
    let client: PoolClient;
    let repository: PersonRepository;

    beforeAll(async () => {
        pool = new Pool({
            connectionString: getTestDatabaseUrl(),
        });

        await pool.query('SELECT 1');
    });

    beforeEach(async () => {
        client = await pool.connect();
        await client.query('BEGIN');

        repository = new PersonRepository(client);
    });

    afterEach(async () => {
        try {
            await client.query('ROLLBACK');
        } finally {
            client.release();
        }
    });

    afterAll(async () => {
        await pool.end();
    });

    it('creates a person with database defaults', async () => {
        const person = await repository.create({
            firstName: 'Alice',
        });

        expect(person).toEqual({
            id: expect.any(String),
            firstName: 'Alice',
            middleNames: null,
            lastName: null,
            birthName: null,
            gender: Gender.Unspecified,
            birthDate: null,
            birthPlace: null,
            deathDate: null,
            deathPlace: null,
            livingStatus: LivingStatus.Unknown,
            biography: null,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
        });
    });

    it('creates and finds a person by id', async () => {
        const createdPerson = await repository.create({
            firstName: 'Alice',
            middleNames: 'Louise',
            lastName: 'Martin',
            birthName: 'Durand',
            gender: Gender.Female,
            birthDate: '1985-03-12',
            birthPlace: 'Lyon',
            deathDate: '2025-06-18',
            deathPlace: 'Paris',
            livingStatus: LivingStatus.Deceased,
            biography: 'Test biography.',
        });

        const person = await repository.findById(createdPerson.id);

        expect(person).toEqual(createdPerson);
    });

    it('returns null when a person does not exist', async () => {
        const person = await repository.findById(randomUUID());

        expect(person).toBeNull();
    });

    it('returns a sorted page and the total number of people', async () => {
        await repository.create({ firstName: 'Charlie' });
        await repository.create({ firstName: 'Alice' });
        await repository.create({ firstName: 'Bob' });

        const result = await repository.findBy(2, 2, [
            {
                field: 'firstName',
                direction: 'ASC',
            },
        ]);

        expect(result.totalItems).toBe(3);
        expect(result.data).toHaveLength(1);
        expect(result.data[0]?.firstName).toBe('Charlie');
    });

    it('updates a person', async () => {
        const person = await repository.create({
            firstName: 'Alice',
            biography: 'Biography',
        });

        const updatedPerson = await repository.update({
            ...person,
            firstName: 'Alicia',
            biography: null,
        });

        expect(updatedPerson).toEqual({
            ...person,
            firstName: 'Alicia',
            biography: null,
            updatedAt: expect.any(Date),
        });
    });

    it('soft deletes a person and excludes it from reads', async () => {
        const person = await repository.create({
            firstName: 'Alice',
        });

        const deleted = await repository.deleteById(person.id);
        const foundPerson = await repository.findById(person.id);
        const page = await repository.findBy(20, 1, [
            {
                field: 'firstName',
                direction: 'ASC',
            },
        ]);
        const { rows } = await client.query<{ deleted_at: Date | null }>(
            'SELECT deleted_at FROM persons WHERE id = $1',
            [person.id],
        );

        expect(deleted).toBe(true);
        expect(foundPerson).toBeNull();
        expect(page).toEqual({
            data: [],
            totalItems: 0,
        });
        expect(rows[0]?.deleted_at).toBeInstanceOf(Date);
    });

    it('returns false when a person is already soft deleted', async () => {
        const person = await repository.create({
            firstName: 'Alice',
        });

        await repository.deleteById(person.id);

        await expect(repository.deleteById(person.id)).resolves.toBe(false);
    });
});
