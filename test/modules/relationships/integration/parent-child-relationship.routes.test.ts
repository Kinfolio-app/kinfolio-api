import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../../../src/app.js';
import { loadConfig } from '../../../../src/config/env.js';
import {
    ParentChildRelationshipEvidenceStatus,
    ParentChildRelationshipType,
} from '../../../../src/modules/relationships/parent-child-relationship.types.js';
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

describe('ParentChildRelationshipRoute integration', () => {
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
        parentId: string,
        childId: string,
        relationshipType?: ParentChildRelationshipType,
        evidenceStatus?: ParentChildRelationshipEvidenceStatus,
    ): Promise<InjectResponse> {
        return app.inject({
            method: 'POST',
            url: '/parent-child-relationships',
            payload: {
                parentId,
                childId,
                ...(relationshipType === undefined ? {} : { relationshipType }),
                ...(evidenceStatus === undefined ? {} : { evidenceStatus }),
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
        await app.pg.query('TRUNCATE TABLE parent_child_relationships, persons');
    });

    afterAll(async () => {
        await app.pg.query('TRUNCATE TABLE parent_child_relationships, persons');
        await app.close();
    });

    it.each([
        ParentChildRelationshipEvidenceStatus.Proven,
        ParentChildRelationshipEvidenceStatus.Challenged,
    ])(
        'creates and returns a parent-child relationship with %s evidence',
        async (evidenceStatus) => {
            const parent = await createPerson('Alice');
            const child = await createPerson('Bob');

            const createResponse = await createRelationship(
                parent.id,
                child.id,
                ParentChildRelationshipType.Biological,
                evidenceStatus,
            );

            expect(createResponse.statusCode).toBe(HttpStatus.Created);
            expect(createResponse.json()).toEqual({
                id: expect.any(String),
                parentId: parent.id,
                childId: child.id,
                relationshipType: ParentChildRelationshipType.Biological,
                evidenceStatus,
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
            });

            const relationship = createResponse.json();
            const getResponse = await app.inject({
                method: 'GET',
                url: `/parent-child-relationships/${relationship.id}`,
            });

            expect(getResponse.statusCode).toBe(HttpStatus.Ok);
            expect(getResponse.json()).toEqual(relationship);
        },
    );

    it('uses unspecified and unassessed as defaults', async () => {
        const parent = await createPerson('Alice');
        const child = await createPerson('Bob');

        const response = await createRelationship(parent.id, child.id);

        expect(response.statusCode).toBe(HttpStatus.Created);
        expect(response.json()).toMatchObject({
            relationshipType: ParentChildRelationshipType.Unspecified,
            evidenceStatus: ParentChildRelationshipEvidenceStatus.Unassessed,
        });
    });

    it('lists the direct relationships of a person with pagination', async () => {
        const person = await createPerson('Alice');
        const parent = await createPerson('Diane');
        const child = await createPerson('Bob');

        await createRelationship(parent.id, person.id, ParentChildRelationshipType.Adoptive);
        await createRelationship(person.id, child.id, ParentChildRelationshipType.Biological);

        const response = await app.inject({
            method: 'GET',
            url: `/people/${person.id}/parent-child-relationships`,
        });

        expect(response.statusCode).toBe(HttpStatus.Ok);
        expect(response.json()).toMatchObject({
            data: expect.arrayContaining([
                expect.objectContaining({
                    parentId: parent.id,
                    childId: person.id,
                    relationshipType: ParentChildRelationshipType.Adoptive,
                }),
                expect.objectContaining({
                    parentId: person.id,
                    childId: child.id,
                    relationshipType: ParentChildRelationshipType.Biological,
                }),
            ]),
            pagination: {
                page: 1,
                limit: 20,
                totalItems: 2,
                totalPages: 1,
            },
        });
    });

    it('returns not found when a related person does not exist', async () => {
        const parent = await createPerson('Alice');

        const response = await createRelationship(parent.id, randomUUID());

        expectProblem(
            response,
            HttpStatus.NotFound,
            'Not Found',
            'The parent or child does not exist.',
        );
    });

    it('rejects a self relationship', async () => {
        const person = await createPerson('Alice');

        const response = await createRelationship(person.id, person.id);

        expectProblem(
            response,
            HttpStatus.Conflict,
            'Conflict',
            'A person cannot be their own parent.',
        );
    });

    it('rejects a duplicate relationship', async () => {
        const parent = await createPerson('Alice');
        const child = await createPerson('Bob');

        await createRelationship(parent.id, child.id);
        const response = await createRelationship(
            parent.id,
            child.id,
            ParentChildRelationshipType.Adoptive,
        );

        expectProblem(
            response,
            HttpStatus.Conflict,
            'Conflict',
            'This parent-child relationship already exists.',
        );
    });

    it('rejects a relationship that would create an indirect cycle', async () => {
        const alice = await createPerson('Alice');
        const bob = await createPerson('Bob');
        const charlie = await createPerson('Charlie');

        await createRelationship(alice.id, bob.id);
        await createRelationship(bob.id, charlie.id);
        const response = await createRelationship(charlie.id, alice.id);

        expectProblem(
            response,
            HttpStatus.Conflict,
            'Conflict',
            'This parent-child relationship would create a cycle.',
        );
        const { rows } = await app.pg.query<{ count: number }>(
            'SELECT COUNT(*)::integer AS count FROM parent_child_relationships',
        );
        expect(rows[0]?.count).toBe(2);
    });

    it('serializes concurrent creations that would form a cycle', async () => {
        const alice = await createPerson('Alice');
        const bob = await createPerson('Bob');

        const responses = await Promise.all([
            createRelationship(alice.id, bob.id),
            createRelationship(bob.id, alice.id),
        ]);

        expect(responses.map(({ statusCode }) => statusCode).sort()).toEqual([
            HttpStatus.Created,
            HttpStatus.Conflict,
        ]);
        const conflictResponse = responses.find(
            ({ statusCode }) => statusCode === HttpStatus.Conflict,
        );
        expect(conflictResponse).toBeDefined();
        expect(conflictResponse?.json()).toMatchObject({
            detail: 'This parent-child relationship would create a cycle.',
        });
    });

    it('hides a relationship when one of its people is soft deleted', async () => {
        const parent = await createPerson('Alice');
        const child = await createPerson('Bob');
        const createResponse = await createRelationship(parent.id, child.id);
        const relationship = createResponse.json();

        const deleteResponse = await app.inject({
            method: 'DELETE',
            url: `/people/${child.id}`,
        });
        const getResponse = await app.inject({
            method: 'GET',
            url: `/parent-child-relationships/${relationship.id}`,
        });
        const listResponse = await app.inject({
            method: 'GET',
            url: `/people/${parent.id}/parent-child-relationships`,
        });

        expect(deleteResponse.statusCode).toBe(HttpStatus.NoContent);
        expectProblem(
            getResponse,
            HttpStatus.NotFound,
            'Not Found',
            'The requested parent-child relationship does not exist.',
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
            url: `/people/${randomUUID()}/parent-child-relationships`,
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
            name: 'an invalid relationship type',
            payload: {
                parentId: randomUUID(),
                childId: randomUUID(),
                relationshipType: 'missing',
            },
        },
        {
            name: 'an invalid evidence status',
            payload: {
                parentId: randomUUID(),
                childId: randomUUID(),
                evidenceStatus: 'missing',
            },
        },
        {
            name: 'an invalid parent id',
            payload: {
                parentId: 'not-a-uuid',
                childId: randomUUID(),
            },
        },
        {
            name: 'an unknown property',
            payload: {
                parentId: randomUUID(),
                childId: randomUUID(),
                unknownProperty: true,
            },
        },
    ])('rejects $name', async ({ payload }) => {
        const response = await app.inject({
            method: 'POST',
            url: '/parent-child-relationships',
            payload,
        });

        expectProblem(response, HttpStatus.BadRequest, 'Bad Request', 'The request is invalid.');
    });
});
