import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PersonRepository } from '../../../../src/modules/people/person.repository.js';
import { CoupleRelationshipEventRepository } from '../../../../src/modules/relationships/couple-relationship-event.repository.js';
import { CoupleRelationshipNotFoundError } from '../../../../src/modules/relationships/couple-relationship.error.js';
import { CoupleRelationshipRepository } from '../../../../src/modules/relationships/couple-relationship.repository.js';
import { CoupleRelationshipEventType } from '../../../../src/modules/relationships/couple-relationship.types.js';
import { exactGregorianDate } from '../../../fixtures/genealogical-date.js';

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

describe('CoupleRelationshipEventRepository integration', () => {
    let pool: Pool;
    let client: PoolClient;
    let personRepository: PersonRepository;
    let relationshipRepository: CoupleRelationshipRepository;
    let eventRepository: CoupleRelationshipEventRepository;

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
        eventRepository = new CoupleRelationshipEventRepository(client);
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

    async function createRelationship(): Promise<{ id: string; partner2Id: string }> {
        const alice = await personRepository.create({ firstName: 'Alice' });
        const bob = await personRepository.create({ firstName: 'Bob' });
        const relationship = await relationshipRepository.create({
            partner1Id: alice.id,
            partner2Id: bob.id,
        });

        return {
            id: relationship.id,
            partner2Id: bob.id,
        };
    }

    it('creates and finds an event with a structured date', async () => {
        const relationship = await createRelationship();
        const date = exactGregorianDate(2000, 6, 10);

        const created = await eventRepository.create(relationship.id, {
            eventType: CoupleRelationshipEventType.Marriage,
            date,
            place: 'Paris',
            description: 'Civil ceremony',
        });

        expect(created).toEqual({
            id: expect.any(String),
            coupleRelationshipId: relationship.id,
            eventType: CoupleRelationshipEventType.Marriage,
            date,
            place: 'Paris',
            description: 'Civil ceremony',
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
        });
        await expect(eventRepository.findById(created.id)).resolves.toEqual(created);
    });

    it('rejects an event for an unavailable relationship', async () => {
        await expect(
            eventRepository.create(randomUUID(), {
                eventType: CoupleRelationshipEventType.Other,
            }),
        ).rejects.toBeInstanceOf(CoupleRelationshipNotFoundError);

        const relationship = await createRelationship();
        await personRepository.deleteById(relationship.partner2Id);

        await expect(
            eventRepository.create(relationship.id, {
                eventType: CoupleRelationshipEventType.Other,
            }),
        ).rejects.toBeInstanceOf(CoupleRelationshipNotFoundError);
    });

    it('returns a paginated event list', async () => {
        const relationship = await createRelationship();
        const events = [];

        for (const eventType of [
            CoupleRelationshipEventType.Engagement,
            CoupleRelationshipEventType.Marriage,
            CoupleRelationshipEventType.Divorce,
        ]) {
            events.push(await eventRepository.create(relationship.id, { eventType }));
        }

        const firstPage = await eventRepository.findByRelationshipId(relationship.id, 2, 1);
        const secondPage = await eventRepository.findByRelationshipId(relationship.id, 2, 2);

        expect(firstPage?.totalItems).toBe(3);
        expect(firstPage?.data).toHaveLength(2);
        expect(secondPage?.totalItems).toBe(3);
        expect(secondPage?.data).toHaveLength(1);
        expect(
            [...(firstPage?.data ?? []), ...(secondPage?.data ?? [])].map(({ id }) => id),
        ).toEqual(expect.arrayContaining(events.map(({ id }) => id)));
    });

    it('updates fields while preserving an unchanged date', async () => {
        const relationship = await createRelationship();
        const created = await eventRepository.create(relationship.id, {
            eventType: CoupleRelationshipEventType.Marriage,
            date: exactGregorianDate(2000, 6, 10),
            place: 'Paris',
        });
        const { rows: initialRows } = await client.query<{ date_id: string }>(
            'SELECT date_id FROM couple_relationship_events WHERE id = $1',
            [created.id],
        );

        const updated = await eventRepository.update(created.id, {
            place: 'Lyon',
            description: 'Updated description',
        });
        const { rows: updatedRows } = await client.query<{ date_id: string }>(
            'SELECT date_id FROM couple_relationship_events WHERE id = $1',
            [created.id],
        );

        expect(updated).toEqual({
            ...created,
            place: 'Lyon',
            description: 'Updated description',
            updatedAt: expect.any(Date),
        });
        expect(updatedRows[0]?.date_id).toBe(initialRows[0]?.date_id);
    });

    it('replaces and removes an owned structured date', async () => {
        const relationship = await createRelationship();
        const created = await eventRepository.create(relationship.id, {
            eventType: CoupleRelationshipEventType.Marriage,
            date: exactGregorianDate(2000, 6, 10),
        });
        const { rows: initialRows } = await client.query<{ date_id: string }>(
            'SELECT date_id FROM couple_relationship_events WHERE id = $1',
            [created.id],
        );
        const initialDateId = initialRows[0]?.date_id;
        const replacement = exactGregorianDate(2001);

        const replaced = await eventRepository.update(created.id, {
            date: replacement,
        });
        const { rows: replacementRows } = await client.query<{ date_id: string }>(
            'SELECT date_id FROM couple_relationship_events WHERE id = $1',
            [created.id],
        );

        expect(replaced?.date).toEqual(replacement);
        expect(replacementRows[0]?.date_id).not.toBe(initialDateId);
        await expect(
            client.query('SELECT id FROM genealogical_dates WHERE id = $1', [initialDateId]),
        ).resolves.toMatchObject({ rowCount: 0 });

        const cleared = await eventRepository.update(created.id, { date: null });
        const { rows: remainingDates } = await client.query<{ id: string }>(
            'SELECT id FROM genealogical_dates',
        );

        expect(cleared?.date).toBeNull();
        expect(remainingDates).toEqual([]);
    });

    it('returns null for unavailable events and relationships', async () => {
        await expect(eventRepository.findById(randomUUID())).resolves.toBeNull();
        await expect(eventRepository.update(randomUUID(), { place: 'Paris' })).resolves.toBeNull();
        await expect(eventRepository.findByRelationshipId(randomUUID(), 20, 1)).resolves.toBeNull();
    });

    it('hides events when a partner is soft deleted', async () => {
        const relationship = await createRelationship();
        const event = await eventRepository.create(relationship.id, {
            eventType: CoupleRelationshipEventType.Other,
        });

        await personRepository.deleteById(relationship.partner2Id);

        await expect(eventRepository.findById(event.id)).resolves.toBeNull();
        await expect(
            eventRepository.findByRelationshipId(relationship.id, 20, 1),
        ).resolves.toBeNull();
        await expect(eventRepository.update(event.id, { place: 'Paris' })).resolves.toBeNull();
    });
});
