import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../../../src/app.js';
import { loadConfig } from '../../../../src/config/env.js';
import {
    FamilyTreeTruncationReason,
    TreeDirection,
} from '../../../../src/modules/family-tree/family-tree.types.js';
import { ParentChildRelationshipType } from '../../../../src/modules/relationships/parent-child-relationship.types.js';
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

function expectBadRequest(response: InjectResponse): void {
    expect(response.statusCode).toBe(HttpStatus.BadRequest);
    expect(response.headers['content-type']).toContain(MediaType.ProblemJson);
    expect(response.json()).toMatchObject({
        type: 'about:blank',
        title: 'Bad Request',
        status: HttpStatus.BadRequest,
        requestId: expect.any(String),
    });
}

describe('FamilyTreeRoute integration', () => {
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

    async function createRelationship(parentId: string, childId: string): Promise<void> {
        const response = await app.inject({
            method: 'POST',
            url: '/parent-child-relationships',
            payload: {
                parentId,
                childId,
                relationshipType: ParentChildRelationshipType.Biological,
            },
        });

        expect(response.statusCode).toBe(HttpStatus.Created);
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

    it('returns ancestors with the default traversal options', async () => {
        const grandparent = await createPerson('Diane');
        const parent = await createPerson('Bob');
        const root = await createPerson('Alice');

        await createRelationship(grandparent.id, parent.id);
        await createRelationship(parent.id, root.id);

        const response = await app.inject({
            method: 'GET',
            url: `/people/${root.id}/family-tree`,
        });
        const body = response.json();

        expect(response.statusCode).toBe(HttpStatus.Ok);
        expect(body).toMatchObject({
            rootPersonId: root.id,
            people: expect.arrayContaining([
                expect.objectContaining({ id: root.id, firstName: 'Alice' }),
                expect.objectContaining({ id: parent.id, firstName: 'Bob' }),
                expect.objectContaining({ id: grandparent.id, firstName: 'Diane' }),
            ]),
            relationships: expect.arrayContaining([
                expect.objectContaining({
                    parentId: parent.id,
                    childId: root.id,
                    relationshipType: ParentChildRelationshipType.Biological,
                }),
                expect.objectContaining({
                    parentId: grandparent.id,
                    childId: parent.id,
                    relationshipType: ParentChildRelationshipType.Biological,
                }),
            ]),
            traversal: {
                direction: TreeDirection.Ancestors,
                requestedDepth: 3,
                reachedDepth: 2,
                truncated: false,
                truncationReasons: [],
                returnedPeople: 3,
            },
        });
        expect(body.people).toHaveLength(3);
        expect(body.relationships).toHaveLength(2);
    });

    it('supports an explicit bidirectional traversal and depth', async () => {
        const parent = await createPerson('Alice');
        const root = await createPerson('Bob');
        const child = await createPerson('Charlie');
        const grandchild = await createPerson('Diane');

        await createRelationship(parent.id, root.id);
        await createRelationship(root.id, child.id);
        await createRelationship(child.id, grandchild.id);

        const response = await app.inject({
            method: 'GET',
            url: `/people/${root.id}/family-tree?direction=both&depth=1`,
        });
        const body = response.json();

        expect(response.statusCode).toBe(HttpStatus.Ok);
        expect(body.people).toHaveLength(3);
        expect(body.people).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ id: parent.id }),
                expect.objectContaining({ id: root.id }),
                expect.objectContaining({ id: child.id }),
            ]),
        );
        expect(body.relationships).toHaveLength(2);
        expect(body.traversal).toEqual({
            direction: TreeDirection.Both,
            requestedDepth: 1,
            reachedDepth: 1,
            truncated: true,
            truncationReasons: [FamilyTreeTruncationReason.DepthLimit],
            returnedPeople: 3,
        });
    });

    it('returns not found when the root person does not exist', async () => {
        const response = await app.inject({
            method: 'GET',
            url: `/people/${randomUUID()}/family-tree`,
        });

        expect(response.statusCode).toBe(HttpStatus.NotFound);
        expect(response.headers['content-type']).toContain(MediaType.ProblemJson);
        expect(response.json()).toMatchObject({
            type: 'about:blank',
            title: 'Not Found',
            status: HttpStatus.NotFound,
            detail: 'The requested person does not exist.',
            requestId: expect.any(String),
        });
    });

    it.each([
        '/people/4cf44241-0f1b-4e69-b070-d47ee66b7203/family-tree?direction=siblings',
        '/people/4cf44241-0f1b-4e69-b070-d47ee66b7203/family-tree?depth=0',
        '/people/4cf44241-0f1b-4e69-b070-d47ee66b7203/family-tree?depth=11',
    ])('rejects invalid traversal options from %s', async (url) => {
        const response = await app.inject({
            method: 'GET',
            url,
        });

        expectBadRequest(response);
    });
});
