import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../../../src/app.js';
import { loadConfig } from '../../../../src/config/env.js';
import type { FastifyInstance } from 'fastify';
import type { CreatePersonDto } from '../../../../src/modules/people/person.schema.js';
import { LivingStatus } from '../../../../src/modules/people/person.types.js';
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

function expectBadRequest(response: InjectResponse, detail: string): void {
    expect(response.statusCode).toBe(HttpStatus.BadRequest);
    expect(response.headers['content-type']).toContain(MediaType.ProblemJson);
    expect(response.json()).toMatchObject({
        type: 'about:blank',
        title: 'Bad Request',
        status: HttpStatus.BadRequest,
        detail,
        requestId: expect.any(String),
    });
}

describe('PersonRoute integration', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        const config = loadConfig();

        assertTestDatabase(config.databaseUrl);

        app = buildApp({ config });
        await app.ready();
    });

    beforeEach(async () => {
        await app.pg.query('TRUNCATE TABLE persons');
    });

    afterAll(async () => {
        await app.pg.query('TRUNCATE TABLE persons');
        await app.close();
    });

    it('creates a person successfully', async () => {
        const personInput: CreatePersonDto = {
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
        };

        const response = await app.inject({
            method: 'POST',
            url: '/people',
            payload: personInput,
        });

        expect(response.statusCode).toBe(HttpStatus.Created);
        expect(response.json()).toMatchObject({
            ...personInput,
            id: expect.any(String),
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
        });
    });

    it('creates a person with database defaults', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/people',
            payload: {
                firstName: 'Alice',
            },
        });

        expect(response.statusCode).toBe(HttpStatus.Created);
        expect(response.json()).toEqual({
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
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
        });
    });

    it('creates a person identified only by a birth name', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/people',
            payload: {
                birthName: ' Durand ',
            },
        });

        expect(response.statusCode).toBe(HttpStatus.Created);
        expect(response.json()).toMatchObject({
            firstName: null,
            lastName: null,
            birthName: 'Durand',
        });
    });

    it('rejects a person without an identifying name', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/people',
            payload: {
                middleNames: 'Louise',
            },
        });

        expectBadRequest(response, 'At least one name is required.');
    });

    it('rejects an identifying name containing only whitespace', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/people',
            payload: {
                firstName: '   ',
            },
        });

        expectBadRequest(response, 'At least one name is required.');
    });

    it('rejects a death date earlier than the birth date', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/people',
            payload: {
                firstName: 'Alice',
                birthDate: '2000-01-01',
                deathDate: '1990-01-01',
            },
        });

        expectBadRequest(response, 'Death date must not be earlier than birth date.');
    });

    it.each([
        {
            name: 'an unknown property',
            payload: {
                firstName: 'Alice',
                unknownProperty: true,
            },
        },
        {
            name: 'an invalid date',
            payload: {
                firstName: 'Alice',
                birthDate: 'not-a-date',
            },
        },
        {
            name: 'an invalid living status',
            payload: {
                firstName: 'Alice',
                livingStatus: 'missing',
            },
        },
    ])('rejects $name', async ({ payload }) => {
        const response = await app.inject({
            method: 'POST',
            url: '/people',
            payload,
        });

        expectBadRequest(response, 'The request is invalid.');
    });

    it('returns a person by id', async () => {
        const createResponse = await app.inject({
            method: 'POST',
            url: '/people',
            payload: {
                firstName: 'Alice',
                lastName: 'Martin',
            },
        });

        expect(createResponse.statusCode).toBe(HttpStatus.Created);

        const createdPerson = createResponse.json();

        const response = await app.inject({
            method: 'GET',
            url: `/people/${createdPerson.id}`,
        });

        expect(response.statusCode).toBe(HttpStatus.Ok);
        expect(response.json()).toEqual(createdPerson);
    });

    it('returns a paginated collection with multiple sorting criteria', async () => {
        for (const payload of [
            {
                firstName: 'Alice',
                birthDate: '1980-01-01',
            },
            {
                firstName: 'Bob',
                birthDate: '1970-01-01',
            },
            {
                firstName: 'Alice',
                birthDate: '2000-01-01',
            },
        ]) {
            const createResponse = await app.inject({
                method: 'POST',
                url: '/people',
                payload,
            });

            expect(createResponse.statusCode).toBe(HttpStatus.Created);
        }

        const response = await app.inject({
            method: 'GET',
            url: '/people?limit=2&page=1&sort=firstName:ASC&sort=birthDate:DESC',
        });

        expect(response.statusCode).toBe(HttpStatus.Ok);
        expect(response.json()).toMatchObject({
            data: [
                {
                    firstName: 'Alice',
                    birthDate: '2000-01-01',
                },
                {
                    firstName: 'Alice',
                    birthDate: '1980-01-01',
                },
            ],
            pagination: {
                page: 1,
                limit: 2,
                totalItems: 3,
                totalPages: 2,
            },
        });
    });

    it('returns an empty collection and caps the requested limit', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/people?limit=500',
        });

        expect(response.statusCode).toBe(HttpStatus.Ok);
        expect(response.json()).toEqual({
            data: [],
            pagination: {
                page: 1,
                limit: 100,
                totalItems: 0,
                totalPages: 0,
            },
        });
    });

    it.each([
        {
            name: 'a limit below one',
            querystring: 'limit=0',
        },
        {
            name: 'a page below one',
            querystring: 'page=0',
        },
        {
            name: 'an unknown sort',
            querystring: 'sort=lastName:ASC',
        },
    ])('rejects $name', async ({ querystring }) => {
        const response = await app.inject({
            method: 'GET',
            url: `/people?${querystring}`,
        });

        expectBadRequest(response, 'The request is invalid.');
    });

    it('rejects multiple sort directions for the same field', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/people?sort=firstName:ASC&sort=firstName:DESC',
        });

        expectBadRequest(response, 'The "firstName" field can only be sorted once.');
    });

    it('rejects an invalid person id', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/people/not-a-uuid',
        });

        expectBadRequest(response, 'The request is invalid.');
    });

    it('returns problem details when a person does not exist', async () => {
        const response = await app.inject({
            method: 'GET',
            url: `/people/${randomUUID()}`,
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
});
