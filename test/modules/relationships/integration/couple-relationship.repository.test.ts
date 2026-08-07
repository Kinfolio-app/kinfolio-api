import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
    CoupleRelationshipPersonNotFoundError,
    SelfCoupleRelationshipError,
} from '../../../../src/modules/relationships/couple-relationship.error.js';
import { CoupleRelationshipRepository } from '../../../../src/modules/relationships/couple-relationship.repository.js';
import { PersonRepository } from '../../../../src/modules/people/person.repository.js';

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

describe('CoupleRelationshipRepository integration', () => {
    let pool: Pool;
    let client: PoolClient;
    let personRepository: PersonRepository;
    let relationshipRepository: CoupleRelationshipRepository;

    beforeAll(async () => {
        pool = new Pool({
            connectionString: getTestDatabaseUrl(),
        });

        await pool.query('SELECT 1');
    });

    beforeEach(async () => {
        client = await pool.connect();
        await client.query('BEGIN');

        personRepository = new PersonRepository(client);
        relationshipRepository = new CoupleRelationshipRepository(client);
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

    it('creates a relationship with canonically ordered partners', async () => {
        const alice = await personRepository.create({ firstName: 'Alice' });
        const bob = await personRepository.create({ firstName: 'Bob' });
        const [partner1Id, partner2Id] = [alice.id, bob.id].sort();

        const relationship = await relationshipRepository.create({
            partner1Id: partner2Id,
            partner2Id: partner1Id,
        });

        expect(relationship).toEqual({
            id: expect.any(String),
            partner1Id,
            partner2Id,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
        });
    });

    it('allows several relationships between the same partners', async () => {
        const alice = await personRepository.create({ firstName: 'Alice' });
        const bob = await personRepository.create({ firstName: 'Bob' });

        const first = await relationshipRepository.create({
            partner1Id: alice.id,
            partner2Id: bob.id,
        });
        const second = await relationshipRepository.create({
            partner1Id: bob.id,
            partner2Id: alice.id,
        });

        expect(second.id).not.toBe(first.id);
        expect(second.partner1Id).toBe(first.partner1Id);
        expect(second.partner2Id).toBe(first.partner2Id);
    });

    it('rejects a relationship with the same person as both partners', async () => {
        const person = await personRepository.create({ firstName: 'Alice' });

        await expect(
            relationshipRepository.create({
                partner1Id: person.id,
                partner2Id: person.id,
            }),
        ).rejects.toBeInstanceOf(SelfCoupleRelationshipError);
    });

    it('rejects an unavailable partner', async () => {
        const person = await personRepository.create({ firstName: 'Alice' });

        await expect(
            relationshipRepository.create({
                partner1Id: person.id,
                partner2Id: randomUUID(),
            }),
        ).rejects.toBeInstanceOf(CoupleRelationshipPersonNotFoundError);

        await personRepository.deleteById(person.id);

        await expect(
            relationshipRepository.create({
                partner1Id: person.id,
                partner2Id: randomUUID(),
            }),
        ).rejects.toBeInstanceOf(CoupleRelationshipPersonNotFoundError);
    });

    it('finds a relationship by id', async () => {
        const alice = await personRepository.create({ firstName: 'Alice' });
        const bob = await personRepository.create({ firstName: 'Bob' });
        const created = await relationshipRepository.create({
            partner1Id: alice.id,
            partner2Id: bob.id,
        });

        await expect(relationshipRepository.findById(created.id)).resolves.toEqual(created);
        await expect(relationshipRepository.findById(randomUUID())).resolves.toBeNull();
    });

    it('returns a paginated relationship list from either partner position', async () => {
        const person = await personRepository.create({ firstName: 'Alice' });
        const partners = [];

        for (const firstName of ['Bob', 'Charlie', 'Diane']) {
            partners.push(await personRepository.create({ firstName }));
        }
        const relationships = [];

        for (const [index, partner] of partners.entries()) {
            relationships.push(
                await relationshipRepository.create({
                    partner1Id: index % 2 === 0 ? person.id : partner.id,
                    partner2Id: index % 2 === 0 ? partner.id : person.id,
                }),
            );
        }

        const firstPage = await relationshipRepository.findByPersonId(person.id, 2, 1);
        const secondPage = await relationshipRepository.findByPersonId(person.id, 2, 2);

        expect(firstPage?.totalItems).toBe(3);
        expect(firstPage?.data).toHaveLength(2);
        expect(secondPage?.totalItems).toBe(3);
        expect(secondPage?.data).toHaveLength(1);
        expect(
            [...(firstPage?.data ?? []), ...(secondPage?.data ?? [])].map(({ id }) => id),
        ).toEqual(expect.arrayContaining(relationships.map(({ id }) => id)));
    });

    it('hides relationships involving a soft-deleted person', async () => {
        const alice = await personRepository.create({ firstName: 'Alice' });
        const bob = await personRepository.create({ firstName: 'Bob' });
        const relationship = await relationshipRepository.create({
            partner1Id: alice.id,
            partner2Id: bob.id,
        });

        await personRepository.deleteById(bob.id);

        await expect(relationshipRepository.findById(relationship.id)).resolves.toBeNull();
        await expect(relationshipRepository.findByPersonId(alice.id, 20, 1)).resolves.toEqual({
            data: [],
            totalItems: 0,
        });
        await expect(relationshipRepository.findByPersonId(bob.id, 20, 1)).resolves.toBeNull();
    });

    it('returns null when listing relationships for an unknown person', async () => {
        await expect(
            relationshipRepository.findByPersonId(randomUUID(), 20, 1),
        ).resolves.toBeNull();
    });
});
