import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PersonRepository } from '../../../../src/modules/people/person.repository.js';
import { Gender, LivingStatus } from '../../../../src/modules/people/person.types.js';
import { exactGregorianDate } from '../../../fixtures/genealogical-date.js';
import { GenealogicalDateKind } from '../../../../src/shared/genealogy/genealogical-date.types.js';

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
            birthDate: exactGregorianDate(1985, 3, 12),
            birthPlace: 'Lyon',
            deathDate: exactGregorianDate(2025, 6, 18),
            deathPlace: 'Paris',
            livingStatus: LivingStatus.Deceased,
            biography: 'Test biography.',
        });

        const person = await repository.findById(createdPerson.id);

        expect(person).toEqual(createdPerson);
    });

    it('persists a partial and approximate genealogical date', async () => {
        const birthDate = {
            ...exactGregorianDate(1900),
            kind: GenealogicalDateKind.About,
            originalText: 'ABT 1900',
        };
        const person = await repository.create({
            firstName: 'Alice',
            birthDate,
        });

        expect(person.birthDate).toEqual(birthDate);
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
            birthDate: exactGregorianDate(1985, 3, 12),
            biography: 'Biography',
        });
        const { rows: initialRows } = await client.query<{ birth_date_id: string }>(
            'SELECT birth_date_id FROM persons WHERE id = $1',
            [person.id],
        );

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
        const { rows: updatedRows } = await client.query<{ birth_date_id: string }>(
            'SELECT birth_date_id FROM persons WHERE id = $1',
            [person.id],
        );

        expect(updatedRows[0]?.birth_date_id).toBe(initialRows[0]?.birth_date_id);
    });

    it('replaces and removes an owned genealogical date', async () => {
        const person = await repository.create({
            firstName: 'Alice',
            birthDate: exactGregorianDate(1985, 3, 12),
        });
        const { rows: initialRows } = await client.query<{ birth_date_id: string }>(
            'SELECT birth_date_id FROM persons WHERE id = $1',
            [person.id],
        );
        const initialDateId = initialRows[0]?.birth_date_id;
        const replacement = exactGregorianDate(1986);

        const replacedPerson = await repository.update({
            ...person,
            birthDate: replacement,
        });
        const { rows: replacementRows } = await client.query<{ birth_date_id: string }>(
            'SELECT birth_date_id FROM persons WHERE id = $1',
            [person.id],
        );

        expect(replacedPerson.birthDate).toEqual(replacement);
        expect(replacementRows[0]?.birth_date_id).not.toBe(initialDateId);
        await expect(
            client.query('SELECT id FROM genealogical_dates WHERE id = $1', [initialDateId]),
        ).resolves.toMatchObject({ rowCount: 0 });

        const clearedPerson = await repository.update({
            ...replacedPerson,
            birthDate: null,
        });
        const { rows: remainingDates } = await client.query<{ id: string }>(
            'SELECT id FROM genealogical_dates',
        );

        expect(clearedPerson.birthDate).toBeNull();
        expect(remainingDates).toEqual([]);
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
