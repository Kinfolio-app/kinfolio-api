import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../../../src/app.js';
import { loadConfig } from '../../../../src/config/env.js';
import { CoupleRelationshipEventType } from '../../../../src/modules/relationships/couple-relationship.types.js';
import { HttpStatus } from '../../../../src/shared/http/http-status.js';
import { MediaType } from '../../../../src/shared/http/media-type.js';
import { exactGregorianDate } from '../../../fixtures/genealogical-date.js';

const TEST_DATABASE_NAME = 'kinfolio_test';

type InjectResponse = Awaited<ReturnType<FastifyInstance['inject']>>;

function assertTestDatabase(databaseUrl: string): void {
    const url = new URL(databaseUrl);
    const databaseName = decodeURIComponent(url.pathname.slice(1));

    if (databaseName !== TEST_DATABASE_NAME) {
        throw new Error(
            `Integration tests require "${TEST_DATABASE_NAME}", received "${databaseName}".`,
        );
    }
}

function expectProblem(
    response: InjectResponse,
    status: number,
    title: string,
    detail: string,
): void {
    expect(response.statusCode).toBe(status);
    expect(response.headers['content-type']).toContain(MediaType.ProblemJson);
    expect(response.json()).toMatchObject({
        type: 'about:blank',
        title,
        status,
        detail,
        requestId: expect.any(String),
    });
}

describe('CoupleRelationshipEventRoute integration', () => {
    let app: FastifyInstance;

    async function createPerson(firstName: string): Promise<{ id: string }> {
        const response = await app.inject({
            method: 'POST',
            url: '/people',
            payload: { firstName },
        });

        expect(response.statusCode).toBe(HttpStatus.Created);

        return response.json();
    }

    async function createRelationship(): Promise<{
        id: string;
        partner1Id: string;
        partner2Id: string;
    }> {
        const alice = await createPerson('Alice');
        const bob = await createPerson('Bob');
        const response = await app.inject({
            method: 'POST',
            url: '/couple-relationships',
            payload: {
                partner1Id: alice.id,
                partner2Id: bob.id,
            },
        });

        expect(response.statusCode).toBe(HttpStatus.Created);

        return response.json();
    }

    async function createEvent(
        relationshipId: string,
        eventType: CoupleRelationshipEventType = CoupleRelationshipEventType.Other,
    ): Promise<InjectResponse> {
        return app.inject({
            method: 'POST',
            url: `/couple-relationships/${relationshipId}/events`,
            payload: { eventType },
        });
    }

    beforeAll(async () => {
        const config = loadConfig();

        assertTestDatabase(config.databaseUrl);

        app = buildApp({ config });
        await app.ready();
    });

    beforeEach(async () => {
        await app.pg.query(
            'TRUNCATE TABLE couple_relationship_events, couple_relationships, parent_child_relationships, persons, genealogical_dates',
        );
    });

    afterAll(async () => {
        await app.pg.query(
            'TRUNCATE TABLE couple_relationship_events, couple_relationships, parent_child_relationships, persons, genealogical_dates',
        );
        await app.close();
    });

    it('creates and returns an event with a structured date', async () => {
        const relationship = await createRelationship();
        const date = exactGregorianDate(2000, 6, 10);
        const createResponse = await app.inject({
            method: 'POST',
            url: `/couple-relationships/${relationship.id}/events`,
            payload: {
                eventType: CoupleRelationshipEventType.Marriage,
                date,
                place: ' Paris ',
                description: ' Civil ceremony ',
            },
        });

        expect(createResponse.statusCode).toBe(HttpStatus.Created);
        expect(createResponse.json()).toEqual({
            id: expect.any(String),
            coupleRelationshipId: relationship.id,
            eventType: CoupleRelationshipEventType.Marriage,
            date,
            place: 'Paris',
            description: 'Civil ceremony',
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
        });

        const event = createResponse.json();
        const getResponse = await app.inject({
            method: 'GET',
            url: `/couple-relationship-events/${event.id}`,
        });

        expect(getResponse.statusCode).toBe(HttpStatus.Ok);
        expect(getResponse.json()).toEqual(event);
    });

    it('lists relationship events with pagination', async () => {
        const relationship = await createRelationship();

        for (const eventType of [
            CoupleRelationshipEventType.Engagement,
            CoupleRelationshipEventType.Marriage,
            CoupleRelationshipEventType.Divorce,
        ]) {
            const response = await createEvent(relationship.id, eventType);
            expect(response.statusCode).toBe(HttpStatus.Created);
        }

        const response = await app.inject({
            method: 'GET',
            url: `/couple-relationships/${relationship.id}/events?limit=2&page=2`,
        });

        expect(response.statusCode).toBe(HttpStatus.Ok);
        expect(response.json()).toMatchObject({
            data: [expect.objectContaining({ id: expect.any(String) })],
            pagination: {
                page: 2,
                limit: 2,
                totalItems: 3,
                totalPages: 2,
            },
        });
    });

    it('updates and clears event fields', async () => {
        const relationship = await createRelationship();
        const createResponse = await app.inject({
            method: 'POST',
            url: `/couple-relationships/${relationship.id}/events`,
            payload: {
                eventType: CoupleRelationshipEventType.Marriage,
                date: exactGregorianDate(2000),
                place: 'Paris',
            },
        });
        const event = createResponse.json();

        const updateResponse = await app.inject({
            method: 'PATCH',
            url: `/couple-relationship-events/${event.id}`,
            payload: {
                eventType: CoupleRelationshipEventType.Divorce,
                date: null,
                place: null,
                description: ' Final judgment ',
            },
        });

        expect(updateResponse.statusCode).toBe(HttpStatus.Ok);
        expect(updateResponse.json()).toEqual({
            ...event,
            eventType: CoupleRelationshipEventType.Divorce,
            date: null,
            place: null,
            description: 'Final judgment',
            updatedAt: expect.any(String),
        });
    });

    it('returns not found for an unavailable relationship', async () => {
        const relationshipId = randomUUID();
        const createResponse = await createEvent(relationshipId);
        const listResponse = await app.inject({
            method: 'GET',
            url: `/couple-relationships/${relationshipId}/events`,
        });

        for (const response of [createResponse, listResponse]) {
            expectProblem(
                response,
                HttpStatus.NotFound,
                'Not Found',
                'The requested couple relationship does not exist.',
            );
        }
    });

    it('returns not found for an unavailable event', async () => {
        const eventId = randomUUID();
        const getResponse = await app.inject({
            method: 'GET',
            url: `/couple-relationship-events/${eventId}`,
        });
        const updateResponse = await app.inject({
            method: 'PATCH',
            url: `/couple-relationship-events/${eventId}`,
            payload: { place: 'Paris' },
        });

        for (const response of [getResponse, updateResponse]) {
            expectProblem(
                response,
                HttpStatus.NotFound,
                'Not Found',
                'The requested couple relationship event does not exist.',
            );
        }
    });

    it('hides events when a partner is soft deleted', async () => {
        const relationship = await createRelationship();
        const createResponse = await createEvent(relationship.id);
        const event = createResponse.json();

        const deleteResponse = await app.inject({
            method: 'DELETE',
            url: `/people/${relationship.partner2Id}`,
        });
        const getResponse = await app.inject({
            method: 'GET',
            url: `/couple-relationship-events/${event.id}`,
        });
        const listResponse = await app.inject({
            method: 'GET',
            url: `/couple-relationships/${relationship.id}/events`,
        });

        expect(deleteResponse.statusCode).toBe(HttpStatus.NoContent);
        expectProblem(
            getResponse,
            HttpStatus.NotFound,
            'Not Found',
            'The requested couple relationship event does not exist.',
        );
        expectProblem(
            listResponse,
            HttpStatus.NotFound,
            'Not Found',
            'The requested couple relationship does not exist.',
        );
    });

    it.each([
        {
            name: 'an invalid event type',
            method: 'POST',
            url: `/couple-relationships/${randomUUID()}/events`,
            payload: { eventType: 'missing' },
        },
        {
            name: 'a blank place',
            method: 'POST',
            url: `/couple-relationships/${randomUUID()}/events`,
            payload: {
                eventType: CoupleRelationshipEventType.Other,
                place: '   ',
            },
        },
        {
            name: 'an empty update',
            method: 'PATCH',
            url: `/couple-relationship-events/${randomUUID()}`,
            payload: {},
        },
        {
            name: 'an invalid page',
            method: 'GET',
            url: `/couple-relationships/${randomUUID()}/events?page=0`,
        },
    ])('rejects $name', async ({ method, url, payload }) => {
        const response = await app.inject({
            method,
            url,
            ...(payload === undefined ? {} : { payload }),
        });

        expect(response.statusCode).toBe(HttpStatus.BadRequest);
    });
});
