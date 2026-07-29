import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PersonRepository } from '../../../../src/modules/people/person.repository.js';
import { LivingStatus } from '../../../../src/modules/people/person.types.js';

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
});
