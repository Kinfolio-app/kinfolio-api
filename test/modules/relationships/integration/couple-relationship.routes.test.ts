import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../../../src/app.js';
import { loadConfig } from '../../../../src/config/env.js';
import { HttpStatus } from '../../../../src/shared/http/http-status.js';
import { MediaType } from '../../../../src/shared/http/media-type.js';

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

describe('CoupleRelationshipRoute integration', () => {
    let app: FastifyInstance;

    async function createPerson(firstName: string): Promise<{ id: string }> {
        const response = await app.inject({
            method: 'POST',
            url: '/people',
            payload: {
                firstName,
            },
        });

        expect(response.statusCode).toBe(HttpStatus.Created);

        return response.json();
    }

    async function createRelationship(
        partner1Id: string,
        partner2Id: string,
    ): Promise<InjectResponse> {
        return app.inject({
            method: 'POST',
            url: '/couple-relationships',
            payload: {
                partner1Id,
                partner2Id,
            },
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

    it('creates and returns a canonically ordered couple relationship', async () => {
        const alice = await createPerson('Alice');
        const bob = await createPerson('Bob');
        const [partner1Id, partner2Id] = [alice.id, bob.id].sort();

        const createResponse = await createRelationship(partner2Id, partner1Id);

        expect(createResponse.statusCode).toBe(HttpStatus.Created);
        expect(createResponse.json()).toEqual({
            id: expect.any(String),
            partner1Id,
            partner2Id,
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
        });

        const relationship = createResponse.json();
        const getResponse = await app.inject({
            method: 'GET',
            url: `/couple-relationships/${relationship.id}`,
        });

        expect(getResponse.statusCode).toBe(HttpStatus.Ok);
        expect(getResponse.json()).toEqual(relationship);
    });

    it('lists a person couple relationships with pagination', async () => {
        const person = await createPerson('Alice');
        const partners = [];

        for (const firstName of ['Bob', 'Charlie', 'Diane']) {
            partners.push(await createPerson(firstName));
        }

        for (const [index, partner] of partners.entries()) {
            const response = await createRelationship(
                index % 2 === 0 ? person.id : partner.id,
                index % 2 === 0 ? partner.id : person.id,
            );

            expect(response.statusCode).toBe(HttpStatus.Created);
        }

        const response = await app.inject({
            method: 'GET',
            url: `/people/${person.id}/couple-relationships?limit=2&page=2`,
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

    it('returns not found when a partner does not exist', async () => {
        const person = await createPerson('Alice');

        const response = await createRelationship(person.id, randomUUID());

        expectProblem(
            response,
            HttpStatus.NotFound,
            'Not Found',
            'One or both partners do not exist or are deleted.',
        );
    });

    it('rejects a self relationship', async () => {
        const person = await createPerson('Alice');

        const response = await createRelationship(person.id, person.id);

        expectProblem(
            response,
            HttpStatus.Conflict,
            'Conflict',
            'A person cannot be their own partner.',
        );
    });

    it('returns not found when a relationship does not exist', async () => {
        const response = await app.inject({
            method: 'GET',
            url: `/couple-relationships/${randomUUID()}`,
        });

        expectProblem(
            response,
            HttpStatus.NotFound,
            'Not Found',
            'The requested couple relationship does not exist.',
        );
    });

    it('hides a relationship when a partner is soft deleted', async () => {
        const alice = await createPerson('Alice');
        const bob = await createPerson('Bob');
        const createResponse = await createRelationship(alice.id, bob.id);
        const relationship = createResponse.json();

        const deleteResponse = await app.inject({
            method: 'DELETE',
            url: `/people/${bob.id}`,
        });
        const getResponse = await app.inject({
            method: 'GET',
            url: `/couple-relationships/${relationship.id}`,
        });
        const listResponse = await app.inject({
            method: 'GET',
            url: `/people/${alice.id}/couple-relationships`,
        });

        expect(deleteResponse.statusCode).toBe(HttpStatus.NoContent);
        expectProblem(
            getResponse,
            HttpStatus.NotFound,
            'Not Found',
            'The requested couple relationship does not exist.',
        );
        expect(listResponse.statusCode).toBe(HttpStatus.Ok);
        expect(listResponse.json()).toEqual({
            data: [],
            pagination: {
                page: 1,
                limit: 20,
                totalItems: 0,
                totalPages: 0,
            },
        });
    });

    it('returns not found when listing relationships for an unavailable person', async () => {
        const response = await app.inject({
            method: 'GET',
            url: `/people/${randomUUID()}/couple-relationships`,
        });

        expectProblem(
            response,
            HttpStatus.NotFound,
            'Not Found',
            'The requested person does not exist.',
        );
    });

    it.each([
        {
            name: 'an invalid partner id',
            method: 'POST',
            url: '/couple-relationships',
            payload: {
                partner1Id: 'not-a-uuid',
                partner2Id: randomUUID(),
            },
        },
        {
            name: 'an unknown property',
            method: 'POST',
            url: '/couple-relationships',
            payload: {
                partner1Id: randomUUID(),
                partner2Id: randomUUID(),
                unknownProperty: true,
            },
        },
        {
            name: 'an invalid page',
            method: 'GET',
            url: `/people/${randomUUID()}/couple-relationships?page=0`,
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
